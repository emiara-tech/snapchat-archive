<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useArchiveStore } from "../stores/archive";

const router = useRouter();
const archiveStore = useArchiveStore();
let active = true;
onBeforeUnmount(() => { active = false; if (archiveStore.isProcessing) archiveStore.cancelProcessing(); });

function chooseDifferentFiles() {
	archiveStore.resetArchive();
	router.replace("/import");
}

async function runProcessingSequence() {
	if (!archiveStore.selectedFiles.length) {
		router.push("/import");
		return;
	}

	archiveStore.updateProgress(5, "Preparing archive session");

	try {
		await archiveStore.prepareArchive(archiveStore.selectedFiles);
		if (!active) return;
		archiveStore.completeProcessing();
		router.push("/welcome");
	} catch (error) {
		if (!active || (error instanceof Error && error.name === 'AbortError')) return;
		archiveStore.updateProgress(0, "Failed to process archive");
	}
}

onMounted(() => {
	if (archiveStore.isImported) {
		router.push("/welcome");
		return;
	}

	if (!archiveStore.isProcessing) {
		router.push("/import");
		return;
	}

	runProcessingSequence();
});
</script>

<template>
	<div class="page">
		<div class="container processing-shell">
			<div
				v-if="archiveStore.importError"
				class="processing-content card"
				role="alert"
			>
				<h1>Couldn't open your archive.</h1>
				<p class="processing-subtitle">
					Choose the original ZIP files from your Snapchat download and try
					again. If the download is incomplete, download it again first.
				</p>
				<button class="btn btn-primary" @click="chooseDifferentFiles">
					Choose different ZIPs
				</button>
			</div>
			<div v-else class="processing-content card">
				<div class="processing-icon">
					<div class="spinner"></div>
				</div>

				<span class="eyebrow">Private processing</span>
				<h1>Building your archive recap.</h1>
				<p class="processing-subtitle">
					The flow opens the takeout locally, indexes the archive paths, and
					detects which export files are actually present.
				</p>

				<div class="progress-container">
					<div class="progress-bar">
						<div
							class="progress-fill"
							:style="{ width: `${archiveStore.processingProgress}%` }"
						></div>
					</div>
					<div class="progress-info">
						<span class="progress-percentage"
							>{{ archiveStore.processingProgress }}%</span
						>
						<span class="progress-status">{{
							archiveStore.processingStatus
						}}</span>
					</div>
				</div>

				<div class="processing-details">
					<div class="detail-item">
						<span
							class="detail-icon"
							:class="{
								complete: archiveStore.processingProgress >= 20,
							}"
							>✓</span
						>
						<span>Open the zip locally</span>
					</div>
					<div class="detail-item">
						<span
							class="detail-icon"
							:class="{
								complete: archiveStore.processingProgress >= 40,
							}"
							>✓</span
						>
						<span>Detect Memories and chat media folders</span>
					</div>
					<div class="detail-item">
						<span
							class="detail-icon"
							:class="{
								complete: archiveStore.processingProgress >= 60,
							}"
							>✓</span
						>
						<span>Prepare JSON metadata readers</span>
					</div>
					<div class="detail-item">
						<span
							class="detail-icon"
							:class="{
								complete: archiveStore.processingProgress >= 80,
							}"
							>✓</span
						>
						<span>Record archive diagnostics</span>
					</div>
					<div class="detail-item">
						<span
							class="detail-icon"
							:class="{
								complete: archiveStore.processingProgress >= 100,
							}"
							>✓</span
						>
						<span>Open your archive</span>
					</div>
				</div>
				<button class="btn btn-secondary" @click="chooseDifferentFiles">Cancel import</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.processing-shell {
	display: flex;
	justify-content: center;
}

.processing-content {
	max-width: 720px;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	padding: 28px;
}

.processing-icon {
	width: 88px;
	height: 88px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 28px;
	background: linear-gradient(
		145deg,
		rgba(243, 203, 69, 0.22),
		rgba(31, 105, 88, 0.08)
	);
}

.spinner {
	width: 64px;
	height: 64px;
	border: 4px solid rgba(89, 69, 48, 0.12);
	border-top-color: var(--secondary);
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.processing-subtitle {
	color: var(--text-soft);
	font-size: 1rem;
	max-width: 520px;
}

.progress-container {
	width: 100%;
	max-width: 560px;
	margin-top: var(--space-md);
}

.progress-bar {
	height: 10px;
	background: rgba(89, 69, 48, 0.12);
	border-radius: var(--radius-full);
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--secondary), var(--accent-strong));
	border-radius: var(--radius-full);
	transition: width 0.3s ease;
}

.progress-info {
	display: flex;
	justify-content: space-between;
	margin-top: var(--space-sm);
	font-size: 0.875rem;
}

.progress-percentage {
	font-weight: 600;
	color: var(--text-h);
}

.progress-status {
	color: var(--text-soft);
}

.processing-details {
	display: flex;
	flex-direction: column;
	gap: var(--space-sm);
	margin-top: var(--space-lg);
	text-align: left;
	width: 100%;
	max-width: 420px;
}

.detail-item {
	display: flex;
	align-items: center;
	gap: var(--space-md);
	color: var(--text-soft);
	font-size: 0.9rem;
}

.detail-icon {
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: rgba(89, 69, 48, 0.12);
	color: var(--text-soft);
	font-size: 0.75rem;
	flex-shrink: 0;
	transition: all 0.2s;
}

.detail-icon.complete {
	background: var(--success);
	color: white;
}
</style>
