import { describe, expect, it } from "vitest";
import { loadArchiveDataset, DEFAULT_QUERY } from "../src/lib/dataset";
import { prepareExportSnapshot } from "../src/lib/exportSnapshot";
import { makeSyntheticArchive } from "./fixtures/archive";
import { createArchiveSession } from "../src/lib/snapArchive";

describe("reviewed workspace export snapshot", () => {
	it("freezes exact selected evidence, timestamp and layer provenance with deliberate mixed-link states", async () => {
		const session = await createArchiveSession([new File([await makeSyntheticArchive()], "synthetic-test-input.zip")]);
		const dataset = await loadArchiveDataset(session);
		const source = { sourceId: "synthetic-originals", path: "memories/original-main.jpg", ordinal: 4 };
		const overlay = { sourceId: "synthetic-layers", path: "memories/original-overlay.png", ordinal: 7 };
		const confirmed = dataset.links.find((link) => link.status === "confirmed")!;
		const original = dataset.assets.find((asset) => asset.id === confirmed.assetId)!;
		original.entryId = source; original.overlayEntryId = overlay; original.overlayPath = overlay.path;
		original.byteSize = 6; original.raw.Date = "2013-07-12 17:16:00 UTC"; original.location = "59, 10";
		const layer = { ...original, id: "layer-evidence", role: "overlay" as const, entryId: overlay, overlayEntryId: null, overlayPath: null, byteSize: 3 };
		dataset.assets.push(layer);
		const context = dataset.events.find((event) => event.id === confirmed.eventId)!;
		const unrelated = dataset.events.find((event) => event.id !== context.id)!;
		unrelated.assetIds = [original.id];
		dataset.links.push({ ...confirmed, id: "candidate-only", eventId: unrelated.id, status: "ambiguous", basis: "Unresolved candidate" });
		const query = { ...DEFAULT_QUERY, text: "reviewed scope" };
		const plan = prepareExportSnapshot({ dataset, events: [context, unrelated], assets: [original, layer], query, revision: "reviewed-revision", mode: "curated", composeImages: false,
			physicalEntries: [{ id: overlay, compressedSize: 3, uncompressedSize: 3, isDirectory: false, signature: 1 }] });
		expect(plan.events.find((event) => event.id === context.id)?.assetIds).toEqual([original.id]);
		expect(plan.events.find((event) => event.id === unrelated.id)?.assetIds).toEqual([]);
		expect(plan.events[0]?.sources).toEqual(context.sources);
		expect(plan.assets[0]).toMatchObject({ sourceId: "synthetic-originals", sourceOrdinal: 4, overlaySourceId: "synthetic-layers", overlayOrdinal: 7, overlayByteSize: 3,
			overlayAssetId: "layer-evidence", linkState: "mixed", linkStates: ["ambiguous", "confirmed"], originalTime: "2013-07-12 17:16:00 UTC", timePrecision: "second", timestampZone: "UTC", location: "59, 10" });
		expect(plan.assets[0]?.links?.map((link) => link.id).sort()).toEqual(["candidate-only", confirmed.id].sort());
		query.text = "later query"; original.raw.Date = "changed later";
		expect(plan.query).toMatchObject({ text: "reviewed scope" });
		expect(plan.assets[0]?.originalTime).toBe("2013-07-12 17:16:00 UTC");
		session.reader.dispose();
	});
});
