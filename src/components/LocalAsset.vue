<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useArchiveStore } from "../stores/archive";
import { useWorkspaceStore } from "../stores/workspace";
import { composeImageLayers, inspectImageSource, unsupportedRecordedOverlay } from "../lib/imageComposition";

const props = withDefaults(defineProps<{ assetId?: string; path: string | null; overlayPath?: string | null; kind: string; label?: string; focused?: boolean }>(), { assetId: undefined, overlayPath: null, label: "Recorded media", focused: false });
const archive = useArchiveStore();
const workspace = useWorkspaceStore();
const src = ref<string | null>(null);
const overlay = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const flattened = ref<string | null>(null);
const flattening = ref(false);
const flattenError = ref<string | null>(null);
const sourceDimensions = ref<{ width: number; height: number } | null>(null);
const overlayDimensions = ref<{ width: number; height: number } | null>(null);
const previewNotice = ref<string | null>(null);
const layerPreviewNotice = ref<string | null>(null);
const recordedTransform = computed(() => {
	const asset = workspace.dataset?.assets.find((item) => item.id === props.assetId);
	return asset ? unsupportedRecordedOverlay(asset.raw) : false;
});
const verifiedImageLayer = computed(() => props.kind === "image" && !recordedTransform.value
	&& sourceDimensions.value !== null && overlayDimensions.value !== null
	&& sourceDimensions.value.width === overlayDimensions.value.width && sourceDimensions.value.height === overlayDimensions.value.height);
const overlayNotice = computed(() => {
	if (!overlay.value || flattened.value) return null;
	if (props.kind !== "image") return "The overlay is preserved separately. Its timing and appearance have not been composed with this source.";
	if (recordedTransform.value) return "The recorded overlay transform is unsupported. The original and layer remain separate.";
	if (sourceDimensions.value && overlayDimensions.value && !verifiedImageLayer.value) return "The source and overlay dimensions differ. Their intended placement is unverified, so the layer remains separate.";
	return null;
});
function rememberDimensions(event: Event, layer: boolean) {
	const image = event.currentTarget;
	if (!(image instanceof HTMLImageElement)) return;
	const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
	if (layer) overlayDimensions.value = dimensions; else sourceDimensions.value = dimensions;
}
let compositionController: AbortController | null = null;
let inspectionController: AbortController | null = null;
let generation = 0;
function release() { compositionController?.abort(); compositionController = null; inspectionController?.abort(); inspectionController = null; for (const url of [src.value, overlay.value, flattened.value]) workspace.releaseAssetUrl(url); src.value = null; overlay.value = null; flattened.value = null; sourceDimensions.value = null; overlayDimensions.value = null; previewNotice.value = null; layerPreviewNotice.value = null; flattening.value = false; flattenError.value = null; }
async function previewFlattened() {
	if (!src.value || !overlay.value || flattening.value) return;
	if (flattened.value) { workspace.releaseAssetUrl(flattened.value); flattened.value = null; return; }
	const run = generation;
	compositionController = new AbortController();
	const signal = compositionController.signal;
	flattening.value = true; flattenError.value = null;
	try {
		const asset = workspace.dataset?.assets.find((item) => item.id === props.assetId);
		if (asset && unsupportedRecordedOverlay(asset.raw)) throw new Error("This archive records an unverified overlay transform. The original layers remain available; a flattened appearance is not established.");
		const [base, layer] = await Promise.all([fetch(src.value, { signal }).then((response) => response.blob()), fetch(overlay.value, { signal }).then((response) => response.blob())]);
		const composed = await composeImageLayers(base, layer, { signal });
		if (run !== generation || signal.aborted) return;
		flattened.value = URL.createObjectURL(composed.blob);
	} catch (failure) {
		if (!signal.aborted && run === generation) flattenError.value = failure instanceof Error ? failure.message : "This overlay could not be flattened. Its original layers remain available.";
	} finally { if (run === generation) flattening.value = false; }
}
watch(() => [props.assetId, props.path, props.overlayPath, archive.archiveSession], async () => {
	const run = ++generation;
	release(); error.value = null;
	if (!props.path) { loading.value = false; return; }
	loading.value = true;
	inspectionController = new AbortController();
	const signal = inspectionController.signal;
	try {
		const results = await Promise.allSettled([props.assetId ? workspace.resolveAssetUrl(props.assetId) : archive.resolveMediaUrl(props.path), props.assetId ? workspace.resolveOverlayUrl(props.assetId) : props.overlayPath ? archive.resolveMediaUrl(props.overlayPath) : Promise.resolve(null)]);
		const main = results[0].status === "fulfilled" ? results[0].value : null;
		const layer = results[1].status === "fulfilled" ? results[1].value : null;
		let mainNotice: string | null = null;
		let layerNotice: string | null = null;
		if (main && ["image", "sticker", "gif"].includes(props.kind)) {
			try { await inspectImageSource(await (await fetch(main, { signal })).blob(), { signal }); }
			catch (failure) { mainNotice = failure instanceof Error ? failure.message : "This image cannot be previewed within the supported limits. Download its unchanged original instead."; }
		}
		if (layer && !mainNotice) {
			try { await inspectImageSource(await (await fetch(layer, { signal })).blob(), { signal }); }
			catch (failure) { layerNotice = failure instanceof Error ? failure.message : "This layer cannot be previewed within the supported limits. Its unchanged source remains downloadable."; }
		}
		if (run !== generation) { for (const url of [main, layer]) workspace.releaseAssetUrl(url); return; }
		previewNotice.value = mainNotice; layerPreviewNotice.value = layerNotice;
		src.value = main; overlay.value = layer;
		if (!main) error.value = "This original file could not be opened.";
		if (results[1].status === "rejected") error.value = "The original is available. Its overlay could not be opened.";
	} finally { if (run === generation) loading.value = false; }
}, { immediate: true });
onBeforeUnmount(() => { generation += 1; release(); });
</script>

