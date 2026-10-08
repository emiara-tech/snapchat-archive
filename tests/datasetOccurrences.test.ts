import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { loadArchiveDataset, normalizeArchiveDataset, OccurrencePreparationError, type DatasetInput } from "../src/lib/dataset";
import { createArchiveSession } from "../src/lib/snapArchive";
import { BlobWriter, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";

const chatPath = "json/chat_history.json";
const repeatedDocument = '{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A","A","B"]}]}';
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function inputFor(text = repeatedDocument, path = chatPath): DatasetInput {
	const bytes = new TextEncoder().encode(text).length;
	return {
		entries: [
			{ id: { sourceId: "metadata", path, ordinal: 0 }, compressedSize: bytes, uncompressedSize: bytes, isDirectory: false },
			{ id: { sourceId: "media", path: "media/A.jpg", ordinal: 0 }, compressedSize: 1, uncompressedSize: 1, isDirectory: false },
			{ id: { sourceId: "media", path: "media/B.jpg", ordinal: 1 }, compressedSize: 1, uncompressedSize: 1, isDirectory: false },
		],
		documents: [{ sourceId: "metadata", path, ordinal: 0, text, documentSha256: sha(text), byteLength: bytes }],
		sourceDigests: { metadata: "1".repeat(64), media: "2".repeat(64) },
	};
}

function missingFanoutInput(rowCount: number, slotCount = rowCount): DatasetInput {
	const perRow = Math.floor(slotCount / rowCount);
	const remainder = slotCount % rowCount;
	const rows = Array.from({ length: rowCount }, (_, index) => ({ From: "owner", "Media IDs": Array.from({ length: perRow + (index < remainder ? 1 : 0) }, () => "SYNTHETIC-MISSING") }));
	const input = inputFor(JSON.stringify({ fixture: rows }));
	input.entries = input.entries.slice(0, 1);
	return input;
}

afterEach(() => vi.unstubAllGlobals());

it("retains all declaring provenance when 129 distinct rows reference one missing target", () => {
	const dataset = normalizeArchiveDataset(missingFanoutInput(129));
	expect(dataset.events).toHaveLength(129);
	expect(dataset.occurrenceFacts!.occurrences).toHaveLength(129);
	expect(dataset.occurrenceFacts!.resources).toHaveLength(1);
	expect(dataset.occurrenceFacts!.resources[0]!.sourceIds).toHaveLength(129);
	expect(dataset.assets).toHaveLength(1);
	expect(dataset.assets[0]!.sources).toHaveLength(129);
	expect(dataset.links).toHaveLength(129);
	expect(dataset.queryEvidence).toBeNull();
	expect(dataset.queryEvidenceUnavailableReason).toBe("producer-incomplete");
});

it.each([true, false])("byte-bounds one missing target with 334 declaring rows and 1083 slots with document proof %s", (attested) => {
	const input = missingFanoutInput(334, 1083);
	if (!attested) input.documents = input.documents.map(({ documentSha256: _sha, byteLength: _bytes, ...document }) => document);
	const dataset = normalizeArchiveDataset({ ...input, occurrenceLimits: { maxSourceIdsPerFact: 1, maxSources: 334, maxResources: 1 } });
	expect(dataset.events).toHaveLength(334);
	expect(dataset.assets).toHaveLength(1);
	expect(dataset.assets[0]!.sources).toHaveLength(334);
	expect(new Set(dataset.assets[0]!.sources.map(source => source.recordPointer)).size).toBe(334);
	expect(dataset.links).toHaveLength(1083);
	expect(new Set(dataset.links.map(link => link.id)).size).toBe(1083);
	expect(new Set(dataset.links.map(link => link.referenceId)).size).toBe(1083);
	expect(dataset.links.every(link => link.assetId === dataset.assets[0]!.id && link.status === "unlinked")).toBe(true);
	if (attested) {
		const facts = dataset.occurrenceFacts!;
		expect(facts.resources).toHaveLength(1);
		expect(facts.resources[0]!.sourceIds).toHaveLength(334);
		expect(new Set(facts.resources[0]!.sourceIds)).toEqual(new Set(facts.sources.map(source => source.id)));
		expect(facts.occurrences).toHaveLength(1083);
		expect(new Set(facts.occurrences.map(occurrence => occurrence.id)).size).toBe(1083);
		expect(facts.occurrences.every(occurrence => occurrence.sourceIds.length === 1 && occurrence.association.state === "unlinked" && occurrence.association.missingMediaId === dataset.assets[0]!.id)).toBe(true);
	} else {
		expect(dataset.occurrenceFacts).toBeNull();
		expect(dataset.occurrenceFactsUnavailableReason).toBe("missing-document-proof");
	}
	const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
	const assetBytes = encoded(dataset.assets[0]);
	const totalBytes = encoded(dataset.occurrenceFacts) + encoded(dataset.links) + assetBytes
		+ dataset.events.reduce((total, event) => total + encoded(event.mediaReferenceIds), 0);
	expect(normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactBytes: assetBytes, maxFactsBytes: totalBytes } })).toEqual(dataset);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactBytes: assetBytes - 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactsBytes: totalBytes - 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxSources: 333 } })).toThrow(expect.objectContaining({ code: "budget" }));
	expect(dataset.queryEvidence).toBeNull();
	expect(dataset.queryEvidenceUnavailableReason).toBe("producer-incomplete");
});

