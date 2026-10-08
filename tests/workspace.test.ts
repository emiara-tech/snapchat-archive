import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useWorkspaceStore } from "../src/stores/workspace";
import { useArchiveStore } from "../src/stores/archive";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { makeSyntheticArchive } from "./fixtures/archive";

async function loadSyntheticWorkspace(workspace: ReturnType<typeof useWorkspaceStore>): Promise<void> {
	const archive = useArchiveStore();
	await archive.prepareArchive([new File([await makeSyntheticArchive()], "synthetic-test-input.zip")]);
	await workspace.loadFromArchive();
}

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

describe("shared local workspace", () => {
	it("removes excluded physical layers from base previews and keeps resolved layers within their base selection", async () => {
		const writer = new ZipWriter(new BlobWriter("application/zip"));
		for (const [path, text] of Object.entries({
			"json/account.json": JSON.stringify({ "Basic Information": { Username: "synthetic-owner" } }),
			"memories/photo-main.jpg": "synthetic original bytes",
			"memories/photo-overlay.png": "synthetic private layer bytes",
		})) await writer.add(path, new TextReader(text));
		const archive = useArchiveStore();
		await archive.prepareArchive([new File([await writer.close()], "synthetic-layers.zip")]);
		const workspace = useWorkspaceStore();
		await workspace.loadFromArchive();
		const original = workspace.dataset!.assets.find((asset) => asset.role === "original")!;
		const layer = workspace.dataset!.assets.find((asset) => asset.role === "overlay")!;
		const originalEntry = original.overlayEntryId;
		expect(originalEntry).not.toBeNull();
		expect(layer.overlayState).toBe("resolved");
		const read = vi.spyOn(archive.archiveSession!.reader, "readMediaEntry");
		workspace.decide(layer.id, "exclude");
		const effective = workspace.selectedAssets.find((asset) => asset.id === original.id)!;
		expect(effective.overlayEntryId).toBeNull();
		expect(effective.overlayPath).toBeNull();
		await expect(workspace.resolveOverlayUrl(original.id)).resolves.toBeNull();
		expect(read).not.toHaveBeenCalled();
		workspace.undo();
		expect(workspace.selectedAssets.find((asset) => asset.id === original.id)?.overlayEntryId).toEqual(originalEntry);
		workspace.decide(original.id, "exclude");
		expect(workspace.selectedAssets.map((asset) => asset.id)).not.toContain(layer.id);
		workspace.undo();
		expect(workspace.selectedAssets.map((asset) => asset.id)).toContain(layer.id);
		archive.resetArchive();
	});

	async function ambiguousFixture() {
		const workspace = useWorkspaceStore(); await loadSyntheticWorkspace(workspace);
		const data = workspace.dataset!;
		const original = data.links[0]!;
		const asset = data.assets.find((item) => item.id === original.assetId)!;
		const alternate = { ...asset, id: `${asset.id}-alternate` };
		data.assets.push(alternate);
		const candidates = [asset.id, alternate.id];
		const first = { ...original, status: "ambiguous" as const, referenceId: "one-explicit-reference", candidateAssetIds: candidates };
		const second = { ...first, id: `${first.id}-alternate`, assetId: alternate.id };
		data.links.splice(0, data.links.length, first, second);
		return { workspace, first, second, alternate };
	}

	it("replaces a mutually exclusive attachment choice atomically and undo restores it", async () => {
		const { workspace, first, second } = await ambiguousFixture();
		workspace.decideAssociation(first.id, "confirm");
		workspace.decideAssociation(second.id, "confirm");
		expect(workspace.effectiveLinks.filter((link) => link.status === "confirmed").map((link) => link.id)).toEqual([second.id]);
		expect(workspace.dataset!.events.find((event) => event.id === first.eventId)?.assetIds).toEqual([second.assetId]);
		workspace.undo();
		expect(workspace.effectiveLinks.filter((link) => link.status === "confirmed").map((link) => link.id)).toEqual([first.id]);
	});

	it("rejects contradictory and missing-file restored confirmations without mutating current decisions", async () => {
		const { workspace, first, second, alternate } = await ambiguousFixture();
		workspace.decideAssociation(first.id, "confirm");
		const state = JSON.parse(workspace.exportReviewState());
		state.associations[second.id] = { linkId: second.id, action: "confirm", updatedAt: "2026-01-01" };
		expect(() => workspace.restoreReviewState(JSON.stringify(state))).toThrow(/same reference|contradictory/i);
		expect(workspace.associationDecisions[first.id]?.action).toBe("confirm");
		alternate.available = false;
		state.associations = { [second.id]: { linkId: second.id, action: "confirm", updatedAt: "2026-01-01" } };
		expect(() => workspace.restoreReviewState(JSON.stringify(state))).toThrow(/missing file/i);
		expect(() => workspace.decideAssociation(second.id, "confirm")).toThrow(/missing file/i);
		expect(workspace.associationDecisions[first.id]?.action).toBe("confirm");
	});

	it("keeps decisions session-only without reading or writing browser storage", async () => {
		const getItem = vi.fn(); const setItem = vi.fn();
		vi.stubGlobal("localStorage", { getItem, setItem, removeItem: vi.fn() });
		const workspace = useWorkspaceStore(); await loadSyntheticWorkspace(workspace);
		workspace.decide(workspace.dataset!.events[0]!.id, "exclude");
		workspace.setQuery({ year: 2013 });
		expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled();
		expect(workspace.exportReviewState()).toContain('"exclude"');
	});
	it("keeps batch exclusion reversible and excludes it from selected evidence even in review mode", async () => {
		const workspace = useWorkspaceStore();
		await loadSyntheticWorkspace(workspace);
		const ids = workspace.dataset!.events.slice(0, 2).map((event) => event.id);
		workspace.batchDecide(ids, "exclude");
		expect(workspace.selectedEvents.some((event) => ids.includes(event.id))).toBe(false);
		workspace.setQuery({ review: "all" });
		expect(workspace.filteredEvents.some((event) => ids.includes(event.id))).toBe(true);
		expect(workspace.selectedEvents.some((event) => ids.includes(event.id))).toBe(false);
		workspace.undo();
		expect(ids.every((id) => !workspace.decisions[id])).toBe(true);
		workspace.redo();
		expect(ids.every((id) => workspace.decisions[id]?.status === "exclude")).toBe(true);
	});

	it("restores a valid review file and rejects a different fingerprint without changing state", async () => {
		const workspace = useWorkspaceStore();
		await loadSyntheticWorkspace(workspace);
		const id = workspace.dataset!.events[0]!.id;
		workspace.decide(id, "keep"); workspace.setQuery({ year: 2013 });
		const saved = workspace.exportReviewState();
		workspace.decide(id, "exclude"); workspace.resetQuery();
		workspace.restoreReviewState(saved);
		expect(workspace.decisions[id]?.status).toBe("keep");
		expect(workspace.query.year).toBe(2013);
		const mismatch = JSON.parse(saved); mismatch.fingerprint = "different-archive";
		expect(() => workspace.restoreReviewState(JSON.stringify(mismatch))).toThrow("different archive");
		expect(workspace.decisions[id]?.status).toBe("keep");
	});

	it("rejects unknown decision targets and leaves original records unchanged", async () => {
		const workspace = useWorkspaceStore();
		await loadSyntheticWorkspace(workspace);
		const raw = JSON.stringify(workspace.dataset!.events.map((event) => event.raw));
		const id = workspace.dataset!.events[0]!.id;
		workspace.decide(id, "exclude");
		expect(JSON.stringify(workspace.dataset!.events.map((event) => event.raw))).toBe(raw);
		const invalid = JSON.parse(workspace.exportReviewState()); invalid.decisions.unknown = { status: "keep", updatedAt: "2026-01-01" };
		expect(() => workspace.restoreReviewState(JSON.stringify(invalid))).toThrow("invalid decision target");
		expect(Object.keys(workspace.decisions)).toEqual([id]);
	});

	it("rejecting a link removes its attachment and undo restores both directions", async () => {
		const workspace = useWorkspaceStore();
		await loadSyntheticWorkspace(workspace);
		const link = workspace.effectiveLinks[0]!;
		workspace.decideAssociation(link.id, "reject");
		expect(workspace.dataset!.events.find((event) => event.id === link.eventId)!.assetIds).not.toContain(link.assetId);
		expect(workspace.effectiveLinks.find((item) => item.id === link.id)?.status).toBe("unlinked");
		workspace.undo();
		expect(workspace.dataset!.events.find((event) => event.id === link.eventId)!.assetIds).toContain(link.assetId);
	});
});
