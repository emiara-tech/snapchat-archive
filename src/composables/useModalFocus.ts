import { nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from "vue";

/** Keyboard containment and focus restoration for a conditionally rendered dialog. */
export function useModalFocus(isOpen: () => boolean, close: () => void) {
	const dialog = ref<HTMLElement | null>(null);
	let trigger: HTMLElement | null = null;
	let active = false;
	const focusable = () => [...(dialog.value?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])]
		.filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
	const keydown = (event: KeyboardEvent) => {
		if (!active) return;
		if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
		if (event.key !== "Tab") return;
		const controls = focusable();
		const first = controls[0]; const last = controls[controls.length - 1];
		if (!first || !last) { event.preventDefault(); dialog.value?.focus(); return; }
		const focused = document.activeElement;
		if (!dialog.value?.contains(focused)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
		else if (event.shiftKey && focused === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && focused === last) { event.preventDefault(); first.focus(); }
	};
	const stop = watch(isOpen, async (open) => {
		if (open) {
			trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			active = true;
			document.addEventListener("keydown", keydown, true);
			await nextTick();
			if (active) (focusable()[0] ?? dialog.value)?.focus();
		} else {
			active = false;
			document.removeEventListener("keydown", keydown, true);
			await nextTick();
			if (trigger?.isConnected) trigger.focus();
			trigger = null;
		}
	}, { flush: "sync" });
	onBeforeUnmount(() => { active = false; stop(); document.removeEventListener("keydown", keydown, true); });
	return (element: Element | ComponentPublicInstance | null) => {
		dialog.value = element instanceof HTMLElement ? element : null;
		if (dialog.value && active) void nextTick(() => { if (active) (focusable()[0] ?? dialog.value)?.focus(); });
	};
}
