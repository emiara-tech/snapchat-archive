import type { ArchiveDataset, ArchiveQuery, ReviewDecision, ReviewStatus } from "../types/dataset";
import { planLocalRequest, type LocalRequestPlan } from "./assistant";
import { queryDataset } from "./dataset";
import { profileOmissionReason, type ProfileStyleChoices, type YearProfile } from "./yearProfile";

export interface ProposalCollection {
	dataset: ArchiveDataset;
	query: ArchiveQuery;
	decisions: Record<string, ReviewDecision>;
	queryRevision: number;
	reviewRevision: number;
}

export interface GuideProposal {
	readonly plan: Readonly<LocalRequestPlan>;
	readonly eventIds: readonly string[];
	readonly assetIds: readonly string[];
	readonly itemIds: readonly string[];
}
type ProposalError = { error: string };
type GuideOutcome = { kind: "query" } | { kind: "review"; count: number; status: ReviewStatus };
const STALE_COLLECTION = "The collection changed. Prepare a new preview before applying.";

function collectionRevision(current: ProposalCollection): string {
	return JSON.stringify([current.dataset.fingerprint, current.dataset.revision, current.queryRevision, current.reviewRevision,
		current.query, Object.entries(current.decisions).sort(([a], [b]) => a.localeCompare(b))]);
}

function effectiveMatches(current: ProposalCollection, query: ArchiveQuery) {
	const matches = queryDataset(current.dataset, { ...query, review: "active" }, current.decisions);
	const linkedEvents = new Map<string, string[]>();
	for (const link of current.dataset.links) if (link.status === "confirmed") {
		linkedEvents.set(link.assetId, [...(linkedEvents.get(link.assetId) ?? []), link.eventId]);
	}
	const authorized = (id: string) => current.decisions[id]?.status !== "exclude"
		&& (!(linkedEvents.get(id)?.length) || linkedEvents.get(id)!.some((eventId) => current.decisions[eventId]?.status !== "exclude"));
	return { events: matches.events, assets: matches.assets.filter((asset) => authorized(asset.id)
		&& (asset.role !== "overlay" || asset.overlayState !== "resolved" || !asset.baseAssetIds?.length || asset.baseAssetIds.some(authorized))) };
}

/** Local preparation and application only. Callbacks are synchronous review/query transactions. */
export function createGuideProposals(actions: {
	current: () => ProposalCollection | null;
	query: (query: ArchiveQuery) => void;
	review: (ids: string[], status: ReviewStatus) => void;
}) {
	const revisions = new WeakMap<GuideProposal, string>();
	const used = new WeakSet<GuideProposal>();
	function isCurrent(proposal: GuideProposal): boolean {
		const current = actions.current();
		return Boolean(current && !used.has(proposal) && revisions.get(proposal) === collectionRevision(current));
	}
	function prepare(request: string): GuideProposal | ProposalError {
		const current = actions.current();
		if (!current) return { error: "Import your archive first." };
		const planned = planLocalRequest(request, current.dataset, current.query);
		if ("error" in planned) return planned;
		const plan = Object.freeze({ ...planned, query: Object.freeze({ ...planned.query, review: "active" as const }) });
		const matches = effectiveMatches(current, plan.query);
		const eventIds = Object.freeze([...new Set(matches.events.map((event) => event.id))]);
		const assetIds = Object.freeze([...new Set(matches.assets.map((asset) => asset.id))]);
		const proposal = Object.freeze({ plan, eventIds, assetIds, itemIds: Object.freeze([...new Set([...eventIds, ...assetIds])]) });
		revisions.set(proposal, collectionRevision(current));
		return proposal;
	}
	function apply(proposal: GuideProposal): GuideOutcome | ProposalError {
		if (!isCurrent(proposal)) return { error: STALE_COLLECTION };
		if (!proposal.itemIds.length || proposal.plan.kind === "explain") return { error: "No review or filter action is available for this preview." };
		used.add(proposal);
		try {
			if (proposal.plan.status) {
				actions.review([...proposal.itemIds], proposal.plan.status);
				return { kind: "review", count: proposal.itemIds.length, status: proposal.plan.status };
			}
			actions.query({ ...proposal.plan.query });
			return { kind: "query" };
		} catch {
			return { error: "The action could not be applied. Prepare a new preview before trying again." };
		}
	}
	return { prepare, isCurrent, apply };
}

export interface ProfileTopicCollection extends ProposalCollection {
	profile: Pick<YearProfile, "revision" | "datasetRevision" | "queryRevision" | "reviewRevision" | "editorRevision" | "year" | "timezone" | "evidenceIds" | "styleChoices">;
	editorRevision: number;
	styleChoices: ProfileStyleChoices;
}
export interface ProfileTopicProposal {
	readonly revision: string;
	readonly literal: string;
	readonly eventIds: readonly string[];
}
const STALE_PROFILE = "The profile changed. Preview the literal matches again before applying.";
function profileReady(current: ProfileTopicCollection): boolean {
	return current.profile.datasetRevision === current.dataset.revision
		&& current.profile.queryRevision === current.queryRevision && current.profile.reviewRevision === current.reviewRevision
		&& current.profile.editorRevision === current.editorRevision && current.profile.timezone === current.dataset.timezone
		&& JSON.stringify(current.profile.styleChoices) === JSON.stringify(current.styleChoices);
}
function topicRevision(current: ProfileTopicCollection): string {
	return JSON.stringify([collectionRevision(current), current.profile.revision, current.profile.year,
		current.profile.evidenceIds, current.editorRevision, current.styleChoices]);
}

/** The literal only selects eligible sources in the current measured profile. */
export function createProfileTopicProposals(actions: {
	current: () => ProfileTopicCollection | null;
	edit: (topic: { literal: string; eventIds: string[] }) => void;
}) {
	const revisions = new WeakMap<ProfileTopicProposal, string>();
	const used = new WeakSet<ProfileTopicProposal>();
	function isCurrent(proposal: ProfileTopicProposal): boolean {
		const current = actions.current();
		return Boolean(current && profileReady(current) && !used.has(proposal) && revisions.get(proposal) === topicRevision(current));
	}
	function prepare(input: string): ProfileTopicProposal | ProposalError {
		const literal = input.trim(), current = actions.current();
		if (!current || !profileReady(current)) return { error: STALE_PROFILE };
		if (!literal || literal.length > 200) return { error: "Choose one literal phrase of at most 200 characters." };
		const allowed = new Set(current.profile.evidenceIds), lower = literal.toLowerCase();
		const eventIds = [...new Set(effectiveMatches(current, current.query).events
			.filter((event) => allowed.has(event.id) && profileOmissionReason(event, current.profile.year, current.profile.timezone) === null && event.text?.toLowerCase().includes(lower))
			.map((event) => event.id))];
		const proposal = Object.freeze({ revision: current.profile.revision, literal, eventIds: Object.freeze(eventIds) });
		revisions.set(proposal, topicRevision(current));
		return proposal;
	}
	function apply(proposal: ProfileTopicProposal): { kind: "topic"; count: number } | ProposalError {
		if (!isCurrent(proposal)) return { error: STALE_PROFILE };
		if (!proposal.eventIds.length) return { error: "No eligible profile messages match this literal phrase." };
		used.add(proposal);
		try {
			actions.edit({ literal: proposal.literal, eventIds: [...proposal.eventIds] });
			return { kind: "topic", count: proposal.eventIds.length };
		} catch {
			return { error: "The profile edit could not be applied. Prepare a new preview before trying again." };
		}
	}
	return { prepare, isCurrent, apply };
}
