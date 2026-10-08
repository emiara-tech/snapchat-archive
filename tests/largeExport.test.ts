import { describe, expect, it } from "vitest";
import { createExportPlan, writeArchiveBundle, type BundleSelection } from "../src/lib/exportBundle";

describe("generated large export verification", () => {
	it.skipIf(process.env.GOODBYE_LARGE_EXPORT_CHECK !== "1")("writes over two GiB through a bounded part sink without retaining all output", async () => {
		const itemBytes = 16 * 1024 * 1024;
		const itemCount = 130;
		const source = new Uint8Array(itemBytes);
		// One immutable generated item can be read repeatedly. The writer must
		// preserve separate IDs without retaining all previously emitted parts.
		const input: BundleSelection = {
			datasetFingerprint: "synthetic-large-export", revision: "synthetic-large-export-v1", mode: "complete", timezone: "UTC", query: {}, events: [], coverage: ["Generated synthetic payloads for output memory verification."],
			assets: Array.from({ length: itemCount }, (_, index) => ({ id: `synthetic-${index}`, path: `chat_media/${index}.bin`, sourceId: "generated", mimeType: "application/octet-stream", byteSize: itemBytes, date: null, overlayPath: null, linkState: "unlinked" })),
		};
		const baseline = process.memoryUsage().rss;
		let peak = baseline;
		let emittedBytes = 0;
		let emittedParts = 0;
		const result = await writeArchiveBundle(createExportPlan(input), async () => source.buffer, {
			compressionLevel: 0,
			onVolume: async (blob) => { peak = Math.max(peak, process.memoryUsage().rss); emittedBytes += blob.size; emittedParts += 1; },
		});
		expect(emittedBytes).toBeGreaterThan(2 * 1024 * 1024 * 1024);
		expect(emittedParts).toBeGreaterThan(15);
		expect(result.manifest.assets).toHaveLength(itemCount);
		expect(result.manifest.volumes).toHaveLength(emittedParts);
		expect(peak - baseline).toBeLessThan(1024 * 1024 * 1024);
		console.info(JSON.stringify({ generatedPayloadBytes: itemBytes * itemCount, emittedBytes, emittedParts, peakRssIncreaseBytes: peak - baseline }));
	}, 180_000);
});
