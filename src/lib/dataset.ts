import type { ArchiveSession } from "./snapArchive";
import { assertNotAborted, isSafeArchivePath, type SnapZipEntryMeta } from "./snapZip";
import type {
	ArchiveDataset, ArchiveCoverage, ArchiveQuery, ConversationEvent, MediaAsset,
	SourceReference, MediaKind, NormalizedTime, Participant, Conversation,
	ReviewDecision, MediaLink, UnsupportedEvidence, Authorship,
} from "../types/dataset";

export const NORMALIZATION_VERSION = 4;
export const DEFAULT_QUERY: ArchiveQuery = {
	year: null, participantId: null, conversationId: null, text: "", kind: "all", review: "active", linkState: "all",
};

export interface DatasetDocument {
	sourceId: string;
	path: string;
	ordinal?: number;
	text: string;
}

export interface DatasetInput {
	entries: SnapZipEntryMeta[];
	documents: DatasetDocument[];
	revision?: string;
	/** Computed locally from bounded reads of each complete source ZIP, never from CRC claims. */
	sourceDigests?: Record<string, string>;
}

const SOURCE_FINGERPRINT_CHUNK_BYTES = 1024 * 1024;

/** A versioned SHA-256 chain fingerprints source bytes without retaining a full ZIP buffer. */
export async function fingerprintArchiveSource(source: Blob, signal?: AbortSignal): Promise<string> {
	assertNotAborted(signal);
	let previous: Uint8Array<ArrayBuffer> = new Uint8Array(32);
	for (let offset = 0; offset < source.size; offset += SOURCE_FINGERPRINT_CHUNK_BYTES) {
		assertNotAborted(signal);
		const chunk = new Uint8Array(await source.slice(offset, offset + SOURCE_FINGERPRINT_CHUNK_BYTES).arrayBuffer());
		assertNotAborted(signal);
		const block = new Uint8Array(previous.length + chunk.length);
		block.set(previous); block.set(chunk, previous.length);
		previous = new Uint8Array(await crypto.subtle.digest("SHA-256", block.buffer));
		if (offset % (16 * SOURCE_FINGERPRINT_CHUNK_BYTES) === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
	assertNotAborted(signal);
	const domain = new TextEncoder().encode(`goodbye-chat-source-v1:${source.size}:`);
	const final = new Uint8Array(domain.length + previous.length); final.set(domain); final.set(previous, domain.length);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", final.buffer));
	assertNotAborted(signal);
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const SECTION_PATHS = {
	account: "json/account.json", friends: "json/friends.json", chats: "json/chat_history.json",
	snaps: "json/snap_history.json", memories: "json/memories_history.json", stories: "json/story_history.json",
};

export async function loadArchiveDataset(session: ArchiveSession, signal?: AbortSignal): Promise<ArchiveDataset> {
	const sourceDigests: Record<string, string> = {};
	for (const source of session.index.sources) sourceDigests[source.id] = await fingerprintArchiveSource(source.file, signal);
	const documents: DatasetDocument[] = [];
	for (const entry of session.index.entries.filter((entry) => !entry.isDirectory && entry.id.path.startsWith("json/") && entry.id.path.endsWith(".json"))) {
		assertNotAborted(signal);
		const bytes = await session.reader.readEntry(entry.id, 128 * 1024 * 1024);
		assertNotAborted(signal);
		documents.push({ sourceId: entry.id.sourceId, path: entry.id.path, ordinal: entry.id.ordinal, text: new TextDecoder().decode(bytes) });
	}
	const input: DatasetInput = { entries: session.index.entries, documents, sourceDigests };
	if (typeof Worker === "undefined") return normalizeArchiveDataset(input);
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL("./dataset.worker.ts", import.meta.url), { type: "module" });
		const cleanup = () => { worker.terminate(); signal?.removeEventListener("abort", abort); };
		const abort = () => { cleanup(); reject(new DOMException("Dataset preparation was canceled.", "AbortError")); };
		worker.onmessage = (message: MessageEvent<{ dataset?: ArchiveDataset; error?: string }>) => {
			cleanup();
			if (message.data.dataset) resolve(message.data.dataset);
			else reject(new Error(message.data.error ?? "Could not prepare the local dataset."));
		};
		worker.onerror = () => { cleanup(); reject(new Error("The local analysis worker could not start. Retry in a supported desktop browser.")); };
		signal?.addEventListener("abort", abort, { once: true });
		if (signal?.aborted) { abort(); return; }
		worker.postMessage(input);
	});
}

