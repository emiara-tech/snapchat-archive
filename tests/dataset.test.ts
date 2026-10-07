import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, fingerprintArchiveSource, normalizeArchiveDataset, normalizeTime, queryDataset, type DatasetInput } from "../src/lib/dataset";
import type { ReviewDecision } from "../src/types/dataset";

function fixture(): DatasetInput {
	return {
		entries: [
			{ id: { sourceId: "metadata", path: "json/account.json", ordinal: 0 }, compressedSize: 30, uncompressedSize: 40, isDirectory: false, signature: 10 },
			{ id: { sourceId: "media", path: "memories/2013-07-12_photo-one-main.jpg", ordinal: 0 }, compressedSize: 20, uncompressedSize: 30, isDirectory: false, signature: 11 },
			{ id: { sourceId: "media", path: "memories/2013-07-12_photo-one-overlay.png", ordinal: 1 }, compressedSize: 20, uncompressedSize: 30, isDirectory: false, signature: 12 },
		],
		documents: [
			{ sourceId: "metadata", path: "json/account.json", text: JSON.stringify({ "Basic Information": { Username: "owner" } }) },
			{ sourceId: "metadata", path: "json/friends.json", text: JSON.stringify({ Friends: [{ Username: "maya", "Display Name": "Same name" }, { Username: "jules", "Display Name": "Same name" }] }) },
			{ sourceId: "metadata", path: "json/chat_history.json", text: JSON.stringify({
				maya: [
					{ From: "owner", IsSender: true, Created: "2013-07-12 17:15:00 UTC", "Media Type": "TEXT", Content: "same words" },
					{ From: "owner", IsSender: true, Created: "2013-07-12 17:15:00 UTC", "Media Type": "TEXT", Content: "same words" },
					{ From: "maya", IsSender: false, Created: "2013-07-12 17:16:00 UTC", "Media Type": "IMAGE", "Media IDs": "photo-one" },
					{ From: "maya", IsSender: true, Created: "invalid", "Media Type": "TEXT", Content: "not the owner's vocabulary" },
				],
				group: [{ From: "jules", IsSender: false, Created: "2013-07-12 17:20:00 UTC", "Conversation Title": "The group", "Media Type": "IMAGE", "Media IDs": "photo-one" }],
			}) },
			{ sourceId: "metadata", path: "json/memories_history.json", text: JSON.stringify({ "Saved Media": [
				{ Date: "2013-07-12 17:16:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/download?mid=photo-one&token=private-canary" },
				{ Date: null, "Media Type": "AR_UNKNOWN", "Download Link": "https://example.invalid/?mid=missing" },
			] }) },
		],
	};
}

