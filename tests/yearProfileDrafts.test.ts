import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useArchiveStore } from "../src/stores/archive";
import { useWorkspaceStore } from "../src/stores/workspace";
import { emptyProfileEdit, useYearProfileDraftStore } from "../src/stores/yearProfileDrafts";
import { buildYearProfile } from "../src/lib/yearProfile";
import { makeSyntheticArchive } from "./fixtures/archive";

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());
async function load() {
	await useArchiveStore().prepareArchive([new File([await makeSyntheticArchive()], "synthetic-profile.zip")]);
	await useWorkspaceStore().loadFromArchive();
}

describe("private session-only year profile drafts", () => {
	it("keeps year choices separate and rebuilds from shared exclusions rather than cached evidence", async () => {
		const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
		vi.stubGlobal("localStorage", storage);
		const drafts = useYearProfileDraftStore(); await load();
		const workspace = useWorkspaceStore();
		const owners = workspace.dataset!.events.filter((event) => event.ownerAuthored && event.year === 2013);
		drafts.edit(2013, { ...emptyProfileEdit(), events: [owners[0]!.id] }, 2);
		drafts.setStyle(2013, { punctuation: "restrained", emoji: "less", intensity: 0.2 });
		expect(drafts.forYear(2016).edit.events).toEqual([]);
		expect(drafts.forYear(2016).styleChoices.punctuation).toBe("measured");
		const profile = () => buildYearProfile(workspace.dataset!, workspace.selectedEvents, 2013, "UTC", {
			excludedEventIds: drafts.forYear(2013).edit.events, styleChoices: drafts.forYear(2013).styleChoices,
		});
		expect(profile().messageCount).toBe(1);
		workspace.decide(owners[1]!.id, "exclude");
		expect(profile().messageCount).toBe(0);
		expect(profile().evidenceIds).not.toContain(owners[1]!.id);
		workspace.undo();
		expect(profile().messageCount).toBe(1);
		drafts.undo(2013, 1);
		expect(profile().messageCount).toBe(2);
		expect(drafts.forYear(2013).styleChoices.punctuation).toBe("restrained");
		expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
		useArchiveStore().resetArchive();
	});

	it("clears discarded state and editor choices on reset and archive replacement, including the same source bytes", async () => {
		const drafts = useYearProfileDraftStore(); await load();
		drafts.discard(2013);
		expect(drafts.forYear(2013).suspension).toBe("discarded");
		useWorkspaceStore().reset();
		expect(drafts.forYear(2013).suspension).toBeNull();
		await useWorkspaceStore().loadFromArchive();
		drafts.setStyle(2013, { punctuation: "expressive", emoji: "more", intensity: 1 });
		drafts.cancel(2013);
		await load();
		expect(drafts.forYear(2013).suspension).toBeNull();
		expect(drafts.forYear(2013).styleChoices.punctuation).toBe("measured");
		expect(drafts.forYear(2013).history).toEqual([]);
		useArchiveStore().resetArchive();
	});
});
