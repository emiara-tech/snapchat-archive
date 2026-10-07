import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import { composeImageLayers, MAX_COMPOSITION_SOURCE_BYTES, sha256Bytes, type ComposedImage, type ImageCompositionRecipe } from "./imageComposition";
import type { MediaLink, SourceReference } from "../types/dataset";

export const MAX_LOCAL_BUNDLE_BYTES = 256 * 1024 * 1024;
export const MAX_LOCAL_ASSET_BYTES = 64 * 1024 * 1024;

export interface BundleEvent {
	id: string;
	conversationId: string;
	conversationTitle: string;
	sender: string;
	authorship: string;
	date: string | null;
	originalTime?: unknown;
	timePrecision?: string;
	kind: string;
	text: string | null;
	assetIds: string[];
	sourceId: string;
	source?: SourceReference;
	sources?: SourceReference[];
}

export interface BundleAsset {
	id: string;
	path: string | null;
	sourceId: string | null;
	sourceOrdinal?: number;
	mimeType: string;
	byteSize: number;
	date: string | null;
	overlayPath: string | null;
	overlaySourceId?: string | null;
	overlayOrdinal?: number;
	linkState: string;
	overlayByteSize?: number;
	originalTime?: unknown;
	timePrecision?: string;
	timestampZone?: string | null;
	location?: string | null;
	overlayAssetId?: string | null;
	compositionRecipe?: ImageCompositionRecipe;
	compositionBlockedReason?: string;
	linkStates?: string[];
	links?: MediaLink[];
	sources?: SourceReference[];
}

export interface BundleSelection {
	datasetFingerprint: string;
	revision: string;
	timezone: string;
	mode: "curated" | "complete";
	query: unknown;
	events: BundleEvent[];
	assets: BundleAsset[];
	coverage: string[];
	composeImages?: boolean;
}

export interface ExportPlan extends BundleSelection {
	schemaVersion: 1;
	estimatedBytes: number;
	missingAssets: number;
	omissions: string[];
}

export interface BundlePayload {
	path: string;
	mimeType: string;
	byteSize: number;
	sha256: string;
}

export interface BundleManifest {
	schemaVersion: 1;
	bundleId: string;
	product: "Goodbye Chat";
	createdAt: string;
	datasetFingerprint: string;
	revision: string;
	mode: "curated" | "complete";
	timezone: string;
	query: unknown;
	metadataPolicy: string;
	payloads: BundlePayload[];
	assets: Array<{ id: string; file: string | null; overlay: string | null; composed: string | null; date: string | null; linkState: string;
		linkStates?: string[]; links?: MediaLink[]; sources?: SourceReference[];
		originalTime?: unknown; timePrecision?: string; timestampZone?: string | null; location?: string | null; overlayAssetId?: string | null;
		originalSource: { sourceId: string | null; path: string | null; ordinal?: number }; overlaySource: { sourceId: string | null; path: string; ordinal?: number } | null;
		composition?: { recipe: ImageCompositionRecipe; originalSha256: string; overlaySha256: string; metadataPolicy: string } }>;
	coverage: string[];
	omissions: string[];
	volumes: BundleVolume[];
}

export interface BundleVolume { filename: string; byteSize: number; sha256: string; payloadPaths: string[] }
export interface BundleWriteOptions {
	signal?: AbortSignal;
	onProgress?: (completed: number, total: number, label: string) => void;
	/** Accept each complete part before another part is built. Do not retain all blobs. */
	onVolume?: (blob: Blob, filename: string) => Promise<void>;
	maxVolumeBytes?: number;
	compressionLevel?: number;
	composeImage?: (original: Blob, overlay: Blob, options: { recipe?: ImageCompositionRecipe; signal?: AbortSignal }) => Promise<ComposedImage>;
}

export type ReadBundleAsset = (path: string, sourceId: string | null, ordinal?: number) => Promise<ArrayBuffer>;

