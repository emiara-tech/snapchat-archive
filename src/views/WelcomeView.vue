<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useWorkspaceStore } from "../stores/workspace";
import { useArchiveStore } from "../stores/archive";
import { useRevealStore } from "../stores/reveal";
const workspace = useWorkspaceStore();
const archive = useArchiveStore();
const reveal = useRevealStore();
const earliestPhoto = computed(
	() =>
		workspace.selectedAssets
			.filter((a) => a.role !== "overlay" && a.available && a.kind === "image" && a.timestamp)
			.sort((a, b) => a.timestamp!.localeCompare(b.timestamp!))[0],
);
const ownWords = computed(() =>
		workspace.selectedEvents.find(
		(e) => e.ownerAuthored && e.authorship === "owner" && e.kind === "text" && e.text,
	),
);
const scopedYears = computed(
	() =>
		new Set(
			[
				...workspace.selectedEvents.map((e) => e.year),
				...workspace.selectedAssets.map((a) => a.year),
			].filter((y) => y !== null),
		).size,
);
const photoUrl = ref<string | null>(null);
let run = 0;
function clearPhoto() {
	workspace.releaseAssetUrl(photoUrl.value);
	photoUrl.value = null;
}
watch(
	earliestPhoto,
	async (photo) => {
		const revision = ++run;
		clearPhoto();
		if (!photo) return;
		let url: string | null = null;
		try {
			url = await workspace.resolveAssetUrl(photo.id);
		} catch {
			return;
		}
		if (revision !== run) {
			workspace.releaseAssetUrl(url);
			return;
		}
		photoUrl.value = url;
	},
	{ immediate: true },
);
watch(
	() => workspace.dataset?.fingerprint,
	(value) => {
		if (value) reveal.forDataset(value);
	},
	{ immediate: true },
);
onBeforeUnmount(() => {
	run++;
	clearPhoto();
});
onMounted(() => {
	if (!workspace.dataset) void workspace.loadFromArchive();
});
function photoDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		dateStyle: "long",
		timeZone: "UTC",
	}).format(new Date(value));
}
</script>
<template>
	<div class="page">
		<div class="container reveal-page">
			<header class="reveal-header">
				<div>
					<span class="eyebrow">Privately opened, on your device</span>
					<h1>Your archive<br />is ready</h1>
					<p>A little of your history, waiting to be rediscovered.</p>
				</div>
				<div v-if="workspace.dataset" class="archive-seal">
					<span>◈</span
					><strong>YOUR LOCAL ARCHIVE</strong
					><small>{{ workspace.dataset.timezone }} · originals preserved</small>
				</div>
			</header>
			<p v-if="workspace.loading" class="workspace-status" role="status">
				Connecting your local records and media…
			</p>
			<section v-else-if="workspace.error" role="alert" class="card">
				<p>{{ workspace.error }}</p>
				<button @click="workspace.loadFromArchive()" class="btn btn-secondary">
					Try loading the workspace again
				</button>
			</section>
			<template v-else-if="workspace.dataset">
				<section class="reveal-facts" aria-label="Current archive selection">
					<article>
						<strong>{{
							workspace.selectedEvents.length.toLocaleString()
						}}</strong
						><span>recorded conversation events</span>
					</article>
					<article>
						<strong>{{
							workspace.selectedAssets.length.toLocaleString()
						}}</strong
						><span>media entries in your selection</span>
					</article>
					<article>
						<strong>{{ scopedYears }}</strong
						><span>years represented by dated records</span>
					</article>
					<p>
						Counts reflect the current filters and exclusions. Missing history
						remains unknown.
					</p>
				</section>
				<section
					class="reveal-highlights"
					v-if="earliestPhoto && !reveal.hidden.includes('first-photo')"
				>
					<div class="first-photo">
						<img
							v-if="photoUrl"
							:src="photoUrl"
							alt="Earliest dated photo available in the current collection"
						/><span v-else>Photo preview unavailable</span
						><small>{{ photoDate(earliestPhoto.timestamp!) }} · UTC</small>
					</div>
					<div class="highlight-copy">
						<span class="eyebrow">The first available photograph</span>
						<h2>A moment you<br />kept along the way.</h2>
						<p>
							This is the earliest dated available image in your current
							selection. The archive may not contain your first ever photo.
						</p>
						<router-link
							:to="{ path: '/library', query: { asset: earliestPhoto.id } }"
							class="btn btn-primary"
							>Open this memory ↗</router-link
						><button class="text-action" @click="reveal.hide('first-photo')">
							Hide this highlight
						</button>
					</div>
				</section>
				<section
					class="own-words"
					v-if="ownWords && !reveal.hidden.includes('own-words')"
				>
					<div>
						<span class="eyebrow">A message from back then</span>
						<h3>Curious how you used to sound?</h3>
						<p>
							Choose to reveal an example you wrote in this selection. This is a
							preserved message, not an interpretation of you.
						</p>
					</div>
					<button
						v-if="!reveal.showOwnWords"
						@click="reveal.showOwnWords = true"
						class="btn btn-secondary"
					>
						Show my old words
					</button>
					<div v-else class="revealed-words">
						<blockquote>{{ ownWords.text }}</blockquote>
						<router-link
							:to="{
								path: '/conversations',
								query: {
									conversation: ownWords.conversationId,
									event: ownWords.id,
								},
							}"
							>Open its conversation ↗</router-link
						><button class="text-action" @click="reveal.hide('own-words')">
							Hide this highlight
						</button>
					</div>
				</section>
				<section class="starting-routes">
					<div class="routes-title">
						<span class="eyebrow">Where would you like to begin?</span>
						<h2>Follow your curiosity.</h2>
					</div>
					<div class="route-cards">
						<router-link to="/conversations" class="route-card"
							><span class="route-number">01</span>
							<h3>Revisit & play</h3>
							<p>Old exchanges, familiar words, and photos in context.</p>
							<span>Open conversations ↗</span></router-link
						><router-link to="/observatory" class="route-card"
							><span class="route-number">02</span>
							<h3>Understand my history</h3>
							<p>Explore the years and the patterns recorded in your export.</p>
							<span>Enter the observatory ↗</span></router-link
						><router-link to="/library" class="route-card"
							><span class="route-number">03</span>
							<h3>Curate & take it with me</h3>
							<p>Choose what matters and make a collection to keep.</p>
							<span>Browse the library ↗</span></router-link
						>
					</div>
				</section>
				<details class="coverage-detail">
					<summary>What's represented in this archive?</summary>
					<p>
						Available records establish coverage, not a complete account of your
						life.
					</p>
					<ul>
						<li
							v-for="(section, name) in workspace.dataset.coverage.sections"
							:key="name"
						>
							{{ name }}: {{ section.status }},
							{{ section.recordCount }} records<span v-if="section.invalidCount"
								>, {{ section.invalidCount }} invalid</span
							>
							<span v-if="section.unsupportedCount">, {{ section.unsupportedCount }} retained unsupported records</span>
						</li>
					</ul>
					<p>
						{{ workspace.dataset.coverage.missingMedia }} unavailable media
						entries · {{ workspace.dataset.coverage.invalidDates }} invalid or
						missing dates ·
						{{ workspace.dataset.coverage.unknownAuthors }} events with
						uncertain authorship
					</p>
					<ul v-if="workspace.dataset.coverage.warnings.length">
						<li
							v-for="warning in workspace.dataset.coverage.warnings"
							:key="warning"
						>
							{{ warning }}
						</li>
					</ul>
				</details>
			</template>
			<router-link
				v-if="archive.isImported"
				to="/photos"
				class="legacy-memories"
				>Browse memories</router-link
			>
			<router-link to="/library" class="skip-reveal" v-if="workspace.dataset"
				>Skip the reveal and open the library ↗</router-link
			>
		</div>
	</div>