it("accounts for replacement source members without retaining stale encoded bytes", () => {
	const input = missingFanoutInput(2);
	const { documentSha256: _sha, byteLength: _bytes, ...unattested } = input.documents[0]!;
	input.documents.push(unattested);
	const dataset = normalizeArchiveDataset(input);
	expect(dataset.occurrenceFacts).toBeNull();
	expect(dataset.events).toHaveLength(4);
	expect(dataset.links).toHaveLength(4);
	expect(dataset.assets).toHaveLength(1);
	expect(dataset.assets[0]!.sources).toHaveLength(2);
	expect(dataset.assets[0]!.sources.every(source => source.documentSha256 === undefined && source.documentByteLength === undefined)).toBe(true);
	const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
	const assetBytes = encoded(dataset.assets[0]);
	const totalBytes = encoded(dataset.occurrenceFacts) + encoded(dataset.links) + assetBytes
		+ dataset.events.reduce((total, event) => total + encoded(event.mediaReferenceIds), 0);
	expect(normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactBytes: assetBytes, maxFactsBytes: totalBytes } })).toEqual(dataset);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactBytes: assetBytes - 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactsBytes: totalBytes - 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
});

it("keeps repeated exported references distinct while preserving valid singleton identities and original membership", () => {
	const dataset = normalizeArchiveDataset(inputFor());
	expect(dataset.occurrenceFacts).toBeDefined();
	expect(dataset.occurrenceFacts).not.toBeNull();
	const facts = dataset.occurrenceFacts!;
	expect(facts.occurrences).toHaveLength(3);
	expect(facts.eventRows).toHaveLength(1);
	expect(facts.occurrences.map(occurrence => occurrence.identity.referenceOrdinal)).toEqual([0, 1, 2]);
	expect(new Set(facts.occurrences.map(occurrence => occurrence.id)).size).toBe(3);
	expect(facts.occurrences.every(occurrence => occurrence.owningEventId === "event-36f8422168fc9d41")).toBe(true);
	expect(facts.occurrences.map(occurrence => occurrence.association)).toEqual([
		{ state: "confirmed", mediaId: "asset-f6319a7e6f6212d6", proof: { kind: "export-exact", sourceIds: expect.any(Array) } },
		{ state: "confirmed", mediaId: "asset-f6319a7e6f6212d6", proof: { kind: "export-exact", sourceIds: expect.any(Array) } },
		{ state: "confirmed", mediaId: "asset-7058943803a51ccc", proof: { kind: "export-exact", sourceIds: expect.any(Array) } },
	]);
	expect(facts.occurrences[2]!.reference?.referenceId).toBe("reference-387ddb95ca65d29b");
	expect(facts.occurrences.slice(0, 2).every(occurrence => occurrence.reference?.referenceId !== "reference-357dd6dc824dc7e4")).toBe(true);
	expect(dataset.links).toHaveLength(3);
	expect(dataset.links[2]!.id).toBe("link-1e6b2687d5bb1039");
	expect(dataset.links.slice(0, 2).every(link => link.id !== "link-586e032ee329541c")).toBe(true);
	expect(dataset.events[0]!.mediaReferenceIds).toEqual(["A", "A", "B"]);
	expect(dataset.events[0]!.assetIds).toEqual(["asset-f6319a7e6f6212d6", "asset-7058943803a51ccc"]);
	expect(facts.resources).toHaveLength(2);
	expect(facts.occurrences.every(occurrence => occurrence.identity.documentSha256 === "96879b9af523f1167f1f85885838deb0fdbcc2e6e79f5c7a458765f4d1a2487c")).toBe(true);
	expect(dataset.queryEvidence).toBeNull();
	expect(dataset.queryEvidenceUnavailableReason).toBe("producer-incomplete");
});

it("keeps malformed original reference gaps inspectable without claiming an attachment", () => {
	const dataset = normalizeArchiveDataset(inputFor('{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A",null,"A"]}]}'));
	const facts = dataset.occurrenceFacts!;
	expect(facts.occurrences.map(occurrence => occurrence.identity.referenceOrdinal)).toEqual([0, 2]);
	expect(facts.eventRows[0]!.references).toEqual({ state: "supported", parserRule: "array-v1", sourcePositions: 3, knownSupportedSlots: 2, unknownRemainder: true });
	expect(facts.referenceDiagnostics).toHaveLength(1);
	expect(facts.referenceDiagnostics[0]).toMatchObject({ code: "malformed-reference-position", fieldPointer: "/maya/0/Media IDs", referenceOrdinal: 1, owner: { kind: "event", id: dataset.events[0]!.id } });
	const source = facts.sources.find(source => source.id === facts.referenceDiagnostics[0]!.sourceIds[0]);
	expect(source).toMatchObject({ sourceId: "metadata", path: chatPath, recordPointer: "/maya/0", entryOrdinal: 0 });
	expect(dataset.events[0]!.mediaReferenceIds).toEqual(["A", "A"]);
	expect(dataset.links).toHaveLength(2);
});

