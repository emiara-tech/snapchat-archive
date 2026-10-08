<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useArchiveStore } from "../stores/archive";
import { useWorkspaceStore } from "../stores/workspace";
import WorkspaceFilters from "../components/WorkspaceFilters.vue";
import { downloadBundlePart, downloadLocalBlob, MAX_LOCAL_BUNDLE_BYTES, writeArchiveBundle, type BundleManifest, type ExportPlan } from "../lib/exportBundle";
import { readSnapZipEntryContent } from "../lib/snapZip";
import { prepareExportSnapshot } from "../lib/exportSnapshot";

const archive = useArchiveStore();
const workspace = useWorkspaceStore();
const mode = ref<"curated" | "complete">("curated");
const plan = ref<ExportPlan | null>(null);
const planValidityKey = ref<string | null>(null);
const approved = ref(false);
const writing = ref(false);
const progress = ref(0);
const progressLabel = ref("");
const error = ref<string | null>(null);
const receipt = ref<BundleManifest | null>(null);
const preservationApproved = ref(false);
const flattenImages = ref(false);
const splitOutput = ref(false);
const supportsFolder = typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
let controller: AbortController | null = null;
const revision = computed(() => JSON.stringify({ dataset: workspace.dataset?.fingerprint, datasetRevision: workspace.dataset?.revision, query: workspace.query, decisions: workspace.decisions, flattenImages: flattenImages.value, splitOutput: splitOutput.value }));
const excludedCount = computed(() => Object.values(workspace.decisions).filter((decision) => decision.status === "exclude").length);
const laterCount = computed(() => Object.values(workspace.decisions).filter((decision) => decision.status === "later").length);
function bytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`; return `${(value / (1024 * 1024)).toFixed(1)} MiB`; }
async function preparePreview() {
	const dataset = workspace.dataset;
	if (!dataset) return;
	if (mode.value === "complete") workspace.resetQuery();
	approved.value = false; error.value = null; receipt.value = null;
	const validityKey = revision.value;
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(validityKey));
	if (validityKey !== revision.value) { error.value = "Your collection changed while preparing. Prepare a fresh preview."; return; }
	const exportRevision = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
	planValidityKey.value = validityKey;
	plan.value = prepareExportSnapshot({ dataset: workspace.dataset!, events: workspace.selectedEvents, assets: workspace.selectedAssets,
		query: { ...workspace.query }, revision: exportRevision, mode: mode.value, composeImages: flattenImages.value,
		physicalEntries: archive.archiveSession?.index.entries });
}
async function writeDownload(saveToFolder = false) {
	const current = plan.value;
	if (!current || !approved.value || planValidityKey.value !== revision.value || writing.value) return;
	const validityKey = planValidityKey.value;
	const session = archive.archiveSession;
	controller = new AbortController(); writing.value = true; error.value = null; receipt.value = null;
	try {
		let directory: FileSystemDirectoryHandle | null = null;
		if (saveToFolder) {
			const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
			if (!picker) throw new Error("Folder output is unavailable in this browser. Enable split ZIP downloads instead.");
			directory = await picker();
		}
		const acceptVolume = async (blob: Blob, filename: string) => {
			if (controller?.signal.aborted || validityKey !== revision.value) throw new DOMException("Export canceled.", "AbortError");
			if (directory) {
				const handle = await directory.getFileHandle(filename, { create: true });
				const target = await handle.createWritable();
				try { await target.write(blob); if (controller?.signal.aborted) throw new DOMException("Export canceled.", "AbortError"); await target.close(); }
				catch (failure) { try { await target.abort(); } catch { /* The destination may already be closed. */ } throw failure; }
			} else {
				progressLabel.value = `Starting ${filename}. Waiting before the next file…`;
				await downloadBundlePart(blob, filename, controller?.signal);
			}
		};
		const result = await writeArchiveBundle(current, async (path, sourceId, ordinal) => {
			if (!session || !sourceId) throw new Error("Reselect your source ZIPs before exporting original media.");
			const content = await readSnapZipEntryContent(session.index, { path, sourceId, ordinal }, { signal: controller?.signal, maxBytes: 64 * 1024 * 1024 });
			return content instanceof ArrayBuffer ? content : new Response(content).arrayBuffer();
		}, { signal: controller.signal, onVolume: splitOutput.value || directory ? acceptVolume : undefined, onProgress: (completed, total, label) => { progress.value = Math.round(completed / total * 100); progressLabel.value = label; } });
		if (validityKey !== revision.value) throw new Error("Your collection changed while writing. Review a new preview before downloading.");
		const filename = `goodbye-chat-${result.manifest.bundleId}-${result.manifest.volumes.length ? "catalogue" : current.mode}.zip`;
		await acceptVolume(result.blob, filename);
		receipt.value = result.manifest;
	} catch (failure) { error.value = failure instanceof Error ? failure.message : "This bundle could not be written. Your source files are unchanged."; }
	finally { writing.value = false; controller = null; }
}
function preserveOriginals() {
	if (!preservationApproved.value) return;
	for (const [index, file] of archive.selectedFiles.entries()) downloadLocalBlob(file, `goodbye-chat-original-${index + 1}.zip`);
}
function cancelExport() { controller?.abort(); }
watch(revision, () => { approved.value = false; controller?.abort(); });
watch(mode, () => { plan.value = null; approved.value = false; receipt.value = null; });
onBeforeUnmount(() => cancelExport());
onMounted(() => { if (!workspace.dataset) workspace.loadFromArchive(); });
</script>

<template>
	<div class="page export-page"><div class="container">
		<header class="export-heading"><div><span class="eyebrow">The departure desk</span><h1>Your history.<br>Your next chapter.</h1></div><p>Take the memories, the conversations, and the context. Leave with something you can open without this website.</p></header>
		<div class="export-modes" role="group" aria-label="Bundle scope"><button :class="{ active: mode === 'curated' }" @click="mode = 'curated'"><span>01</span><strong>Your curated collection</strong><small>Your current filters and reversible choices.</small></button><button :class="{ active: mode === 'complete' }" @click="mode = 'complete'"><span>02</span><strong>Complete available collection</strong><small>Reset temporary filters. Respect your exclusions.</small></button></div>
		<WorkspaceFilters v-if="mode === 'curated'" />
		<p v-else class="complete-policy">Preparing a complete preview resets the shared filters in every room. Your {{ excludedCount }} exclusion decisions stay in place. Missing source material remains missing.</p>
		<div class="export-workbench"><section class="export-summary card"><span class="eyebrow">A portable, readable ZIP</span><h2>Keep the whole story<br>around the photo.</h2><p>Local original media, readable conversations, selected records, and an integrity manifest. Everything is written on your device.</p><div class="summary-counts"><div><strong>{{ workspace.selectedEvents.length }}</strong><span>recorded events</span></div><div><strong>{{ workspace.selectedAssets.length }}</strong><span>media records</span></div><div><strong>{{ excludedCount }}</strong><span>excluded decisions</span></div></div><p v-if="laterCount" class="later-note">{{ laterCount }} decisions are marked for later. They remain included unless you explicitly narrow the review filter.</p><label class="export-option"><input v-model="flattenImages" type="checkbox" :disabled="writing">Also create supported flattened PNG images, with source layers preserved.</label><label class="export-option"><input v-model="splitOutput" type="checkbox" :disabled="writing">Allow bounded ZIP parts. Save every part and unzip all into the same folder.</label><button class="btn btn-primary" :disabled="writing || !workspace.dataset" @click="preparePreview">{{ mode === 'complete' ? 'Reset filters and preview complete bundle' : 'Preview this collection' }}</button><p class="download-limits">Single ZIP limit: 256 MiB. Split output builds one bounded part at a time, with a final catalogue. Originals remain limited to 64 MiB each.</p></section>
			<section class="destination-note"><span class="eyebrow">A destination is a separate decision</span><h2>Start with a copy<br>you control.</h2><p>Your local bundle preserves context that a photo service cannot represent.</p><div class="destination-row"><span class="destination-mark">G</span><div><strong>Google Photos</strong><small>Not connected. OAuth approval and verified transfer are required.</small></div></div><div class="destination-row"><span class="destination-mark immich">I</span><div><strong>Your Immich server</strong><small>Not connected. A verified instance and limited key are required.</small></div></div><p class="destination-footnote">External transfers are not available in this version. Importing, signing in, or reviewing never sends your memories to a destination.</p></section></div>
		<section v-if="plan" class="export-preview card"><div class="preview-heading"><div><span class="eyebrow">The exact preview</span><h2>{{ plan.mode === 'complete' ? 'Complete available collection' : 'Your curated collection' }}</h2></div><span class="size-estimate">~{{ bytes(plan.estimatedBytes) }}<small>estimated payload</small></span></div><div class="preview-counts"><span>{{ plan.events.length }} recorded events</span><span>{{ plan.assets.length }} media records</span><span>{{ plan.missingAssets }} missing originals</span><span>{{ plan.timezone }}</span></div><p v-if="planValidityKey !== revision" class="preview-alert" role="alert">Your collection changed. Prepare a fresh preview.</p><p v-if="plan.estimatedBytes > MAX_LOCAL_BUNDLE_BYTES && !splitOutput" class="preview-alert" role="alert">This collection needs split ZIP parts. Enable split output and prepare a fresh preview, or save the bounded parts to a supported folder.</p><ul class="omissions"><li v-for="omission in plan.omissions" :key="omission">{{ omission }}</li></ul><p class="policy-copy">Requested flattened PNGs use supported actual source layers at full size. A mismatched or unsupported transform is reported; original video and audio remain unchanged. Raw source JSON and original ZIPs are never included in this readable bundle. Selected text is escaped, and media references are local. Original preservation is a separate choice below.</p><label class="export-consent"><input v-model="approved" type="checkbox" :disabled="planValidityKey !== revision || writing"><span>I reviewed this scope and understand that original media may retain private embedded metadata.</span></label><div class="export-actions"><button class="btn btn-primary" :disabled="!approved || writing || planValidityKey !== revision || (plan.estimatedBytes > MAX_LOCAL_BUNDLE_BYTES && !splitOutput)" @click="writeDownload()">{{ writing ? 'Writing your local bundle...' : splitOutput ? 'Download readable ZIP parts' : 'Download readable ZIP' }}</button><button v-if="supportsFolder" class="btn btn-secondary" :disabled="!approved || writing || planValidityKey !== revision" @click="writeDownload(true)">Save ZIP parts to a folder</button><button v-if="writing" class="btn btn-secondary" @click="cancelExport">Cancel export</button></div><div v-if="writing" class="export-progress" role="status"><progress :value="progress" max="100"></progress><span>{{ progressLabel }} · {{ progress }}%</span></div><p v-if="error" class="preview-alert" role="alert">{{ error }}</p><div v-if="receipt" class="export-receipt" role="status"><h3>Your bundle is ready.</h3><p>{{ receipt.payloads.length }} payload files written with SHA-256 checksums. Unzip it and open index.html to read your collection offline. The manifest records its scope and omissions.</p><p v-if="receipt.volumes.length">Keep all {{ receipt.volumes.length }} numbered ZIP parts and the final catalogue ZIP. Unzip all into the same folder before opening index.html. Browser downloads must be saved completely; this page cannot verify your disk.</p><details v-if="receipt.volumes.length"><summary>Required ZIP parts and verified sizes</summary><ul><li v-for="volume in receipt.volumes" :key="volume.filename">{{ volume.filename }} · {{ bytes(volume.byteSize) }}</li></ul></details></div></section>
		<details class="original-preservation"><summary>Preserve a separate unchanged copy of my source ZIPs</summary><p>This copy contains all original private data, including excluded people, unfiltered messages, and embedded metadata. It is separate from your readable collection.</p><label><input v-model="preservationApproved" type="checkbox">I want unchanged source ZIPs, including content excluded from my curated view.</label><button class="btn btn-secondary" :disabled="!preservationApproved || !archive.selectedFiles.length" @click="preserveOriginals">Download {{ archive.selectedFiles.length }} unchanged source ZIPs</button></details>
	</div></div>
</template>

<style scoped>
.export-page{padding-top:58px}.export-heading{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:36px}.export-heading h1{font-size:clamp(3rem,5vw,4.8rem);margin-top:12px}.export-heading>p{max-width:350px;color:var(--text-soft);font-size:1.05rem}.export-modes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}.export-modes button{display:grid;grid-template-columns:auto 1fr;column-gap:15px;row-gap:6px;text-align:left;background:var(--bg-elevated);border:1px solid var(--border);padding:22px;border-radius:15px;color:var(--text)}.export-modes button.active{border-color:var(--secondary);background:var(--secondary-soft)}.export-modes span{grid-row:span 2;color:var(--secondary);font-size:.74rem;padding-top:3px}.export-modes strong{font-size:1rem}.export-modes small{font-size:.78rem;color:var(--text-soft)}.complete-policy{padding:16px 22px;border:1px solid var(--border);border-radius:12px;color:var(--text-soft);font-size:.85rem}.export-workbench{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;margin-top:26px}.export-summary{padding:34px}.export-summary h2,.destination-note h2{font:2.65rem var(--font-serif);margin:14px 0 20px}.export-summary>p{font-size:.88rem;color:var(--text-soft);max-width:500px}.summary-counts{display:flex;gap:35px;margin:26px 0}.summary-counts>div{display:grid}.summary-counts strong{font:2.4rem var(--font-serif);color:var(--secondary)}.summary-counts span{font-size:.7rem;color:var(--text-soft)}.later-note{margin:15px 0}.download-limits{font-size:.7rem!important;margin-top:14px}.destination-note{padding:34px;background:#232c25;border-radius:20px;color:#eadbc5}.destination-note .eyebrow{color:#b5bea7}.destination-note h2{color:#fff6e7}.destination-note>p{font-size:.85rem;color:#c4c7b8}.destination-row{display:flex;gap:14px;align-items:center;margin-top:24px}.destination-row>div{display:grid;gap:4px}.destination-row strong{font-size:.93rem;color:#fff7e5}.destination-row small{font-size:.7rem;color:#b7baac;line-height:1.5}.destination-mark{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:12px;color:#232c25;background:#dcc087;font-weight:700}.destination-mark.immich{background:#93aa9b}.destination-footnote{font-size:.7rem!important;margin-top:30px}.export-preview{margin-top:26px;padding:32px}.preview-heading{display:flex;justify-content:space-between;align-items:center;gap:20px}.preview-heading h2{font:2.3rem var(--font-serif);margin:10px 0}.size-estimate{font:2rem var(--font-serif);color:var(--secondary);text-align:right}.size-estimate small{display:block;font:.65rem var(--font-sans);color:var(--text-soft)}.preview-counts{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.preview-counts span{background:var(--secondary-soft);border-radius:20px;padding:6px 14px;font-size:.72rem;color:var(--secondary)}.omissions{font-size:.82rem;color:var(--text-soft);padding-left:20px;line-height:1.7}.policy-copy{font-size:.8rem;color:var(--text-soft);margin:20px 0}.export-consent{display:flex;align-items:start;gap:12px;font-size:.85rem;margin:20px 0;max-width:760px}.export-consent input{accent-color:var(--secondary);margin-top:5px}.export-actions{display:flex;gap:12px}.export-progress{margin:20px 0;display:grid;gap:6px;font-size:.75rem;color:var(--secondary)}progress{width:100%;accent-color:var(--secondary)}.preview-alert{padding:12px 16px;border-radius:10px;background:#c8664117;color:#934d2f;font-size:.85rem;margin:20px 0}.export-receipt{padding:20px;background:var(--secondary-soft);border-radius:14px;margin-top:22px}.export-receipt h3{color:var(--secondary);margin-bottom:10px}.export-receipt p{font-size:.85rem}.original-preservation{padding:25px;margin-top:28px;border:1px solid var(--border);border-radius:16px;color:var(--text-soft);font-size:.84rem}.original-preservation summary{cursor:pointer;color:var(--text)}.original-preservation p{margin:18px 0;max-width:700px}.original-preservation label{display:block;margin:20px 0}.original-preservation input{accent-color:var(--secondary)}.export-option{display:flex;align-items:start;gap:9px;font-size:.78rem;color:var(--text-soft);margin:16px 0}.export-option input{accent-color:var(--secondary);margin-top:3px}button:disabled{opacity:.4;cursor:default}@media(max-width:850px){.export-workbench{grid-template-columns:1fr}.export-heading{display:block}.export-heading>p{margin-top:20px}}@media(max-width:650px){.export-modes{grid-template-columns:1fr}.export-summary,.destination-note,.export-preview{padding:24px}.summary-counts{gap:20px}.preview-heading{align-items:start}.preview-heading h2{font-size:1.6rem}.size-estimate{font-size:1.5rem}}
</style>
