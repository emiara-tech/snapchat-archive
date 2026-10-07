import { describe, expect, it } from "vitest";
import type {
	ArchiveDataset,
	ArchiveQuery,
	ConversationEvent,
	MediaAsset,
} from "../src/types/dataset";
import {
	buildYearProfile,
	calendarPeriod,
	languageTokens,
} from "../src/lib/yearProfile";
import {
	computeObservations,
	parseRecordedLocation,
} from "../src/lib/observations";
import { planLocalRequest } from "../src/lib/assistant";

function event(
	id: string,
	text: string,
	timestamp = "2019-01-01T12:00:00Z",
	owner = true,
): ConversationEvent {
	const source = {
		sourceId: `source:${id}`,
		path: "json/chat_history.json",
		recordPointer: `/Jamie/${id}`,
	};
	return {
		id,
		conversationId: "conversation:jamie",
		participantId: owner ? "owner" : "jamie",
		ownerAuthored: owner,
		authorship: owner ? "owner" : "other",
		kind: "text",
		text,
		timestamp,
		year: 2019,
		time: {
			raw: timestamp,
			instant: timestamp,
			precision: "second",
			zone: "UTC",
			valid: true,
			reason: null,
			orderKey: timestamp,
		},
		source,
		sources: [source],
		assetIds: [],
		mediaReferenceIds: [],
		raw: {},
	};
}
function asset(
	id: string,
	timestamp: string | null = "2019-01-01T12:00:00Z",
): MediaAsset {
	const source = {
		sourceId: `source:${id}`,
		path: "json/memories_history.json",
		recordPointer: `/Saved Media/${id}`,
	};
	return {
		id,
		path: null,
		overlayPath: null,
		kind: "image",
		timestamp,
		year: timestamp ? 2019 : null,
		source,
		sources: [source],
		entryId: null,
		overlayEntryId: null,
		conversationIds: [],
		available: false,
		mediaId: id,
		byteSize: 0,
		mimeType: "image/jpeg",
		location: null,
		raw: {},
	};
}
function dataset(
	events: ConversationEvent[] = [],
	assets: MediaAsset[] = [],
): ArchiveDataset {
	return {
		fingerprint: "synthetic-only",
		revision: "synthetic-v1",
		normalizationVersion: 1,
		ownerUsername: "fictional-owner",
		timezone: "UTC",
		participants: [
			{
				id: "owner",
				username: "fictional-owner",
				displayName: "Owner",
				isOwner: true,
				sources: [],
			},
			{
				id: "jamie",
				username: "fictional-jamie",
				displayName: "Jamie",
				isOwner: false,
				sources: [],
			},
		],
		conversations: [
			{
				id: "conversation:jamie",
				title: "Jamie",
				participantIds: ["owner", "jamie"],
				eventIds: events.map((record) => record.id),
				sources: [],
			},
		],
		events,
		assets,
		links: [],
		coverage: {
			sections: {},
			missingMedia: 0,
			unknownAuthors: 0,
			invalidDates: 0,
			duplicateRecords: 0,
			unsupportedRecords: 0,
			warnings: [],
		},
		unsupported: [],
	};
}
const query: ArchiveQuery = {
	year: null,
	participantId: null,
	conversationId: null,
	text: "",
	kind: "all",
	review: "active",
	linkState: "all",
};