it("retains repeated Memories saves, merges only attested copies and separates a different-byte overlap", () => {
	const row = { Date: "2020-01-01 01:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=A", Location: "LOCATION-ONE" };
	const text = JSON.stringify({ "Saved Media": [row, row] });
	const input = inputFor(text, "json/memories_history.json");
	input.entries = input.entries.slice(0, 2);
	input.entries[1]!.id.path = "memories/2020-01-01_A-main.jpg";
	const first = normalizeArchiveDataset(input);
	expect(first.occurrenceFacts!.occurrences).toHaveLength(2);
	expect(first.occurrenceFacts!.occurrences.map(occurrence => occurrence.identity.repeatRank)).toEqual([0, 1]);
	expect(first.occurrenceFacts!.occurrences.every(occurrence => occurrence.owningEventId === null && occurrence.origin === "memories")).toBe(true);
	expect(first.occurrenceFacts!.resources).toHaveLength(1);
	input.documents.push({ ...input.documents[0]!, sourceId: "copy" });
	input.entries.push({ ...input.entries[0]!, id: { ...input.entries[0]!.id, sourceId: "copy" } });
	input.sourceDigests!.copy = "3".repeat(64);
	const copied = normalizeArchiveDataset(input);
	expect(copied.occurrenceFacts!.occurrences).toHaveLength(2);
	expect(copied.occurrenceFacts!.occurrences.every(occurrence => occurrence.sourceIds.length === 2 && occurrence.identity.copySourceIds.length === 2)).toBe(true);
	expect(copied.occurrenceFacts!.occurrences.map(occurrence => occurrence.id)).toEqual(first.occurrenceFacts!.occurrences.map(occurrence => occurrence.id));
	const overlap = ` ${JSON.stringify({ "Saved Media": [row] })}`;
	const overlapBytes = new TextEncoder().encode(overlap).length;
	input.documents.push({ sourceId: "overlap", path: "json/memories_history.json", ordinal: 0, text: overlap, documentSha256: sha(overlap), byteLength: overlapBytes });
	input.entries.push({ id: { sourceId: "overlap", path: "json/memories_history.json", ordinal: 0 }, compressedSize: overlapBytes, uncompressedSize: overlapBytes, isDirectory: false });
	input.sourceDigests!.overlap = "4".repeat(64);
	const combined = normalizeArchiveDataset(input);
	expect(combined.occurrenceFacts!.occurrences).toHaveLength(3);
	expect(combined.occurrenceFacts!.occurrences.map(occurrence => occurrence.sourceIds.length).sort()).toEqual([1, 2, 2]);
	expect(combined.occurrenceFacts!.occurrences.every(occurrence => occurrence.caption === null && occurrence.location === "LOCATION-ONE")).toBe(true);
});

it("rejects occurrence expansion as a whole and permits a valid retry on the same exact ZIP reader", async () => {
	vi.stubGlobal("Worker", undefined);
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(chatPath, new Uint8ArrayReader(new TextEncoder().encode(repeatedDocument)), { level: 0 });
	await writer.add("media/A.jpg", new Uint8ArrayReader(new Uint8Array([11])), { level: 0 });
	await writer.add("media/B.jpg", new Uint8ArrayReader(new Uint8Array([22])), { level: 0 });
	const session = await createArchiveSession([new File([await writer.close()], "internal-reference-budget.zip")]);
	try {
		await expect(loadArchiveDataset(session, undefined, { maxOccurrences: 2 })).rejects.toThrow("The archive exceeds the supported occurrence preparation limits.");
		const recovered = await loadArchiveDataset(session);
		expect(recovered.occurrenceFacts!.occurrences).toHaveLength(3);
		expect(recovered.occurrenceFacts!.resources).toHaveLength(2);
		const a = session.index.entries.find(entry => entry.id.path === "media/A.jpg")!;
		expect(new Uint8Array(await session.reader.readEntry(a.id, 32))).toEqual(new Uint8Array([11]));
	} finally { session.reader.dispose(); }
});

it("keeps the same actual reader usable after missing-provenance record rejection and retries all 129 declarations", async () => {
	vi.stubGlobal("Worker", undefined);
	const input = missingFanoutInput(129);
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(chatPath, new Uint8ArrayReader(new TextEncoder().encode(input.documents[0]!.text)), { level: 0 });
	await writer.add("media/A.jpg", new Uint8ArrayReader(new Uint8Array([11, 22, 33])), { level: 0 });
	const session = await createArchiveSession([new File([await writer.close()], "internal-missing-provenance-budget.zip")]);
	try {
		const baseline = await loadArchiveDataset(session);
		const missing = baseline.assets.find(asset => !asset.available)!;
		const bytes = new TextEncoder().encode(JSON.stringify(missing)).length;
		expect(missing.sources).toHaveLength(129);
		await expect(loadArchiveDataset(session, undefined, { maxFactBytes: bytes - 1 })).rejects.toMatchObject({ name: "OccurrencePreparationError", code: "budget", message: "The archive exceeds the supported occurrence preparation limits. Select fewer ZIP parts and retry." });
		expect(missing.sources).toHaveLength(129);
		const recovered = await loadArchiveDataset(session, undefined, { maxFactBytes: bytes });
		expect(recovered.occurrenceFacts!.occurrences).toHaveLength(129);
		expect(recovered.links).toHaveLength(129);
		expect(recovered.assets.find(asset => !asset.available)!.sources).toHaveLength(129);
		expect((await loadArchiveDataset(session)).occurrenceFacts).toEqual(baseline.occurrenceFacts);
		const original = session.index.entries.find(entry => entry.id.path === "media/A.jpg")!;
		expect(new Uint8Array(await session.reader.readEntry(original.id))).toEqual(new Uint8Array([11, 22, 33]));
	} finally { session.reader.dispose(); }
});