</template>
<style scoped>
.reveal-page {
	max-width: 1200px;
}
.reveal-header {
	display: flex;
	justify-content: space-between;
	gap: 30px;
	align-items: center;
	margin-bottom: 40px;
}
.reveal-header h1 {
	font-size: 4.3rem;
	letter-spacing: -0.045em;
	margin: 15px 0 20px;
	line-height: 1.06;
}
.reveal-header p {
	color: var(--text-soft);
	font-size: 0.96rem;
}
.archive-seal {
	display: grid;
	justify-items: center;
	gap: 10px;
	width: 190px;
	text-align: center;
	transform: rotate(5deg);
	padding: 28px 10px;
	border: 1px solid var(--border);
	border-radius: 50%;
	aspect-ratio: 1;
	color: var(--secondary);
}
.archive-seal > span {
	font-size: 2.8rem;
	line-height: 1;
}
.archive-seal strong {
	font-size: 0.6rem;
	letter-spacing: 0.13em;
}
.archive-seal small {
	font-size: 0.66rem;
	color: var(--text-soft);
}
.reveal-facts {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 20px;
	border-block: 1px solid var(--border);
	padding: 25px 0;
	margin-bottom: 40px;
}
.reveal-facts article {
	display: grid;
	gap: 4px;
}
.reveal-facts strong {
	font-size: 2.2rem;
	color: var(--secondary);
	font-family: var(--font-serif);
	font-weight: 500;
}
.reveal-facts span {
	font-size: 0.75rem;
	color: var(--text-soft);
}
.reveal-facts > p {
	grid-column: 1/-1;
	font-size: 0.71rem;
	color: var(--text-soft);
}
.reveal-highlights {
	display: grid;
	grid-template-columns: 0.8fr 1fr;
	gap: 55px;
	padding: 35px 50px;
	background: #e7ebe0;
	border: 1px solid #d9dfcc;
	border-radius: 6px;
	margin-bottom: 30px;
	align-items: center;
}
.first-photo {
	padding: 12px 12px 20px;
	background: #faf6eb;
	transform: rotate(-3deg);
	box-shadow: var(--shadow-md);
	display: grid;
	gap: 12px;
}
.first-photo img {
	width: 100%;
	height: 270px;
	object-fit: cover;
}
.first-photo small {
	font-size: 0.65rem;
	color: var(--text-soft);
	text-align: center;
}
.highlight-copy {
	display: grid;
	justify-items: start;
	gap: 20px;
}
.highlight-copy h2 {
	font: 500 2.7rem/1.12 var(--font-serif);
	letter-spacing: -0.04em;
}
.highlight-copy p {
	font-size: 0.85rem;
	color: var(--text-soft);
	line-height: 1.8;
	max-width: 370px;
}
.highlight-copy .btn {
	font-size: 0.78rem;
}
.text-action {
	background: none;
	border: 0;
	text-decoration: underline;
	padding: 0;
	color: var(--text-soft);
	font-size: 0.7rem;
}
.own-words {
	display: flex;
	gap: 25px;
	justify-content: space-between;
	align-items: center;
	border: 1px solid var(--border);
	padding: 28px 32px;
	border-radius: 6px;
	background: #f9f4ea;
}
.own-words h3 {
	font-family: var(--font-serif);
	font-size: 1.5rem;
	margin: 8px 0 10px;
}
.own-words p {
	color: var(--text-soft);
	font-size: 0.78rem;
	max-width: 500px;
}
.own-words .btn {
	font-size: 0.76rem;
	flex-shrink: 0;
}
.revealed-words {
	display: grid;
	gap: 10px;
	max-width: 45%;
	overflow-wrap: anywhere;
}
.revealed-words blockquote {
	margin: 0;
	font-family: var(--font-serif);
	font-size: 1.35rem;
	color: var(--secondary);
}
.revealed-words a {
	font-size: 0.75rem;
	color: var(--secondary);
}
.starting-routes {
	margin-top: 50px;
}
.routes-title h2 {
	font: 500 2.15rem/1.2 var(--font-serif);
	margin: 10px 0 26px;
}
.route-cards {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16px;
}
.route-card {
	display: grid;
	gap: 15px;
	border: 1px solid var(--border);
	background: var(--bg-card);
	padding: 26px;
	border-radius: 6px;
	transition: transform 0.15s;
}
.route-card:hover {
	transform: translateY(-3px);
}
.route-number {
	color: var(--secondary);
	font-family: var(--font-serif);
	font-size: 1.5rem;
}
.route-card h3 {
	font-size: 1rem;
}
.route-card p {
	font-size: 0.78rem;
	color: var(--text-soft);
	line-height: 1.7;
}
.route-card > span:last-child {
	font-size: 0.73rem;
	color: var(--secondary);
}
.coverage-detail {
	margin: 35px 0 20px;
	border-top: 1px solid var(--border);
	padding-top: 22px;
	font-size: 0.76rem;
	color: var(--text-soft);
}
.coverage-detail summary {
	color: var(--text);
	cursor: pointer;
}
.coverage-detail p {
	margin-top: 14px;
}
.skip-reveal,
.legacy-memories {
	font-size: 0.76rem;
	color: var(--secondary);
	display: inline-block;
	margin: 12px 22px 0 0;
}
.workspace-status {
	padding: 30px;
	color: var(--text-soft);
}
@media (max-width: 800px) {
	.reveal-header h1 {
		font-size: 3rem;
	}
	.archive-seal {
		display: none;
	}
	.reveal-highlights {
		grid-template-columns: 1fr;
		padding: 25px;
		gap: 30px;
	}
	.route-cards {
		grid-template-columns: 1fr;
	}
	.own-words {
		flex-direction: column;
		align-items: flex-start;
	}
	.revealed-words {
		max-width: 100%;
	}
	.reveal-facts {
		grid-template-columns: 1fr;
	}
}
</style>
