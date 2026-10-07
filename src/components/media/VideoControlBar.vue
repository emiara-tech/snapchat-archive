<template>
	<div class="video-control-bar" @click.stop>
		<button
			type="button"
			class="video-control-bar__button"
			:aria-label="playLabel"
			@click="emit('toggle-play')"
		>
			<Pause v-if="isPlaying" fill="currentColor" aria-hidden="true" />
			<Play v-else fill="currentColor" aria-hidden="true" />
		</button>

		<input
			type="range"
			class="video-control-bar__seek"
			min="0"
			:max="duration || 0"
			step="0.05"
			:value="currentTime"
			:style="{ '--fill': progressPercent + '%' }"
			aria-label="Seek through video"
			@input="onSeek"
		/>

		<span class="video-control-bar__time" aria-hidden="true">
			{{ formattedCurrent }}<span class="video-control-bar__time-sep">/</span
			>{{ formattedDuration }}
		</span>

		<button
			v-if="isFullscreen"
			type="button"
			class="video-control-bar__button"
			:aria-label="muteLabel"
			@click="emit('toggle-mute')"
		>
			<Volume2 v-if="!isMuted && volume > 0" aria-hidden="true" />
			<VolumeX v-else aria-hidden="true" />
		</button>

		<input
			v-if="isFullscreen"
			type="range"
			class="video-control-bar__volume"
			min="0"
			max="1"
			step="0.05"
			:value="isMuted ? 0 : volume"
			:style="{ '--fill': volumePercent + '%' }"
			aria-label="Volume"
			@input="onVolume"
		/>

		<button
			type="button"
			class="video-control-bar__button"
			:aria-label="fullscreenLabel"
			@click="emit('toggle-fullscreen')"
		>
			<Maximize v-if="!isFullscreen" aria-hidden="true" />
			<Minimize v-else aria-hidden="true" />
		</button>
	</div>
</template>

<script setup lang="ts">
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "@lucide/vue";

defineProps<{
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	formattedCurrent: string;
	formattedDuration: string;
	progressPercent: number;
	isMuted: boolean;
	volume: number;
	volumePercent: number;
	isFullscreen: boolean;
	playLabel: string;
	muteLabel: string;
	fullscreenLabel: string;
}>();

const emit = defineEmits<{
	(event: "toggle-play"): void;
	(event: "seek", value: number): void;
	(event: "toggle-mute"): void;
	(event: "volume", value: number): void;
	(event: "toggle-fullscreen"): void;
}>();

function onSeek(event: Event) {
	emit("seek", Number((event.target as HTMLInputElement).value));
}

function onVolume(event: Event) {
	emit("volume", Number((event.target as HTMLInputElement).value));
}
</script>

<style scoped>
.video-control-bar {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	gap: var(--space-xs);
	padding: 18px 6px 6px;
	background: linear-gradient(
		to top,
		rgba(12, 9, 7, 0.62) 0%,
		rgba(12, 9, 7, 0.28) 55%,
		transparent 100%
	);
	color: #fff;
}

.video-control-bar__button {
	flex: 0 0 auto;
	width: 28px;
	height: 28px;
	display: grid;
	place-items: center;
	padding: 0;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: #fff;
	transition: background var(--transition-fast);
}

.video-control-bar__button svg {
	width: 18px;
	height: 18px;
}

.video-control-bar__button:hover {
	background: rgba(255, 255, 255, 0.18);
}

.video-control-bar__time {
	flex: 0 0 auto;
	font-size: 0.7rem;
	font-variant-numeric: tabular-nums;
	letter-spacing: 0.01em;
	color: rgba(255, 255, 255, 0.92);
	white-space: nowrap;
}

.video-control-bar__time-sep {
	margin: 0 3px;
	opacity: 0.55;
}

.video-control-bar__seek,
.video-control-bar__volume {
	appearance: none;
	-webkit-appearance: none;
	height: 4px;
	border-radius: var(--radius-full);
	background: linear-gradient(
		to right,
		var(--accent) var(--fill, 0%),
		rgba(255, 255, 255, 0.3) var(--fill, 0%)
	);
	cursor: pointer;
}

.video-control-bar__seek {
	flex: 1 1 auto;
	min-width: 28px;
}

.video-control-bar__volume {
	flex: 0 0 auto;
	width: 80px;
}

.video-control-bar__seek::-webkit-slider-thumb,
.video-control-bar__volume::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.video-control-bar__seek::-moz-range-thumb,
.video-control-bar__volume::-moz-range-thumb {
	width: 12px;
	height: 12px;
	border: none;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.video-control-bar__button:focus-visible,
.video-control-bar__seek:focus-visible,
.video-control-bar__volume:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}

:global(.media-frame.is-fullscreen) .video-control-bar {
	padding: 32px 24px 20px;
	gap: var(--space-sm);
}
</style>