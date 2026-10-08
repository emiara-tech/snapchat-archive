import { staticImageDimensions, MAX_COMPOSITION_PIXELS } from "./imageComposition";

export const THUMBNAIL_EDGE = 384;
export const MAX_THUMBNAIL_SOURCE_BYTES = 32 * 1024 * 1024;
export const MAX_THUMBNAIL_DECODERS = 3;

interface ThumbnailTask {
	signal: AbortSignal;
	run: () => Promise<string>;
	resolve: (url: string) => void;
	reject: (error: unknown) => void;
	abort: () => void;
}
const pending: ThumbnailTask[] = [];
let active = 0;
function cancelled() { return new DOMException("Thumbnail generation was canceled.", "AbortError"); }
function drain() {
	while (active < MAX_THUMBNAIL_DECODERS && pending.length) {
		const task = pending.shift()!;
		task.signal.removeEventListener("abort", task.abort);
		if (task.signal.aborted) { task.reject(cancelled()); continue; }
		active++;
		void task.run().then(task.resolve, task.reject).finally(() => { active--; drain(); });
	}
}

/** One decoder budget spans room changes, including native decodes still finishing after abort. */
export function localThumbnail(url: string, signal: AbortSignal): Promise<string> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) { reject(cancelled()); return; }
		const task: ThumbnailTask = { signal, run: () => decodeThumbnail(url, signal), resolve, reject, abort: () => {
			const index = pending.indexOf(task);
			if (index >= 0) pending.splice(index, 1);
			signal.removeEventListener("abort", task.abort);
			reject(cancelled());
		} };
		signal.addEventListener("abort", task.abort, { once: true });
		pending.push(task); drain();
	});
}

async function decodeThumbnail(url: string, signal: AbortSignal): Promise<string> {
	if (!url.startsWith("blob:")) throw new Error("A thumbnail must come from a local archive file.");
	const source = await (await fetch(url, { signal })).blob();
	if (source.size > MAX_THUMBNAIL_SOURCE_BYTES) throw new Error("This source exceeds the thumbnail byte budget.");
	const dimensions = staticImageDimensions(await source.arrayBuffer());
	if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width * dimensions.height > MAX_COMPOSITION_PIXELS
		|| dimensions.width > 8192 || dimensions.height > 8192) throw new Error("This source exceeds the supported thumbnail dimensions.");
	if (signal.aborted) throw cancelled();
	if (typeof createImageBitmap !== "function") throw new Error("Local thumbnail decoding is unavailable.");
	const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(dimensions.width, dimensions.height));
	const bitmap = await createImageBitmap(source, { resizeWidth: Math.max(1, Math.round(dimensions.width * scale)),
		resizeHeight: Math.max(1, Math.round(dimensions.height * scale)), resizeQuality: "high", imageOrientation: "from-image" });
	let canvas: HTMLCanvasElement | null = null;
	try {
		if (signal.aborted) throw cancelled();
		canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Local thumbnail rendering is unavailable.");
		context.drawImage(bitmap, 0, 0);
		const thumbnail = await new Promise<Blob>((resolve, reject) => canvas!.toBlob((result) => result ? resolve(result) : reject(new Error("Local thumbnail encoding failed.")), "image/png"));
		if (signal.aborted) throw cancelled();
		return URL.createObjectURL(thumbnail);
	} finally { bitmap.close(); if (canvas) { canvas.width = 0; canvas.height = 0; } }
}
