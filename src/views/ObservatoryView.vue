<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	shallowRef,
	watch,
} from "vue";
import { useWorkspaceStore } from "../stores/workspace";
import { useRoute, useRouter } from "vue-router";
import ArchiveScene, {
	type SceneMode,
	type SceneNode,
} from "../components/ArchiveScene.vue";
import WorkspaceFilters from "../components/WorkspaceFilters.vue";
import ObservationNotebook from "../components/ObservationNotebook.vue";
import {
	type LocalObservations,
	type ObservationGroup,
} from "../lib/observations";
import { observationJob } from "../lib/observationJob";
import { localThumbnail, MAX_THUMBNAIL_SOURCE_BYTES } from "../lib/localThumbnail";

const workspace = useWorkspaceStore();
const route = useRoute();
const router = useRouter();
const supportedRooms = ["timeline", "relationships", "memories", "language", "map"] as const;
type ObservatoryRoom = typeof supportedRooms[number];
function routeRoom(value: unknown): ObservatoryRoom {
	return supportedRooms.includes(value as ObservatoryRoom) ? value as ObservatoryRoom : "timeline";
}
const compatibleRoute = () => !route.query.archive || route.query.archive === workspace.dataset?.fingerprint;
const room = ref<ObservatoryRoom>(compatibleRoute() ? routeRoom(route.query.room) : "timeline");
const selected = ref(compatibleRoute() && typeof route.query.group === "string" ? route.query.group : "");
const reading = ref(route.query.reading === "1");
const navigationStarted = ref(Boolean(route.query.room));
const motion = ref(true);
const backend = ref("Starting local renderer");
const thumbnails = ref<Record<string, string>>({});
const observations = shallowRef<LocalObservations | null>(null);
const calculating = ref(false);
const calculationError = ref<string | null>(null);
const mediaError = ref(false);
const evidencePage = ref(0);
let calculation = new AbortController();
watch(
	() => [workspace.dataset, workspace.selectedEvents, workspace.selectedAssets],
	async () => {
		calculation.abort();
		calculation = new AbortController();
		const job = calculation;
		observations.value = null;
		calculationError.value = null;
		if (!workspace.dataset) {
			calculating.value = false;
			return;
		}
		calculating.value = true;
		try {
			const result = await observationJob(
				workspace.dataset,
				workspace.selectedEvents,
				workspace.selectedAssets,
				job.signal,
			);
			if (!job.signal.aborted) observations.value = result;
		} catch (error) {
			if (!job.signal.aborted)
				calculationError.value =
					error instanceof Error ? error.message : "Local calculations failed.";
		} finally {
			if (!job.signal.aborted) calculating.value = false;
		}
	},
	{ immediate: true },
);
const groups = computed<ObservationGroup[]>(
	() => observations.value?.[room.value] ?? [],
);
const selectedGroup = computed(
	() => groups.value.find((group) => group.id === selected.value) ?? null,
);
const sources = computed(() =>
	workspace.selectedEvents.filter((event) =>
		selectedGroup.value?.eventIds.includes(event.id),
	),
);
const assets = computed(() =>
	workspace.selectedAssets.filter((asset) =>
		selectedGroup.value?.assetIds.includes(asset.id),
	),
);
const visibleGroups = computed(() =>
	groups.value.slice(evidencePage.value * 64, (evidencePage.value + 1) * 64),
);
const nodes = computed<SceneNode[]>(() =>
	visibleGroups.value.map((group) => ({
		id: group.id,
		label: group.label,
		value: group.value,
		latitude: group.latitude,
		longitude: group.longitude,
		calendarMonth: group.calendarMonth,
		imageUrl: thumbnails.value[group.id],
	})),
);
const rooms: {
	id: Exclude<SceneMode, "persona">;
	title: string;
	description: string;
	legend: string;
}[] = [
	{
		id: "timeline",
		title: "Time",
		description: "Your history has a shape.",
		legend:
			"Position follows recorded months. Height counts events and standalone media without counting a linked asset twice. Gaps mean missing evidence, not an empty life.",
	},
	{
		id: "relationships",
		title: "People",
		description: "Follow a conversation back to a person.",
		legend:
			"Size counts recorded direct exchanges, with group conversations kept separate. Lines indicate conversation scope; distance is a visual arrangement, not emotional closeness.",
	},
	{
		id: "memories",
		title: "Memories",
		description: "A small gallery from a much bigger life.",
		legend:
			"Frames follow recorded chronology. A frame is one selected media asset, with its available sources and conversation links.",
	},
	{
		id: "language",
		title: "Language",
		description: "The words that kept coming back.",
		legend:
			"Height counts word occurrences in proven owner-authored text. Select a word for its rate, denominator, and the messages behind it.",
	},
	{
		id: "map",
		title: "Places",
		description: "Revisit the coordinates you left behind.",
		legend:
			"Pins use recorded longitude and latitude on a local plane. No external map or geocoder receives your location. Missing coordinates stay missing.",
	},
];
const activeRoom = computed(() =>
	rooms.find((item) => item.id === room.value)!,
);
const excludedDecisions = computed(
	() =>
		Object.values(workspace.decisions).filter(
			(decision) => decision.status === "exclude",
		).length,
);
async function chooseEvidence(
	nextRoom: "timeline" | "relationships" | "language",
	id: string,
) {
	navigationStarted.value = true;
	room.value = nextRoom;
	selected.value = id;
	await nextTick();
	const index = groups.value.findIndex((group) => group.id === id);
	if (index >= 0) evidencePage.value = Math.floor(index / 64);
}
function selectRoom(value: ObservatoryRoom) { navigationStarted.value = true; room.value = value; }
function selectEvidence(id: string) { navigationStarted.value = true; selected.value = id; }
function reviewExcluded() {
	workspace.setQuery({ review: "exclude" });
	void router.push("/library");
}

