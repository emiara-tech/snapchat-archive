import { defineStore } from "pinia";
import { ref } from "vue";
export const useRevealStore = defineStore("reveal", () => {
	const fingerprint = ref("");
	const hidden = ref<string[]>([]);
	const showOwnWords = ref(false);
	function forDataset(value: string) {
		if (value !== fingerprint.value) {
			fingerprint.value = value;
			hidden.value = [];
			showOwnWords.value = false;
		}
	}
	function hide(id: string) {
		if (!hidden.value.includes(id)) hidden.value.push(id);
	}
	return { hidden, showOwnWords, forDataset, hide };
});
