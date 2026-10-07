import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveDataset, ConversationEvent } from "../src/types/dataset";
import { buildYearProfile, DEFAULT_PROFILE_STYLE, defaultProfileYear, prepareProfilePacket } from "../src/lib/yearProfile";
import { yearProfileJob, type ProfileJobInput } from "../src/lib/yearProfileJob";

function event(id: string, text: string, conversationId = "a", timestamp = "2019-01-01T12:00:00Z"): ConversationEvent {
	const source = { sourceId: "synthetic-only", path: "json/chat_history.json", recordPointer: `/${conversationId}/${id}` };
	return { id, conversationId, text, timestamp, year: 2019, ownerAuthored: true, authorship: "owner", kind: "text", participantId: "owner",
		time: { raw: timestamp, instant: timestamp, precision: "second", zone: "UTC", valid: true, reason: null, orderKey: timestamp },
		source, sources: [source], assetIds: [], mediaReferenceIds: [], raw: {} };
}
function dataset(events: ConversationEvent[]): ArchiveDataset {
	return { fingerprint: "synthetic-profile-only", revision: "synthetic-r1", normalizationVersion: 2, ownerUsername: "owner", timezone: "UTC",
		participants: [], conversations: ["a", "b"].map((id) => ({ id, title: `Conversation ${id}`, participantIds: ["owner"], eventIds: events.filter((item) => item.conversationId === id).map((item) => item.id), sources: [] })),
		events, assets: [], links: [], unsupported: [], coverage: { sections: { chats: { status: "available", recordCount: events.length, invalidCount: 0 } }, unknownAuthors: 0, invalidDates: 0, missingMedia: 0, duplicateRecords: 0, unsupportedRecords: 0, warnings: ["Retained records are incomplete history."] } };
}
function represented() {
	return Array.from({ length: 36 }, (_, index) => event(`message-${String(index).padStart(2, "0")}`, `Hei café hello ${index} 👋`, index % 2 ? "b" : "a", `2019-0${1 + Math.floor(index / 12)}-${String(1 + index % 12).padStart(2, "0")}T12:00:00Z`));
}
afterEach(() => vi.unstubAllGlobals());

