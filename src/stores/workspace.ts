import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import { useArchiveStore } from "./archive";
import { DEFAULT_QUERY, loadArchiveDataset, queryDataset } from "../lib/dataset";
import { describeArchiveImportFailure } from "../lib/archiveImportFailure";
import type { ArchiveSession } from "../lib/snapArchive";
import type { ArchiveDataset, ArchiveQuery, ReviewDecision, ReviewStatus, AssociationDecision, MediaLink, MediaAsset } from "../types/dataset";

interface ReviewSnapshot {
	decisions: Record<string, ReviewDecision>;
	associations: Record<string, AssociationDecision>;
}

export const useWorkspaceStore = defineStore("workspace", () => {
	const archive = useArchiveStore();
	const baseDataset = shallowRef<ArchiveDataset | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const query = ref<ArchiveQuery>({ ...DEFAULT_QUERY });
	const decisions = ref<Record<string, ReviewDecision>>({});
	const associationDecisions = ref<Record<string, AssociationDecision>>({});
	const reviewRevision = ref(0);
	const queryRevision = ref(0);
	const undoStack = ref<ReviewSnapshot[]>([]);
	const redoStack = ref<ReviewSnapshot[]>([]);
	let generation = 0;
	let controller = new AbortController();
	let loadedSession: ArchiveSession | null = null;
	let pendingSession: ArchiveSession | null = null;
	let pendingLoad: Promise<void> | null = null;

	const effectiveLinks = computed<MediaLink[]>(() => {
		const data = baseDataset.value;
		if (!data) return [];
		const confirmed = new Set(Object.values(associationDecisions.value).filter((decision) => decision.action === "confirm").map((decision) => decision.linkId));
		const chosenAssets = new Map<string, string>();
		for (const link of data.links) if (confirmed.has(link.id)) chosenAssets.set(associationGroup(link), link.assetId);
		return data.links.map((link) => {
			const decision = associationDecisions.value[link.id];
			if (decision?.action === "confirm") return { ...link, status: "confirmed", basis: "The archive owner confirmed this association. The original evidence remains unchanged." };
			if (decision?.action === "reject") return { ...link, status: "unlinked", basis: "The archive owner rejected this candidate association." };
			const chosen = chosenAssets.get(associationGroup(link));
			if (link.status === "ambiguous" && chosen && chosen !== link.assetId) return { ...link, status: "unlinked", basis: "The owner selected a different candidate for this reference." };
			return link;
		});
	});
	const dataset = computed<ArchiveDataset | null>(() => {
		const data = baseDataset.value;
		if (!data) return null;
		const revision = `${data.revision}:review-${reviewRevision.value}`;
		const excludedLayers = new Set(data.assets.flatMap((asset) => asset.role === "overlay" && asset.entryId && decisions.value[asset.id]?.status === "exclude" ? [physicalEntryKey(asset.entryId)] : []));
		const assets = excludedLayers.size ? data.assets.map((asset) => asset.overlayEntryId && excludedLayers.has(physicalEntryKey(asset.overlayEntryId))
			? { ...asset, overlayEntryId: null, overlayPath: null, overlayState: "none" as const }
			: asset) : data.assets;
		if (!Object.keys(associationDecisions.value).length) return { ...data, assets, revision };
		const links = effectiveLinks.value;
		const byEvent = new Map<string, string[]>();
		const byAsset = new Map<string, string[]>();
		const eventMap = new Map(data.events.map((event) => [event.id, event]));
		for (const link of links.filter((link) => link.status === "confirmed")) {
			byEvent.set(link.eventId, [...(byEvent.get(link.eventId) ?? []), link.assetId]);
			const conversationId = eventMap.get(link.eventId)?.conversationId;
			if (conversationId) byAsset.set(link.assetId, [...(byAsset.get(link.assetId) ?? []), conversationId]);
		}
		return { ...data, revision,
			links,
			events: data.events.map((event) => ({ ...event, assetIds: [...new Set(byEvent.get(event.id) ?? [])] })),
			assets: assets.map((asset) => ({ ...asset, conversationIds: [...new Set(byAsset.get(asset.id) ?? [])] })),
		};
	});
	const filtered = computed(() => dataset.value ? queryDataset(dataset.value, query.value, decisions.value) : { events: [], assets: [] });
	const filteredEvents = computed(() => filtered.value.events);
	const filteredAssets = computed(() => filtered.value.assets);
	const selectedEvents = computed(() => filteredEvents.value.filter((event) => decisions.value[event.id]?.status !== "exclude"));
	const selectedAssets = computed(() => {
		const linkedEvents = new Map<string, string[]>();
		for (const link of effectiveLinks.value) if (link.status === "confirmed") linkedEvents.set(link.assetId, [...(linkedEvents.get(link.assetId) ?? []), link.eventId]);
		const authorized = (id: string) => {
			if (decisions.value[id]?.status === "exclude") return false;
			const links = linkedEvents.get(id) ?? [];
			return !links.length || links.some((eventId) => decisions.value[eventId]?.status !== "exclude");
		};
		return filteredAssets.value.filter((asset) => {
			if (!authorized(asset.id)) return false;
			return asset.role !== "overlay" || asset.overlayState !== "resolved" || !asset.baseAssetIds?.length || asset.baseAssetIds.some(authorized);
		});
	});
	const years = computed(() => [...new Set([...(dataset.value?.events ?? []).map((event) => event.year), ...(dataset.value?.assets ?? []).map((asset) => asset.year)].filter((year): year is number => year !== null))].sort((a, b) => a - b));
	const canUndo = computed(() => undoStack.value.length > 0);
	const canRedo = computed(() => redoStack.value.length > 0);

	function setQuery(patch: Partial<ArchiveQuery>) {
		query.value = { ...query.value, ...patch };
		queryRevision.value += 1;
	}
	function resetQuery() { query.value = { ...DEFAULT_QUERY }; queryRevision.value += 1; }
	function snapshot(): ReviewSnapshot { return { decisions: { ...decisions.value }, associations: { ...associationDecisions.value } }; }
	function remember() {
		undoStack.value = [...undoStack.value.slice(-99), snapshot()];
		redoStack.value = [];
	}
	function changed() { reviewRevision.value += 1; }
	function decide(ids: string | string[], status: ReviewStatus | "unreviewed") {
		if (!baseDataset.value) return;
		const valid = new Set([...baseDataset.value.events, ...baseDataset.value.assets].map((item) => item.id));
		const targets = (typeof ids === "string" ? [ids] : [...new Set(ids)]).filter((id) => valid.has(id));
		if (!targets.length) return;
		if (!["keep", "exclude", "later", "unreviewed"].includes(status)) throw new Error("Unsupported review decision.");
		remember();
		const next = { ...decisions.value };
		for (const id of targets) {
			if (status === "unreviewed") delete next[id];
			else next[id] = { status, updatedAt: new Date().toISOString() };
		}
		decisions.value = next;
		changed();
	}
	function decideAssociation(linkId: string, action: "confirm" | "reject" | "undo") {
		const link = baseDataset.value?.links.find((candidate) => candidate.id === linkId);
		if (!link) return;
		if (!["confirm", "reject", "undo"].includes(action)) throw new Error("Unsupported association decision.");
		const next = { ...associationDecisions.value };
		if (action === "undo") delete next[linkId];
		else {
			if (action === "confirm") for (const alternative of baseDataset.value!.links) {
				if (alternative.id !== linkId && associationGroup(alternative) === associationGroup(link) && next[alternative.id]?.action === "confirm") delete next[alternative.id];
			}
			next[linkId] = { linkId, action, updatedAt: new Date().toISOString(), evidenceRevision: baseDataset.value!.revision };
		}
		validateAssociations(baseDataset.value!, next);
		remember();
		associationDecisions.value = next;
		changed();
	}
	function undo() {
		const previous = undoStack.value.pop();
		if (!previous) return;
		redoStack.value.push(snapshot());
		decisions.value = previous.decisions;
		associationDecisions.value = previous.associations;
		changed();
	}
	function redo() {
		const next = redoStack.value.pop();
		if (!next) return;
		undoStack.value.push(snapshot());
		decisions.value = next.decisions;
		associationDecisions.value = next.associations;
		changed();
	}
	function exportReviewState(): string {
		if (!baseDataset.value) throw new Error("Open an archive before saving review decisions.");
		return JSON.stringify({ version: 1, fingerprint: baseDataset.value.fingerprint, normalizationVersion: baseDataset.value.normalizationVersion,
			query: query.value, decisions: decisions.value, associations: associationDecisions.value }, null, 2);
	}
	function restoreReviewState(text: string) {
		if (!baseDataset.value) throw new Error("Open the matching archive before restoring decisions.");
		if (baseDataset.value.identityVerified === false) throw new Error("Source-byte identity has not been verified. Saved decisions cannot safely be restored to this inventory.");
		if (text.length > 10 * 1024 * 1024) throw new Error("This review file exceeds the supported size.");
		const state: unknown = JSON.parse(text);
		if (!isRecord(state) || state.version !== 1 || state.fingerprint !== baseDataset.value.fingerprint || state.normalizationVersion !== baseDataset.value.normalizationVersion) throw new Error("These decisions belong to a different archive or dataset version.");
		if (!isRecord(state.decisions) || !isRecord(state.associations)) throw new Error("This review file is malformed.");
		const ids = new Set([...baseDataset.value.events, ...baseDataset.value.assets].map((item) => item.id));
		const links = new Set(baseDataset.value.links.map((link) => link.id));
		const restored: Record<string, ReviewDecision> = {};
		const restoredAssociations: Record<string, AssociationDecision> = {};
		for (const [id, value] of Object.entries(state.decisions)) {
			if (!ids.has(id) || !isRecord(value) || !isReviewStatus(value.status) || typeof value.updatedAt !== "string") throw new Error("The review file contains an invalid decision target.");
			restored[id] = { status: value.status, updatedAt: value.updatedAt };
		}
		for (const [id, value] of Object.entries(state.associations)) {
			if (!links.has(id) || !isRecord(value) || !["confirm", "reject"].includes(String(value.action)) || typeof value.updatedAt !== "string") throw new Error("The review file contains an invalid association target.");
			if (value.evidenceRevision !== undefined && value.evidenceRevision !== baseDataset.value.revision) throw new Error("This association decision refers to changed evidence.");
			restoredAssociations[id] = { linkId: id, action: value.action as "confirm" | "reject", updatedAt: value.updatedAt, evidenceRevision: baseDataset.value.revision };
		}
		validateAssociations(baseDataset.value, restoredAssociations);
		remember(); decisions.value = restored; associationDecisions.value = restoredAssociations;
		if (isRecord(state.query)) {
			const value = state.query;
			setQuery({
				year: typeof value.year === "number" && years.value.includes(value.year) ? value.year : null,
				participantId: typeof value.participantId === "string" && baseDataset.value.participants.some((person) => person.id === value.participantId) ? value.participantId : null,
				conversationId: typeof value.conversationId === "string" && baseDataset.value.conversations.some((conversation) => conversation.id === value.conversationId) ? value.conversationId : null,
				text: typeof value.text === "string" ? value.text.slice(0, 1000) : "",
				kind: ["all", "text", "image", "video", "audio", "sticker", "gif", "attachment", "unknown"].includes(String(value.kind)) ? value.kind as ArchiveQuery["kind"] : "all",
				review: ["active", "all", "keep", "exclude", "later", "unreviewed"].includes(String(value.review)) ? value.review as ArchiveQuery["review"] : "active",
				linkState: ["all", "confirmed", "inferred", "ambiguous", "unlinked"].includes(String(value.linkState)) ? value.linkState as ArchiveQuery["linkState"] : "all",
			});
		}
		changed();
	}
	function install(data: ArchiveDataset) {
		baseDataset.value = data; decisions.value = {}; associationDecisions.value = {};
		undoStack.value = []; redoStack.value = []; reviewRevision.value = 0; resetQuery();
	}
	async function loadFromArchive(): Promise<void> {
		const session = archive.archiveSession;
		if (!session) { reset(); return; }
		if (loadedSession === session && baseDataset.value) return;
		if (pendingSession === session && pendingLoad) return pendingLoad;
		generation += 1;
		controller.abort(); controller = new AbortController();
		const expected = generation;
		const signal = controller.signal;
		baseDataset.value = null; loading.value = true; error.value = null;
		pendingSession = session;
		pendingLoad = (async () => {
			try {
				const data = await loadArchiveDataset(session, signal);
				if (expected !== generation || archive.archiveSession !== session) return;
				install(data); loadedSession = session;
			} catch (failure) {
				if (expected !== generation || signal.aborted) return;
				error.value = describeArchiveImportFailure(failure).description;
			} finally {
				if (expected === generation) { loading.value = false; pendingSession = null; pendingLoad = null; }
			}
		})();
		return pendingLoad;
	}
	async function resolveAssetUrl(assetId: string): Promise<string | null> {
		const asset = dataset.value?.assets.find((item) => item.id === assetId);
		if (!asset) return null;
		if (!asset.entryId || !archive.archiveSession) return null;
		return archive.archiveSession.reader.readMediaEntry(asset.entryId);
	}
	async function resolveOverlayUrl(assetId: string): Promise<string | null> {
		const asset = dataset.value?.assets.find((item) => item.id === assetId);
		if (!asset?.overlayEntryId || !archive.archiveSession) return null;
		return archive.archiveSession.reader.readMediaEntry(asset.overlayEntryId);
	}
	function releaseAssetUrl(url: string | null) {
		if (!url || !url.startsWith("blob:")) return;
		archive.archiveSession?.reader.releaseMediaUrl(url); URL.revokeObjectURL(url);
	}
	function reset(clearSavedDecisions = true) {
		// Clear any derivatives written by the earlier prototype, without saving new state implicitly.
		if (clearSavedDecisions && typeof localStorage !== "undefined") {
			try {
				for (const key of Object.keys(localStorage)) if (key.startsWith("goodbye-chat-review-v1:")) localStorage.removeItem(key);
			} catch { /* Decisions remain session-only if browser storage is unavailable. */ }
		}
		generation += 1; controller.abort(); controller = new AbortController();
		baseDataset.value = null; loading.value = false; error.value = null;
		loadedSession = null; pendingSession = null; pendingLoad = null;
		decisions.value = {}; associationDecisions.value = {}; undoStack.value = []; redoStack.value = []; reviewRevision.value += 1; resetQuery();
	}
	watch(() => archive.archiveSession, (next, previous) => { if (next !== previous && (baseDataset.value || pendingLoad)) reset(false); }, { flush: "sync" });

	return { dataset, loading, error, query, decisions, associationDecisions, effectiveLinks,
		filteredEvents, filteredAssets, selectedEvents, selectedAssets, years, canUndo, canRedo, reviewRevision, queryRevision,
		setQuery, resetQuery, decide, batchDecide: decide, decideAssociation, undo, redo, exportReviewState, restoreReviewState,
		loadFromArchive, resolveAssetUrl, resolveOverlayUrl, releaseAssetUrl, reset };
});

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isReviewStatus(value: unknown): value is ReviewStatus { return value === "keep" || value === "exclude" || value === "later"; }
function physicalEntryKey(entry: NonNullable<MediaAsset["entryId"]>): string { return JSON.stringify([entry.sourceId, entry.path, entry.ordinal]); }

function associationGroup(link: MediaLink): string {
	return `${link.eventId}:${link.referenceId ?? link.candidateAssetIds.slice().sort().join(",")}`;
}

/** Runtime changes and restored files share the same evidence and exclusivity invariant. */
function validateAssociations(dataset: ArchiveDataset, decisions: Record<string, AssociationDecision>) {
	const links = new Map(dataset.links.map((link) => [link.id, link]));
	const assets = new Map(dataset.assets.map((asset) => [asset.id, asset]));
	const confirmed = new Map<string, string>();
	for (const [id, decision] of Object.entries(decisions)) {
		const link = links.get(id);
		if (!link || decision.linkId !== id) throw new Error("The association target is not part of this dataset.");
		if (decision.evidenceRevision !== undefined && decision.evidenceRevision !== dataset.revision) throw new Error("This association decision refers to changed evidence.");
		if (decision.action !== "confirm") continue;
		if (!assets.get(link.assetId)?.available) throw new Error("A missing file cannot become a confirmed attachment.");
		const group = associationGroup(link);
		if (confirmed.has(group) && confirmed.get(group) !== link.assetId) throw new Error("Contradictory candidates cannot both be confirmed for the same reference.");
		confirmed.set(group, link.assetId);
	}
}