it("keeps equal physical originals ambiguous with attributed proof and refuses an oversized candidate pool", () => {
	const input = inputFor('{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A","MISSING"]}]}');
	input.entries.push({ ...input.entries[1]!, id: { ...input.entries[1]!.id, ordinal: 2 } });
	const dataset = normalizeArchiveDataset(input);
	const facts = dataset.occurrenceFacts!;
	const association = facts.occurrences[0]!.association;
	expect(association.state).toBe("ambiguous");
	if (association.state !== "ambiguous") throw new Error("Expected authored ambiguity");
	expect(association.candidates).toHaveLength(2);
	const ordinalProofs = association.candidates.map(candidate => candidate.proofSourceIds.map(id => facts.sources.find(source => source.id === id)!).filter(source => source.documentSha256 === null).map(source => source.entryOrdinal));
	expect(ordinalProofs.sort((left, right) => left[0]! - right[0]!)).toEqual([[0], [2]]);
	expect(facts.resources.filter(resource => resource.available)).toHaveLength(3);
	expect(dataset.events[0]!.assetIds).toEqual([]);
	expect(facts.occurrences[1]!.association.state).toBe("unlinked");
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxCandidatesPerOccurrence: 1 } })).toThrow("The archive exceeds the supported occurrence preparation limits.");
});

