import { createHash } from "node:crypto";
import { BlobWriter, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import { afterEach, expect, it, vi } from "vitest";
import { loadArchiveDataset, normalizeArchiveDataset, OccurrencePreparationError, type DatasetInput } from "../src/lib/dataset";
import { createArchiveSession } from "../src/lib/snapArchive";

const path = "json/chat_history.json";
const text = '{"maya":[{"From":"owner","Media Type":"TEXT","Content":"retained words"}]}';
const bytes = new TextEncoder().encode(text);
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

async function zip(document: Uint8Array, name: string, entryPath = path): Promise<File> {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(entryPath, new Uint8ArrayReader(document), { level: 0 });
	return new File([await writer.close()], name, { type: "application/zip" });
}

afterEach(() => vi.unstubAllGlobals());

function authoredInput(documents: { sourceId: string; bytes: Uint8Array; ordinal?: number }[]): DatasetInput {
	return {
		entries: documents.map(document => ({ id: { sourceId: document.sourceId, path, ordinal: document.ordinal ?? 0 },
			compressedSize: document.bytes.length, uncompressedSize: document.bytes.length, isDirectory: false })),
		documents: documents.map(document => ({ sourceId: document.sourceId, path, ordinal: document.ordinal ?? 0,
			text: new TextDecoder("utf-8", { fatal: true }).decode(document.bytes), documentSha256: sha(document.bytes), byteLength: document.bytes.length })),
	};
}

it("attests decompressed original bytes before UTF-8 BOM removal and keeps different documents distinct", async () => {
	vi.stubGlobal("Worker", undefined);
	const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
	const session = await createArchiveSession([await zip(bytes, "one.zip"), await zip(withBom, "bom.zip")]);
	try {
		const dataset = await loadArchiveDataset(session);
		expect(dataset.events).toHaveLength(2);
		expect(dataset.events.map(event => event.source.documentSha256).sort()).toEqual([sha(bytes), sha(withBom)].sort());
		expect(dataset.events.map(event => event.source.documentByteLength).sort((a, b) => a! - b!)).toEqual([bytes.length, withBom.length]);
		expect(dataset.events.every(event => event.source.entryOrdinal === 0 && event.source.recordPointer === "/maya/0")).toBe(true);
		expect(dataset.normalizationVersion).toBe(5);
		expect(dataset.queryEvidence).toBeNull();
		expect(dataset.queryEvidenceUnavailableReason).toBe("producer-incomplete");
	} finally { session.reader.dispose(); }
});

it("rejects repeated proof DTOs for one physical document instead of inventing a second source copy", () => {
	const input = authoredInput([{ sourceId: "one", bytes }]);
	input.documents.push({ ...input.documents[0]! });
	expect(() => normalizeArchiveDataset(input)).toThrow("The original document proof is incomplete or does not match its exact ZIP entry.");
});

it("rejects malformed proof without string coercion or exposing input canaries", () => {
	const input = authoredInput([{ sourceId: "one", bytes }]);
	Object.assign(input.documents[0]!, { documentSha256: [sha(bytes)], proofCanary: "private-proof-canary" });
	expect(() => normalizeArchiveDataset(input)).toThrow("The original document proof is incomplete or does not match its exact ZIP entry.");
});

it("merges attested exact document copies while preserving genuine repeat pointers and every physical copy", async () => {
	vi.stubGlobal("Worker", undefined);
	const repeated = new TextEncoder().encode('{"maya":[{"From":"owner","Media Type":"TEXT","Content":"shared"},{"From":"owner","Media Type":"TEXT","Content":"shared"}]}');
	const session = await createArchiveSession([await zip(repeated, "copy-one.zip"), await zip(repeated, "copy-two.zip")]);
	try {
		const dataset = await loadArchiveDataset(session);
		expect(dataset.events).toHaveLength(2);
		expect(new Set(dataset.events.map(event => event.id)).size).toBe(2);
		expect(dataset.coverage.sections.chats?.recordCount).toBe(2);
		expect(dataset.coverage.duplicateRecords).toBe(2);
		expect(dataset.events.map(event => event.source.recordPointer).sort()).toEqual(["/maya/0", "/maya/1"]);
		for (const event of dataset.events) {
			expect(event.sources).toHaveLength(2);
			expect(new Set(event.sources.map(source => source.sourceId)).size).toBe(2);
			expect(event.sources.every(source => source.documentSha256 === sha(repeated) && source.documentByteLength === repeated.length && source.entryOrdinal === 0)).toBe(true);
		}
		expect(dataset.queryEvidence).toBeNull();
	} finally { session.reader.dispose(); }
});

it("splits both overlapping rows while retaining valid singleton IDs and multipart reorder identity", () => {
	const first = new TextEncoder().encode('{"maya":[{"From":"owner","Media Type":"TEXT","Content":"alpha"},{"From":"owner","Media Type":"TEXT","Content":"shared"}]}');
	const second = new TextEncoder().encode('{"maya":[{"From":"owner","Media Type":"TEXT","Content":"shared"},{"From":"owner","Media Type":"TEXT","Content":"omega"}]}');
	const input = authoredInput([{ sourceId: "one", bytes: first }, { sourceId: "two", bytes: second }]);
	const dataset = normalizeArchiveDataset(input);
	const reversed = normalizeArchiveDataset({ ...input, documents: [...input.documents].reverse(), entries: [...input.entries].reverse() });
	// These are the existing singleton identities for the independently worked legacy rows.
	expect(dataset.events.find(event => event.text === "alpha")?.id).toBe("event-466678c8994efcd0");
	expect(dataset.events.find(event => event.text === "omega")?.id).toBe("event-7c362a058c1d75f5");
	expect(dataset.events).toHaveLength(4);
	const shared = dataset.events.filter(event => event.text === "shared");
	expect(shared).toHaveLength(2);
	expect(shared.every(event => event.id !== "event-9b7e0945da2bb305" && event.sources.length === 1)).toBe(true);
	expect(shared.map(event => event.source.recordPointer).sort()).toEqual(["/maya/0", "/maya/1"]);
	expect(dataset.coverage.duplicateRecords).toBe(0);
	expect(reversed.fingerprint).toBe(dataset.fingerprint);
	expect(reversed.events.map(event => event.id)).toEqual(dataset.events.map(event => event.id));
	expect(dataset.conversations[0]?.eventIds.sort()).toEqual(dataset.events.map(event => event.id).sort());
});

it("retains exact invalid UTF-8 proof without guessed rows and keeps a valid sibling section usable", async () => {
	vi.stubGlobal("Worker", undefined);
	const invalid = bytes.slice();
	invalid[text.indexOf("retained words")] = 0xff;
	const session = await createArchiveSession([await zip(invalid, "invalid.zip"), await zip(bytes, "valid.zip")]);
	try {
		const dataset = await loadArchiveDataset(session);
		expect(dataset.events).toHaveLength(1);
		expect(dataset.events[0]?.text).toBe("retained words");
		expect(dataset.coverage.sections.chats).toMatchObject({ status: "partial", recordCount: 1, invalidCount: 1 });
		expect(dataset.unsupported).toHaveLength(1);
		const diagnostic = dataset.unsupported[0]!;
		expect(diagnostic).toMatchObject({ reason: "This JSON section contains invalid UTF-8.", raw: null,
			source: { path, entryOrdinal: 0, recordPointer: "", documentSha256: sha(invalid), documentByteLength: invalid.length } });
		expect(JSON.stringify(dataset)).not.toContain("\ufffd");
		const original = await session.reader.readEntry({ sourceId: diagnostic.source.sourceId, path, ordinal: 0 }, 1024);
		expect(new Uint8Array(original)).toEqual(invalid);
	} finally { session.reader.dispose(); }
});

it("distinguishes unreadable unknown documents from parsed unsupported content", async () => {
	vi.stubGlobal("Worker", undefined);
	const invalid = new Uint8Array([0xff, 0x7b, 0x7d]);
	const session = await createArchiveSession([await zip(invalid, "unknown.zip", "json/unknown.json")]);
	try {
		const dataset = await loadArchiveDataset(session);
		expect(dataset.events).toHaveLength(0);
		expect(dataset.unsupported).toHaveLength(1);
		expect(dataset.unsupported[0]).toMatchObject({ reason: "This JSON section contains invalid UTF-8.", raw: null,
			source: { path: "json/unknown.json", recordPointer: "", entryOrdinal: 0, documentSha256: sha(invalid), documentByteLength: 3 } });
		expect(dataset.coverage.sections).not.toHaveProperty("unknown");
	} finally { session.reader.dispose(); }
});

it("includes original document proof in fallback authority even when equal-length whitespace parses identically", () => {
	const trailing = new TextEncoder().encode(`${text}  `);
	const leading = new TextEncoder().encode(`  ${text}`);
	const first = normalizeArchiveDataset(authoredInput([{ sourceId: "same-handle", bytes: trailing }]));
	const second = normalizeArchiveDataset(authoredInput([{ sourceId: "same-handle", bytes: leading }]));
	expect(trailing.length).toBe(leading.length);
	expect(first.events[0]?.raw).toEqual(second.events[0]?.raw);
	expect(first.events[0]?.id).toBe("event-f433a399e62c0015");
	expect(second.events[0]?.id).toBe("event-f433a399e62c0015");
	expect(first.fingerprint).not.toBe(second.fingerprint);
	expect(first.events[0]?.source.sourceFingerprint).not.toBe(second.events[0]?.source.sourceFingerprint);
	expect(first.events[0]?.source.documentSha256).toBe(sha(trailing));
	expect(second.events[0]?.source.documentSha256).toBe(sha(leading));
	expect(first.identityVerified).toBe(false);
	expect(second.identityVerified).toBe(false);
	expect(first.queryEvidence).toBeNull();
	expect(second.queryEvidence).toBeNull();
});

it("keeps credential-different original rows separate before redaction and corrects every conflated legacy ID", () => {
	const first = new TextEncoder().encode('{"maya":[{"From":"owner","Media Type":"TEXT","Content":"retained words","Token":"credential-canary-one"}]}');
	const second = new TextEncoder().encode('{"maya":[{"From":"owner","Media Type":"TEXT","Content":"retained words","Token":"credential-canary-two"}]}');
	const input = authoredInput([{ sourceId: "one", bytes: first }, { sourceId: "two", bytes: second }]);
	const dataset = normalizeArchiveDataset(input);
	expect(dataset.events).toHaveLength(2);
	expect(dataset.events.map(event => event.raw)).toEqual([
		{ From: "owner", "Media Type": "TEXT", Content: "retained words" },
		{ From: "owner", "Media Type": "TEXT", Content: "retained words" },
	]);
	expect(dataset.events.every(event => event.id !== "event-f433a399e62c0015" && event.sources.length === 1)).toBe(true);
	expect(new Set(dataset.events.map(event => event.id)).size).toBe(2);
	expect(dataset.events.map(event => event.source.documentSha256).sort()).toEqual([sha(first), sha(second)].sort());
	expect(dataset.coverage.duplicateRecords).toBe(0);
	expect(JSON.stringify(dataset)).not.toMatch(/credential-canary-one|credential-canary-two/);
	const reversed = normalizeArchiveDataset({ ...input, entries: [...input.entries].reverse(), documents: [...input.documents].reverse() });
	expect(reversed.fingerprint).toBe(dataset.fingerprint);
	expect(reversed.events.map(event => event.id)).toEqual(dataset.events.map(event => event.id));
});

it("requires the complete trusted digest, actual byte length and exact non-directory ordinal envelope", () => {
	const malformed = [
		{ documentSha256: undefined }, { documentSha256: "private-proof-canary" }, { documentSha256: sha(bytes).toUpperCase() },
		{ byteLength: undefined }, { byteLength: bytes.length - 1 }, { byteLength: -1 },
		{ ordinal: undefined }, { ordinal: 1 }, { ordinal: 0.5 },
		{ sourceId: "private-source-canary" },
		{ decodingFailure: "invalid-utf8" },
	];
	for (const patch of malformed) {
		const input = authoredInput([{ sourceId: "one", bytes }]);
		Object.assign(input.documents[0]!, patch);
		expect(() => normalizeArchiveDataset(input)).toThrow(new Error("The original document proof is incomplete or does not match its exact ZIP entry."));
	}
	const unsafe = authoredInput([{ sourceId: "one", bytes }]);
	unsafe.documents[0]!.path = "../private-path-canary.json";
	expect(() => normalizeArchiveDataset(unsafe)).toThrow(OccurrencePreparationError);
	const directory = authoredInput([{ sourceId: "one", bytes }]);
	directory.entries[0]!.isDirectory = true;
	expect(() => normalizeArchiveDataset(directory)).toThrow(new Error("The original document proof is incomplete or does not match its exact ZIP entry."));
	const duplicateEntry = authoredInput([{ sourceId: "one", bytes }]);
	duplicateEntry.entries.push({ ...duplicateEntry.entries[0]! });
	expect(() => normalizeArchiveDataset(duplicateEntry)).toThrow(new Error("The original document proof is incomplete or does not match its exact ZIP entry."));
});

it("does not treat digest claims inside JSON or decoded text equality as original-byte proof", () => {
	const claimed = '{"maya":[{"From":"owner","Media Type":"TEXT","Content":"retained words","documentSha256":"' + sha(bytes) + '","byteLength":' + bytes.length + '}]}';
	const dataset = normalizeArchiveDataset({ entries: [], documents: [
		{ sourceId: "one", path, text: claimed }, { sourceId: "two", path, text: claimed },
	] });
	expect(dataset.events).toHaveLength(2);
	expect(dataset.events.every(event => event.sources.length === 1 && event.source.documentSha256 === undefined && event.source.documentByteLength === undefined)).toBe(true);
	expect(dataset.coverage.duplicateRecords).toBe(0);
	expect(dataset.queryEvidence).toBeNull();
	expect(dataset.queryEvidenceUnavailableReason).toBe("producer-incomplete");
});

it("retains exact ordinals for byte-attested document copies within one source", () => {
	const dataset = normalizeArchiveDataset(authoredInput([
		{ sourceId: "one", bytes, ordinal: 0 }, { sourceId: "one", bytes, ordinal: 3 },
	]));
	expect(dataset.events).toHaveLength(1);
	expect(dataset.events[0]?.id).toBe("event-f433a399e62c0015");
	expect(dataset.events[0]?.sources.map(source => source.entryOrdinal).sort()).toEqual([0, 3]);
	expect(dataset.events[0]?.sources.every(source => source.sourceId === "one" && source.recordPointer === "/maya/0" && source.documentSha256 === sha(bytes))).toBe(true);
	expect(dataset.coverage.duplicateRecords).toBe(1);
});

it("distinguishes parsed-empty coverage from unreadable content without inventing rows", async () => {
	vi.stubGlobal("Worker", undefined);
	const malformed = new TextEncoder().encode('{"maya":[');
	const empty = new TextEncoder().encode('{}');
	const session = await createArchiveSession([await zip(malformed, "malformed.zip"), await zip(empty, "empty.zip")]);
	try {
		const dataset = await loadArchiveDataset(session);
		expect(dataset.events).toHaveLength(0);
		expect(dataset.coverage.sections.chats).toMatchObject({ status: "partial", recordCount: 0, invalidCount: 1 });
		expect(dataset.unsupported).toHaveLength(1);
		expect(dataset.unsupported[0]).toMatchObject({ reason: "This JSON section could not be parsed.", raw: null,
			source: { path, entryOrdinal: 0, recordPointer: "", documentSha256: sha(malformed), documentByteLength: 9 } });
		expect(dataset.queryEvidence).toBeNull();
	} finally { session.reader.dispose(); }
});

it("cannot attest a text-only copy through aliased document objects", () => {
	const document = { sourceId: "one", path, text };
	const dataset = normalizeArchiveDataset({ entries: [], documents: [document, document] });
	expect(dataset.events).toHaveLength(2);
	expect(dataset.events.every(event => event.sources.length === 1 && event.source.documentSha256 === undefined)).toBe(true);
	expect(dataset.coverage.duplicateRecords).toBe(0);
	expect(dataset.queryEvidence).toBeNull();
});