describe("normalized local dataset", () => {
	it("redacts nested remote metadata URLs and credentials without altering message text", () => {
		const input = fixture();
		const chat = input.documents.find((document) => document.path === "json/chat_history.json")!;
		chat.text = JSON.stringify({ maya: [{ From: "owner", IsSender: true, "Media Type": "TEXT", Content: "I sent https://example.invalid/our-joke", PlaybackURL: "https://expired.invalid/?credential=secret-canary", nested: { unfamiliar: ["https://expired.invalid/?X-Amz-Signature=nested-canary"], Authorization: "Bearer credential-canary", ordinary: "local evidence" } }] });
		const dataset = normalizeArchiveDataset(input);
		expect(JSON.stringify(dataset)).not.toMatch(/secret-canary|nested-canary|credential-canary/);
		expect(dataset.events[0]!.text).toBe("I sent https://example.invalid/our-joke");
		expect(dataset.events[0]!.raw.Content).toBe(dataset.events[0]!.text);
		expect(dataset.events[0]!.raw.nested).toMatchObject({ ordinary: "local evidence" });
	});

	it("keeps every physical occurrence despite identical advertised CRC and size", () => {
		const entry = fixture().entries[1]!;
		const dataset = normalizeArchiveDataset({ entries: [entry, { ...entry, id: { ...entry.id, sourceId: "other-source" } }], documents: [] });
		expect(dataset.assets).toHaveLength(2);
		expect(new Set(dataset.assets.map((asset) => asset.id)).size).toBe(2);
		expect(new Set(dataset.assets.map((asset) => asset.entryId?.sourceId)).size).toBe(2);
		expect(dataset.identityVerified).toBe(false);
	});

	it("uses bounded source-byte evidence for changed fingerprints and reorder stability", async () => {
		const first = await fingerprintArchiveSource(new Blob([new Uint8Array([1, 2, 3])]));
		const different = await fingerprintArchiveSource(new Blob([new Uint8Array([1, 2, 4])]));
		expect(first).not.toBe(different);
		const entry = fixture().entries[1]!;
		const one = normalizeArchiveDataset({ entries: [entry], documents: [], sourceDigests: { media: first } });
		const changed = normalizeArchiveDataset({ entries: [entry], documents: [], sourceDigests: { media: different } });
		const renamed = normalizeArchiveDataset({ entries: [{ ...entry, id: { ...entry.id, sourceId: "renamed" } }], documents: [], sourceDigests: { renamed: first } });
		expect(one.identityVerified).toBe(true);
		expect(changed.fingerprint).not.toBe(one.fingerprint);
		expect(changed.assets[0]!.id).not.toBe(one.assets[0]!.id);
		expect(renamed.fingerprint).toBe(one.fingerprint);
		expect(renamed.assets[0]!.id).toBe(one.assets[0]!.id);
		const cancelled = new AbortController(); cancelled.abort();
		await expect(fingerprintArchiveSource(new Blob(["bytes"]), cancelled.signal)).rejects.toMatchObject({ name: "AbortError" });
	});

	it("retains orphan and competing overlay occurrences with explicit diagnostics", () => {
		const input = fixture();
		input.entries = [input.entries[2]!]; input.documents = [];
		const orphan = normalizeArchiveDataset(input);
		expect(orphan.assets).toHaveLength(1);
		expect(orphan.assets[0]).toMatchObject({ role: "overlay", overlayState: "missing-base", available: true });
		expect(orphan.coverage.warnings.join(" ")).toMatch(/overlay.*base/i);
		const conflicting = fixture();
		conflicting.entries.push({ ...conflicting.entries[2]!, id: { ...conflicting.entries[2]!.id, ordinal: 3 } });
		const dataset = normalizeArchiveDataset(conflicting);
		expect(dataset.assets.filter((asset) => asset.role === "overlay")).toHaveLength(2);
		expect(dataset.assets.find((asset) => asset.role === "original")?.overlayState).toBe("ambiguous");
		expect(dataset.assets.find((asset) => asset.role === "original")?.overlayEntryId).toBeNull();
	});

	it("reports retained unsupported story rows and row-order-independent partial coverage", () => {
		const input = fixture();
		input.documents.push({ sourceId: "metadata", path: "json/story_history.json", text: JSON.stringify({ "Your Story Views": [{ Viewer: "maya", Time: "2020-01-01 UTC" }] }) });
		const friends = input.documents.find((document) => document.path === "json/friends.json")!;
		friends.text = JSON.stringify({ Friends: [null, { Username: "maya" }] });
		const dataset = normalizeArchiveDataset(input);
		expect(dataset.coverage.sections.friends?.status).toBe("partial");
		expect(dataset.coverage.sections.stories?.status).toBe("unsupported");
		expect(dataset.coverage.sections.stories?.unsupportedCount).toBe(1);
		expect(dataset.unsupported.find((item) => item.source.path === "json/story_history.json")?.source.recordPointer).toBe("/Your Story Views/0");
		friends.text = JSON.stringify({ Friends: [{ Username: "maya" }, null] });
		expect(normalizeArchiveDataset(input).coverage.sections.friends).toEqual(dataset.coverage.sections.friends);
		friends.text = JSON.stringify({ Friends: [null] });
		expect(normalizeArchiveDataset(input).coverage.sections.friends?.status).toBe("invalid");
	});

	it("keeps unknown physical files in inventory with accurate supported file MIME types", () => {
		const entries = ["attachments/voice.wav", "chat_media/photo.heic", "misc/readme.bin"].map((path, ordinal) => ({ id: { sourceId: "part", path, ordinal }, compressedSize: 2, uncompressedSize: 2, isDirectory: false }));
		const dataset = normalizeArchiveDataset({ entries, documents: [] });
		expect(dataset.assets.find((asset) => asset.path?.endsWith(".wav"))?.mimeType).toBe("audio/wav");
		expect(dataset.assets.find((asset) => asset.path?.endsWith(".heic"))?.mimeType).toBe("image/heic");
		expect(dataset.assets.find((asset) => asset.path?.endsWith(".bin"))?.kind).toBe("unknown");
		expect(dataset.unsupported.some((item) => item.source.path === "misc/readme.bin")).toBe(true);
	});

	it("recognizes an exact exported direct recipient without using title similarity", () => {
		const input = fixture();
		input.documents.find((document) => document.path === "json/chat_history.json")!.text = JSON.stringify({ maya: [{ From: "owner", IsSender: true, "Media Type": "TEXT", Content: "outgoing only" }], "Same name": [{ From: "owner", IsSender: true, "Media Type": "TEXT", Content: "unknown thread" }] });
		const dataset = normalizeArchiveDataset(input);
		const maya = dataset.participants.find((person) => person.username === "maya")!;
		expect(dataset.conversations.find((conversation) => conversation.title === "maya")?.participantIds).toContain(maya.id);
		expect(dataset.conversations.find((conversation) => conversation.title === "Same name")?.participantIds).not.toContain(maya.id);
	});
	it("keeps repeated messages, exact sources, distinct identities, and many-to-many media links", () => {
		const dataset = normalizeArchiveDataset(fixture());
		expect(dataset.events).toHaveLength(5);
		expect(dataset.events.filter((event) => event.text === "same words")).toHaveLength(2);
		expect(dataset.participants.filter((person) => person.displayName === "Same name")).toHaveLength(2);
		expect(dataset.conversations.find((conversation) => conversation.title === "The group")?.participantIds).toHaveLength(2);
		const photo = dataset.assets.find((asset) => asset.mediaId === "photo-one")!;
		expect(photo.entryId).toEqual({ sourceId: "media", path: "memories/2013-07-12_photo-one-main.jpg", ordinal: 0 });
		expect(photo.overlayEntryId?.ordinal).toBe(1);
		expect(photo.conversationIds).toHaveLength(2);
		expect(dataset.links.filter((link) => link.status === "confirmed")).toHaveLength(2);
		expect(dataset.events.find((event) => event.text === "not the owner's vocabulary")?.authorship).toBe("conflicting");
		expect(dataset.events.filter((event) => event.ownerAuthored)).toHaveLength(2);
		expect(dataset.coverage.missingMedia).toBe(1);
		expect(dataset.coverage.sections.snaps?.status).toBe("missing");
		expect(dataset.unsupported).not.toHaveLength(0);
		expect(JSON.stringify(dataset)).not.toContain("private-canary");
		expect(JSON.stringify(dataset)).not.toContain("Download Link");
	});

	it("has stable IDs, fingerprint, and order after source selection reorder", () => {
		const original = fixture();
		const reordered = fixture();
		reordered.entries.reverse();
		reordered.documents.reverse();
		for (const entry of reordered.entries) entry.id.sourceId = entry.id.sourceId === "metadata" ? "source-9" : "source-2";
		for (const document of reordered.documents) document.sourceId = document.sourceId === "metadata" ? "source-9" : "source-2";
		const left = normalizeArchiveDataset(original);
		const right = normalizeArchiveDataset(reordered);
		expect(right.fingerprint).toBe(left.fingerprint);
		expect(right.events.map((event) => event.id)).toEqual(left.events.map((event) => event.id));
		expect(right.assets.map((asset) => asset.id)).toEqual(left.assets.map((asset) => asset.id));
		expect(right.coverage).toEqual(left.coverage);
	});

	it("deduplicates repeated source records while preserving their occurrences and genuine repeats", () => {
		const input = fixture();
		input.documents.push({ ...input.documents.find((document) => document.path === "json/chat_history.json")!, sourceId: "second-part" });
		const dataset = normalizeArchiveDataset(input);
		expect(dataset.events).toHaveLength(5);
		expect(dataset.events.every((event) => event.sources.length === 2)).toBe(true);
		expect(dataset.coverage.duplicateRecords).toBe(5);
	});

	it("keeps duplicate exact media candidates ambiguous rather than choosing a file", () => {
		const input = fixture();
		input.entries.push({ ...input.entries[1]!, id: { ...input.entries[1]!.id, ordinal: 2 }, signature: 999 });
		const dataset = normalizeArchiveDataset(input);
		expect(dataset.links.filter((link) => link.status === "ambiguous")).toHaveLength(4);
		expect(dataset.events.every((event) => event.assetIds.length === 0)).toBe(true);
		expect(dataset.assets.filter((asset) => asset.mediaId === "photo-one")).toHaveLength(2);
	});

	it("filters one collection and keeps excluded sources out of ordinary results", () => {
		const dataset = normalizeArchiveDataset(fixture());
		const linkedEvents = dataset.events.filter((event) => event.assetIds.length > 0);
		const decisions: Record<string, ReviewDecision> = Object.fromEntries(linkedEvents.map((event) => [event.id, { status: "exclude", updatedAt: "2026-01-01T00:00:00Z" }]));
		const ordinary = queryDataset(dataset, { ...DEFAULT_QUERY, year: 2013 }, decisions);
		expect(ordinary.events.some((event) => linkedEvents.some((excluded) => excluded.id === event.id))).toBe(false);
		expect(ordinary.assets.some((asset) => asset.mediaId === "photo-one")).toBe(false);
		const explicitReview = queryDataset(dataset, { ...DEFAULT_QUERY, review: "exclude" }, decisions);
		expect(explicitReview.events).toHaveLength(2);
		const text = queryDataset(dataset, { ...DEFAULT_QUERY, text: "same words" }, {});
		expect(text.events).toHaveLength(2);
	});

	it("retains malformed/unknown sections and prevents unknown owner inference", () => {
		const input = fixture();
		input.documents = input.documents.filter((document) => document.path !== "json/account.json");
		input.documents.push({ sourceId: "metadata", path: "json/snap_history.json", text: "{broken" });
		input.documents.push({ sourceId: "metadata", path: "json/unknown.json", text: '{"original":"evidence"}' });
		const dataset = normalizeArchiveDataset(input);
		expect(dataset.ownerUsername).toBeNull();
		expect(dataset.events.some((event) => event.ownerAuthored)).toBe(false);
		expect(dataset.coverage.sections.snaps?.status).toBe("invalid");
		expect(dataset.unsupported.some((item) => item.source.path === "json/unknown.json")).toBe(true);
	});
});

