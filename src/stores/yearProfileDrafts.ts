import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_PROFILE_STYLE, type ProfileStyleChoices } from "../lib/yearProfile";
import { useWorkspaceStore } from "./workspace";

export interface ProfileEdit {
	events: string[];
	conversations: string[];
	topics: { literal: string; eventIds: string[] }[];
}
export const emptyProfileEdit = (): ProfileEdit => ({ events: [], conversations: [], topics: [] });
interface YearDraft {
	edit: ProfileEdit;
	history: ProfileEdit[];
	styleChoices: ProfileStyleChoices;
	editorRevision: number;
	suspension: "canceled" | "discarded" | null;
	changeBefore: number | null;
}
function emptyDraft(): YearDraft {
	return { edit: emptyProfileEdit(), history: [], styleChoices: { ...DEFAULT_PROFILE_STYLE }, editorRevision: 0, suspension: null, changeBefore: null };
}
function copyEdit(edit: ProfileEdit): ProfileEdit {
	return { events: [...edit.events], conversations: [...edit.conversations], topics: edit.topics.map((item) => ({ literal: item.literal, eventIds: [...item.eventIds] })) };
}

/** Private navigation state only. Measurements and source text are rebuilt, never cached here. */
export const useYearProfileDraftStore = defineStore("year-profile-drafts", () => {
	const workspace = useWorkspaceStore();
	const drafts = ref<Record<number, YearDraft>>({});
	const archiveIdentity = computed(() => workspace.dataset ? `${workspace.dataset.fingerprint}:${workspace.dataset.normalizationVersion}` : null);
	watch(archiveIdentity, () => { drafts.value = {}; }, { flush: "sync" });
	function forYear(year: number): YearDraft { return drafts.value[year] ?? emptyDraft(); }
	function write(year: number, changes: Partial<YearDraft>) {
		drafts.value = { ...drafts.value, [year]: { ...forYear(year), ...changes } };
	}
	function edit(year: number, next: ProfileEdit, before: number | null) {
		const current = forYear(year);
		write(year, { edit: copyEdit(next), history: [...current.history.slice(-19), copyEdit(current.edit)],
			changeBefore: before ?? current.changeBefore, editorRevision: current.editorRevision + 1 });
	}
	function undo(year: number, before: number | null) {
		const current = forYear(year), history = [...current.history];
		const previous = history.pop();
		if (previous) write(year, { edit: previous, history, changeBefore: before, editorRevision: current.editorRevision + 1 });
	}
	function setStyle(year: number, choices: ProfileStyleChoices) { write(year, { styleChoices: { ...choices } }); }
	function cancel(year: number) { write(year, { suspension: "canceled" }); }
	function discard(year: number) { write(year, { ...emptyDraft(), editorRevision: forYear(year).editorRevision + 1, suspension: "discarded" }); }
	function regenerate(year: number) { write(year, { suspension: null, editorRevision: forYear(year).editorRevision + 1 }); }
	return { forYear, edit, undo, setStyle, cancel, discard, regenerate };
});