export function createExportPlan(selection: BundleSelection): ExportPlan {
	// A reviewed plan owns its data. Reactive query changes cannot expand a write.
	const snapshot = JSON.parse(JSON.stringify(selection)) as BundleSelection;
	const estimatedBytes = snapshot.assets.reduce((sum, asset) => sum + Math.max(0, asset.byteSize) + Math.max(0, asset.overlayByteSize ?? 0), 0)
		+ new TextEncoder().encode(JSON.stringify(snapshot.events)).byteLength * 3 + 4096;
	const missingAssets = snapshot.assets.filter((asset) => !asset.path).length;
	const omissions = [
		...(missingAssets ? [`${missingAssets} media records have no available original file.`] : []),
		...(snapshot.assets.some((asset) => asset.overlayPath) ? [snapshot.composeImages ? "Supported static JPEG/PNG images get a separate flattened PNG. Mismatched dimensions or unsupported transforms are reported; originals and overlay sources remain preserved." : "Overlay sources are preserved separately. Flattened image variants were not requested."] : []),
		...(snapshot.assets.some((asset) => asset.overlayPath && asset.mimeType.startsWith("video/")) ? ["Composed video is unsupported. Original video, audio and separate overlay remain unchanged."] : []),
		...snapshot.assets.filter((asset) => snapshot.composeImages && asset.compositionBlockedReason).map((asset) => `No flattened image for ${asset.id}. ${asset.compositionBlockedReason}`),
		"Original media retains its embedded metadata, which may include GPS. Metadata removal is not applied.",
	];
	return { ...snapshot, schemaVersion: 1, estimatedBytes, missingAssets, omissions };
}

export function safeBundleStem(value: string): string {
	// Stable IDs become ASCII paths. The readable record retains its Unicode title.
	const bytes = new TextEncoder().encode(value);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || "empty";
}

function extensionFor(asset: BundleAsset, overlay = false): string {
	const path = overlay ? asset.overlayPath : asset.path;
	const extension = /\.([a-z0-9]{1,8})$/i.exec(path ?? "")?.[1]?.toLowerCase();
	return extension ?? "bin";
}

function escaped(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function mediaMarkup(asset: BundleAsset, file: string | null): string {
	if (!file) return '<p class="gap">Media is missing from the imported archive.</p>';
	const url = escaped(`../${file}`);
	if (asset.mimeType.startsWith("image/")) return `<a href="${url}"><img src="${url}" alt="Recorded media" loading="lazy"></a>`;
	if (asset.mimeType.startsWith("video/")) return `<video src="${url}" controls preload="metadata"></video>`;
	if (asset.mimeType.startsWith("audio/")) return `<audio src="${url}" controls preload="metadata"></audio>`;
	return `<a href="${url}">Open original attachment</a>`;
}

function conversationPage(title: string, events: BundleEvent[], assets: Map<string, BundleAsset>, files: Map<string, string>): string {
	const messages = events.map((event) => {
		const media = event.assetIds.map((id) => {
			const asset = assets.get(id);
			return asset ? mediaMarkup(asset, files.get(id) ?? null) : '<p class="gap">Attachment was not included in this selection.</p>';
		}).join("");
		return `<article id="${escaped(safeBundleStem(event.id))}" class="message ${event.authorship === "owner" ? "owner" : ""}"><header>${escaped(event.sender)} <time>${escaped(event.date ?? "Time not recorded")}</time></header><p>${escaped(event.text ?? `Recorded ${event.kind.toLowerCase()} event; text was not included.`)}</p>${media}<small>Record ${escaped(event.id)}</small></article>`;
	}).join("\n");
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escaped(title)} | Goodbye Chat</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f7f1e6;color:#241b13;max-width:900px;margin:40px auto;padding:24px}a{color:#1f6958}h1{font:48px Georgia,serif}.message{max-width:75%;padding:18px 22px;margin:18px 0;background:white;border-radius:20px}.owner{margin-left:auto;background:#f3cb45}header{font-weight:700}time,small{display:block;font-size:12px;opacity:.7}p{white-space:pre-wrap;overflow-wrap:anywhere}img,video{max-width:100%;max-height:480px}audio{max-width:100%}.gap{color:#875432}small{overflow-wrap:anywhere}</style></head><body><a href="../index.html">All conversations</a><h1>${escaped(title)}</h1><p>This is the selected recorded history, with gaps preserved.</p>${messages}</body></html>`;
}

function abortIfNeeded(signal?: AbortSignal) {
	if (signal?.aborted) throw new DOMException("Export cancelled. No completed bundle was downloaded.", "AbortError");
}

