import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBundlePart } from "../src/lib/exportBundle";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("bounded browser bundle download sink", () => {
	it("cancels a pending sink without retaining the source URL or completing the next part", async () => {
		vi.useFakeTimers();
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cancelled-part");
		const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const click = vi.fn();
		vi.stubGlobal("document", { createElement: () => ({ href: "", download: "", click }) });
		const controller = new AbortController();
		const pending = downloadBundlePart(new Blob(["synthetic part"]), "part.zip", controller.signal);
		controller.abort();
		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(revoke).toHaveBeenCalledWith("blob:cancelled-part");
		expect(vi.getTimerCount()).toBe(0);
		await expect(downloadBundlePart(new Blob(), "never-started.zip", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
		expect(click).toHaveBeenCalledTimes(1);
	});
	it("reports a refused download and releases its source instead of acknowledging a successful part", async () => {
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:refused-part");
		const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		vi.stubGlobal("document", { createElement: () => ({ href: "", download: "", click: () => { throw new Error("Download refused"); } }) });
		await expect(downloadBundlePart(new Blob(["synthetic part"]), "part.zip")).rejects.toThrow("Download refused");
		expect(revoke).toHaveBeenCalledWith("blob:refused-part");
	});
	it("releases the current source URL before allowing the next split part", async () => {
		vi.useFakeTimers();
		const active = new Set<string>();
		let issued = 0;
		vi.spyOn(URL, "createObjectURL").mockImplementation(() => { const url = `blob:part-${++issued}`; active.add(url); return url; });
		vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => { active.delete(url); });
		const click = vi.fn();
		vi.stubGlobal("document", { createElement: () => ({ href: "", download: "", click }) });
		const source = new Blob(["synthetic ZIP part"]);
		const finished = (async () => { await downloadBundlePart(source, "part-1.zip"); expect(active.size).toBe(0); await downloadBundlePart(source, "part-2.zip"); })();
		expect(active.size).toBe(1); expect(click).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(9_999);
		expect(active.size).toBe(1); expect(click).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(active.size).toBe(1); expect(click).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(10_000); await finished;
		expect(active.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
	});
});
