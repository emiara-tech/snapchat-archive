import type { ArchiveDataset, ConversationEvent, SourceReference } from "../types/dataset";
import { buildYearProfile, calendarPeriod, emptyProfileOmissions, profileEvidenceFlag, profileOmissionReason, type ProfileDataset, type ProfileEvent, type ProfileOptions, type ProfilePreparation, type YearProfile } from "./yearProfile";

export interface ProfileJobInput {
	jobId: string;
	dataset: ProfileDataset;
	events: ProfileEvent[];
	year: number;
	timezone: string;
	options: Omit<ProfileOptions, "progress">;
	preparation: ProfilePreparation;
}
export interface ProfileJobProgress { fraction: number; stage: string }
const MAX_PROFILE_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_PROFILE_RECORDS = 50_000;
let nextJobId = 0;
function check(signal: AbortSignal) { if (signal.aborted) throw new DOMException("Profile calculation canceled.", "AbortError"); }
function sameSource(source: SourceReference, expected: SourceReference): boolean {
	return source.sourceId === expected.sourceId && source.sourceFingerprint === expected.sourceFingerprint
		&& source.path === expected.path && source.recordPointer === expected.recordPointer && source.entryOrdinal === expected.entryOrdinal;
}
function validResult(profile: YearProfile, input: ProfileJobInput): boolean {
	const excluded = new Set(input.options.excludedEventIds ?? []);
	const conversations = new Set(input.options.excludedConversationIds ?? []);
	const allowed = new Map(input.events.filter((event) => event.ownerAuthored && event.authorship === "owner" && event.kind === "text"
		&& event.text?.trim() && !profileEvidenceFlag(event) && calendarPeriod(event.timestamp, input.timezone, "year") === String(input.year)
		&& !excluded.has(event.id) && !conversations.has(event.conversationId)).map((event) => [event.id, event]));
	return profile.datasetRevision === input.dataset.revision && profile.year === input.year && profile.timezone === input.timezone
		&& profile.queryRevision === (input.options.queryRevision ?? 0) && profile.reviewRevision === (input.options.reviewRevision ?? 0)
		&& profile.editorRevision === (input.options.editorRevision ?? 0) && profile.messageCount === profile.evidenceIds.length
		&& profile.eligibleMessageCount === input.events.length + input.preparation.omitted.profileExcluded
		&& Object.entries(input.preparation.omitted).every(([reason, count]) => profile.omitted[reason as keyof YearProfile["omitted"]] === count)
		&& profile.evidenceIds.length === allowed.size
		&& new Set(profile.evidenceIds).size === profile.evidenceIds.length && profile.evidenceIds.every((id) => allowed.has(id))
		&& profile.examples.every((event) => {
			const expected = allowed.get(event.id);
			return expected && expected.text === event.text && expected.conversationId === event.conversationId && expected.timestamp === event.timestamp
				&& event.ownerAuthored && event.authorship === "owner" && event.kind === "text" && !profileEvidenceFlag(event)
				&& sameSource(event.source, expected.source) && event.sources.length === expected.sources.length
				&& event.sources.every((source, index) => sameSource(source, expected.sources[index]!));
		})
		&& [...profile.terms, ...profile.phrases, ...profile.emoji, ...profile.measurements, ...profile.contributions].every((item) => item.eventIds.every((id) => allowed.has(id)));
}