export async function writeArchiveBundle(
	plan: ExportPlan,
	readAsset: ReadBundleAsset,
	options: BundleWriteOptions = {},
): Promise<{ blob: Blob; manifest: BundleManifest }> {
	if (plan.estimatedBytes > MAX_LOCAL_BUNDLE_BYTES && !options.onVolume) throw new Error("This collection exceeds a single 256 MiB ZIP and needs split ZIP parts. Save to a folder or enable split downloads.");
	if (plan.assets.some((asset) => asset.byteSize > MAX_LOCAL_ASSET_BYTES)) throw new Error("This download cannot process an original larger than 64 MiB. Exclude it for this collection; the source remains intact.");
	abortIfNeeded(options.signal);
	const volumeLimit = options.maxVolumeBytes ?? 128 * 1024 * 1024;
	if (!Number.isFinite(volumeLimit) || volumeLimit <= 0 || volumeLimit > MAX_LOCAL_BUNDLE_BYTES) throw new Error("The split ZIP volume limit is invalid.");
	if (options.compressionLevel !== undefined && (!Number.isInteger(options.compressionLevel) || options.compressionLevel < 0 || options.compressionLevel > 9)) throw new Error("The ZIP compression level is invalid.");
	const newWriter = () => new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: typeof Worker !== "undefined", level: options.compressionLevel });
	let writer = newWriter();
	let volumeBytes = 0;
	let volumePaths: string[] = [];
	const manifest: BundleManifest = {
		schemaVersion: 1, bundleId: crypto.randomUUID().replaceAll("-", ""), product: "Goodbye Chat", createdAt: new Date().toISOString(),
		datasetFingerprint: plan.datasetFingerprint, revision: plan.revision, mode: plan.mode,
		timezone: plan.timezone, query: plan.query,
		metadataPolicy: "Original media bytes and embedded metadata are preserved. Source ZIPs and raw source JSON are not included.",
		payloads: [], assets: [], coverage: plan.coverage, omissions: [...plan.omissions], volumes: [],
	};
	const files = new Map<string, string>();
	const assets = new Map(plan.assets.map((asset) => [asset.id, asset]));
	let completed = 0;
	const total = plan.assets.length + 2;
	async function flushVolume() {
		if (!options.onVolume) throw new Error("The actual output needs split ZIP parts. Enable split output and review a new preview.");
		abortIfNeeded(options.signal);
		const blob = await writer.close();
		if (blob.size > volumeLimit) throw new Error("A ZIP part exceeded its bounded output limit.");
		const filename = `goodbye-chat-${manifest.bundleId}-part-${String(manifest.volumes.length + 1).padStart(4, "0")}.zip`;
		const volume: BundleVolume = { filename, byteSize: blob.size, sha256: await sha256Bytes(await blob.arrayBuffer()), payloadPaths: volumePaths };
		abortIfNeeded(options.signal);
		await options.onVolume(blob, filename);
		manifest.volumes.push(volume);
		writer = newWriter(); volumeBytes = 0; volumePaths = [];
	}
	async function addPayload(path: string, mimeType: string, bytes: Uint8Array) {
		abortIfNeeded(options.signal);
		if (bytes.byteLength > MAX_LOCAL_ASSET_BYTES) throw new Error("A payload exceeded the supported 64 MiB item limit. No complete catalogue was produced.");
		const projectedBytes = bytes.byteLength + 512 + new TextEncoder().encode(path).byteLength * 2 + Math.ceil(bytes.byteLength * .01);
		if (volumeBytes && volumeBytes + projectedBytes > (options.onVolume ? volumeLimit : MAX_LOCAL_BUNDLE_BYTES)) await flushVolume();
		if (projectedBytes > (options.onVolume ? volumeLimit : MAX_LOCAL_BUNDLE_BYTES)) throw new Error("This payload exceeds the selected split-part limit.");
		const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
		const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
		await writer.add(path, new Uint8ArrayReader(bytes), { signal: options.signal });
		manifest.payloads.push({ path, mimeType, byteSize: bytes.byteLength, sha256 });
		volumeBytes += projectedBytes; volumePaths.push(path);
	}
	async function addText(path: string, mimeType: string, text: string) {
		await addPayload(path, mimeType, new TextEncoder().encode(text));
	}
	try {
		for (const asset of plan.assets) {
			abortIfNeeded(options.signal);
			let file: string | null = null;
			let overlay: string | null = null;
			let composed: string | null = null;
			let baseBytes: Uint8Array | null = null;
			let layerBytes: Uint8Array | null = null;
			let composition: BundleManifest["assets"][number]["composition"];
			if (asset.path) {
				const bytes = new Uint8Array(await readAsset(asset.path, asset.sourceId, asset.sourceOrdinal));
				if (bytes.byteLength !== asset.byteSize) throw new Error("The original bytes no longer match the approved source size. Prepare a fresh preview; no complete catalogue was produced.");
				baseBytes = bytes;
				if (bytes.byteLength > MAX_LOCAL_ASSET_BYTES) throw new Error("An original exceeded the supported 64 MiB item limit. No completed download was produced.");
			}
			if (asset.overlayPath) {
				const bytes = new Uint8Array(await readAsset(asset.overlayPath, asset.overlaySourceId ?? asset.sourceId, asset.overlayOrdinal));
				if (asset.overlayByteSize !== undefined && bytes.byteLength !== asset.overlayByteSize) throw new Error("The overlay bytes no longer match the approved source size. Prepare a fresh preview; no complete catalogue was produced.");
				layerBytes = bytes;
			}
			if (baseBytes) {
				file = `media/${safeBundleStem(asset.id)}.${extensionFor(asset)}`;
				await addPayload(file, asset.mimeType, baseBytes);
				files.set(asset.id, file);
			}
			if (layerBytes) {
				overlay = `overlays/${safeBundleStem(asset.id)}.${extensionFor(asset, true)}`;
				await addPayload(overlay, "image/png", layerBytes);
			}
			if (plan.composeImages && !asset.compositionBlockedReason && baseBytes && layerBytes && asset.mimeType.startsWith("image/")) {
				let result: ComposedImage | null = null;
				try {
					if (baseBytes.byteLength > MAX_COMPOSITION_SOURCE_BYTES || layerBytes.byteLength > MAX_COMPOSITION_SOURCE_BYTES) throw new Error("This image exceeds the supported source byte budget. Its unchanged layers are preserved without a derivative.");
					result = await (options.composeImage ?? composeImageLayers)(new Blob([Uint8Array.from(baseBytes).buffer], { type: asset.mimeType }), new Blob([Uint8Array.from(layerBytes).buffer], { type: "image/png" }), { recipe: asset.compositionRecipe, signal: options.signal });
					if (result.originalSha256 !== manifest.payloads.find((payload) => payload.path === file)?.sha256 || result.overlaySha256 !== manifest.payloads.find((payload) => payload.path === overlay)?.sha256) throw new Error("The composition source hashes do not match the preserved layers.");
				} catch (failure) {
					result = null;
					abortIfNeeded(options.signal);
					manifest.omissions.push(`No flattened image for ${asset.id}. ${failure instanceof Error ? failure.message : "The recorded transform is unsupported."}`);
				}
				if (result) {
					abortIfNeeded(options.signal);
					composed = `composed/${safeBundleStem(asset.id)}.png`;
					await addPayload(composed, "image/png", new Uint8Array(await result.blob.arrayBuffer()));
					composition = { recipe: result.recipe, originalSha256: result.originalSha256, overlaySha256: result.overlaySha256, metadataPolicy: result.metadataPolicy };
					files.set(asset.id, composed);
				}
			}
			manifest.assets.push({ id: asset.id, file, overlay, composed, date: asset.date, linkState: asset.linkState,
				linkStates: asset.linkStates, links: asset.links, sources: asset.sources,
				originalTime: asset.originalTime, timePrecision: asset.timePrecision, timestampZone: asset.timestampZone, location: asset.location,
				overlayAssetId: overlay ? asset.overlayAssetId ?? null : null,
				originalSource: { sourceId: asset.sourceId, path: asset.path, ordinal: asset.sourceOrdinal },
				overlaySource: overlay && asset.overlayPath ? { sourceId: asset.overlaySourceId ?? asset.sourceId, path: asset.overlayPath, ordinal: asset.overlayOrdinal } : null, composition });
			options.onProgress?.(++completed, total, "Preserving original media");
		}
		await addText("records.json", "application/json", JSON.stringify({ schemaVersion: 1, events: plan.events, assets: manifest.assets }, null, 2));
		const conversations = new Map<string, BundleEvent[]>();
		for (const event of plan.events) {
			const group = conversations.get(event.conversationId) ?? [];
			group.push(event);
			conversations.set(event.conversationId, group);
		}
		const links: string[] = [];
		for (const [id, events] of conversations) {
			const path = `conversations/${safeBundleStem(id)}.html`;
			const title = events[0]?.conversationTitle || "Recorded conversation";
			await addText(path, "text/html", conversationPage(title, events, assets, files));
			links.push(`<li><a href="${escaped(path)}">${escaped(title)}</a> <span>${events.length} recorded events</span></li>`);
		}
		options.onProgress?.(++completed, total, "Writing readable conversations");
		const gallery = plan.assets.map((asset) => `<li>${mediaMarkup(asset, files.get(asset.id) ?? null).replaceAll('href="../', 'href="').replaceAll('src="../', 'src="')}<p>${escaped(asset.date ?? "Date not recorded")}</p></li>`).join("");
		await addText("index.html", "text/html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Your Goodbye Chat collection</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f7f1e6;color:#241b13;max-width:1000px;margin:40px auto;padding:24px}h1{font:48px Georgia,serif}a{color:#1f6958}img,video{max-width:320px;max-height:360px}li{margin:20px 0}p{overflow-wrap:anywhere}</style></head><body><h1>Your history, kept.</h1><p>${plan.events.length} recorded events and ${plan.assets.length} media records. Scope: ${escaped(plan.mode)}. Timezone: ${escaped(plan.timezone)}.</p><h2>Conversations</h2><ul>${links.join("")}</ul><h2>Media</h2><ul>${gallery}</ul><h2>Coverage and limitations</h2><ul>${[...plan.coverage, ...manifest.omissions].map((text) => `<li>${escaped(text)}</li>`).join("")}</ul><p><a href="manifest.json">Integrity manifest</a> | <a href="records.json">Selected records</a></p></body></html>`);
		abortIfNeeded(options.signal);
		// Place the catalogue after data parts. Every part extracts into one folder.
		if (options.onVolume && volumeBytes) await flushVolume();
		if (manifest.volumes.length) await addText("READ-ME.txt", "text/plain", `This collection has ${manifest.volumes.length} data ZIP parts plus this catalogue ZIP. Unzip every numbered part and the catalogue into the SAME folder, without creating a separate folder for each ZIP. Then open index.html. All references remain local. Required parts:\n${manifest.volumes.map((volume) => `${volume.filename} (${volume.byteSize} bytes, SHA-256 ${volume.sha256})`).join("\n")}\n`);
		// The manifest lists all payload checksums. It cannot checksum itself.
		const manifestText = JSON.stringify(manifest, null, 2);
		const manifestBytes = new TextEncoder().encode(manifestText).byteLength;
		if (manifestBytes > MAX_LOCAL_ASSET_BYTES || manifestBytes + volumeBytes > (options.onVolume ? volumeLimit : MAX_LOCAL_BUNDLE_BYTES)) throw new Error("The catalogue exceeds its bounded metadata size. Narrow the collection; no complete catalogue was produced.");
		await writer.add("manifest.json", new TextReader(manifestText), { signal: options.signal });
		const blob = await writer.close();
		abortIfNeeded(options.signal);
		if (blob.size > (options.onVolume ? volumeLimit : MAX_LOCAL_BUNDLE_BYTES)) throw new Error("The final ZIP exceeded its bounded output limit. No complete catalogue was produced.");
		options.onProgress?.(total, total, "Bundle ready");
		return { blob, manifest };
	} catch (error) {
		try { await writer.close(); } catch { /* A cancelled writer has no completed output. */ }
		if (manifest.volumes.length) {
			const reason = error instanceof Error ? error.message : "The export could not finish.";
			throw new Error(`Partial output: ${manifest.volumes.length} ZIP parts were written before the export stopped. No complete catalogue was produced. ${reason}`);
		}
		throw error;
	}
}

