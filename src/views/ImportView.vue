<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useArchiveStore } from "../stores/archive";
import FileDropzone from "../components/FileDropzone.vue";

const router = useRouter();
const archiveStore = useArchiveStore();

const files = ref<File[]>([]);
const isStarting = ref(false);

function handleFiles(selectedFiles: File[]) {
	files.value = selectedFiles;
	archiveStore.setSelectedFiles(selectedFiles);
}

function resetFiles() {
	files.value = [];
	archiveStore.setSelectedFiles([]);
}

async function startImport() {
	if (!files.value.length) return;

	isStarting.value = true;
	archiveStore.startProcessing();
	archiveStore.updateProgress(
		8,
		files.value.length === 1
			? `Opening ${files.value[0].name}`
			: `Opening ${files.value.length} zip files`,
	);
	isStarting.value = false;
	router.push("/processing");
}
</script>

<template>
	<div class="page">
		<div class="container import-shell">
			<header class="page-header">
				<span class="eyebrow">Your data • Your browser</span>
				<h1>Drop the zips from Snapchat here to start exploring the past.</h1>
				<p class="page-subtitle">
					This opens your Snapchat data, locally and privately. Your eyes only.
				</p>
			</header>

			<div class="import-content">
				<section class="card import-panel">
					<FileDropzone @file="handleFiles" />

					<div v-if="files.length" class="import-actions">
						<button
							class="btn btn-primary"
							@click="startImport"
							:disabled="isStarting"
						>
							{{ isStarting ? "Preparing session..." : "Build my recap" }}
						</button>
						<button class="btn btn-secondary" @click="resetFiles">
							Pick different zips
						</button>
					</div>
				</section>

				<aside class="import-sidebar">
					<section class="card info-card emphasis">
						<h3 class="info-title">What this is for</h3>
						<ul class="info-list">
							<li>It is scary to delete your account, this tool will alleviate that fear.</li>
							<li>Get back control of your life story</li>
							<li>Explore your past in a new and exiting way.</li>
						</ul>
					</section>

					<section class="card info-card">
						<h3 class="info-title">Where to get the zip</h3>
						<ol class="info-steps">
							<li>Open the account settings On Snapchat.</li>
							<li>Find <strong>My Data</strong>.</li>
							<li>Request ALL possible data sent by email.</li>
							<li>Wait...</li>
							<li>Download the zip once it is ready, and come back here.</li>
						</ol>
					</section>

					<section class="card info-card">
						<h3 class="info-title">Privacy notes</h3>
						<ul class="info-list">
							<li>No sign-in wall.</li>
							<li>No analytics.</li>
							<li>
								Your data stays in-browser.
							</li>
						</ul>
					</section>
				</aside>
			</div>

			<section class="import-footnote card">
				<div>
					<span class="footnote-label">After exploring</span>
					<p>
						Filter out what you would mostly like to forget, and take the rest with you wherever you want.
					</p>
				</div>
			</section>
		</div>
	</div>
</template>

<style scoped>
.page-header {
	max-width: 720px;
	margin-bottom: 28px;
}

.page-header h1 {
	margin: 16px 0 12px;
}

.page-subtitle {
	color: var(--text-soft);
	font-size: 1.05rem;
	max-width: 620px;
}

.import-content {
	display: grid;
	grid-template-columns: minmax(0, 1.1fr) 360px;
	gap: 24px;
	align-items: start;
}

.import-panel {
	padding: 18px;
}

.import-actions {
	display: flex;
	gap: 12px;
	justify-content: center;
	flex-wrap: wrap;
	margin-top: 18px;
}

.import-sidebar {
	display: grid;
	gap: 16px;
}

.info-card {
	display: grid;
	gap: 14px;
}

.info-card.emphasis {
	background:
		radial-gradient(
			circle at top left,
			rgba(243, 203, 69, 0.25),
			transparent 40%
		),
		rgba(255, 251, 245, 0.9);
}

.info-title {
	font-size: 1rem;
}

.info-list,
.info-steps {
	margin: 0;
	padding-left: 18px;
	color: var(--text-soft);
}

.info-list li,
.info-steps li {
	margin-bottom: 10px;
}

.footnote-label {
	display: inline-block;
	margin-bottom: 10px;
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--text-soft);
}

.import-footnote {
	margin-top: 24px;
	background: rgba(255, 255, 255, 0.48);
}

.import-footnote p {
	color: var(--text-soft);
}

@media (max-width: 960px) {
	.import-content {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 640px) {
	.import-actions {
		flex-direction: column;
	}
}
</style>