watch(
	groups,
	(value) => {
		if (!observations.value) return;
		if (!value.some((group) => group.id === selected.value))
			selected.value = value[0]?.id ?? "";
		const index = value.findIndex((group) => group.id === selected.value);
		evidencePage.value = Math.max(0, Math.floor(index / 64));
	},
	{ immediate: true },
);
watch(() => route.query, () => {
	if (!route.query.room) return;
	room.value = compatibleRoute() ? routeRoom(route.query.room) : "timeline";
	selected.value = compatibleRoute() && typeof route.query.group === "string" ? route.query.group : "";
	reading.value = route.query.reading === "1";
});
watch([room, selected, reading, evidencePage, () => workspace.dataset?.fingerprint], () => {
	if (!navigationStarted.value || !workspace.dataset || !observations.value) return;
	void router.replace({ path: route.path, query: { ...route.query, room: room.value, group: selected.value || undefined,
		page: String(evidencePage.value), reading: reading.value ? "1" : undefined, archive: workspace.dataset.fingerprint } });
}, { flush: "post" });
let thumbnailGeneration = 0;
let thumbnailJob = new AbortController();
function releaseThumbnails() {
	for (const url of Object.values(thumbnails.value))
		workspace.releaseAssetUrl(url);
	thumbnails.value = {};
}
watch(
	() => [room.value, visibleGroups.value, workspace.selectedAssets],
	async () => {
		const generation = ++thumbnailGeneration;
		thumbnailJob.abort(); thumbnailJob = new AbortController();
		const signal = thumbnailJob.signal;
		releaseThumbnails();
		mediaError.value = false;
		if (room.value !== "memories") return;
		const assetsById = new Map(
			workspace.selectedAssets.map((asset) => [asset.id, asset]),
		);
		const requested = visibleGroups.value.slice(0, 18);
		const results: Array<{ id: string; url: string | null } | null> = [];
		let next = 0;
		async function decodeNext() {
			while (!signal.aborted && next < requested.length) {
			const group = requested[next++]!;
				const asset = assetsById.get(group.id);
				if (!asset || asset.kind !== "image") continue;
				if (asset.byteSize > MAX_THUMBNAIL_SOURCE_BYTES) { mediaError.value = true; continue; }
				let original: string | null = null;
				try {
					original = await workspace.resolveAssetUrl(asset.id);
					if (!original || signal.aborted) continue;
					const url = await localThumbnail(original, signal);
					results.push({ id: asset.id, url });
				} catch {
					if (!signal.aborted && generation === thumbnailGeneration) mediaError.value = true;
				} finally { workspace.releaseAssetUrl(original); }
			}
		}
		await Promise.all(Array.from({ length: Math.min(3, requested.length) }, decodeNext));
		if (generation !== thumbnailGeneration) {
			for (const result of results)
				if (result?.url) workspace.releaseAssetUrl(result.url);
			return;
		}
		thumbnails.value = Object.fromEntries(
			results.flatMap((result) =>
				result?.url ? [[result.id, result.url]] : [],
			),
		);
	},
	{ immediate: true },
);
onBeforeUnmount(() => {
	calculation.abort();
	thumbnailJob.abort();
	thumbnailGeneration++;
	releaseThumbnails();
});
onMounted(async () => {
	if (!workspace.dataset) await workspace.loadFromArchive();
});
</script>

