import { afterEach, expect, it, vi } from "vitest";
import { localThumbnail, MAX_THUMBNAIL_SOURCE_BYTES } from "../src/lib/localThumbnail";

afterEach(() => vi.unstubAllGlobals());

it("keeps overlapping thumbnail generations inside one three-decoder budget", async () => {
	const bytes = new Uint8Array(33); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
	const header = new DataView(bytes.buffer); header.setUint32(8, 13); bytes.set([73, 72, 68, 82], 12); header.setUint32(16, 1); header.setUint32(20, 1);
	vi.stubGlobal("fetch", async () => new Response(new Blob([bytes])));
	let active = 0, peak = 0;
	const complete: Array<() => void> = [];
	vi.stubGlobal("createImageBitmap", () => new Promise((resolve) => {
		active++; peak = Math.max(peak, active);
		complete.push(() => { active--; resolve({ width: 1, height: 1, close() {} }); });
	}));
	vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (accept: (blob: Blob) => void) => accept(new Blob([bytes])) }) });
	const controller = new AbortController();
	const requests = Array.from({ length: 6 }, () => localThumbnail("blob:synthetic-source", controller.signal));
	try {
		await vi.waitFor(() => expect(active).toBeGreaterThanOrEqual(3));
		expect(peak).toBe(3);
	} finally {
		controller.abort(); complete.forEach((resolve) => resolve());
		await Promise.allSettled(requests);
	}
});

it("refuses unknown and oversized sources before native decode and reports the applicable budget", async () => {
	const decode = vi.fn(); vi.stubGlobal("createImageBitmap", decode);
	vi.stubGlobal("fetch", async () => ({ blob: async () => new Blob(["unknown image encoding"]) }));
	await expect(localThumbnail("blob:unknown-source", new AbortController().signal)).rejects.toThrow("supported thumbnail dimensions");
	const oversized = new Blob([new Uint8Array(MAX_THUMBNAIL_SOURCE_BYTES + 1)]);
	const read = vi.spyOn(oversized, "arrayBuffer");
	vi.stubGlobal("fetch", async () => ({ blob: async () => oversized }));
	await expect(localThumbnail("blob:oversized-source", new AbortController().signal)).rejects.toThrow("thumbnail byte budget");
	expect(read).not.toHaveBeenCalled(); expect(decode).not.toHaveBeenCalled();
});