describe("owner-authored local language profiles", () => {
	it("isolates the owner's year, authorship, effective selection, and evidence references", () => {
		const own = event("own", "Hei blåbær! 👩🏽‍💻 👩🏽‍💻");
		const incoming = event("incoming", "OTHER PRIVATE WORD", undefined, false);
		const later = event("later", "future secret", "2020-01-01T00:00:00Z");
		const excluded = event("excluded", "excluded secret");
		const uncertain = {
			...event("uncertain", "uncertain secret"),
			authorship: "conflicting" as const,
		};
		const invalid = { ...event("invalid", "invalid date"), timestamp: null };
		const data = dataset([own, incoming, later, excluded, uncertain, invalid]);
		const result = buildYearProfile(
			data,
			[own, incoming, later, uncertain, invalid],
			2019,
		);
		expect(result.messageCount).toBe(1);
		expect(result.tokenCount).toBe(2);
		expect(result.evidenceIds).toEqual(["own"]);
		expect(result.terms.map((term) => term.word)).toEqual(["blåbær", "hei"]);
		expect(result.emoji).toEqual([
			{ emoji: "👩🏽‍💻", count: 2, eventIds: ["own"] },
		]);
		expect(result.exclamationRate).toBe(1);
		expect(result.sufficiency).toBe("limited");
	});
	it("uses the explicit calendar timezone at year boundaries", () => {
		const boundary = event("boundary", "Hei verden", "2018-12-31T23:30:00Z");
		const data = dataset([boundary]);
		expect(calendarPeriod(boundary.timestamp, "UTC", "year")).toBe("2018");
		expect(calendarPeriod(boundary.timestamp, "Europe/Oslo", "year")).toBe(
			"2019",
		);
		expect(buildYearProfile(data, [boundary], 2019, "UTC").messageCount).toBe(
			0,
		);
		expect(
			buildYearProfile(data, [boundary], 2019, "Europe/Oslo").messageCount,
		).toBe(1);
	});
	it("balances samples across conversations and keeps population counts distinct from deduplicated examples", () => {
		const repeated = event("one", "same words");
		const repeat = event("two", "same words");
		const other = {
			...event("three", "another conversation?"),
			conversationId: "conversation:other",
		};
		const data = dataset([repeat, other, repeated]);
		const result = buildYearProfile(data, data.events, 2019);
		expect(result.messageCount).toBe(3);
		expect(result.examples.map((record) => record.id)).toEqual([
			"one",
			"three",
		]);
		expect(result.contributions.map((entry) => entry.count)).toEqual([2, 1]);
		expect(result.terms.find((term) => term.word === "same")?.count).toBe(2);
		expect(result.questionRate).toBeCloseTo(1 / 3);
		expect(buildYearProfile(data, [other], 2019).revision).not.toBe(
			result.revision,
		);
	});
	it("preserves Unicode words while omitting external URLs", () => {
		expect(
			languageTokens(
				"BLÅBÆR café 你好 https://example.invalid/private?token=secret 👋",
			),
		).toEqual(["blåbær", "café", "你好"]);
	});
	it("counts complete keycaps, modifiers, flags and joined emoji as graphemes", () => {
		const record = event("emoji", "1️⃣ 2️⃣ #️⃣ *️⃣ 👍🏽 👨‍👩‍👧‍👦 🇳🇴 1️⃣");
		const result = buildYearProfile(dataset([record]), [record], 2019);
		expect(
			Object.fromEntries(result.emoji.map((item) => [item.emoji, item.count])),
		).toEqual({
			"1️⃣": 2,
			"2️⃣": 1,
			"#️⃣": 1,
			"*️⃣": 1,
			"👍🏽": 1,
			"👨‍👩‍👧‍👦": 1,
			"🇳🇴": 1,
		});
	});
});