it.each([true, false])("charges every ambiguous candidate target retained in facts and compatibility links with document proof %s", (attested) => {
	const input = inputFor('{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A"]}]}');
	input.entries.push({ ...input.entries[1]!, id: { ...input.entries[1]!.id, ordinal: 2 } });
	if (!attested) input.documents = input.documents.map(({ documentSha256: _sha, byteLength: _bytes, ...document }) => document);
	const exact = normalizeArchiveDataset({ ...input, occurrenceLimits: { maxAssociationTargets: 8 } });
	expect(exact.links).toHaveLength(2);
	expect(exact.links.every(link => link.status === "ambiguous" && link.candidateAssetIds.length === 2)).toBe(true);
	expect(exact.events[0]!.assetIds).toEqual([]);
	if (attested) {
		const association = exact.occurrenceFacts!.occurrences[0]!.association;
		expect(association.state).toBe("ambiguous");
		if (association.state !== "ambiguous") throw new Error("Expected authored ambiguity");
		expect(association.candidates).toHaveLength(2);
	} else expect(exact.occurrenceFacts).toBeNull();
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxAssociationTargets: 7 } })).toThrow(expect.objectContaining({ code: "budget" }));
	for (const token of ["B", "MISSING"]) {
		const singleton = inputFor(JSON.stringify({ maya: [{ From: "owner", "Media IDs": [token] }] }));
		expect(normalizeArchiveDataset({ ...singleton, occurrenceLimits: { maxAssociationTargets: 2 } }).links).toHaveLength(1);
		expect(() => normalizeArchiveDataset({ ...singleton, occurrenceLimits: { maxAssociationTargets: 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
	}
});

it("preserves a layer-only source reference without inventing an original or ordinary attachment", () => {
	const input = inputFor('{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["media/A-overlay.png"]}]}');
	input.entries[1]!.id.path = "media/A-overlay.png";
	const dataset = normalizeArchiveDataset(input);
	const facts = dataset.occurrenceFacts!;
	expect(facts.occurrences).toHaveLength(1);
	expect(facts.occurrences[0]!.association).toMatchObject({ state: "unlinked", missingMediaId: null });
	expect(facts.resources.filter(resource => !resource.available)).toEqual([]);
	expect(facts.resources.find(resource => resource.filename === "media/A-overlay.png")?.role).toBe("layer");
	expect(facts.referenceDiagnostics.some(diagnostic => diagnostic.code === "reference-target-is-layer" && diagnostic.owner?.id === facts.occurrences[0]!.id)).toBe(true);
	expect(dataset.events[0]!.assetIds).toEqual([]);
});

it("retains recognized invalid Memories fields as scoped uncertainty without fabricating empty saves", () => {
	const text = JSON.stringify({ "Saved Media": [{}, { Unknown: "not a save" }, { Location: "\ud800" }, { Location: "Oslo 🚀" }, { "Media Type": 42 }] });
	const dataset = normalizeArchiveDataset(inputFor(text, "json/memories_history.json"));
	const facts = dataset.occurrenceFacts!;
	expect(facts.occurrences).toHaveLength(3);
	expect(facts.occurrences.map(occurrence => occurrence.identity.rowPointer)).toEqual(["/Saved Media/2", "/Saved Media/3", "/Saved Media/4"]);
	expect(facts.occurrences.map(occurrence => occurrence.location)).toEqual([null, "Oslo 🚀", null]);
	expect(facts.occurrences.map(occurrence => occurrence.rawMediaType)).toEqual([null, null, null]);
	expect(facts.referenceDiagnostics.filter(diagnostic => diagnostic.code === "unsupported-occurrence-field").map(diagnostic => diagnostic.fieldPointer).sort()).toEqual(["/Saved Media/2/Location", "/Saved Media/4/Media Type"]);
	expect(facts.referenceDiagnostics.filter(diagnostic => diagnostic.code === "unsupported-occurrence-field").every(diagnostic => diagnostic.owner?.kind === "occurrence" && facts.occurrences.some(occurrence => occurrence.id === diagnostic.owner?.id))).toBe(true);
	expect(facts.occurrences.every(occurrence => occurrence.caption === null && occurrence.declaredKind === "unknown" && occurrence.normalizedTime.valid === false)).toBe(true);
	expect(facts.resources.filter(resource => !resource.available)).toEqual([]);
});

it("keeps separate missing-save context and one minimal declaring-proof resource without first-row metadata", () => {
	const text = JSON.stringify({ "Saved Media": [
		{ Date: "2020-01-01 01:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=NOFILE", Location: "LOCATION-ONE", Caption: "CAPTION-CANARY" },
		{ Date: "2020-01-01 02:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=NOFILE", Location: "DENIED-LOCATION-CANARY" },
	] });
	const dataset = normalizeArchiveDataset(inputFor(text, "json/memories_history.json"));
	const facts = dataset.occurrenceFacts!;
	const missing = facts.resources.filter(resource => !resource.available);
	expect(missing).toHaveLength(1);
	expect(missing[0]).toMatchObject({ filename: "memories/2020-01-01_NOFILE-main.jpg", kind: "unknown", entry: null, available: false });
	expect(missing[0]!.sourceIds).toHaveLength(2);
	expect(facts.occurrences.map(occurrence => occurrence.location)).toEqual(["LOCATION-ONE", "DENIED-LOCATION-CANARY"]);
	expect(facts.occurrences.map(occurrence => occurrence.normalizedTime.instant)).toEqual(["2020-01-01T01:00:00.000Z", "2020-01-01T02:00:00.000Z"]);
	expect(facts.occurrences.every(occurrence => occurrence.caption === null && occurrence.association.state === "unlinked" && occurrence.association.missingMediaId === missing[0]!.id)).toBe(true);
	expect(JSON.stringify(missing)).not.toMatch(/LOCATION|CAPTION|2020-01-01T/);
	expect(dataset.assets.filter(asset => !asset.available)).toHaveLength(1);
});

it("shares an exact missing file across chat and Memory declarations through normalization and the actual ZIP loader", async () => {
	vi.stubGlobal("Worker", undefined);
	const memoryPath = "json/memories_history.json";
	const path = "memories/2020-01-01_A-main.jpg";
	const chat = JSON.stringify({ maya: [{ From: "owner", "Media IDs": [path] }] });
	const memories = JSON.stringify({ "Saved Media": [
		{ Date: "2020-01-01 01:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=A", Location: "LOCATION-ONE" },
		{ Date: "2020-01-01 02:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=A", Location: "DENIED-LOCATION-CANARY" },
	] });
	const input = inputFor(chat);
	input.entries = input.entries.slice(0, 1);
	const bytes = new TextEncoder().encode(memories).length;
	input.entries.push({ id: { sourceId: "metadata", path: memoryPath, ordinal: 1 }, compressedSize: bytes, uncompressedSize: bytes, isDirectory: false });
	input.documents.push({ sourceId: "metadata", path: memoryPath, ordinal: 1, text: memories, documentSha256: sha(memories), byteLength: bytes });
	const assertShared = (dataset: ReturnType<typeof normalizeArchiveDataset>) => {
		const facts = dataset.occurrenceFacts!;
		expect(facts.occurrences).toHaveLength(3);
		expect(facts.resources).toHaveLength(1);
		const resource = facts.resources[0]!;
		expect(resource).toMatchObject({ filename: path, available: false, entry: null, kind: "unknown", role: "original" });
		expect(resource.sourceIds).toHaveLength(3);
		expect(resource.sourceIds.map(id => {
			const source = facts.sources.find(source => source.id === id)!;
			return source.path + ":" + source.recordPointer;
		}).sort()).toEqual([chatPath + ":/maya/0", memoryPath + ":/Saved Media/0", memoryPath + ":/Saved Media/1"]);
		expect(facts.occurrences.every(occurrence => occurrence.association.state === "unlinked" && occurrence.association.missingMediaId === resource.id)).toBe(true);
		expect(facts.occurrences.filter(occurrence => occurrence.origin === "memories").map(occurrence => occurrence.location)).toEqual(["LOCATION-ONE", "DENIED-LOCATION-CANARY"]);
		expect(facts.occurrences.filter(occurrence => occurrence.origin === "memories").map(occurrence => occurrence.normalizedTime.instant)).toEqual(["2020-01-01T01:00:00.000Z", "2020-01-01T02:00:00.000Z"]);
		expect(JSON.stringify(resource)).not.toMatch(/LOCATION|2020-01-01T|Download Link/);
		expect(dataset.assets).toHaveLength(1);
		expect(dataset.assets[0]).toMatchObject({ id: resource.id, available: false, path, kind: "unknown", location: null, timestamp: null, raw: {} });
		expect(dataset.assets[0]!.sources).toHaveLength(3);
		expect(dataset.links).toHaveLength(1);
		expect(dataset.links[0]).toMatchObject({ assetId: resource.id, status: "unlinked", candidateAssetIds: [] });
		expect(dataset.coverage.missingMedia).toBe(1);
	};
	const baseline = normalizeArchiveDataset({ ...input, occurrenceLimits: { maxResources: 1, maxSources: 3, maxSourceIdsPerFact: 1 } });
	assertShared(baseline);
	const reversed = normalizeArchiveDataset({ ...input, documents: [...input.documents].reverse(), entries: [...input.entries].reverse() });
	expect(reversed.occurrenceFacts).toEqual(baseline.occurrenceFacts);
	const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
	const unattested = { ...input, documents: input.documents.map(({ documentSha256: _sha, byteLength: _bytes, ...document }) => document) };
	for (const fixture of [input, unattested]) {
		const dataset = normalizeArchiveDataset({ ...fixture, occurrenceLimits: { maxResources: 1, maxSources: 3, maxSourceIdsPerFact: 1 } });
		expect(dataset.assets.filter(asset => !asset.available)).toHaveLength(1);
		expect(dataset.assets[0]!.sources).toHaveLength(3);
		const bytes = encoded(dataset.occurrenceFacts) + encoded(dataset.links)
			+ dataset.events.reduce((sum, event) => sum + encoded(event.mediaReferenceIds), 0)
			+ dataset.assets.filter(asset => !asset.available).reduce((sum, asset) => sum + encoded(asset), 0);
		expect(normalizeArchiveDataset({ ...fixture, occurrenceLimits: { maxFactsBytes: bytes } })).toEqual(dataset);
		expect(() => normalizeArchiveDataset({ ...fixture, occurrenceLimits: { maxFactsBytes: bytes - 1 } })).toThrow(expect.objectContaining({ code: "budget" }));
		expect(normalizeArchiveDataset({ ...fixture, occurrenceLimits: { maxSourceIdsPerFact: 1 } })).toEqual(dataset);
		expect(() => normalizeArchiveDataset({ ...fixture, occurrenceLimits: { maxSources: 2 } })).toThrow(expect.objectContaining({ code: "budget" }));
	}
	expect(normalizeArchiveDataset(unattested).occurrenceFactsUnavailableReason).toBe("missing-document-proof");
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	for (const document of input.documents) await writer.add(document.path, new Uint8ArrayReader(new TextEncoder().encode(document.text)), { level: 0 });
	const session = await createArchiveSession([new File([await writer.close()], "internal-shared-missing.zip")]);
	try { assertShared(await loadArchiveDataset(session, undefined, { maxResources: 1 })); }
	finally { session.reader.dispose(); }
});

it("preserves literal singleton missing identities and keeps same-mid different-path declarations distinct", () => {
	const path = "memories/2020-01-01_A-main.jpg";
	const chat = inputFor(JSON.stringify({ maya: [{ From: "owner", "Media IDs": [path] }] }));
	chat.entries = chat.entries.slice(0, 1);
	const chatOnly = normalizeArchiveDataset(chat);
	// Literal legacy hashes were calculated from the pre-fix singleton algorithm.
	expect(chatOnly.assets[0]!.id).toBe("missing-reference-0fb57beafe19239c");
	expect(chatOnly.links[0]).toMatchObject({ id: "link-d9fbedd2c02031ac", referenceId: "reference-22f1571631f5c000" });
	const row = { Date: "2020-01-01", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=A" };
	const memory = inputFor(JSON.stringify({ "Saved Media": [row] }), "json/memories_history.json");
	memory.entries = memory.entries.slice(0, 1);
	expect(normalizeArchiveDataset(memory).assets[0]!.id).toBe("missing-asset-1e63a3325e7b0d6a");
	const different = inputFor(JSON.stringify({ "Saved Media": [row, { ...row, Date: "2020-01-02" }, { "Download Link": "https://example.invalid/?mid=A" }] }), "json/memories_history.json");
	different.entries = different.entries.slice(0, 1);
	const result = normalizeArchiveDataset(different);
	expect(result.occurrenceFacts!.resources.map(resource => resource.filename).sort()).toEqual(["A", path, "memories/2020-01-02_A-main.jpg"]);
	expect(new Set(result.occurrenceFacts!.occurrences.map(occurrence => occurrence.association.state === "unlinked" ? occurrence.association.missingMediaId : null)).size).toBe(3);
	expect(result.assets).toHaveLength(3);
});

it("admits exact encoded output and rejects one-byte overflow without dropping provenance or compatibility links", () => {
	const input = inputFor();
	const baseline = normalizeArchiveDataset(input);
	const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
	const bytes = encoded(baseline.occurrenceFacts) + encoded(baseline.links)
		+ baseline.events.reduce((sum, event) => sum + encoded(event.mediaReferenceIds), 0);
	expect(normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactsBytes: bytes } }).occurrenceFacts).toEqual(baseline.occurrenceFacts);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactsBytes: bytes - 1 } })).toThrow(OccurrencePreparationError);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxFactBytes: 32 } })).toThrow(OccurrencePreparationError);
	const unattested: DatasetInput = { ...input, documents: input.documents.map(document => ({ sourceId: document.sourceId, path: document.path, text: document.text })) };
	expect(() => normalizeArchiveDataset({ ...unattested, occurrenceLimits: { maxFactsBytes: 64 } })).toThrow(OccurrencePreparationError);
});

