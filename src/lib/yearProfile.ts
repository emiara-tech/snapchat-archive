import type { ArchiveDataset, ConversationEvent } from "../types/dataset";

export interface LanguageTerm {
	word: string;
	count: number;
	perThousandTokens: number;
	eventIds: string[];
}
export type ProfileEvidenceFlag = "quoted" | "forwarded" | "copied" | null;
export type ProfileEvent = Pick<ConversationEvent, "id" | "conversationId" | "ownerAuthored" | "authorship" | "kind" | "text" | "timestamp" | "source" | "sources"> & { raw?: Record<string, unknown>; evidenceFlag?: ProfileEvidenceFlag };
export type ProfileDataset = Pick<ArchiveDataset, "fingerprint" | "revision" | "normalizationVersion" | "timezone" | "conversations" | "coverage">;
export interface ProfileStyleChoices {
	punctuation: "measured" | "restrained" | "expressive";
	emoji: "measured" | "less" | "more";
	intensity: number;
}
export const DEFAULT_PROFILE_STYLE: ProfileStyleChoices = { punctuation: "measured", emoji: "measured", intensity: 0.5 };
export type ProfileOmissionReason = "incoming" | "uncertainAuthor" | "unknownTime" | "otherYear" | "nonText" | "knownCopied";
export type ProfileOmissionCounts = Record<ProfileOmissionReason | "profileExcluded", number>;
export interface ProfilePreparation {
	omitted: ProfileOmissionCounts;
	excludedContributions: { conversationId: string; count: number }[];
}
export const emptyProfileOmissions = (): ProfileOmissionCounts => ({ incoming: 0, uncertainAuthor: 0, unknownTime: 0, otherYear: 0, nonText: 0, knownCopied: 0, profileExcluded: 0 });
export interface ProfileOptions {
	excludedEventIds?: string[];
	excludedConversationIds?: string[];
	queryRevision?: number;
	reviewRevision?: number;
	editorRevision?: number;
	styleChoices?: ProfileStyleChoices;
	progress?: (fraction: number, stage: string) => void;
}
export interface ProfileMeasurement {
	id: string;
	label: string;
	value: number;
	unit: string;
	denominator: number;
	denominatorUnit: string;
	policy: string;
	eventIds: string[];
}
export interface ProfileContribution {
	conversationId: string;
	title: string;
	count: number;
	share: number;
	tokenCount: number;
	averageLength: number;
	questionsPer100Messages: number;
	emojiPer100Messages: number;
	eventIds: string[];
}
export interface YearProfile {
	id: string;
	schemaVersion: number;
	calculationVersion: string;
	tokenizerVersion: string;
	sufficiencyPolicy: { version: string; reason: string; thresholds: string };
	year: number;
	timezone: string;
	revision: string;
	datasetRevision: string;
	queryRevision: number;
	reviewRevision: number;
	editorRevision: number;
	eligibleMessageCount: number;
	messageCount: number;
	activeDays: number;
	activeMonths: string[];
	firstTimestamp: string | null;
	lastTimestamp: string | null;
	uniqueTextCount: number;
	duplicateMessageCount: number;
	tokenCount: number;
	averageLength: number;
	questionRate: number;
	exclamationRate: number;
	uppercaseRate: number;
	emojiPer100Messages: number;
	measurements: ProfileMeasurement[];
	terms: LanguageTerm[];
	phrases: (LanguageTerm & { size: number; denominator: number })[];
	emoji: { emoji: string; count: number; eventIds: string[] }[];
	examples: ProfileEvent[];
	contributions: ProfileContribution[];
	eligibleContributions: { conversationId: string; title: string; count: number; selectedCount: number }[];
	evidenceIds: string[];
	omitted: ProfileOmissionCounts;
	styleChoices: ProfileStyleChoices;
	interpretations: { text: string; uncertainty: string; eventIds: string[] }[];
	sufficiency: "insufficient" | "limited" | "represented";
	limitations: string[];
}

export function languageTokens(input: string): string[] {
	return (
		input
			.replace(/https?:\/\/\S+/gi, " ")
			.toLowerCase()
			.match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? []
	);
}

export function selectionRevision(ids: string[]): string {
	let hash = 2166136261;
	for (const id of ids)
		for (const character of `${id}\u0000`)
			hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return `${ids.length}:${(hash >>> 0).toString(16)}`;
}

