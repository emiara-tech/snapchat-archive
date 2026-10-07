<template>
	<MediaFrame
		ref="frameRef"
		kind="video"
		:overlay-src="overlaySrc"
		:has-media="Boolean(src)"
		:is-fullscreen="isFullscreen"
	>
		<template #media>
			<video
				v-if="src"
				ref="videoEl"
				class="media-frame__media"
				:src="src"
				:aria-label="label"
				preload="metadata"
				playsinline
				@click.stop="togglePlay"
				@loadedmetadata="onLoadedMetadata"
				@timeupdate="onTimeUpdate"
				@play="isPlaying = true"
				@pause="isPlaying = false"
				@volumechange="onVolumeChange"
				@ended="onEnded"
			/>
		</template>

		<template #controls>
			<template v-if="src">
				<button
					v-show="!isPlaying"
					type="button"
					class="video-media-card__play-badge"
					:aria-label="playLabel"
					@click.stop="togglePlay"
				>
					<Play fill="currentColor" aria-hidden="true" />
				</button>

				<VideoControlBar
					:is-playing="isPlaying"
					:current-time="currentTime"
					:duration="duration"
					:formatted-current="formattedCurrent"
					:formatted-duration="formattedDuration"
					:progress-percent="progressPercent"
					:is-muted="isMuted"
					:volume="volume"
					:volume-percent="volumePercent"
					:is-fullscreen="isFullscreen"
					:play-label="playLabel"
					:mute-label="muteLabel"
					:fullscreen-label="fullscreenLabel"
					@toggle-play="togglePlay"
					@seek="onSeek"
					@toggle-mute="toggleMute"
					@volume="onVolume"
					@toggle-fullscreen="toggleFullscreen"
				/>
			</template>
		</template>
	</MediaFrame>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Play } from "@lucide/vue";
import MediaFrame from "./MediaFrame.vue";
import VideoControlBar from "./VideoControlBar.vue";

defineProps<{
	src: string | null;
	overlaySrc: string | null;
	label: string;
}>();

const frameRef = ref<InstanceType<typeof MediaFrame> | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);

const isPlaying = ref(false);
const isMuted = ref(false);
const isFullscreen = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);

onMounted(() => {
	document.addEventListener("fullscreenchange", onFullscreenChange);
});

onUnmounted(() => {
	document.removeEventListener("fullscreenchange", onFullscreenChange);
});

function togglePlay() {
	const video = videoEl.value;
	if (!video) return;
	if (video.paused) video.play();
	else video.pause();
}

function onLoadedMetadata() {
	if (videoEl.value) duration.value = videoEl.value.duration || 0;
}

function onTimeUpdate() {
	if (videoEl.value) currentTime.value = videoEl.value.currentTime;
}

function onSeek(value: number) {
	currentTime.value = value;
	if (videoEl.value) videoEl.value.currentTime = value;
}

function toggleMute() {
	if (videoEl.value) videoEl.value.muted = !videoEl.value.muted;
}

function onVolume(value: number) {
	if (!videoEl.value) return;
	videoEl.value.volume = value;
	videoEl.value.muted = value === 0;
}

function onVolumeChange() {
	if (!videoEl.value) return;
	isMuted.value = videoEl.value.muted;
	volume.value = videoEl.value.volume;
}

function onEnded() {
	isPlaying.value = false;
}

function toggleFullscreen() {
	frameRef.value?.toggleFullscreen();
}

function onFullscreenChange() {
	isFullscreen.value = frameRef.value?.isFullscreenElement() ?? false;
}

const progressPercent = computed(() =>
	duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0,
);

const volumePercent = computed(() => (isMuted.value ? 0 : volume.value * 100));

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) return "0:00";
	const total = Math.floor(seconds);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const formattedCurrent = computed(() => formatTime(currentTime.value));
const formattedDuration = computed(() => formatTime(duration.value));
const playLabel = computed(() =>
	isPlaying.value ? "Pause video" : "Play video",
);
const muteLabel = computed(() => (isMuted.value ? "Unmute" : "Mute"));
const fullscreenLabel = computed(() =>
	isFullscreen.value ? "Exit fullscreen" : "Enter fullscreen",
);
</script>

<style scoped>
.video-media-card__play-badge {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 56px;
	height: 56px;
	display: grid;
	place-items: center;
	border: none;
	border-radius: var(--radius-full);
	background: rgba(18, 14, 11, 0.42);
	color: #fff;
	backdrop-filter: blur(6px);
	transition:
		background var(--transition-fast),
		transform var(--transition-fast);
}

.video-media-card__play-badge svg {
	width: 26px;
	height: 26px;
	margin-left: 2px;
}

.video-media-card__play-badge:hover {
	background: rgba(18, 14, 11, 0.6);
	transform: translate(-50%, -50%) scale(1.04);
}

.video-media-card__play-badge:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}
</style>