it("rejects critical malformed locators while retaining malformed token gaps and valid non-BMP local filenames", () => {
	const empty = inputFor(JSON.stringify({ ["\ud800PRIVATE-LOCATOR-CANARY"]: [] }));
	expect(() => normalizeArchiveDataset(empty)).toThrow(OccurrencePreparationError);
	const handle = "s".repeat(256);
	const emptyGood = inputFor("{}");
	emptyGood.documents[0]!.sourceId = handle; emptyGood.entries[0]!.id.sourceId = handle;
	emptyGood.sourceDigests = { [handle]: "1".repeat(64), media: "2".repeat(64) };
	expect(normalizeArchiveDataset(emptyGood).occurrenceFacts).not.toBeNull();
	const bad = { ...emptyGood, entries: emptyGood.entries.map(entry => ({ ...entry, id: { ...entry.id, sourceId: entry.id.sourceId === handle ? handle + "s" : entry.id.sourceId } })),
		documents: emptyGood.documents.map(document => ({ ...document, sourceId: handle + "s" })) };
	expect(() => normalizeArchiveDataset(bad)).toThrow(OccurrencePreparationError);
	let locatorGetterCalled = false;
	const accessorInput = inputFor("{}");
	Object.defineProperty(accessorInput.entries[0]!.id, "sourceId", { enumerable: true, get: () => { locatorGetterCalled = true; return "PRIVATE-GETTER-CANARY"; } });
	expect(() => normalizeArchiveDataset(accessorInput)).toThrow(OccurrencePreparationError);
	expect(locatorGetterCalled).toBe(false);
	const text = JSON.stringify({ "fixture/🚀~b": [{ From: "owner", "Media Type": "TEXT", "Media IDs": ["\ud800PRIVATE-TOKEN-CANARY", "media/photo 🚀 one.jpg"] }] });
	const positive = inputFor(text); positive.entries[1]!.id.path = "media/photo 🚀 one.jpg";
	const dataset = normalizeArchiveDataset(positive);
	expect(dataset.occurrenceFacts!.occurrences.map(occurrence => occurrence.identity.referenceOrdinal)).toEqual([1]);
	expect(dataset.occurrenceFacts!.occurrences[0]).toMatchObject({ declaredKind: "unknown", rawMediaType: "TEXT", recordedPosition: { containerPointer: "/fixture~1🚀~0b", rowIndex: 0 } });
	expect(dataset.occurrenceFacts!.referenceDiagnostics[0]).toMatchObject({ code: "malformed-reference-position", referenceOrdinal: 0 });
	expect(dataset.occurrenceFacts!.resources.find(resource => resource.filename === "media/photo 🚀 one.jpg")?.kind).toBe("image");
	expect(dataset.events[0]!.kind).toBe("text");
});