<template>
	<div class="local-asset" :class="[{ focused }, `kind-${kind}`]">
		<a v-if="src && previewNotice" :href="src" download class="attachment">Download original</a>
		<img v-else-if="src && ['image','sticker','gif'].includes(kind)" class="original" :src="flattened ?? src" :alt="flattened ? 'Flattened PNG preview from the original and recorded overlay' : label" loading="lazy" @load="rememberDimensions($event, false)" @error="error = 'This image format could not be decoded.'">
		<video v-else-if="src && kind === 'video'" class="original" :src="src" :controls="focused" :preload="focused ? 'metadata' : 'none'" @error="error = 'This video format could not be decoded.'"></video>
		<audio v-else-if="src && kind === 'audio'" :src="src" controls preload="none" @error="error = 'This audio format could not be decoded.'"></audio>
		<a v-else-if="src" :href="src" download class="attachment">Open original attachment</a>
		<div v-else class="missing"><span>{{ loading ? 'Opening locally...' : 'A piece is missing' }}</span><small>{{ loading ? 'Your file stays on this device.' : 'The export records this media, but its original file is unavailable.' }}</small></div>
		<img v-if="overlay && !error && !flattened && !previewNotice && !layerPreviewNotice" class="overlay" :class="{ 'unverified-layer': !verifiedImageLayer }" :src="overlay" alt="Recorded overlay layer" @load="rememberDimensions($event, true)" @error="error = 'The original is available. Its overlay image could not be decoded.'">
		<div v-if="focused && kind === 'image' && src && overlay && !previewNotice && !layerPreviewNotice" class="composition-controls"><button @click="previewFlattened" :disabled="flattening">{{ flattening ? 'Composing locally...' : flattened ? 'Show source layers' : 'Preview flattened PNG' }}</button><a v-if="flattened" :href="flattened" download="goodbye-chat-composed-preview.png">Save full-size preview</a></div>
		<p v-if="previewNotice" class="media-error" role="status">{{ previewNotice }}</p>
		<p v-else-if="layerPreviewNotice" class="media-error" role="status">{{ layerPreviewNotice }} <a :href="overlay!" download="recorded-overlay.png">Save original overlay</a></p>
		<p v-if="focused && overlayNotice && !flattenError && !error" class="media-error" role="status">{{ overlayNotice }} <a :href="overlay!" download="recorded-overlay.png">Save original overlay</a></p>
		<p v-if="flattenError" class="media-error" role="status">{{ flattenError }}</p>
		<p v-if="error" class="media-error" role="status">{{ error }}</p>
		<span v-if="kind === 'video' && !focused" class="video-label">Video</span>
	</div>
</template>

<style scoped>
.local-asset { position:relative; background:#e8ddcb; aspect-ratio:4/3; overflow:hidden; display:grid; place-items:center; border-radius:12px; }
.original { width:100%; height:100%; object-fit:contain; }
.focused { aspect-ratio:auto; min-height:260px; max-height:65vh; background:#181710; }
.focused .original { object-fit:contain; max-height:65vh; }
.overlay { position:absolute; inset:0; height:100%; width:100%; object-fit:contain; pointer-events:none; }
.unverified-layer { visibility:hidden; }
.missing { text-align:center; max-width:240px; padding:24px; display:grid; gap:8px; color:var(--text-soft); }
.missing span { font:1.3rem var(--font-serif); } .missing small { line-height:1.45; }
.media-error { position:absolute; left:12px; right:12px; bottom:12px; padding:10px; background:#fff3df; color:#714023; border-radius:8px; font-size:.76rem; }
.attachment { color:var(--secondary); padding:25px; }
audio { max-width:95%; }
.video-label { position:absolute; bottom:12px; left:12px; background:#171811bc; color:#fff; border-radius:20px; padding:4px 12px; font-size:.72rem; }
.composition-controls{position:absolute;left:12px;top:12px;display:flex;gap:8px;z-index:2}.composition-controls button,.composition-controls a{border:0;border-radius:12px;background:#fff5dfed;color:#315b4c;padding:8px 12px;font-size:.7rem}.composition-controls button:disabled{opacity:.6}
</style>