export function downloadLocalBlob(blob: Blob, filename: string, onRelease?: (failure?: Error) => void): () => void {
	const url = URL.createObjectURL(blob);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let released = false;
	const release = (failure?: Error) => {
		if (released) return;
		released = true;
		if (timer !== null) clearTimeout(timer);
		URL.revokeObjectURL(url);
		onRelease?.(failure);
	};
	try {
		const anchor = document.createElement("a");
		anchor.href = url; anchor.download = filename;
		anchor.click();
		timer = setTimeout(release, 10_000);
		return release;
	} catch (failure) { release(failure instanceof Error ? failure : new Error("The browser download could not start.")); throw failure; }
}

/** Browser downloads have no page-visible disk completion event. Keep one source URL leased at a time. */
export function downloadBundlePart(blob: Blob, filename: string, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return Promise.reject(new DOMException("Export canceled.", "AbortError"));
	return new Promise((resolve, reject) => {
		let release: () => void = () => {};
		const abort = () => release();
		signal?.addEventListener("abort", abort, { once: true });
		try {
			release = downloadLocalBlob(blob, filename, (failure) => {
				signal?.removeEventListener("abort", abort);
				if (failure) reject(failure);
				else if (signal?.aborted) reject(new DOMException("Export canceled during a download. Previously started parts may be incomplete.", "AbortError"));
				else resolve();
			});
			if (signal?.aborted) release();
		} catch (failure) { signal?.removeEventListener("abort", abort); reject(failure); }
	});
}