it("checks exact multibyte reference admission and operation-wide malformed positions without truncation", () => {
	const input = inputFor(JSON.stringify({ maya: [{ From: "owner", "Media Type": "IMAGE", "Media IDs": ["é", "A"] }] }));
	expect(normalizeArchiveDataset({ ...input, occurrenceLimits: { maxReferenceFieldBytes: 10, maxTokenBytes: 2 } }).events[0]!.mediaReferenceIds).toEqual(["é", "A"]);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxReferenceFieldBytes: 9 } })).toThrow(OccurrencePreparationError);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxTokenBytes: 1 } })).toThrow(OccurrencePreparationError);
	const rows = inputFor(JSON.stringify({ maya: [{ From: "owner", "Media IDs": [null, "A"] }, { From: "owner", "Media IDs": [null, "B"] }] }));
	expect(() => normalizeArchiveDataset({ ...rows, occurrenceLimits: { maxReferencePositions: 3 } })).toThrow(OccurrencePreparationError);
	expect(normalizeArchiveDataset({ ...rows, occurrenceLimits: { maxReferencePositions: 4 } }).occurrenceFacts!.occurrences.map(occurrence => occurrence.identity.referenceOrdinal)).toEqual([1, 1]);
});

it.each([true, false])("admits the complete generated Memory filename before missing expansion with document proof %s", (attested) => {
	const memory = (mid: string) => {
		const input = inputFor(JSON.stringify({ "Saved Media": [{ Date: "2020-01-01", "Media Type": "Image", "Download Link": `https://example.invalid/?mid=${mid}` }] }), "json/memories_history.json");
		if (!attested) input.documents = input.documents.map(({ documentSha256: _sha, byteLength: _bytes, ...document }) => document);
		return input;
	};
	const exact = normalizeArchiveDataset(memory("A".repeat(4067)));
	expect(exact.assets.find(asset => !asset.available)?.path).toBe(`memories/2020-01-01_${"A".repeat(4067)}-main.jpg`);
	expect(exact.occurrenceFacts === null).toBe(!attested);
	expect(() => normalizeArchiveDataset(memory("A".repeat(4068)))).toThrow(expect.objectContaining({ name: "OccurrencePreparationError", code: "domain", message: "The archive contains an unsupported source locator for occurrence preparation." }));
	const multibyte = memory("éééé"); // The whole expected filename is 37 UTF-8 bytes.
	const admitted = normalizeArchiveDataset({ ...multibyte, occurrenceLimits: { maxLocatorBytes: 37 } });
	expect(admitted.assets.find(asset => !asset.available)?.path).toBe("memories/2020-01-01_éééé-main.jpg");
	expect(() => normalizeArchiveDataset({ ...multibyte, occurrenceLimits: { maxLocatorBytes: 36 } })).toThrow(expect.objectContaining({ name: "OccurrencePreparationError", code: "budget", message: "The archive exceeds the supported occurrence preparation limits. Select fewer ZIP parts and retry." }));
});

it("rejects invalid lowering overrides before any loader read or accessor and keeps errors free of private fields", async () => {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(chatPath, new Uint8ArrayReader(new TextEncoder().encode(repeatedDocument)), { level: 0 });
	const session = await createArchiveSession([new File([await writer.close()], "internal-limit-check.zip")]);
	const read = vi.spyOn(session.reader, "readEntry");
	let invoked = false;
	const accessor = Object.defineProperty({}, "maxOccurrences", { enumerable: true, get: () => { invoked = true; return 1; } });
	try {
		for (const override of [accessor, { "PRIVATE-LIMIT-CANARY": 1 }, { maxOccurrences: 250001 }, { maxOccurrences: 0 }]) {
			await expect(loadArchiveDataset(session, undefined, override)).rejects.toMatchObject({ name: "OccurrencePreparationError", code: "limits", message: "The occurrence preparation limits are invalid." });
		}
		expect(invoked).toBe(false); expect(read).not.toHaveBeenCalled();
	} finally { session.reader.dispose(); }
});