<template>
	<div class="page observatory-page">
		<div class="container observatory-container">
			<header class="observatory-heading">
				<div>
					<span class="eyebrow">The observatory</span>
					<h1>Your life,<br /><em>in orbit.</em></h1>
				</div>
				<p>
					Follow a pattern. Open its evidence. Find the memory behind the shape.
				</p>
			</header>
			<WorkspaceFilters compact />
			<p v-if="workspace.error" role="alert">{{ workspace.error }}</p>
			<p v-if="calculating" role="status">
				Calculating your selected collection locally…
			</p>
			<p v-if="calculationError" role="alert">{{ calculationError }}</p>
			<p v-if="mediaError" role="status">
				Some gallery thumbnails are unavailable or exceed the supported image budget.
				Their originals and source records remain inspectable in Library.
			</p>
			<div class="observatory-grid">
				<section class="world-card">
					<nav class="room-tabs" aria-label="Observatory rooms">
						<button
							v-for="item in rooms"
							:key="item.id"
							:aria-pressed="room === item.id"
							@click="selectRoom(item.id)"
						>
							{{ item.title }}
						</button>
					</nav>
					<div class="world-heading">
						<div>
							<h2>{{ activeRoom.description }}</h2>
							<p>
								{{ groups.length }}
								{{
									room === "timeline"
										? "recorded months"
										: room === "relationships"
											? "conversation scopes"
											: room === "language"
												? "words shown"
												: "items"
								}}
								· {{ observations?.timezone ?? "UTC" }}
							</p>
						</div>
						<button
							class="reading-toggle"
							:aria-pressed="reading"
							@click="reading = !reading"
						>
							{{ reading ? "Open 3D" : "Reading mode" }}
						</button>
					</div>
					<ArchiveScene
						v-if="!reading"
						:mode="room"
						:nodes="nodes"
						:selected="selected"
						:motion="motion"
						@select="selectEvidence($event)"
						@backend="backend = $event"
					/>
					<div v-else class="reading-world">
						<p>
							Choose any item in the evidence list. The same sources and
							selection remain available.
						</p>
						<p>{{ activeRoom.legend }}</p>
					</div>
					<p class="scene-legend">{{ activeRoom.legend }}</p>
					<div class="world-footer">
						<span
							>{{ reading ? "Semantic reading mode" : backend }} · Local
							calculations</span
						><label><input v-model="motion" type="checkbox" /> Motion</label>
					</div>
					<p v-if="room === 'map'" class="coverage-note">
						{{ observations?.unknownLocations ?? 0 }} selected media items have
						no supported recorded coordinates.
					</p>
					<p v-if="observations?.unknownDates" class="coverage-note">
						{{ observations.unknownDates }} selected records have no usable
						date. Missing sections are described in your archive coverage.
					</p>
				</section>
				<aside class="evidence-card">
					<span class="panel-kicker">Evidence, close at hand</span>
					<h2>{{ selectedGroup?.label ?? "No recorded evidence here yet" }}</h2>
					<p v-if="selectedGroup" class="metric-value">
						{{ selectedGroup.value.toLocaleString() }}
						<span>{{
							room === "language"
								? "occurrences"
								: room === "relationships"
									? "events"
									: room === "timeline"
										? "records"
										: "item"
						}}</span>
					</p>
					<p>
						{{
							selectedGroup?.definition ??
							"Try a different year or filter. This room does not invent records to fill the space."
						}}
					</p>
					<div class="source-list">
						<article v-for="event in sources.slice(0, 6)" :key="event.id">
							<time>{{ event.timestamp?.slice(0, 10) ?? "Unknown date" }}</time>
							<p>{{ event.text || `Recorded ${event.kind} event` }}</p>
							<router-link
								:to="{
									path: '/conversations',
									query: {
										conversation: event.conversationId,
										event: event.id,
									},
								}"
								>Open conversation →</router-link
							><small
								>{{ event.source.path }} ·
								{{ event.source.recordPointer }}</small
							>
						</article>
					</div>
					<div class="source-list">
						<article v-for="asset in assets.slice(0, 4)" :key="asset.id">
							<img
								v-if="thumbnails[asset.id]"
								:src="thumbnails[asset.id]"
								alt="Selected archive memory"
							/>
							<p>
								{{ asset.kind }} ·
								{{ asset.timestamp?.slice(0, 10) ?? "Unknown date"
								}}<span v-if="!asset.available"> · File unavailable</span>
							</p>
							<router-link
								:to="{ path: '/library', query: { asset: asset.id } }"
								>Inspect media →</router-link
							><small
								>{{ asset.source.path }} ·
								{{ asset.source.recordPointer }}</small
							>
						</article>
					</div>
					<p
						v-if="sources.length > 6 || assets.length > 4"
						class="coverage-note"
					>
						Showing a bounded source preview. {{ sources.length }} events and
						{{ assets.length }} assets contribute to this selection.
					</p>
				</aside>
			</div>
			<ObservationNotebook
				:observations="observations"
				:coverage="workspace.dataset?.coverage ?? null"
				:busy="calculating"
				:excluded-decisions="excludedDecisions"
				@select="chooseEvidence"
				@year="workspace.setQuery({ year: $event })"
				@review="reviewExcluded"
			/>
			<section class="evidence-index">
				<div>
					<h2>Choose the evidence</h2>
					<p>
						Keyboard-accessible selection. Each page holds up to 64 evidence
						groups; the gallery draws up to 18 frames from that page.
					</p>
				</div>
				<div class="evidence-buttons">
					<button
						v-for="group in visibleGroups"
						:key="group.id"
						:aria-pressed="selected === group.id"
							@click="selectEvidence(group.id)"
					>
						{{ group.label }} <span>{{ group.value }}</span>
					</button>
					<p v-if="!groups.length && !calculating">
						No supported records match the current selection.
					</p>
				</div>
				<div v-if="groups.length > 64" class="evidence-buttons">
					<button
						:disabled="evidencePage === 0"
						@click="
							evidencePage--;
							selected = visibleGroups[0]?.id ?? '';
						"
					>
						Previous groups</button
					><span
						>Page {{ evidencePage + 1 }} of
						{{ Math.ceil(groups.length / 64) }}</span
					><button
						:disabled="(evidencePage + 1) * 64 >= groups.length"
						@click="
							evidencePage++;
							selected = visibleGroups[0]?.id ?? '';
						"
					>
						Next groups
					</button>
				</div>
			</section>
		</div>
	</div>
