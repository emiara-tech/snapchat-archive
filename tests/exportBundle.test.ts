import { BlobReader, BlobWriter, TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";
import { createExportPlan, MAX_LOCAL_BUNDLE_BYTES, safeBundleStem, writeArchiveBundle, type BundleSelection } from "../src/lib/exportBundle";
import { buildSnapZipIndex, readSnapZipEntryContent } from "../src/lib/snapZip";

const original = new Uint8Array([0, 1, 127, 255, 12, 16]);
const layer = new Uint8Array([9, 8, 7]);
function fixture(): BundleSelection {
	return {
		datasetFingerprint: "synthetic-evidence-v1", revision: "query-and-review-1", timezone: "UTC", mode: "curated", query: { year: 2018 },
		coverage: ["This fixture represents only recorded exchanges."],
		events: [
			{ id: "event-first", conversationId: "../Jamie/2018", conversationTitle: "Jamie & <friends>", sender: "You", authorship: "owner", date: "2018-01-01T12:00:00.000Z", kind: "image", text: '<script>fetch("https://example.invalid/private")</script> & old jokes', assetIds: ["../../a photo 🐈"], sourceId: "source:0" },
			{ id: "event-repeat", conversationId: "../Jamie/2018", conversationTitle: "Jamie & <friends>", sender: "Jamie", authorship: "other", date: "2018-01-01T12:01:00.000Z", kind: "image", text: "Remember this?", assetIds: ["../../a photo 🐈"], sourceId: "source:1" },
		],
		assets: [{ id: "../../a photo 🐈", path: "chat_media/original.jpg", sourceId: "zip-media", mimeType: "image/jpeg", byteSize: original.byteLength, date: "2018-01-01T12:00:00.000Z", overlayPath: "chat_media/overlay.png", overlaySourceId: "zip-overlays", linkState: "confirmed" }],
	};
}

describe("portable readable bundle", () => {
	it("rejects changed original bytes against the approved size including a known empty original", async () => {
		for (const expectedSize of [original.byteLength, 0]) {
			const input = fixture();
			input.assets[0]!.byteSize = expectedSize;
			let emitted = 0;
			await expect(writeArchiveBundle(createExportPlan(input), async () => new Uint8Array([1]).buffer,
				{ onVolume: async () => { emitted++; } })).rejects.toThrow(/original.*approved.*size/i);
			expect(emitted).toBe(0);
		}
	});
	it("rejects a changed recorded overlay before a complete catalogue is emitted", async () => {
		const input = fixture();
		input.assets[0]!.overlayByteSize = layer.byteLength;
		let emitted = 0;
		await expect(writeArchiveBundle(createExportPlan(input), async (path) => Uint8Array.from(path.endsWith("overlay.png") ? [8] : original).buffer,
			{ onVolume: async () => { emitted++; } })).rejects.toThrow(/overlay.*approved.*size/i);
		expect(emitted).toBe(0);
	});
	it("validates both source layers before writing the next asset can flush a part", async () => {
		const input = fixture();
		input.assets = [
			{ ...input.assets[0]!, id: "first", overlayPath: null, byteSize: 48 * 1024 },
			{ ...input.assets[0]!, id: "changed-layer", overlayByteSize: 3, byteSize: 48 * 1024 },
		];
		let emitted = 0;
		await expect(writeArchiveBundle(createExportPlan(input), async (path) => path.endsWith("overlay.png") ? new Uint8Array([8]).buffer : new Uint8Array(48 * 1024).buffer,
			{ maxVolumeBytes: 96 * 1024, onVolume: async () => { emitted++; } })).rejects.toThrow(/overlay.*approved.*size/i);
		expect(emitted).toBe(0);
	});

	it("preserves exact original and overlay bytes for duplicated paths inside one ZIP", async () => {
		const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
		for (const [path, bytes] of [["chat_media/a.jpg", new Uint8Array([99])], ["chat_media/b.jpg", original], ["chat_media/a.png", new Uint8Array([88])], ["chat_media/b.png", layer]] as const) {
			await writer.add(path, new Uint8ArrayReader(bytes));
		}
		// Renaming equal-length local and central directory names creates a valid
		// duplicate-entry fixture without bypassing zip.js integrity checks.
		const bytes = new Uint8Array(await (await writer.close()).arrayBuffer());
		for (const extension of ["jpg", "png"]) {
			const before = new TextEncoder().encode(`chat_media/b.${extension}`);
			const after = new TextEncoder().encode(`chat_media/a.${extension}`);
			for (let offset = 0; offset <= bytes.length - before.length; offset += 1) {
				if (before.every((byte, index) => bytes[offset + index] === byte)) bytes.set(after, offset);
			}
		}
		const index = await buildSnapZipIndex([{ id: "same-source", file: new Blob([bytes]) }]);
		const input = fixture();
		input.assets[0] = { ...input.assets[0]!, path: "chat_media/a.jpg", sourceId: "same-source", sourceOrdinal: 1, overlayPath: "chat_media/a.png", overlaySourceId: "same-source", overlayOrdinal: 3 };
		const reads: Array<[string, string | null, number | undefined]> = [];
		const result = await writeArchiveBundle(createExportPlan(input), async (path, sourceId, ordinal) => {
			reads.push([path, sourceId, ordinal]);
			const content = await readSnapZipEntryContent(index, { sourceId: sourceId!, path, ordinal });
			return content instanceof ArrayBuffer ? content : new Response(content).arrayBuffer();
		});
		expect(reads).toEqual([["chat_media/a.jpg", "same-source", 1], ["chat_media/a.png", "same-source", 3]]);
		const reader = new ZipReader(new BlobReader(result.blob), { useWebWorkers: false });
		try {
			const entries = await reader.getEntries();
			expect(await entries.find((entry) => entry.filename === result.manifest.assets[0]!.file)!.getData(new Uint8ArrayWriter())).toEqual(original);
			expect(await entries.find((entry) => entry.filename === result.manifest.assets[0]!.overlay)!.getData(new Uint8ArrayWriter())).toEqual(layer);
		} finally { await reader.close(); }
	});
	it("freezes the approved input instead of observing later query or decision changes", () => {
		const selection = fixture();
		const plan = createExportPlan(selection);
		selection.events[0]!.text = "A later edit";
		selection.assets.push({ ...selection.assets[0]!, id: "not-reviewed" });
		(selection.query as { year: number }).year = 2020;
		expect(plan.events[0]!.text).toContain("old jokes");
		expect(plan.assets).toHaveLength(1);
		expect(plan.query).toEqual({ year: 2018 });
	});

	it("preserves original bytes, exact overlay source, repeated context, escaped HTML, and independently verified hashes", async () => {
		const reads: Array<[string, string | null]> = [];
		const result = await writeArchiveBundle(createExportPlan(fixture()), async (path, sourceId) => {
			reads.push([path, sourceId]);
			return Uint8Array.from(path.endsWith("overlay.png") ? layer : original).buffer;
		});
		expect(reads).toEqual([["chat_media/original.jpg", "zip-media"], ["chat_media/overlay.png", "zip-overlays"]]);
		const reader = new ZipReader(new BlobReader(result.blob), { useWebWorkers: false });
		try {
			const entries = await reader.getEntries();
			const paths = entries.map((entry) => entry.filename);
			expect(paths).toContain("index.html");
			expect(paths).toContain("manifest.json");
			expect(paths).not.toContain("json/chat_history.json");
			expect(paths.every((path) => !path.includes("..") && !path.startsWith("/") && !path.includes("\\"))).toBe(true);
			const mediaPath = result.manifest.assets[0]!.file!;
			const media = entries.find((entry) => entry.filename === mediaPath)!;
			expect(await media.getData(new Uint8ArrayWriter(), { useWebWorkers: false })).toEqual(original);
			for (const payload of result.manifest.payloads) {
				const entry = entries.find((entry) => entry.filename === payload.path)!;
				const bytes = await entry.getData(new Uint8ArrayWriter(), { useWebWorkers: false });
				expect(bytes.byteLength).toBe(payload.byteSize);
				const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
				expect(Buffer.from(hash).toString("hex")).toBe(payload.sha256);
			}
			const page = entries.find((entry) => entry.filename.startsWith("conversations/"))!;
			const html = await page.getData(new TextWriter(), { useWebWorkers: false });
			expect(html).toContain("&lt;script&gt;");
			expect(html).not.toContain("<script>");
			expect(html).toContain("Jamie &amp; &lt;friends&gt;");
			expect(html.match(new RegExp(`src="\\.\\./${mediaPath}"`, "g"))).toHaveLength(2);
			const records = JSON.parse(await entries.find((entry) => entry.filename === "records.json")!.getData(new TextWriter(), { useWebWorkers: false }));
			expect(records.events).toHaveLength(2);
			expect(records.assets).toHaveLength(1);
		} finally { await reader.close(); }
	});

	it("retains a missing-media record as a reported gap", async () => {
		const input = fixture();
		input.assets = [{ ...input.assets[0]!, path: null, overlayPath: null }];
		let reads = 0;
		const result = await writeArchiveBundle(createExportPlan(input), async () => { reads += 1; return original.buffer; });
		expect(reads).toBe(0);
		expect(result.manifest.assets[0]!.file).toBeNull();
		expect(result.manifest.omissions).toContain("1 media records have no available original file.");
	});

	it("refuses oversized and cancelled work before reading any private asset", async () => {
		const input = fixture();
		input.assets[0]!.byteSize = MAX_LOCAL_BUNDLE_BYTES + 1;
		let reads = 0;
		const read = async () => { reads += 1; return original.buffer; };
		await expect(writeArchiveBundle(createExportPlan(input), read)).rejects.toThrow("256 MiB");
		const cancellation = new AbortController(); cancellation.abort();
		await expect(writeArchiveBundle(createExportPlan(fixture()), read, { signal: cancellation.signal })).rejects.toMatchObject({ name: "AbortError" });
		expect(reads).toBe(0);
	});

	it("does not return a completed bundle when an original read fails", async () => {
		await expect(writeArchiveBundle(createExportPlan(fixture()), async () => { throw new Error("Damaged source media"); })).rejects.toThrow("Damaged source media");
	});

	it("writes bounded independent parts with a complete catalogue and cross-part local references", async () => {
		const input = fixture();
		input.assets = Array.from({ length: 5 }, (_, index) => ({ ...input.assets[0]!, id: `asset-${index}`, path: `chat_media/${index}.jpg`, overlayPath: null, byteSize: 48 * 1024 }));
		input.events[0]!.assetIds = input.assets.map((asset) => asset.id);
		const parts: Array<{ blob: Blob; name: string }> = [];
		const result = await writeArchiveBundle(createExportPlan(input), async () => new Uint8Array(48 * 1024).buffer, {
			maxVolumeBytes: 96 * 1024, onVolume: async (blob, name) => { parts.push({ blob, name }); },
		});
		expect(parts.length).toBeGreaterThan(1);
		expect(result.manifest.volumes.map((volume) => volume.filename)).toEqual(parts.map((part) => part.name));
		const allPayloads = new Map<string, Uint8Array>();
		for (const part of [...parts, { blob: result.blob, name: "catalogue.zip" }]) {
			const reader = new ZipReader(new BlobReader(part.blob), { useWebWorkers: false });
			try { for (const entry of await reader.getEntries()) if (!entry.directory) allPayloads.set(entry.filename, await entry.getData(new Uint8ArrayWriter())); }
			finally { await reader.close(); }
		}
		for (const volume of result.manifest.volumes) {
			const part = parts.find((value) => value.name === volume.filename)!;
			expect(part.blob.size).toBe(volume.byteSize);
			expect(Buffer.from(await crypto.subtle.digest("SHA-256", await part.blob.arrayBuffer())).toString("hex")).toBe(volume.sha256);
			expect(volume.payloadPaths.every((path) => allPayloads.has(path))).toBe(true);
		}
		expect(allPayloads.has("index.html")).toBe(true);
		expect(allPayloads.has("manifest.json")).toBe(true);
		expect(new TextDecoder().decode(allPayloads.get("READ-ME.txt"))).toContain("SAME folder");
		for (const asset of result.manifest.assets) expect(allPayloads.get(asset.file!)!.length).toBe(48 * 1024);
	});

	it("reports partial output and never returns a catalogue after an interrupted volume sink", async () => {
		const input = fixture();
		input.assets = Array.from({ length: 4 }, (_, index) => ({ ...input.assets[0]!, id: `asset-${index}`, path: `chat_media/${index}.jpg`, overlayPath: null, byteSize: 48 * 1024 }));
		let accepted = 0;
		await expect(writeArchiveBundle(createExportPlan(input), async () => new Uint8Array(48 * 1024).buffer, {
			maxVolumeBytes: 96 * 1024, onVolume: async () => { if (++accepted === 2) throw new Error("Disk refused this write"); },
		})).rejects.toThrow("Partial output: 1 ZIP parts");
		expect(accepted).toBe(2);
	});

	it("preserves source layers and reports a failed composition without claiming a derivative", async () => {
		const input = fixture(); input.composeImages = true;
		const result = await writeArchiveBundle(createExportPlan(input), async (path) => Uint8Array.from(path.endsWith("overlay.png") ? layer : original).buffer, { composeImage: async () => { throw new Error("The recorded transform is unsupported."); } });
		expect(result.manifest.assets[0]!.file).not.toBeNull();
		expect(result.manifest.assets[0]!.overlay).not.toBeNull();
		expect(result.manifest.assets[0]!.composed).toBeNull();
		expect(result.manifest.omissions.join(" ")).toContain("No flattened image");
	});
	it("preserves an oversized composition source without copying it into a derivative renderer", async () => {
		const input = fixture(); input.composeImages = true;
		input.assets[0]!.byteSize = 16 * 1024 * 1024 + 1;
		let rendererCalls = 0;
		const result = await writeArchiveBundle(createExportPlan(input), async (path) => path.endsWith("overlay.png") ? Uint8Array.from(layer).buffer : new Uint8Array(input.assets[0]!.byteSize).buffer,
			{ composeImage: async () => { rendererCalls++; throw new Error("Decoder must not run"); } });
		expect(rendererCalls).toBe(0);
		expect(result.manifest.assets[0]!.file).not.toBeNull();
		expect(result.manifest.assets[0]!.composed).toBeNull();
		expect(result.manifest.omissions.join(" ")).toMatch(/source byte budget/i);
	});

	it("produces distinct safe filenames for hostile and Unicode identifiers", () => {
		const identifiers = ["../file", "..\\file", "/absolute", "CON", "file", "Filé", "🐈", "", "empty"];
		const paths = identifiers.map(safeBundleStem);
		expect(new Set(paths).size).toBe(identifiers.length);
		expect(paths.every((path) => /^[a-z0-9]+$/.test(path))).toBe(true);
	});
});