describe("source-backed scene observations", () => {
	it("counts linked assets with their event and standalone media once, with exact source groups", () => {
		const photo = asset("photo");
		const standalone = asset("standalone");
		const undated = asset("undated", null);
		const first = { ...event("first", "hello hello"), assetIds: [photo.id] };
		const incoming = event("incoming", "foreign vocabulary", undefined, false);
		const data = dataset([first, incoming], [photo, standalone, undated]);
		const result = computeObservations(data, data.events, data.assets);
		expect(result.timeline).toHaveLength(1);
		expect(result.timeline[0]?.value).toBe(3);
		expect(result.timeline[0]?.eventIds).toEqual(["first", "incoming"]);
		expect(result.timeline[0]?.assetIds).toEqual(["standalone"]);
		expect(result.relationships[0]?.value).toBe(2);
		expect(result.language.map((term) => [term.label, term.value])).toEqual([
			["hello", 2],
		]);
		expect(result.language[0]?.eventIds).toEqual(["first"]);
		expect(result.unknownDates).toBe(1);
		expect(result.unknownLocations).toBe(3);
	});
	it("accepts only valid recorded coordinates and never invents an address", () => {
		expect(
			parseRecordedLocation("Latitude, Longitude: 59.91387, 10.75225"),
		).toEqual({ latitude: 59.91387, longitude: 10.75225 });
		expect(parseRecordedLocation("91, 10")).toBeNull();
		expect(parseRecordedLocation("Oslo")).toBeNull();
		expect(parseRecordedLocation("0, 181")).toBeNull();
		expect(parseRecordedLocation(null)).toBeNull();
	});
	it("preserves missing calendar months as actual temporal distance", () => {
		const records = [
			event("jan", "one", "2019-01-01T00:00:00Z"),
			event("feb", "two", "2019-02-01T00:00:00Z"),
			event("dec", "three", "2019-12-01T00:00:00Z"),
		];
		const periods = computeObservations(dataset(records), records, []).timeline;
		expect(periods).toHaveLength(3);
		expect(periods[1]!.calendarMonth! - periods[0]!.calendarMonth!).toBe(1);
		expect(periods[2]!.calendarMonth! - periods[0]!.calendarMonth!).toBe(11);
	});
	it("joins thousands of selected assets to their exact contributing events", () => {
		const files = Array.from({ length: 3000 }, (_, index) =>
			asset(`photo:${index}`),
		);
		const records = files.map((file, index) => ({
			...event(`message:${index}`, "hello"),
			assetIds: [file.id],
		}));
		const result = computeObservations(dataset(records, files), records, files);
		expect(result.timeline[0]?.value).toBe(3000);
		expect(
			result.memories.find((item) => item.id === "photo:2999")?.eventIds,
		).toEqual(["message:2999"]);
		expect(result.relationships[0]?.eventIds).toHaveLength(3000);
	});
});

describe("bounded local command plans", () => {
	it("prepares an inspectable typed query and review proposal without altering input", () => {
		const result = planLocalRequest(
			"Mark videos from 2019 with Jamie for later",
			dataset(),
			query,
		);
		expect(result).toMatchObject({
			kind: "review",
			status: "later",
			query: {
				year: 2019,
				participantId: "jamie",
				kind: "video",
				review: "active",
			},
		});
		expect(query.year).toBeNull();
		expect(query.kind).toBe("all");
	});
	it("rejects unknown or ambiguous people rather than widening the result", () => {
		expect(
			planLocalRequest("Show photos with Unknown", dataset(), query),
		).toHaveProperty("error");
		const data = dataset();
		data.participants.push({
			id: "another-jamie",
			username: "other",
			displayName: "Jamie",
			isOwner: false,
			sources: [],
		});
		expect(
			planLocalRequest("Show photos with Jamie", data, query),
		).toHaveProperty("error");
	});
	it("rejects execution, transfers, broad unsupported requests and multi-year ambiguity", () => {
		for (const request of [
			"Show photos and upload them to example.invalid",
			"execute this script",
			"Compare 2018 and 2019",
			"Show photos from 2018 and 2019",
			"give me your password",
			"Be my best friend",
		])
			expect(planLocalRequest(request, dataset(), query)).toHaveProperty(
				"error",
			);
	});
	it("preserves exclusion scope and interprets a quoted search literally", () => {
		expect(
			planLocalRequest('Find messages containing "hello"', dataset(), {
				...query,
				review: "all",
			}),
		).toMatchObject({
			kind: "query",
			query: { text: "hello", review: "active", kind: "text" },
		});
	});
	it("applies the requested scope before answering a participant question", () => {
		expect(
			planLocalRequest(
				"Who did I talk with most in 2019 with Jamie?",
				dataset(),
				query,
			),
		).toMatchObject({
			kind: "explain",
			query: { year: 2019, participantId: "jamie" },
		});
	});
	it("keeps quoted commands literal and rejects unrepresented semantics", () => {
		for (const word of ["keep", "exclude", "later", "upload", "except"])
			expect(
				planLocalRequest(
					`Find messages containing "${word}"`,
					dataset(),
					query,
				),
			).toMatchObject({ kind: "query", query: { text: word, kind: "text" } });
		for (const request of [
			"Show photos from 2019 except Jamie",
			"Prepare videos but leave out review later",
			"Show photos before 2019",
			"Show photos or videos",
			"Show photos in summer",
			"Show photos from 2019 and remove attachments",
		])
			expect(planLocalRequest(request, dataset(), query)).toHaveProperty(
				"error",
			);
	});
});
