export const IMAGE_COMPOSITION_VERSION = 1;
export const MAX_COMPOSITION_PIXELS = 12 * 1024 * 1024;
export const MAX_COMPOSITION_SOURCE_BYTES = 16 * 1024 * 1024;

export interface ImageCompositionRecipe {
	version: 1;
	renderer: "browser-canvas-2d-v1";
	basis: "same-canvas-archive-layer" | "recorded-transform";
	orientation: "decoded-source-orientation";
	canvas: { width: number; height: number };
	layer: { width: number; height: number };
	transform: { x: number; y: number; width: number; height: number; rotation: number; opacity: number };
}

export interface ComposedImage {
	blob: Blob;
	recipe: ImageCompositionRecipe;
	originalSha256: string;
	overlaySha256: string;
	metadataPolicy: string;
}

export function validateCompositionRecipe(recipe: ImageCompositionRecipe, maxPixels = MAX_COMPOSITION_PIXELS): void {
	if (recipe.version !== IMAGE_COMPOSITION_VERSION || recipe.renderer !== "browser-canvas-2d-v1"
		|| !["same-canvas-archive-layer", "recorded-transform"].includes(recipe.basis)
		|| recipe.orientation !== "decoded-source-orientation") throw new Error("This overlay recipe is unsupported.");
	const values = [...Object.values(recipe.canvas), ...Object.values(recipe.layer), ...Object.values(recipe.transform)];
	if (values.some((value) => !Number.isFinite(value))) throw new Error("The recorded overlay transform is invalid.");
	for (const size of [recipe.canvas, recipe.layer]) {
		if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width <= 0 || size.height <= 0
			|| size.width > 8192 || size.height > 8192 || size.width * size.height > maxPixels) throw new Error("This image exceeds the bounded composition dimensions.");
	}
	const transform = recipe.transform;
	if (transform.width <= 0 || transform.height <= 0 || transform.width * transform.height > maxPixels
		|| transform.opacity < 0 || transform.opacity > 1 || Math.abs(transform.rotation) > 360
		|| Math.abs(transform.x) > 8192 || Math.abs(transform.y) > 8192) throw new Error("The recorded overlay transform exceeds its supported bounds.");
	if (recipe.basis === "same-canvas-archive-layer" && (recipe.canvas.width !== recipe.layer.width || recipe.canvas.height !== recipe.layer.height
		|| transform.x !== 0 || transform.y !== 0 || transform.width !== recipe.canvas.width || transform.height !== recipe.canvas.height
		|| transform.rotation !== 0 || transform.opacity !== 1)) throw new Error("The overlay does not establish an unchanged same-canvas layer.");
}

export async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function unsupportedRecordedOverlay(raw: Record<string, unknown>): boolean {
	const pending: { value: unknown; layer: boolean }[] = [{ value: raw, layer: false }];
	const seen = new Set<object>();
	while (pending.length) {
		const item = pending.pop()!;
		if (typeof item.value !== "object" || item.value === null || seen.has(item.value)) continue;
		seen.add(item.value);
		for (const [key, value] of Object.entries(item.value)) {
			if (value === null || value === undefined) continue;
			const layer = item.layer || /overlay|layer/i.test(key);
			if (layer && /transform|position|rotation|scale|timing|animation|placement|offset|opacity|matrix/i.test(key)) return true;
			pending.push({ value, layer });
		}
	}
	return false;
}

export async function inspectImageSource(source: Blob, options: { signal?: AbortSignal; maxPixels?: number } = {}): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
	const check = () => { if (options.signal?.aborted) throw new DOMException("Image inspection was canceled.", "AbortError"); };
	check();
	if (source.size > MAX_COMPOSITION_SOURCE_BYTES) throw new Error("This image exceeds the supported source byte budget. Download its unchanged original instead.");
	const bytes = await source.arrayBuffer();
	check();
	const size = staticImageDimensions(bytes);
	if (!size || size.width <= 0 || size.height <= 0 || size.width > 8192 || size.height > 8192 || size.width * size.height > (options.maxPixels ?? MAX_COMPOSITION_PIXELS)) throw new Error("This source has unsupported or oversized image dimensions. Download its unchanged original instead.");
	return { bytes, ...size };
}