/** Deterministic local identities, never an authentication or anonymization mechanism. */
export function stableId(prefix: string, value: string): string {
	let left = 2166136261;
	let right = 2246822519;
	for (let index = 0; index < value.length; index += 1) {
		left = Math.imul(left ^ value.charCodeAt(index), 16777619);
		right = Math.imul(right ^ value.charCodeAt(index), 3266489917);
	}
	return `${prefix}-${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
	return JSON.stringify(value) ?? "null";
}

export function normalizeArchiveDataset(input: DatasetInput): ArchiveDataset {
	const coverage: ArchiveCoverage = {
		sections: {}, missingMedia: 0, unknownAuthors: 0, invalidDates: 0,
		duplicateRecords: 0, unsupportedRecords: 0, warnings: [],
	};
	const unsupported: UnsupportedEvidence[] = [];
	const supportedSections = new Set<string>();
	const parsed = input.documents.map((document) => {
		try { return { document, value: JSON.parse(document.text) as unknown, invalid: false }; }
		catch { return { document, value: null, invalid: true }; }
	});
	const sourceKeys = new Map<string, string>();
	const sourceGroups = new Map<string, string[]>();
	const sourceIds = [...new Set([...input.entries.map((entry) => entry.id.sourceId), ...input.documents.map((document) => document.sourceId)])];
	const identityVerified = sourceIds.length > 0 && sourceIds.every((id) => /^[a-f0-9]{64}$/.test(input.sourceDigests?.[id] ?? ""));
	for (const sourceId of sourceIds) {
		const manifest = input.entries.filter((entry) => entry.id.sourceId === sourceId)
			.map((entry) => [entry.id.path, entry.id.ordinal, entry.uncompressedSize, entry.signature ?? null]).sort(compareCanonical);
		const documents = parsed.filter((entry) => entry.document.sourceId === sourceId)
			.map((entry) => [entry.document.path, entry.document.ordinal, entry.invalid ? entry.document.text : entry.value]).sort(compareCanonical);
		const digest = input.sourceDigests?.[sourceId];
		const key = digest && /^[a-f0-9]{64}$/.test(digest) ? `bytes-${digest}` : stableId("unverified-part", canonical([manifest, documents]));
		sourceGroups.set(key, [...(sourceGroups.get(key) ?? []), sourceId]);
	}
	// Even verified byte equality does not erase a second selectable physical occurrence.
	for (const [key, ids] of sourceGroups) ids.sort().forEach((id, index) => sourceKeys.set(id, ids.length > 1 ? `${key}:copy-${index}` : key));
	const fingerprint = stableId("archive", canonical([NORMALIZATION_VERSION, [...sourceKeys.values()].sort()]));
	const sourceOf = (document: DatasetDocument, pointer = ""): SourceReference => ({
		sourceId: document.sourceId, sourceFingerprint: sourceKeys.get(document.sourceId), path: document.path, recordPointer: pointer, entryOrdinal: document.ordinal,
	});
	const reject = (source: SourceReference, value: unknown, reason: string, unsupportedShape = true) => {
		unsupported.push({ source, raw: sanitizeRaw(value), reason });
		coverage.unsupportedRecords += 1;
		const name = Object.entries(SECTION_PATHS).find(([, path]) => path === source.path)?.[0];
		const section = name ? coverage.sections[name] : null;
		if (section && unsupportedShape) section.unsupportedCount = (section.unsupportedCount ?? 0) + 1;
	};
	const valuesAt = (path: string) => parsed.filter((entry) => entry.document.path === path);
	for (const [name, path] of Object.entries(SECTION_PATHS)) {
		const docs = valuesAt(path);
		coverage.sections[name] = { status: docs.length ? "available" : "missing", recordCount: 0, invalidCount: docs.filter((doc) => doc.invalid).length, unsupportedCount: 0 };
		for (const doc of docs.filter((doc) => doc.invalid)) reject(sourceOf(doc.document), null, "This JSON section could not be parsed.", false);
	}
	for (const doc of parsed.filter((doc) => !Object.values(SECTION_PATHS).includes(doc.document.path))) {
		reject(sourceOf(doc.document), doc.value, "This section is retained as unsupported evidence.");
	}
	const ownerNames = new Set(valuesAt(SECTION_PATHS.account).flatMap(({ value }) => record(value) && record(value["Basic Information"])
		? [string(value["Basic Information"].Username)].filter((name): name is string => Boolean(name)) : []));
	const ownerUsername = ownerNames.size === 1 ? [...ownerNames][0]! : null;
	if (ownerNames.size > 1) coverage.warnings.push("The selected files contain conflicting archive owners. Owner-authored analysis is unavailable.");
	for (const { document, value, invalid } of valuesAt(SECTION_PATHS.account)) {
		if (invalid) continue;
		if (record(value) && record(value["Basic Information"]) && string(value["Basic Information"].Username)) coverage.sections.account!.recordCount += 1;
		else { markInvalid(coverage, "account"); reject(sourceOf(document), value, "Archive account identity fields are unsupported or absent."); }
	}
	const participants = new Map<string, Participant>();
	const person = (username: string, displayName = username, source?: SourceReference) => {
		const id = stableId("person", username);
		const previous = participants.get(id);
		if (previous) { if (source) previous.sources.push(source); return previous; }
		const participant: Participant = { id, username, displayName, isOwner: username === ownerUsername, sources: source ? [source] : [] };
		participants.set(id, participant);
		return participant;
	};
	if (ownerUsername) person(ownerUsername, ownerUsername);
	for (const { document, value, invalid } of valuesAt(SECTION_PATHS.friends)) {
		if (invalid) continue;
		if (!record(value) || !Array.isArray(value.Friends)) {
			markInvalid(coverage, "friends"); reject(sourceOf(document), value, "Unsupported friends section."); continue;
		}
		if (!value.Friends.length) supportedSections.add("friends");
		value.Friends.forEach((friend, index) => {
			const source = sourceOf(document, `/Friends/${index}`);
			if (!record(friend) || !string(friend.Username)) { markInvalid(coverage, "friends"); reject(source, friend, "Missing participant identifier."); return; }
			person(string(friend.Username)!, string(friend["Display Name"]) ?? string(friend.Username)!, source);
			coverage.sections.friends!.recordCount += 1;
		});
	}
	for (const { document, value, invalid } of valuesAt(SECTION_PATHS.stories)) {
		if (invalid) continue;
		if (!record(value)) { markInvalid(coverage, "stories"); reject(sourceOf(document), value, "Unsupported story section."); continue; }
		if (!Object.keys(value).length) reject(sourceOf(document), value, "The story section has no recognized fields.");
		for (const [name, rows] of Object.entries(value)) {
			if (!["Your Story Views", "Friend and Public Story Views"].includes(name)) { reject(sourceOf(document, `/${pointerEscape(name)}`), rows, "This story field is retained without an established interpretation."); continue; }
			if (!Array.isArray(rows)) { reject(sourceOf(document, `/${pointerEscape(name)}`), rows, "This story field is retained without an established interpretation."); continue; }
			if (!rows.length) supportedSections.add("stories");
			rows.forEach((row, index) => reject(sourceOf(document, `/${pointerEscape(name)}/${index}`), row, "Story evidence is retained; interpreting story views as conversation events is unsupported."));
		}
	}
	const conversations = new Map<string, Conversation>();
	const scopeProofs = new Map<string, { direct: Map<string, SourceReference[]>; group: SourceReference[] }>();
	const events = new Map<string, ConversationEvent>();
	const orderedDocs = [...parsed].sort((a, b) => `${sourceKeys.get(a.document.sourceId)}:${a.document.path}:${a.document.ordinal}`.localeCompare(`${sourceKeys.get(b.document.sourceId)}:${b.document.path}:${b.document.ordinal}`));
	for (const { document, value, invalid } of orderedDocs.filter(({ document }) => document.path === SECTION_PATHS.chats || document.path === SECTION_PATHS.snaps)) {
		const section = document.path === SECTION_PATHS.chats ? "chats" : "snaps";
		if (invalid) continue;
		if (!record(value)) { markInvalid(coverage, section); reject(sourceOf(document), value, "Expected a conversation record."); continue; }
		if (!Object.keys(value).length) supportedSections.add(section);
		for (const [threadKey, rows] of Object.entries(value)) {
			if (!Array.isArray(rows)) { markInvalid(coverage, section); reject(sourceOf(document, `/${pointerEscape(threadKey)}`), rows, "Unsupported conversation section."); continue; }
			if (!rows.length) supportedSections.add(section);
			const conversationId = stableId("conversation", threadKey);
			const conversation: Conversation = conversations.get(conversationId) ?? { id: conversationId, title: threadKey, participantIds: [], eventIds: [], sources: [] };
			const recordedGroupTitle = rows.some((row) => record(row) && string(row["Conversation Title"]) && row["Conversation Title"] !== threadKey);
			const directRecipient = recordedGroupTitle ? null : [...participants.values()].find((participant) => participant.username === threadKey && participant.sources.some((source) => source.path === SECTION_PATHS.friends));
			const proof = scopeProofs.get(conversationId) ?? { direct: new Map<string, SourceReference[]>(), group: [] };
			const threadSource = sourceOf(document, `/${pointerEscape(threadKey)}`);
			if (recordedGroupTitle) proof.group.push(threadSource);
			if (directRecipient) proof.direct.set(directRecipient.id, [...(proof.direct.get(directRecipient.id) ?? []), threadSource,
				...directRecipient.sources.filter((source) => source.path === SECTION_PATHS.friends)]);
			scopeProofs.set(conversationId, proof);
			if (directRecipient && !conversation.participantIds.includes(directRecipient.id)) conversation.participantIds.push(directRecipient.id);
			conversations.set(conversationId, conversation);
			const repeated = new Map<string, number>();
			rows.forEach((row, index) => {
				const source = sourceOf(document, `/${pointerEscape(threadKey)}/${index}`);
				if (!record(row)) { markInvalid(coverage, section); reject(source, row, "A conversation event must be an object."); return; }
				const from = string(row.From);
				const kind = normalizeKind(row["Media Type"]);
				const text = string(row.Content);
				if (!from && !text && kind === "unknown" && !row.Created && row["Created(microseconds)"] === undefined) {
					markInvalid(coverage, section); reject(source, row, "This event has no supported message fields."); return;
				}
				const time = normalizeTime(row.Created, row["Created(microseconds)"]);
				const raw = sanitizeRaw(row) as Record<string, unknown>;
				const signature = canonical(raw);
				const repeat = repeated.get(signature) ?? 0;
				repeated.set(signature, repeat + 1);
				const id = stableId("event", `${document.path}:${threadKey}:${signature}:${repeat}`);
				if (events.has(id)) { events.get(id)!.sources.push(source); coverage.duplicateRecords += 1; return; }
				const authorship = classifyAuthorship(from, row.IsSender, ownerUsername);
				const participant = from ? person(from, from, source) : null;
				if (participant && !conversation.participantIds.includes(participant.id)) conversation.participantIds.push(participant.id);
				if (ownerUsername) {
					const owner = person(ownerUsername);
					if (!conversation.participantIds.includes(owner.id)) conversation.participantIds.push(owner.id);
				}
				const title = string(row["Conversation Title"]);
				if (title) conversation.title = title;
				conversation.sources.push(source);
				const event: ConversationEvent = {
					id, conversationId, participantId: participant?.id ?? null,
					ownerAuthored: authorship === "owner", authorship, kind, text,
					timestamp: time.instant, year: yearOf(time), time, source, sources: [source],
					assetIds: [], mediaReferenceIds: parseMediaReferences(row["Media IDs"]), raw,
				};
				events.set(id, event);
				conversation.eventIds.push(id);
				coverage.sections[section]!.recordCount += 1;
				if (authorship === "unknown" || authorship === "conflicting") coverage.unknownAuthors += 1;
				if (!time.valid) coverage.invalidDates += 1;
				if (kind === "unknown") reject(source, row, "This event type is unsupported. Its evidence remains available.");
			});
		}
	}
	for (const conversation of conversations.values()) {
		const proof = scopeProofs.get(conversation.id)!;
		const recipientId = proof.direct.size === 1 ? [...proof.direct.keys()][0]! : null;
		const ownerId = ownerUsername ? stableId("person", ownerUsername) : null;
		if (proof.group.length || conversation.participantIds.length > 2) conversation.scope = {
			kind: "group", recipientId: null, basis: proof.group.length ? "An exported conversation title identifies a separate conversation scope; membership can be incomplete." : "More than two distinct participants occur in the recorded conversation.",
			evidence: proof.group.length ? proof.group : conversation.sources,
		};
		else if (recipientId && ownerId && conversation.participantIds.every((id) => id === ownerId || id === recipientId)) conversation.scope = {
			kind: "direct", recipientId, basis: "The exported thread key exactly matches a recorded friend username, with no conflicting group or participant evidence.", evidence: proof.direct.get(recipientId)!,
		};
		else conversation.scope = { kind: "unknown", recipientId: null, basis: "The archive does not establish direct or complete group membership for this conversation.", evidence: conversation.sources };
	}
	const assets = new Map<string, MediaAsset>();
	const paths = new Map<string, MediaAsset[]>();
	const addAsset = (asset: MediaAsset) => {
		const existing = assets.get(asset.id);
		if (existing) {
			existing.sources.push(...asset.sources);
			coverage.duplicateRecords += 1;
			return;
		}
		assets.set(asset.id, asset);
		if (asset.path) paths.set(asset.path, [...(paths.get(asset.path) ?? []), asset]);
	};
	for (const entry of input.entries.filter((entry) => !entry.isDirectory && !/\.json$/i.test(entry.id.path))) {
		const id = stableId("asset", `${sourceKeys.get(entry.id.sourceId)}:${entry.id.path}:${entry.id.ordinal}`);
		const source: SourceReference = { sourceId: entry.id.sourceId, sourceFingerprint: sourceKeys.get(entry.id.sourceId), path: entry.id.path, entryOrdinal: entry.id.ordinal, recordPointer: "" };
		const isOverlay = /-overlay\.[^.]+$/i.test(entry.id.path);
		addAsset({ id, path: entry.id.path, overlayPath: null, kind: kindForPath(entry.id.path),
			timestamp: null, year: null, source, sources: [source], entryId: entry.id, overlayEntryId: null,
			conversationIds: [], available: true, mediaId: isOverlay ? null : mediaIdFromPath(entry.id.path),
			byteSize: entry.uncompressedSize, mimeType: mimeForKind(kindForPath(entry.id.path), entry.id.path), location: null, raw: {},
			role: isOverlay ? "overlay" : "original", overlayState: "none", baseAssetIds: [],
		});
		if (kindForPath(entry.id.path) === "unknown") reject(source, { path: entry.id.path }, "This physical file type is unsupported; its exact original remains available.");
	}
	for (const { document, value, invalid } of orderedDocs.filter(({ document }) => document.path === SECTION_PATHS.memories)) {
		if (invalid) continue;
		if (!record(value) || !Array.isArray(value["Saved Media"])) { markInvalid(coverage, "memories"); reject(sourceOf(document), value, "Unsupported Memories section."); continue; }
		if (!value["Saved Media"].length) supportedSections.add("memories");
		value["Saved Media"].forEach((row, index) => {
			const source = sourceOf(document, `/Saved Media/${index}`);
			if (!record(row)) { markInvalid(coverage, "memories"); reject(source, row, "Memory metadata must be an object."); return; }
			const kind = normalizeKind(row["Media Type"]);
			const time = normalizeTime(row.Date);
			const mediaId = extractMediaId(row["Download Link"]);
			const date = string(row.Date)?.slice(0, 10);
			const path = mediaId && date && /^\d{4}-\d{2}-\d{2}$/.test(date)
				? `memories/${date}_${mediaId}-main.${kind === "video" ? "mp4" : kind === "image" ? "jpg" : "unsupported"}` : null;
			const candidates = path ? paths.get(path) ?? [] : [];
			if (!candidates.length) {
				const id = stableId("missing-asset", canonical([path, mediaId, sanitizeRaw(row)]));
				if (assets.has(id)) { assets.get(id)!.sources.push(source); coverage.duplicateRecords += 1; }
				else addAsset({ id, path, overlayPath: null, kind, timestamp: time.instant, year: yearOf(time),
					source, sources: [source], entryId: null, overlayEntryId: null, conversationIds: [], available: false,
					mediaId, byteSize: 0, mimeType: mimeForKind(kind, path), location: string(row.Location), raw: sanitizeRaw(row) as Record<string, unknown> });
			} else for (const asset of candidates) {
				asset.sources.push(source); asset.timestamp = time.instant; asset.year = yearOf(time);
				asset.mediaId = mediaId; asset.location = string(row.Location); asset.raw = sanitizeRaw(row) as Record<string, unknown>;
			}
			coverage.sections.memories!.recordCount += 1;
			if (!time.valid) coverage.invalidDates += 1;
			if (!path || kind === "unknown") reject(source, row, "No supported local media path can be established for this metadata.");
		});
	}
	for (const asset of assets.values()) {
		if (!asset.path || !/-main\.[^.]+$/i.test(asset.path)) continue;
		const overlayPath = asset.path.replace(/-main\.[^.]+$/i, "-overlay.png");
		const overlays = paths.get(overlayPath) ?? [];
		const bases = (paths.get(asset.path) ?? []).filter((candidate) => candidate.role !== "overlay" && candidate.available);
		asset.overlayCandidates = overlays.flatMap((layer) => layer.entryId ? [layer.entryId] : []);
		if (overlays.length === 1 && bases.length === 1 && asset.available) {
			const layer = overlays[0]!; asset.overlayPath = overlayPath; asset.overlayEntryId = layer.entryId;
			asset.overlayState = "resolved"; layer.overlayState = "resolved"; layer.baseAssetIds = [asset.id];
			layer.timestamp = asset.timestamp; layer.year = asset.year;
		} else if (overlays.length && (overlays.length > 1 || bases.length > 1)) {
			asset.overlayState = "ambiguous"; for (const layer of overlays) layer.overlayState = "ambiguous";
			coverage.warnings.push("An overlay has competing base or layer occurrences and was left unresolved.");
		}
	}
	for (const layer of assets.values()) if (layer.role === "overlay" && layer.overlayState === "none") {
		layer.overlayState = "missing-base";
		coverage.warnings.push("An overlay has no uniquely available base file. Its exact layer remains in the inventory.");
	}
	const links: MediaLink[] = [];
	const assetsByReference = new Map<string, MediaAsset[]>();
	for (const asset of assets.values()) {
		for (const token of new Set([asset.mediaId, asset.path, filenameStem(asset.path)].filter((value): value is string => value !== null))) {
			assetsByReference.set(token, [...(assetsByReference.get(token) ?? []), asset]);
		}
	}
	for (const event of events.values()) {
		for (const reference of event.mediaReferenceIds) {
			const referenceId = stableId("reference", `${event.id}:${reference}`);
			const candidates = assetsByReference.get(reference) ?? [];
			const available = candidates.filter((asset) => asset.available);
			if (available.length === 1 && candidates.length === 1) {
				const asset = available[0]!;
				links.push({ id: stableId("link", `${referenceId}:${asset.id}`), referenceId, eventId: event.id, assetId: asset.id,
					status: "confirmed", basis: "The event's explicit media identifier matches one local asset.", evidence: [event.source, asset.source], candidateAssetIds: [asset.id] });
				if (!event.assetIds.includes(asset.id)) event.assetIds.push(asset.id);
				if (!asset.conversationIds.includes(event.conversationId)) asset.conversationIds.push(event.conversationId);
				if (!asset.timestamp) { asset.timestamp = event.timestamp; asset.year = event.year; }
			} else if (candidates.length) {
				for (const candidate of candidates) links.push({ id: stableId("link", `${referenceId}:${candidate.id}`), referenceId, eventId: event.id, assetId: candidate.id,
					status: candidates.length > 1 ? "ambiguous" : "unlinked", basis: candidates.length > 1 ? "The explicit reference has several source candidates." : "The event references metadata, but the physical file is missing.",
					evidence: [event.source, candidate.source], candidateAssetIds: candidates.map((asset) => asset.id), missingReason: available.length ? undefined : "No readable local file is available." });
			} else {
				const id = stableId("missing-reference", reference);
				if (!assets.has(id)) addAsset({ id, path: null, overlayPath: null, kind: event.kind, timestamp: event.timestamp, year: event.year,
					source: event.source, sources: [event.source], entryId: null, overlayEntryId: null, conversationIds: [event.conversationId],
					available: false, mediaId: reference, byteSize: 0, mimeType: mimeForKind(event.kind, null), location: null, raw: {} });
				links.push({ id: stableId("link", `${referenceId}:${id}`), referenceId, eventId: event.id, assetId: id, status: "unlinked",
					basis: "An explicit media reference has no indexed file.", evidence: [event.source], candidateAssetIds: [], missingReason: "The referenced file is absent from the selected ZIP parts." });
			}
		}
	}
	const sortedEvents = [...events.values()].sort((a, b) => a.time.orderKey.localeCompare(b.time.orderKey) || a.id.localeCompare(b.id));
	for (const conversation of conversations.values()) conversation.eventIds.sort((a, b) => {
		const left = events.get(a)!; const right = events.get(b)!;
		return left.time.orderKey.localeCompare(right.time.orderKey) || left.id.localeCompare(right.id);
	});
	coverage.missingMedia = [...assets.values()].filter((asset) => !asset.available).length;
	for (const [name, section] of Object.entries(coverage.sections)) {
		if (section.status === "missing") continue;
		section.status = section.invalidCount ? (section.recordCount || supportedSections.has(name) ? "partial" : "invalid")
			: (section.unsupportedCount ?? 0) ? (section.recordCount ? "partial" : "unsupported") : "available";
	}
	if (sortedEvents.some(event => event.time.valid && event.time.precision === "millisecond" && event.raw["Created(microseconds)"] != null)) {
		coverage.warnings.push("Some epoch fields labelled microseconds contain milliseconds, corroborated by their recorded zoned dates. Original fields are preserved.");
	}
	coverage.warnings.push("Counts describe retained records in the selected archive. Missing periods do not prove inactivity.");
	if (!ownerUsername) coverage.warnings.push("Archive owner identity could not be verified. Owner-only language features remain unavailable.");
	for (const name of ["chats", "snaps", "memories"]) if (coverage.sections[name]?.status === "missing") coverage.warnings.push(`The ${name} section is absent from these ZIP parts.`);
	return { fingerprint, identityVerified, revision: input.revision ?? fingerprint, normalizationVersion: NORMALIZATION_VERSION, ownerUsername, timezone: "UTC",
		participants: [...participants.values()].sort((a, b) => a.id.localeCompare(b.id)), conversations: [...conversations.values()].sort((a, b) => a.id.localeCompare(b.id)),
		events: sortedEvents, assets: [...assets.values()].sort((a, b) => a.id.localeCompare(b.id)), links, coverage, unsupported };
}

export function normalizeTime(raw: unknown, rawMicroseconds?: unknown): NormalizedTime {
	raw = sanitizeRaw(raw);
	const unknown = (reason: string): NormalizedTime => ({ raw, instant: null, precision: "unknown", zone: null, valid: false, reason, orderKey: "z-unknown" });
	if ((typeof rawMicroseconds === "number" && Number.isSafeInteger(rawMicroseconds)) || (typeof rawMicroseconds === "string" && /^\d+$/.test(rawMicroseconds))) {
		try {
			let micros = BigInt(rawMicroseconds);
			let correctedUnit = false;
			const comparison = typeof raw === "string" ? normalizeTime(raw) : null;
			if (comparison?.instant && typeof raw === "string") {
				const fractional = /\.(\d+)/.exec(raw)?.[1] ?? "";
				const recordedMicros = BigInt(Date.parse(comparison.instant)) * 1000n + BigInt(fractional.padEnd(6, "0").slice(3, 6) || "0");
				const recordedPrecision = 10n ** BigInt(6 - Math.min(6, fractional.length));
				const agrees = (candidate: bigint) => candidate >= recordedMicros && candidate < recordedMicros + recordedPrecision;
				if (!agrees(micros)) {
					// Some exports label milliseconds as microseconds. The zoned date, never magnitude, establishes the correction.
					if (!agrees(micros * 1000n)) return unknown("The exported timestamp fields conflict.");
					micros *= 1000n;
					correctedUnit = true;
				}
			}
			const milliseconds = Number(micros / 1000n);
			const date = new Date(milliseconds);
			if (!Number.isFinite(date.getTime()) || micros < 0n) return unknown("Invalid microsecond timestamp.");
			const instant = date.toISOString();
			return { raw, instant, precision: correctedUnit ? "millisecond" : "microsecond", zone: "UTC", valid: true,
				reason: correctedUnit ? "The field labelled microseconds contains milliseconds, corroborated by the recorded zoned date. The original field is preserved." : null,
				orderKey: micros.toString().padStart(24, "0") };
		} catch { return unknown("Invalid microsecond timestamp."); }
	}
	if (rawMicroseconds !== undefined && rawMicroseconds !== null) return unknown("The microsecond field cannot be represented exactly.");
	const text = string(raw);
	if (!text) return unknown("No timestamp was recorded.");
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		const date = new Date(`${text}T00:00:00Z`);
		if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) return unknown("Invalid calendar date.");
		return { raw: text, instant: null, precision: "date", zone: null, valid: true, reason: "Only a calendar date was recorded.", orderKey: `y-date-${text}` };
	}
	if (!/(?:UTC|Z|[+-]\d{2}:?\d{2})$/i.test(text)) return unknown("The timestamp has no explicit time zone.");
	const normalized = text.replace(/ UTC$/i, "Z").replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T");
	const calendar = /^(\d{4}-\d{2}-\d{2})T/.exec(normalized)?.[1];
	if (!calendar) return unknown("The timestamp format is unsupported.");
	const calendarDate = new Date(`${calendar}T00:00:00Z`);
	if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== calendar) return unknown("Invalid calendar date.");
	const milliseconds = Date.parse(normalized);
	if (!Number.isFinite(milliseconds)) return unknown("Invalid timestamp.");
	const date = new Date(milliseconds);
	const fractional = /\.(\d+)/.exec(normalized)?.[1] ?? "";
	const submillis = fractional.padEnd(6, "0").slice(3, 6);
	const micros = BigInt(milliseconds) * 1000n + BigInt(submillis || "0");
	return { raw, instant: date.toISOString(), precision: fractional.length > 3 ? "microsecond" : fractional.length ? "millisecond" : "second", zone: /([+-]\d{2}:?\d{2})$/.exec(text)?.[1] ?? "UTC", valid: true, reason: null, orderKey: micros.toString().padStart(24, "0") };
}

export function queryDataset(dataset: ArchiveDataset, query: ArchiveQuery, decisions: Record<string, ReviewDecision>): { events: ConversationEvent[]; assets: MediaAsset[] } {
	const lower = query.text.trim().toLocaleLowerCase();
	const participants = new Map(dataset.participants.map((person) => [person.id, person]));
	const conversations = new Map(dataset.conversations.map((conversation) => [conversation.id, conversation]));
	const eventLinks = new Map<string, MediaLink[]>();
	const assetLinks = new Map<string, MediaLink[]>();
	for (const link of dataset.links) {
		eventLinks.set(link.eventId, [...(eventLinks.get(link.eventId) ?? []), link]);
		assetLinks.set(link.assetId, [...(assetLinks.get(link.assetId) ?? []), link]);
	}
	const matchesReview = (id: string) => {
		const status = decisions[id]?.status;
		if (query.review === "all") return true;
		if (query.review === "active") return status !== "exclude";
		if (query.review === "unreviewed") return !status;
		return status === query.review;
	};
	const matchesLink = (id: string, event: boolean) => {
		if (query.linkState === "all") return true;
		const links = (event ? eventLinks : assetLinks).get(id) ?? [];
		return query.linkState === "unlinked" ? !links.length || links.some((link) => link.status === "unlinked") : links.some((link) => link.status === query.linkState);
	};
	const eventMatches = (event: ConversationEvent, includeKind = true) => {
		const conversation = conversations.get(event.conversationId);
		return (query.year === null || event.year === query.year)
			&& (!query.participantId || event.participantId === query.participantId || Boolean(conversation?.participantIds.includes(query.participantId)))
			&& (!query.conversationId || event.conversationId === query.conversationId)
			&& (!includeKind || query.kind === "all" || event.kind === query.kind)
			&& (!lower || `${event.text ?? ""} ${participants.get(event.participantId ?? "")?.displayName ?? ""} ${conversation?.title ?? ""}`.toLocaleLowerCase().includes(lower));
	};
	const events = dataset.events.filter((event) => eventMatches(event) && matchesReview(event.id) && matchesLink(event.id, true));
	const candidateEvents = dataset.events.filter((event) => eventMatches(event, false) && decisions[event.id]?.status !== "exclude");
	const candidateEventIds = new Set(candidateEvents.map((event) => event.id));
	const assets = dataset.assets.filter((asset) => {
		if (!matchesReview(asset.id) || !matchesLink(asset.id, false) || (query.kind !== "all" && asset.kind !== query.kind)) return false;
		const links = assetLinks.get(asset.id) ?? [];
		const confirmed = links.filter((link) => link.status === "confirmed");
		const matchingEvents = links.some((link) => candidateEventIds.has(link.eventId));
		if (confirmed.length && confirmed.every((link) => decisions[link.eventId]?.status === "exclude") && query.review !== "exclude" && query.review !== "all") return false;
		if (query.year !== null && asset.year !== query.year && !matchingEvents) return false;
		if ((query.participantId || query.conversationId) && !matchingEvents) return false;
		if (lower && !matchingEvents && !`${asset.path ?? ""} ${asset.mediaId ?? ""} ${asset.location ?? ""}`.toLocaleLowerCase().includes(lower)) return false;
		return true;
	});
	return { events, assets };
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function string(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function compareCanonical(a: unknown, b: unknown) { return canonical(a).localeCompare(canonical(b)); }
function pointerEscape(value: string) { return value.replace(/~/g, "~0").replace(/\//g, "~1"); }
function markInvalid(coverage: ArchiveCoverage, section: string) { const entry = coverage.sections[section]!; entry.invalidCount += 1; entry.status = entry.recordCount ? "partial" : "invalid"; }
function normalizeKind(value: unknown): MediaKind {
	const kind = string(value)?.toLowerCase();
	return (["text", "image", "video", "audio", "sticker", "gif", "attachment"] as const).find((candidate) => candidate === kind) ?? "unknown";
}
function kindForPath(path: string): MediaKind {
	if (/\.(?:jpe?g|png|webp|heic|avif)$/i.test(path)) return "image";
	if (/\.(?:mp4|mov|webm)$/i.test(path)) return "video";
	if (/\.(?:mp3|m4a|wav|ogg|aac)$/i.test(path)) return "audio";
	if (/\.gif$/i.test(path)) return "gif";
	return "unknown";
}
function mimeForKind(kind: MediaKind, path: string | null): string {
	const extension = path?.split(".").pop()?.toLowerCase();
	const mimeByExtension: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", avif: "image/avif", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", gif: "image/gif" };
	if (extension && mimeByExtension[extension]) return mimeByExtension[extension];
	if (kind === "gif") return "image/gif";
	return "application/octet-stream";
}
function filenameStem(path: string | null): string | null { return path?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? null; }
function mediaIdFromPath(path: string): string | null {
	const stem = filenameStem(path);
	return stem?.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/-(?:main|overlay)$/, "") ?? null;
}
function extractMediaId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	try { const id = new URL(value).searchParams.get("mid"); return id && isSafeArchivePath(`memories/${id}`) && !id.includes("/") ? id : null; } catch { return null; }
}
function parseMediaReferences(value: unknown): string[] {
	const supported = (item: string) => isSafeArchivePath(item) && !/[?#&<>]/.test(item);
	if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === "string" && supported(item.trim())).map((item) => item.trim()))];
	if (typeof value !== "string" || !value.trim()) return [];
	try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) return parseMediaReferences(parsed); } catch { /* Most exports use a delimited string. */ }
	return [...new Set(value.split(/[\s,;]+/).map((item) => item.trim()).filter(supported))];
}
function classifyAuthorship(from: string | null, isSender: unknown, owner: string | null): Authorship {
	if (!owner || !from) return "unknown";
	if (from === owner) return isSender === false ? "conflicting" : "owner";
	return isSender === true ? "conflicting" : "other";
}
function yearOf(time: NormalizedTime): number | null { return time.instant ? Number(time.instant.slice(0, 4)) : time.valid && time.precision === "date" ? Number(String(time.raw).slice(0, 4)) : null; }
function sanitizeRaw(value: unknown, preserveMessage = false): unknown {
	if (Array.isArray(value)) return value.map((entry) => sanitizeRaw(entry));
	if (typeof value === "string" && !preserveMessage && /(?:https?:\/\/|\bBearer\s|\bsk-(?:or-|proj-))/i.test(value)) return "[Remote URL or credential redacted]";
	if (!record(value)) return value;
	return Object.fromEntries(Object.entries(value)
		.filter(([key]) => !/download[ _-]*link|token|password|secret|credential|authorization|cookie|api[ _-]*key/i.test(key))
		.map(([key, entry]) => [key, sanitizeRaw(entry, typeof entry === "string" && /^(?:Content|Text|Message|Caption|Title|Conversation Title|Display Name)$/i.test(key))]));
}