it("rejects malformed override reflection with fixed limits errors before source work and preserves loader retry", async () => {
	vi.stubGlobal("Worker", undefined);
	const revoked = Proxy.revocable({}, {}); revoked.revoke();
	const overrides = [
		revoked.proxy,
		new Proxy({}, { getPrototypeOf() { throw new Error("PRIVATE-PROTOTYPE-CANARY"); } }),
		new Proxy({}, { ownKeys() { throw new Error("PRIVATE-OWNKEYS-CANARY"); } }),
		new Proxy({}, { ownKeys() { return ["maxOccurrences"]; }, getOwnPropertyDescriptor() { return undefined; } }),
		new Proxy({}, { ownKeys() { return ["maxOccurrences"]; }, getOwnPropertyDescriptor() { throw new Error("PRIVATE-DESCRIPTOR-CANARY"); } }),
	];
	const expected = { name: "OccurrencePreparationError", code: "limits", message: "The occurrence preparation limits are invalid." };
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(chatPath, new Uint8ArrayReader(new TextEncoder().encode(repeatedDocument)), { level: 0 });
	await writer.add("media/A.jpg", new Uint8ArrayReader(new Uint8Array([11])), { level: 0 });
	await writer.add("media/B.jpg", new Uint8ArrayReader(new Uint8Array([22])), { level: 0 });
	const file = new File([await writer.close()], "internal-reflection-check.zip");
	const session = await createArchiveSession([file]);
	const read = vi.spyOn(session.reader, "readEntry");
	const slice = vi.spyOn(file, "slice");
	let sourceWork = 0;
	try {
		for (const occurrenceLimits of overrides) {
			const input = { ...inputFor(), occurrenceLimits };
			Object.defineProperty(input, "entries", { get() { sourceWork++; throw new Error("PRIVATE-SOURCE-CANARY"); } });
			expect(() => normalizeArchiveDataset(input)).toThrow(OccurrencePreparationError);
			expect(() => normalizeArchiveDataset(input)).toThrow(expect.objectContaining(expected));
			await expect(loadArchiveDataset(session, undefined, occurrenceLimits)).rejects.toBeInstanceOf(OccurrencePreparationError);
			await expect(loadArchiveDataset(session, undefined, occurrenceLimits)).rejects.toMatchObject(expected);
		}
		expect(sourceWork).toBe(0); expect(read).not.toHaveBeenCalled(); expect(slice).not.toHaveBeenCalled();
		expect((await loadArchiveDataset(session)).occurrenceFacts!.occurrences).toHaveLength(3);
		const original = session.index.entries.find(entry => entry.id.path === "media/A.jpg")!;
		expect(new Uint8Array(await session.reader.readEntry(original.id))).toEqual(new Uint8Array([11]));
	} finally { session.reader.dispose(); }
});

it("retains all 128 attested copy sources and rejects an additional copy without inventing new references", () => {
	const input = inputFor('{"maya":[{"From":"owner","Media Type":"IMAGE","Media IDs":["A"]}]}');
	for (let index = 1; index < 128; index += 1) {
		const sourceId = `copy-${index}`;
		input.documents.push({ ...input.documents[0]!, sourceId });
		input.entries.push({ ...input.entries[0]!, id: { ...input.entries[0]!.id, sourceId } });
		input.sourceDigests![sourceId] = (index + 2).toString(16).padStart(64, "0");
	}
	const dataset = normalizeArchiveDataset({ ...input, occurrenceLimits: { maxSources: 130 } });
	expect(dataset.events).toHaveLength(1); expect(dataset.links).toHaveLength(1);
	expect(dataset.occurrenceFacts!.occurrences).toHaveLength(1);
	expect(dataset.occurrenceFacts!.sources).toHaveLength(130);
	expect(dataset.occurrenceFacts!.occurrences[0]!.sourceIds).toHaveLength(128);
	expect(dataset.occurrenceFacts!.occurrences[0]!.identity.copySourceIds).toHaveLength(128);
	expect(() => normalizeArchiveDataset({ ...input, occurrenceLimits: { maxSources: 129 } })).toThrow(OccurrencePreparationError);
	input.documents.push({ ...input.documents[0]!, sourceId: "overflow-copy" });
	input.entries.push({ ...input.entries[0]!, id: { ...input.entries[0]!.id, sourceId: "overflow-copy" } });
	input.sourceDigests!["overflow-copy"] = "f".repeat(64);
	expect(() => normalizeArchiveDataset(input)).toThrow(OccurrencePreparationError);
});

it("keeps string-array, delimiter, absent, empty and unsupported interpretations distinct without declaring JPEG kinds from TEXT", () => {
	const rows = [
		{ From: "owner", "Media Type": "TEXT", "Media IDs": '["A","A"]' },
		{ From: "owner", "Media Type": "TEXT", "Media IDs": "A; A" },
		{ From: "owner", "Media Type": "IMAGE" },
		{ From: "owner", "Media Type": "IMAGE", "Media IDs": [] },
		{ From: "owner", "Media Type": "IMAGE", "Media IDs": { secret: "PRIVATE-FIELD-CANARY" } },
	];
	const dataset = normalizeArchiveDataset(inputFor(JSON.stringify({ maya: rows })));
	const facts = dataset.occurrenceFacts!;
	expect(facts.occurrences).toHaveLength(4);
	expect(facts.occurrences.map(occurrence => occurrence.reference?.parserRule)).toEqual(["json-array-string-v1", "json-array-string-v1", "delimited-v1", "delimited-v1"]);
	expect(facts.occurrences.every(occurrence => occurrence.declaredKind === "unknown")).toBe(true);
	expect(facts.eventRows.map(row => row.references.state)).toEqual(["supported", "supported", "absent", "supported", "unsupported"]);
	expect(facts.eventRows[3]!.references).toMatchObject({ sourcePositions: 0, knownSupportedSlots: 0, unknownRemainder: false });
	expect(facts.referenceDiagnostics.map(diagnostic => diagnostic.code)).toEqual(["absent-reference-field", "unsupported-reference-field"]);
	expect(JSON.stringify(facts)).not.toContain("PRIVATE-FIELD-CANARY");
});