describe("explicit archive time", () => {
	it("requires zoned recorded-date corroboration instead of guessing numeric epoch units", () => {
		expect(normalizeTime("2019-01-02 03:04:05 UTC").instant).toBe("2019-01-02T03:04:05.000Z");
		expect(Number.isSafeInteger(1546398245123)).toBe(true);
		const corroborated = normalizeTime("2019-01-02 03:04:05 UTC", "1546398245123");
		expect(corroborated).toMatchObject({ instant: "2019-01-02T03:04:05.123Z", precision: "millisecond", valid: true });
		expect(corroborated.orderKey).toBe("000000001546398245123000");
		expect(normalizeTime("2019-01-02 03:04:05 UTC", "1546398246000").valid).toBe(false);
		expect(normalizeTime("2019-01-02 03:04:05 UTC", "1546398244999").valid).toBe(false);
		expect(normalizeTime("2019-01-02T03:04:05.123Z", "1546398245124").valid).toBe(false);
		expect(normalizeTime("2019-01-02T03:04:05.123Z", "1546398245123")).toMatchObject({ instant: "2019-01-02T03:04:05.123Z", valid: true });
		expect(normalizeTime("2019-01-02T04:04:05+01:00", 1546398245000).instant).toBe("2019-01-02T03:04:05.000Z");
		expect(normalizeTime("2019-01-02 03:04:05", "1546398245000")).toMatchObject({ precision: "microsecond", reason: null });
		expect(normalizeTime("2019-01-02", "1546398245000")).toMatchObject({ precision: "microsecond", reason: null });
	});
	it("dates chat events when the labelled microsecond field is corroborated milliseconds", () => {
		const input = fixture();
		input.documents = input.documents.map(document => document.path === "json/chat_history.json" ? {
			...document,
			text: JSON.stringify({ maya: [{ From: "owner", IsSender: true, Created: "2019-01-02 03:04:05 UTC", "Created(microseconds)": 1546398245000, "Media Type": "TEXT", Content: "synthetic owner evidence" }] }),
		} : document);
		const data = normalizeArchiveDataset(input);
		expect(data.events).toHaveLength(1);
		expect(data.events[0]).toMatchObject({ timestamp: "2019-01-02T03:04:05.000Z", year: 2019, authorship: "owner" });
		expect(data.events[0]?.time.reason).toMatch(/millisecond.*corroborat|corroborat.*millisecond/i);
		expect(data.events[0]?.raw["Created(microseconds)"]).toBe(1546398245000);
		expect(data.coverage.warnings.some(warning => /labelled microseconds.*milliseconds.*corroborat/i.test(warning))).toBe(true);
		expect(queryDataset(data, { ...DEFAULT_QUERY, year: 2019 }, {}).events).toHaveLength(1);
	});
	it("uses explicit zones and preserves microsecond order", () => {
		const early = normalizeTime("2020-01-01 00:00:00 UTC", "1577836800000001");
		const later = normalizeTime("2020-01-01 00:00:00 UTC", "1577836800000002");
		expect(early.instant).toBe("2020-01-01T00:00:00.000Z");
		expect(early.orderKey < later.orderKey).toBe(true);
		expect(normalizeTime("2020-01-01T00:30:00+01:00").instant).toBe("2019-12-31T23:30:00.000Z");
	});

	it("does not invent time for unzoned, bad, conflicting, or date-only records", () => {
		expect(normalizeTime("2020-01-01 00:00:00").valid).toBe(false);
		expect(normalizeTime("2020-02-30 00:00:00 UTC").valid).toBe(false);
		expect(normalizeTime("2021-01-01 00:00:00 UTC", "1577836800000000").valid).toBe(false);
		const date = normalizeTime("2020-01-01");
		expect(date.precision).toBe("date");
		expect(date.instant).toBeNull();
		expect(date.valid).toBe(true);
	});
});