const calendarFormatters = new Map<string, Intl.DateTimeFormat>();
export function calendarPeriod(
	timestamp: string | null,
	timezone: string,
	unit: "year" | "month" | "day" = "day",
): string | null {
	if (!timestamp) return null;
	const date = new Date(timestamp);
	if (!Number.isFinite(date.getTime())) return null;
	if (timezone === "UTC")
		return date
			.toISOString()
			.slice(0, unit === "year" ? 4 : unit === "month" ? 7 : 10);
	let formatter = calendarFormatters.get(timezone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		if (calendarFormatters.size >= 16) calendarFormatters.clear();
		calendarFormatters.set(timezone, formatter);
	}
	const parts = formatter.formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return unit === "year"
		? value("year")
		: unit === "month"
			? `${value("year")}-${value("month")}`
			: `${value("year")}-${value("month")}-${value("day")}`;
}

export function measuredLanguage(
	events: Pick<ConversationEvent, "id" | "text">[],
): { terms: LanguageTerm[]; tokenCount: number } {
	const frequencies = new Map<
		string,
		{ count: number; eventIds: Set<string> }
	>();
	let tokenCount = 0;
	for (const event of events) {
		for (const word of languageTokens(event.text ?? "")) {
			tokenCount++;
			const entry = frequencies.get(word) ?? {
				count: 0,
				eventIds: new Set<string>(),
			};
			entry.count++;
			entry.eventIds.add(event.id);
			frequencies.set(word, entry);
		}
	}
	const terms = [...frequencies].map(([word, entry]) => ({
		word,
		count: entry.count,
		eventIds: [...entry.eventIds].sort(),
		perThousandTokens: tokenCount ? (entry.count / tokenCount) * 1000 : 0,
	}));
	terms.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
	return { terms, tokenCount };
}

export function profileEvidenceFlag(event: Pick<ProfileEvent, "raw" | "evidenceFlag">): ProfileEvidenceFlag {
	if (event.evidenceFlag !== undefined) return event.evidenceFlag;
	for (const [key, value] of Object.entries(event.raw ?? {})) {
		const contentField = /(?:text|content|message)$/i.test(key);
		const marked = value === true || value === 1 || (typeof value === "string" && Boolean(value.trim())
			&& (contentField || !/^(?:false|0|no)$/i.test(value.trim())));
		if (/^(?:is[ _-]*)?(?:quoted|quote|forwarded|copied)(?:[ _-]*(?:text|content|message))?$/i.test(key)
			&& marked) {
			if (/forward/i.test(key)) return "forwarded";
			if (/cop/i.test(key)) return "copied";
			return "quoted";
		}
	}
	return null;
}

const emojiSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function emojiSymbols(text: string): string[] {
	return [...emojiSegmenter.segment(text)].map(({ segment }) => segment).filter((segment) =>
		/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(segment) || /^[#*0-9]\uFE0F?\u20E3$/u.test(segment));
}

export function profileOmissionReason(event: ProfileEvent, year: number, timezone: string): ProfileOmissionReason | null {
	if (event.kind !== "text" || !event.text?.trim()) return "nonText";
	if (event.authorship === "other") return "incoming";
	if (!event.ownerAuthored || event.authorship !== "owner") return "uncertainAuthor";
	const recordedYear = calendarPeriod(event.timestamp, timezone, "year");
	if (!recordedYear) return "unknownTime";
	if (recordedYear !== String(year)) return "otherYear";
	return profileEvidenceFlag(event) ? "knownCopied" : null;
}

/** Prefer evidence meeting the same two-token minimum as profile sufficiency, with sparse years still inspectable. */
export function defaultProfileYear(events: ProfileEvent[], timezone: string): number | null {
	const tokens = new Map<number, number>();
	for (const event of events) {
		const recorded = calendarPeriod(event.timestamp, timezone, "year");
		if (!recorded) continue;
		const year = Number(recorded);
		if (profileOmissionReason(event, year, timezone)) continue;
		const count = tokens.get(year) ?? 0;
		if (count < 2) tokens.set(year, Math.min(2, count + languageTokens(event.text ?? "").length));
	}
	const years = [...tokens.keys()].sort((a, b) => a - b);
	return years.find((year) => tokens.get(year)! >= 2) ?? years[0] ?? null;
}

export function buildYearProfile(dataset: ProfileDataset, selectedEvents: ProfileEvent[], year: number,
	timezone: string = dataset.timezone, options: ProfileOptions = {}, preparation?: ProfilePreparation): YearProfile {
	const report = options.progress ?? (() => {});
	report(0, "Checking owner, dates and evidence choices");
	const omitted = { ...emptyProfileOmissions(), ...preparation?.omitted };
	const excludedEvents = new Set(options.excludedEventIds ?? []);
	const excludedConversations = new Set(options.excludedConversationIds ?? []);
	const eligible: ProfileEvent[] = [];
	const events: ProfileEvent[] = [];
	for (const [index, event] of selectedEvents.entries()) {
		const reason = profileOmissionReason(event, year, timezone);
		if (reason) omitted[reason]++;
		else {
			eligible.push(event);
			if (excludedEvents.has(event.id) || excludedConversations.has(event.conversationId)) omitted.profileExcluded++;
			else events.push(event);
		}
		if (index % 200 === 0) report(selectedEvents.length ? index / selectedEvents.length * 0.2 : 0.2, "Checking selected records");
	}
	events.sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? "") || a.id.localeCompare(b.id));
	const { terms, tokenCount } = measuredLanguage(events);
	const days = new Set<string>(); const months = new Set<string>();
	const context = new Map<string, ProfileEvent[]>();
	const eligibleCounts = new Map((preparation?.excludedContributions ?? []).map((item) => [item.conversationId, item.count]));
	const titles = new Map(dataset.conversations.map((conversation) => [conversation.id, conversation.title]));
	for (const event of eligible) eligibleCounts.set(event.conversationId, (eligibleCounts.get(event.conversationId) ?? 0) + 1);
	const emojis = new Map<string, { count: number; eventIds: Set<string> }>();
	const phraseCounts = new Map<string, { count: number; size: number; eventIds: Set<string> }>();
	const phraseDenominators = [0, 0, 0, 0];
	const details = new Map<string, { length: number; emojiCount: number; words: number }>();
	let totalLength = 0; let letters = 0; let uppercase = 0; let emojiCount = 0;
	const questionIds: string[] = []; const exclamationIds: string[] = []; const casedIds: string[] = [];
	for (const [index, event] of events.entries()) {
		const text = event.text ?? "";
		const day = calendarPeriod(event.timestamp, timezone); const month = calendarPeriod(event.timestamp, timezone, "month");
		if (day) days.add(day); if (month) months.add(month);
		const group = context.get(event.conversationId) ?? []; group.push(event); context.set(event.conversationId, group);
		const symbols = emojiSymbols(text); const length = [...text].length; const words = languageTokens(text);
		details.set(event.id, { length, emojiCount: symbols.length, words: words.length }); totalLength += length; emojiCount += symbols.length;
		if (text.includes("?")) questionIds.push(event.id); if (text.includes("!")) exclamationIds.push(event.id);
		let cased = false;
		for (const character of text) {
			if (!/\p{L}/u.test(character) || character.toLowerCase() === character.toUpperCase()) continue;
			cased = true; letters++; if (character === character.toUpperCase()) uppercase++;
		}
		if (cased) casedIds.push(event.id);
		for (const symbol of symbols) {
			const entry = emojis.get(symbol) ?? { count: 0, eventIds: new Set<string>() };
			entry.count++; entry.eventIds.add(event.id); emojis.set(symbol, entry);
		}
		for (const size of [2, 3]) {
			phraseDenominators[size]! += Math.max(0, words.length - size + 1);
			for (let position = 0; position <= words.length - size; position++) {
				const phrase = words.slice(position, position + size).join(" ");
				const entry = phraseCounts.get(phrase) ?? { count: 0, size, eventIds: new Set<string>() };
				entry.count++; entry.eventIds.add(event.id); phraseCounts.set(phrase, entry);
			}
		}
		if (index % 200 === 0) report(0.2 + (events.length ? index / events.length * 0.55 : 0.55), "Measuring words, phrases, punctuation and emoji");
	}
	const evidenceIds = events.map((event) => event.id);
	const rate = (count: number, denominator: number) => denominator ? count / denominator : 0;
	const contributions: ProfileContribution[] = [...context].map(([conversationId, group]) => ({
		conversationId, title: titles.get(conversationId) ?? "Unknown conversation", count: group.length, share: rate(group.length, events.length),
		tokenCount: group.reduce((sum, event) => sum + details.get(event.id)!.words, 0),
		averageLength: group.reduce((sum, event) => sum + details.get(event.id)!.length, 0) / group.length,
		questionsPer100Messages: rate(group.filter((event) => event.text?.includes("?")).length, group.length) * 100,
		emojiPer100Messages: rate(group.reduce((sum, event) => sum + details.get(event.id)!.emojiCount, 0), group.length) * 100,
		eventIds: group.map((event) => event.id),
	})).sort((a, b) => b.count - a.count || a.conversationId.localeCompare(b.conversationId));
	const selectedCounts = new Map(contributions.map((item) => [item.conversationId, item.count]));
	const eligibleContributions = [...eligibleCounts].map(([conversationId, count]) => ({ conversationId, title: titles.get(conversationId) ?? "Unknown conversation", count, selectedCount: selectedCounts.get(conversationId) ?? 0 })).sort((a, b) => b.count - a.count || a.conversationId.localeCompare(b.conversationId));
	const examples: ProfileEvent[] = []; const seenText = new Set<string>();
	let samples = [...context.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => ({ group, index: 0 }));
	while (samples.length && examples.length < 24) {
		const next = [];
		for (const sample of samples) {
			const event = sample.group[sample.index++];
			if (event && examples.length < 24) {
				const text = event.text?.trim() ?? "";
				if (!seenText.has(text)) { seenText.add(text); examples.push(event); }
			}
			if (sample.index < sample.group.length) next.push(sample);
		}
		samples = next;
	}
	const uniqueTextCount = new Set(events.map((event) => event.text?.trim())).size;
	const sufficiency = !events.length || tokenCount < 2 ? "insufficient"
		: events.length >= 30 && uniqueTextCount >= 20 && uniqueTextCount / events.length >= 0.5 && days.size >= 6 && months.size >= 3 && contributions.length >= 2 && (contributions[0]?.share ?? 0) <= 0.85 ? "represented" : "limited";
	const reason = sufficiency === "insufficient" ? "No usable owner-language evidence remains, or fewer than two word tokens were retained. Choose another year or restore profile evidence."
		: sufficiency === "represented" ? "This collection meets the local coverage policy across messages, original text, dates and conversation contexts. This does not establish persona reliability."
		: "This evidence supports a limited language sketch. Message count, repetition, dates or conversation diversity does not meet the local coverage policy.";
	const styleChoices = { ...DEFAULT_PROFILE_STYLE, ...options.styleChoices };
	const selection = selectionRevision([dataset.revision, String(year), timezone, String(options.queryRevision ?? 0), String(options.reviewRevision ?? 0), String(options.editorRevision ?? 0), JSON.stringify(styleChoices), ...evidenceIds]);
	const metric = (id: string, label: string, value: number, unit: string, denominator: number, denominatorUnit: string, eventIds: string[], policy: string): ProfileMeasurement => ({ id, label, value, unit, denominator, denominatorUnit, eventIds, policy });
	report(1, "Local profile ready");
	return {
		id: `owner-profile-v2:${dataset.fingerprint}:${year}`, schemaVersion: 2, calculationVersion: "owner-language-v2", tokenizerVersion: "unicode-words-and-graphemes-v2",
		sufficiencyPolicy: { version: "local-coverage-v1", reason, thresholds: "Represented: 30 messages, 20 distinct texts, at least 50% distinct, 6 active days, 3 observed months, 2 conversations, and no conversation above 85%. Insufficient: no messages or fewer than 2 word tokens. Evaluated on synthetic boundary, sparse, repetition, diversity and multilingual fixtures; persona reliability remains unevaluated." },
		year, timezone, revision: `${dataset.revision}:owner-language-v2:${selection}`, datasetRevision: dataset.revision,
		queryRevision: options.queryRevision ?? 0, reviewRevision: options.reviewRevision ?? 0, editorRevision: options.editorRevision ?? 0,
		eligibleMessageCount: eligible.length + (preparation?.omitted.profileExcluded ?? 0), messageCount: events.length, activeDays: days.size, activeMonths: [...months].sort(), firstTimestamp: events[0]?.timestamp ?? null, lastTimestamp: events.at(-1)?.timestamp ?? null,
		uniqueTextCount, duplicateMessageCount: events.length - uniqueTextCount, tokenCount,
		averageLength: rate(totalLength, events.length), questionRate: rate(questionIds.length, events.length), exclamationRate: rate(exclamationIds.length, events.length), uppercaseRate: rate(uppercase, letters), emojiPer100Messages: rate(emojiCount, events.length) * 100,
		measurements: [
			metric("length", "Mean characters", rate(totalLength, events.length), "Unicode code points per message", events.length, "owner messages", evidenceIds, "Original selected text; Unicode code points, not bytes or visual glyph width."),
			metric("questions", "Messages containing ?", rate(questionIds.length, events.length) * 100, "% of messages", events.length, "owner messages", questionIds, "At least one literal question mark in the message; this does not infer intent."),
			metric("exclamations", "Messages containing !", rate(exclamationIds.length, events.length) * 100, "% of messages", events.length, "owner messages", exclamationIds, "At least one literal exclamation mark in the message."),
			metric("capitalization", "Uppercase cased letters", rate(uppercase, letters) * 100, "% of cased letters", letters, "Unicode cased letters", casedIds, "Only letters with distinct upper/lowercase forms enter the denominator; uncased scripts are preserved."),
			metric("emoji", "Emoji clusters", rate(emojiCount, events.length) * 100, "clusters per 100 messages", events.length, "owner messages", [...new Set([...emojis.values()].flatMap((entry) => [...entry.eventIds]))], "Intl.Segmenter grapheme clusters including flags, modifiers, joined emoji and keycaps."),
		],
		terms: terms.slice(0, 64), phrases: [...phraseCounts].map(([word, entry]) => ({ word, size: entry.size, count: entry.count, eventIds: [...entry.eventIds].sort(), denominator: phraseDenominators[entry.size]!, perThousandTokens: rate(entry.count, phraseDenominators[entry.size]!) * 1000 })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, 40),
		emoji: [...emojis].map(([symbol, entry]) => ({ emoji: symbol, count: entry.count, eventIds: [...entry.eventIds].sort() })).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)),
		examples, contributions, eligibleContributions, evidenceIds, omitted, styleChoices, interpretations: [], sufficiency,
		limitations: ["Only proven owner-authored text in the selected collection contributes. Shared exclusions always apply.",
			"Observed dates describe retained archive records. Missing months are unknown, not proof of inactivity.",
			"All retained repetitions count in population measurements; the balanced 24-example sample omits exact repeated text.",
			"Known quoted, forwarded and copied records are omitted conservatively. Unmarked copied text cannot be detected reliably; language identity stays unknown, including mixed-language text.",
			"Context rates use each conversation's own denominator. A small context is a sparse observation, not a causal or personality claim.",
			...dataset.coverage.warnings, reason],
	};
}

export interface PreparedProfilePacket {
	purpose: string;
	profileRevision: string;
	year: number;
	omittedExamples: number;
	recipients: string[];
	billingSource: null;
	budget: null;
	sendAllowed: false;
	styleChoices: ProfileStyleChoices;
	measurements: Omit<ProfileMeasurement, "eventIds">[];
	excerpts: { eventId: string; text: string; truncated: boolean; source: ProfileEvent["source"] }[];
}
export function prepareProfilePacket(profile: YearProfile): PreparedProfilePacket {
	const excerpts = profile.sufficiency === "insufficient" ? [] : profile.examples.slice(0, 12).map((event) => ({ eventId: event.id, text: [...(event.text ?? "")].slice(0, 500).join(""), truncated: [...(event.text ?? "")].length > 500, source: event.source }));
	return { purpose: "Optional interpretation of this year's owner-language evidence", profileRevision: profile.revision, year: profile.year,
		omittedExamples: Math.max(0, profile.examples.length - excerpts.length), recipients: [], billingSource: null, budget: null, sendAllowed: false,
		styleChoices: profile.styleChoices, measurements: profile.measurements.map(({ eventIds: _ids, ...metric }) => metric), excerpts };
}