export async function yearProfileJob(dataset: ArchiveDataset, events: ConversationEvent[], year: number,
	options: Omit<ProfileOptions, "progress">, signal: AbortSignal, progress: (update: ProfileJobProgress) => void = () => {}): Promise<YearProfile> {
	check(signal);
	const prepared: ProfileEvent[] = [];
	const preparation: ProfilePreparation = { omitted: emptyProfileOmissions(), excludedContributions: [] };
	const excludedEvents = new Set(options.excludedEventIds ?? []);
	const excludedConversations = new Set(options.excludedConversationIds ?? []);
	const excludedCounts = new Map<string, number>();
	let bytes = 0;
	for (const [index, event] of events.entries()) {
		check(signal);
		const reason = profileOmissionReason(event, year, dataset.timezone);
		if (reason) preparation.omitted[reason]++;
		else if (excludedEvents.has(event.id) || excludedConversations.has(event.conversationId)) {
			preparation.omitted.profileExcluded++;
			excludedCounts.set(event.conversationId, (excludedCounts.get(event.conversationId) ?? 0) + 1);
		} else {
			if (prepared.length >= MAX_PROFILE_RECORDS) throw new Error("This local profile supports up to 50,000 measured owner messages in the selected year. Narrow the collection before generating it.");
			bytes += (event.text?.length ?? 0) * 2;
			if (bytes > MAX_PROFILE_TEXT_BYTES || (event.text?.length ?? 0) > 16_000) throw new Error("This profile's owner text exceeds the local calculation limit. Narrow the collection; original messages remain available in Conversations.");
			prepared.push({ id: event.id, conversationId: event.conversationId, ownerAuthored: true, authorship: "owner",
				kind: "text", timestamp: event.timestamp, text: event.text, source: event.source, sources: event.sources, evidenceFlag: null });
		}
		if (index % 250 === 0) {
			progress({ fraction: events.length ? index / events.length * 0.1 : 0.1, stage: `Preparing ${index} of ${events.length} selected records` });
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		}
	}
	check(signal);
	preparation.excludedContributions = [...excludedCounts].map(([conversationId, count]) => ({ conversationId, count }));
	const contributingIds = new Set([...prepared.map((event) => event.conversationId), ...excludedCounts.keys()]);
	const input: ProfileJobInput = { jobId: `profile-job-${++nextJobId}`, dataset: { fingerprint: dataset.fingerprint, revision: dataset.revision,
		normalizationVersion: dataset.normalizationVersion, timezone: dataset.timezone, coverage: dataset.coverage,
		conversations: dataset.conversations.filter((conversation) => contributingIds.has(conversation.id)).map(({ id, title, participantIds }) => ({ id, title, participantIds, sources: [], eventIds: [] })) },
		events: prepared, year, timezone: dataset.timezone, options, preparation };
	if (typeof Worker === "undefined") {
		if (prepared.length > 1000) throw new Error("Background workers are unavailable. Choose fewer than 1,000 measured owner messages or use a browser with worker support.");
		return buildYearProfile(input.dataset, input.events, year, input.timezone, { ...options, progress: (fraction, stage) => progress({ fraction: 0.1 + fraction * 0.9, stage }) }, preparation);
	}
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL("./yearProfile.worker.ts", import.meta.url), { type: "module" });
		const close = () => { worker.terminate(); signal.removeEventListener("abort", abort); };
		const abort = () => { close(); reject(new DOMException("Profile calculation canceled.", "AbortError")); };
		signal.addEventListener("abort", abort, { once: true });
		worker.onmessage = (message: MessageEvent<{ jobId: string; progress?: ProfileJobProgress; profile?: YearProfile; error?: string }>) => {
			if (message.data.jobId !== input.jobId || signal.aborted) return;
			if (message.data.progress) { progress({ ...message.data.progress, fraction: 0.1 + message.data.progress.fraction * 0.9 }); return; }
			close();
			try {
				if (message.data.profile && validResult(message.data.profile, input)) { resolve(message.data.profile); return; }
			} catch { /* Malformed worker evidence cannot leave an unresolved calculation. */ }
			reject(new Error(message.data.error ?? "A stale or invalid local profile was rejected. Generate it again."));
		};
		worker.onerror = () => { close(); reject(new Error("The local profile worker failed. Retry with a smaller collection.")); };
		try { worker.postMessage(input); } catch { close(); reject(new Error("This browser could not start the local profile calculation.")); }
	});
}