describe("local owner profile evidence and evaluated coverage", () => {
	it("defaults to a usable owner-language year while retaining honest sparse or empty selections", () => {
		const records = [
			{ ...event("image", "", "a", "2012-01-01T12:00:00Z"), kind: "image" as const },
			{ ...event("incoming", "incoming words", "a", "2013-01-01T12:00:00Z"), ownerAuthored: false, authorship: "other" as const },
			{ ...event("copied", "copied words", "a", "2014-01-01T12:00:00Z"), raw: { IsCopied: true } },
			event("sparse", "yes", "a", "2015-01-01T12:00:00Z"),
			event("own-first", "hello", "a", "2020-01-01T12:00:00Z"), event("own-second", "world", "a", "2020-01-02T12:00:00Z"),
		];
		expect(defaultProfileYear(records, "UTC")).toBe(2020);
		expect(defaultProfileYear(records.slice(0, 4), "UTC")).toBe(2015);
		expect(defaultProfileYear(records.slice(0, 3), "UTC")).toBeNull();
	});
	it("scopes the worker payload to measured owner/year evidence with exact omission summaries", async () => {
		let transferred!: ProfileJobInput;
		class LocalWorker {
			onmessage: ((message: { data: unknown }) => void) | null = null;
			onerror = null;
			terminate() {}
			postMessage(input: ProfileJobInput) {
				transferred = input;
				queueMicrotask(() => this.onmessage!({ data: { jobId: input.jobId, profile: buildYearProfile(input.dataset, input.events, input.year, input.timezone, input.options, input.preparation) } }));
			}
		}
		vi.stubGlobal("Worker", LocalWorker);
		const incoming = Array.from({ length: 50_001 }, (_, index) => ({ ...event(`incoming-${index}`, "ineligible private canary"), ownerAuthored: false, authorship: "other" as const }));
		const records = [...incoming, event("own", "hello café"), event("profile-removed", "excluded private canary".repeat(1000)),
			event("future", "out-of-year private canary", "b", "2020-01-01T12:00:00Z"),
			{ ...event("copied", "copied private canary"), raw: { IsCopied: true } },
			{ ...event("unknown", "uncertain private canary"), authorship: "unknown" as const },
			{ ...event("undated", "undated private canary"), timestamp: null },
			{ ...event("attachment", "non-text private canary"), kind: "attachment" as const }];
		const updates: number[] = [];
		const result = await yearProfileJob(dataset(records), records, 2019, { excludedEventIds: ["profile-removed"] }, new AbortController().signal, (update) => updates.push(update.fraction));
		expect(result.evidenceIds).toEqual(["own"]);
		expect(result.eligibleMessageCount).toBe(2);
		expect(result.omitted).toEqual({ incoming: 50_001, uncertainAuthor: 1, unknownTime: 1, otherYear: 1, nonText: 1, knownCopied: 1, profileExcluded: 1 });
		expect(result.eligibleContributions).toEqual([{ conversationId: "a", title: "Conversation a", count: 2, selectedCount: 1 }]);
		expect(transferred.events.map((item) => item.id)).toEqual(["own"]);
		expect(JSON.stringify(transferred)).not.toContain("private canary");
		expect(updates.length).toBeGreaterThan(2);
		expect(updates.every((value) => value >= 0 && value <= 1)).toBe(true);
	});

	it("cancels preparation of a large irrelevant population before creating a worker", async () => {
		const construct = vi.fn(); vi.stubGlobal("Worker", class { constructor() { construct(); } });
		const records = Array.from({ length: 50_001 }, (_, index) => ({ ...event(`incoming-${index}`, "private"), ownerAuthored: false, authorship: "other" as const }));
		const controller = new AbortController();
		await expect(yearProfileJob(dataset(records), records, 2019, {}, controller.signal, () => controller.abort())).rejects.toMatchObject({ name: "AbortError" });
		expect(construct).not.toHaveBeenCalled();
	});

	it("still refuses a genuinely oversized measured owner population", async () => {
		vi.stubGlobal("Worker", undefined);
		const records = Array.from({ length: 50_001 }, (_, index) => event(`own-${index}`, "hi"));
		await expect(yearProfileJob(dataset(records), records, 2019, {}, new AbortController().signal)).rejects.toThrow("50,000 measured owner messages");
	});

	it("retains explicitly unmarked text while excluding positive copy flags and quoted content", () => {
		const records = [
			{ ...event("unmarked", "original owner words"), raw: { IsCopied: "false", Forwarded: false, IsQuoted: "0" } },
			{ ...event("copied", "outside author words"), raw: { IsCopied: true } },
			{ ...event("quoted", "literal false quotation"), raw: { "Quoted Text": "false" } },
		];
		const profile = buildYearProfile(dataset(records), records, 2019);
		expect(profile.evidenceIds).toEqual(["unmarked"]);
		expect(profile.omitted.knownCopied).toBe(2);
	});

	it("measures independently specified Unicode, phrases, punctuation and normalized contexts", () => {
		const first = event("first", "HI! 👋"); const second = event("second", "hi? café", "b", "2019-02-01T12:00:00Z");
		const records = [first, second, { ...event("incoming", "incoming canary"), ownerAuthored: false, authorship: "other" as const },
			{ ...event("uncertain", "uncertain canary"), authorship: "unknown" as const }, { ...event("undated", "unknown canary"), timestamp: null },
			event("future", "future canary", "a", "2020-01-01T12:00:00Z"), { ...event("quoted", "copied canary"), raw: { "Quoted Text": "external quote" } }];
		const profile = buildYearProfile(dataset(records), records, 2019);
		expect(profile.evidenceIds).toEqual(["first", "second"]);
		expect(profile.messageCount).toBe(2); expect(profile.tokenCount).toBe(3);
		expect(profile.averageLength).toBe(6.5); expect(profile.uppercaseRate).toBe(0.25);
		expect(profile.questionRate).toBe(0.5); expect(profile.exclamationRate).toBe(0.5); expect(profile.emojiPer100Messages).toBe(50);
		expect(profile.phrases.find((item) => item.word === "hi café")).toMatchObject({ count: 1, denominator: 1, perThousandTokens: 1000, eventIds: ["second"] });
		expect(profile.contributions.find((item) => item.conversationId === "a")).toMatchObject({ count: 1, averageLength: 5, questionsPer100Messages: 0, emojiPer100Messages: 100 });
		expect(profile.contributions.find((item) => item.conversationId === "b")).toMatchObject({ count: 1, averageLength: 8, questionsPer100Messages: 100, emojiPer100Messages: 0 });
		expect(profile.omitted).toMatchObject({ incoming: 1, uncertainAuthor: 1, unknownTime: 1, otherYear: 1, knownCopied: 1 });
		expect(JSON.stringify(prepareProfilePacket(profile))).not.toContain("canary");
	});

	it("edits profile evidence without changing originals or independent style measurements", () => {
		const records = represented(); const data = dataset(records); const original = JSON.stringify(data);
		const baseline = buildYearProfile(data, records, 2019);
		const edited = buildYearProfile(data, records, 2019, "UTC", { excludedConversationIds: ["b"], excludedEventIds: ["message-00"], editorRevision: 1 });
		expect(edited.eligibleMessageCount).toBe(36); expect(edited.messageCount).toBe(17); expect(edited.omitted.profileExcluded).toBe(19);
		expect(edited.examples.every((item) => item.conversationId === "a" && item.id !== "message-00")).toBe(true);
		expect(edited.eligibleContributions.find((item) => item.conversationId === "b")?.selectedCount).toBe(0);
		const preferred = buildYearProfile(data, records, 2019, "UTC", { styleChoices: { punctuation: "restrained", emoji: "less", intensity: 0.1 } });
		expect(preferred.measurements).toEqual(baseline.measurements); expect(preferred.revision).not.toBe(baseline.revision);
		expect(preferred.styleChoices).toEqual({ punctuation: "restrained", emoji: "less", intensity: 0.1 });
		expect(JSON.stringify(data)).toBe(original);
		expect(buildYearProfile(data, [...records].reverse(), 2019)).toEqual(baseline);
	});

	it("evaluates insufficient, sparse, represented, repetitive and single-audience fixtures", () => {
		const cases: [ConversationEvent[], string][] = [
			[[], "insufficient"], [[event("one", "okay")], "insufficient"], [[event("sketch", "Hei verden")], "limited"],
			[represented(), "represented"], [represented().map((item) => ({ ...item, text: "same repeated phrase" })), "limited"],
			[represented().map((item) => ({ ...item, conversationId: "a" })), "limited"],
			[represented().map((item) => ({ ...item, timestamp: "2019-01-01T12:00:00Z" })), "limited"],
		];
		for (const [records, expected] of cases) {
			const profile = buildYearProfile(dataset(records), records, 2019);
			expect(profile.sufficiency).toBe(expected); expect(profile.sufficiencyPolicy.version).toBe("local-coverage-v1");
		}
		const multilingual = represented().map((item, index) => ({ ...item, text: `blåbær café 你好 ${index} 🇳🇴` }));
		expect(buildYearProfile(dataset(multilingual), multilingual, 2019).sufficiency).toBe("represented");
	});

	it("bounds a local packet by selected sources and preserves inspectable truncation", () => {
		const records = represented().map((item, index) => ({ ...item, text: index === 0 ? `hello café ${"👋".repeat(600)}` : item.text }));
		const profile = buildYearProfile(dataset(records), records, 2019, "UTC", { excludedEventIds: ["message-01"] });
		const packet = prepareProfilePacket(profile);
		expect(packet.excerpts).toHaveLength(12); expect(packet.excerpts.every((item) => [...item.text].length <= 500)).toBe(true);
		expect(packet.excerpts.find((item) => item.eventId === "message-00")?.truncated).toBe(true);
		expect(packet.excerpts.some((item) => item.eventId === "message-01")).toBe(false);
		expect(packet).toMatchObject({ recipients: [], billingSource: null, budget: null, sendAllowed: false, profileRevision: profile.revision });
		expect(prepareProfilePacket(buildYearProfile(dataset([]), [], 2019)).excerpts).toEqual([]);
	});

	it("runs local fallback with actual progress and rejects cancellation and unsupported input sizes", async () => {
		vi.stubGlobal("Worker", undefined);
		const records = [event("own", "hello café"), { ...event("incoming", "private canary"), ownerAuthored: false, authorship: "other" as const }];
		const progress: number[] = [];
		const result = await yearProfileJob(dataset(records), records, 2019, { styleChoices: DEFAULT_PROFILE_STYLE }, new AbortController().signal, (update) => progress.push(update.fraction));
		expect(result.evidenceIds).toEqual(["own"]); expect(JSON.stringify(result)).not.toContain("private canary");
		expect(progress.at(-1)).toBe(1); expect(progress.every((value) => value >= 0 && value <= 1)).toBe(true);
		const canceled = new AbortController(); canceled.abort();
		await expect(yearProfileJob(dataset(records), records, 2019, {}, canceled.signal)).rejects.toMatchObject({ name: "AbortError" });
		await expect(yearProfileJob(dataset(records), [event("huge", "x".repeat(16_001))], 2019, {}, new AbortController().signal)).rejects.toThrow("limit");
	});

	it("terminates canceled workers and rejects stale or fabricated worker evidence", async () => {
		let ready!: (worker: FakeWorker) => void;
		class FakeWorker {
			onmessage: ((message: { data: unknown }) => void) | null = null;
			onerror: (() => void) | null = null;
			input!: ProfileJobInput;
			terminate = vi.fn();
			constructor() { ready(this); }
			postMessage(input: ProfileJobInput) { this.input = input; }
		}
		vi.stubGlobal("Worker", FakeWorker);
		const records = [event("own", "hello café")]; const data = dataset(records);
		let entered = new Promise<FakeWorker>((resolve) => { ready = resolve; });
		const canceled = new AbortController();
		const first = yearProfileJob(data, records, 2019, {}, canceled.signal);
		const firstWorker = await entered; canceled.abort();
		await expect(first).rejects.toMatchObject({ name: "AbortError" }); expect(firstWorker.terminate).toHaveBeenCalledOnce();
		for (const invalid of ["revision", "source", "source-pointer", "cross-year", "malformed", "incomplete"]) {
			entered = new Promise<FakeWorker>((resolve) => { ready = resolve; });
			const next = yearProfileJob(data, records, 2019, {}, new AbortController().signal);
			const worker = await entered; const profile = buildYearProfile(data, invalid === "incomplete" ? [] : records, 2019);
			if (invalid === "revision") profile.datasetRevision = "old-archive";
			else if (invalid === "source") profile.evidenceIds = ["fabricated-or-incoming-id"];
			else if (invalid === "source-pointer") profile.examples = profile.examples.map((item) => ({ ...item, source: { ...item.source, recordPointer: "/fabricated" } }));
			else if (invalid === "cross-year") profile.examples = profile.examples.map((item) => ({ ...item, timestamp: "2020-01-01T00:00:00Z" }));
			else if (invalid === "malformed") Object.assign(profile, { evidenceIds: undefined });
			worker.onmessage!({ data: { jobId: worker.input.jobId, profile } });
			await expect(next).rejects.toThrow("stale"); expect(worker.terminate).toHaveBeenCalledOnce();
		}
	});
});