</template>

<style scoped>
.observatory-container {
	max-width: 1500px;
}
.observatory-heading {
	display: flex;
	align-items: end;
	justify-content: space-between;
	margin-bottom: 32px;
	gap: 32px;
}
.observatory-heading h1 {
	font-size: clamp(3rem, 5vw, 5.3rem);
	margin-top: 16px;
}
.observatory-heading h1 em {
	color: var(--secondary);
	font-style: normal;
}
.observatory-heading > p {
	max-width: 320px;
	color: var(--text-soft);
	padding-bottom: 12px;
}
.observatory-grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 340px;
	gap: 20px;
	margin-top: 24px;
}
.world-card {
	padding: 20px;
	border-radius: 28px;
	background: #fbf7ec;
	border: 1px solid var(--border);
	min-width: 0;
}
.room-tabs {
	display: flex;
	gap: 6px;
	border-bottom: 1px solid var(--border);
	padding-bottom: 14px;
	flex-wrap: wrap;
}
.room-tabs button {
	border: 0;
	background: transparent;
	padding: 10px 16px;
	border-radius: 8px;
	color: var(--text-soft);
	font-size: 0.9rem;
}
.room-tabs button[aria-pressed="true"] {
	background: #183e34;
	color: #f4ebd3;
}
.world-heading {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 20px;
	padding: 24px 2px 20px;
}
.world-heading h2 {
	font-size: 1.35rem;
}
.world-heading p {
	font-size: 0.8rem;
	color: var(--text-soft);
	margin-top: 5px;
}
.reading-toggle {
	border: 1px solid var(--border);
	background: transparent;
	padding: 8px 12px;
	border-radius: 8px;
	white-space: nowrap;
	color: var(--secondary);
}
.reading-world {
	min-height: 350px;
	display: grid;
	align-content: center;
	gap: 20px;
	padding: 48px;
	background: var(--secondary-soft);
	border-radius: 20px;
}
.scene-legend {
	font-size: 0.85rem;
	color: var(--text-soft);
	padding: 16px 4px;
}
.world-footer {
	display: flex;
	justify-content: space-between;
	font-size: 0.7rem;
	color: var(--text-soft);
	gap: 12px;
}
.evidence-card {
	padding: 30px 26px;
	border-radius: 28px;
	background: #eee6d5;
	border: 1px solid var(--border);
}
.panel-kicker {
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.13em;
	color: var(--secondary);
}
.evidence-card h2 {
	font-family: var(--font-serif);
	margin-top: 16px;
	font-size: 1.8rem;
	overflow-wrap: anywhere;
}
.evidence-card > p {
	margin-top: 16px;
	font-size: 0.86rem;
}
.metric-value {
	font-size: 2.6rem !important;
	color: var(--secondary);
}
.metric-value span {
	font-size: 0.75rem;
	color: var(--text-soft);
}
.source-list article {
	margin-top: 22px;
	padding-top: 16px;
	border-top: 1px solid var(--border);
}
.source-list time {
	font-size: 0.7rem;
	color: var(--text-soft);
}
.source-list p {
	font-size: 0.9rem;
	margin-top: 5px;
	overflow-wrap: anywhere;
}
.source-list a {
	font-size: 0.78rem;
	color: var(--secondary);
}
.source-list small {
	display: block;
	font-size: 0.6rem;
	color: var(--text-soft);
	margin-top: 8px;
	overflow-wrap: anywhere;
}
.source-list img {
	border-radius: 8px;
	width: 100%;
	max-height: 180px;
	object-fit: contain;
}
.coverage-note {
	font-size: 0.75rem !important;
	color: var(--text-soft);
	margin-top: 10px;
}
.evidence-index {
	margin-top: 32px;
	padding: 26px;
	border-radius: 20px;
	border: 1px solid var(--border);
}
.evidence-index h2 {
	font-size: 1.25rem;
}
.evidence-index p {
	color: var(--text-soft);
	font-size: 0.85rem;
	margin-top: 8px;
}
.evidence-buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 18px;
	max-height: 320px;
	overflow: auto;
}
.evidence-buttons button {
	border: 1px solid var(--border);
	padding: 9px 13px;
	background: #fff9ed;
	border-radius: 8px;
	color: var(--text);
}
.evidence-buttons button span {
	font-size: 0.7rem;
	color: var(--text-soft);
	padding-left: 8px;
}
.evidence-buttons button[aria-pressed="true"] {
	border-color: var(--secondary);
	background: var(--secondary-soft);
}
button:focus-visible {
	outline: 3px solid var(--accent-strong);
	outline-offset: 3px;
}
@media (max-width: 1080px) {
	.observatory-grid {
		grid-template-columns: 1fr;
	}
	.observatory-heading {
		align-items: start;
	}
	.evidence-card {
		display: block;
	}
}
</style>