export async function composeImageLayers(original: Blob, overlay: Blob, options: { recipe?: ImageCompositionRecipe; signal?: AbortSignal; maxPixels?: number } = {}): Promise<ComposedImage> {
	const check = () => { if (options.signal?.aborted) throw new DOMException("Image composition was canceled.", "AbortError"); };
	check();
	if (original.size > MAX_COMPOSITION_SOURCE_BYTES || overlay.size > MAX_COMPOSITION_SOURCE_BYTES) throw new Error("This image exceeds the supported source byte budget. Its original layers remain available.");
	if (typeof createImageBitmap !== "function") throw new Error("This browser cannot compose image layers. Original and overlay files remain available.");
	const originalBytes = (await inspectImageSource(original, options)).bytes;
	const overlayBytes = (await inspectImageSource(overlay, options)).bytes;
	let base: ImageBitmap | null = null;
	let layer: ImageBitmap | null = null;
	let canvas: HTMLCanvasElement | null = null;
	try {
		base = await createImageBitmap(original, { imageOrientation: "from-image" }); check();
		layer = await createImageBitmap(overlay, { imageOrientation: "from-image" }); check();
		const recipe: ImageCompositionRecipe = options.recipe ?? {
			version: 1, renderer: "browser-canvas-2d-v1", basis: "same-canvas-archive-layer", orientation: "decoded-source-orientation",
			canvas: { width: base.width, height: base.height }, layer: { width: layer.width, height: layer.height },
			transform: { x: 0, y: 0, width: base.width, height: base.height, rotation: 0, opacity: 1 },
		};
		validateCompositionRecipe(recipe, options.maxPixels);
		if (recipe.canvas.width !== base.width || recipe.canvas.height !== base.height || recipe.layer.width !== layer.width || recipe.layer.height !== layer.height) throw new Error("The recorded composition dimensions do not match the original and overlay.");
		canvas = document.createElement("canvas"); canvas.width = base.width; canvas.height = base.height;
		const context = canvas.getContext("2d", { colorSpace: "srgb" });
		if (!context) throw new Error("The browser could not allocate a bounded composition canvas.");
		context.drawImage(base, 0, 0);
		context.save();
		context.globalAlpha = recipe.transform.opacity;
		context.translate(recipe.transform.x, recipe.transform.y);
		context.rotate(recipe.transform.rotation * Math.PI / 180);
		context.drawImage(layer, 0, 0, recipe.transform.width, recipe.transform.height);
		context.restore(); check();
		const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob((result) => result ? resolve(result) : reject(new Error("The flattened PNG could not be encoded.")), "image/png"));
		check();
		const [originalSha256, overlaySha256] = await Promise.all([sha256Bytes(originalBytes), sha256Bytes(overlayBytes)]);
		check();
		return { blob, recipe, originalSha256, overlaySha256, metadataPolicy: "Flattened PNG derivative. Browser-decoded orientation and sRGB rendering. Original EXIF/GPS metadata is not copied; preserved originals retain it." };
	} finally {
		base?.close(); layer?.close();
		if (canvas) { canvas.width = 0; canvas.height = 0; }
	}
}

/** Read dimensions before allocating decoder output. Animated sources are unsupported. */
export function staticImageDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);
	if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
		for (let offset = 8; offset + 12 <= bytes.length;) {
			const length = view.getUint32(offset);
			if (offset + length + 12 > bytes.length) return null;
			const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
			if (kind === "acTL") return null;
			offset += length + 12;
		}
		return { width: view.getUint32(16), height: view.getUint32(20) };
	}
	if (bytes[0] === 255 && bytes[1] === 216) {
		for (let offset = 2; offset + 4 <= bytes.length;) {
			if (bytes[offset] !== 255) return null;
			const marker = bytes[offset + 1]!;
			if (marker === 217 || marker === 218) break;
			if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) { offset += 2; continue; }
			const length = view.getUint16(offset + 2);
			if (length < 2 || offset + length + 2 > bytes.length) return null;
			if ([192, 193, 194].includes(marker) && length >= 7) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
			offset += length + 2;
		}
	}
	return null;
}
