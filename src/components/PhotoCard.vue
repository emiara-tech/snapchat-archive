<template>
   <article class="photo-card card" :aria-label="photoLabel">
      <div class="photo-header">
         <div v-if="cityName" class="photo-meta">
            <span class="meta-dot" aria-hidden="true"></span>
            <span class="meta-info">{{ cityName }}</span>
         </div>
         <time :datetime="photo.date" class="photo-date">
            {{ formattedDate }}
         </time>
      </div>

      <div
         ref="mediaWrapper"
         class="photo-media-wrapper"
         :class="{ 'is-video': isVideo, 'is-fullscreen': isFullscreen }"
      >
         <video
            v-if="mainBlobUrl && isVideo"
            ref="videoEl"
            class="photo-media photo-media-video"
            :src="mainBlobUrl"
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
         <img
            v-else-if="mainBlobUrl"
            class="photo-media"
            :src="mainBlobUrl"
            :alt="mediaLabel"
            loading="lazy"
         />
         <div v-else class="photo-media-placeholder">Media unavailable</div>

         <img
            v-if="overlayBlobUrl"
            class="photo-overlay"
            :src="overlayBlobUrl"
            alt=""
            aria-hidden="true"
         />

         <template v-if="isVideo && mainBlobUrl">
            <button
               v-show="!isPlaying"
               type="button"
               class="play-badge"
               :aria-label="playLabel"
               @click.stop="togglePlay"
            >
               <Play fill="currentColor" aria-hidden="true" />
            </button>

            <div class="video-controls" @click.stop>
               <button
                  type="button"
                  class="ctrl-btn"
                  :aria-label="playLabel"
                  @click="togglePlay"
               >
                  <Pause v-if="isPlaying" fill="currentColor" aria-hidden="true" />
                  <Play v-else fill="currentColor" aria-hidden="true" />
               </button>

               <input
                  type="range"
                  class="seek"
                  min="0"
                  :max="duration || 0"
                  step="0.05"
                  :value="currentTime"
                  :style="{ '--fill': progressPercent + '%' }"
                  aria-label="Seek through video"
                  @input="onSeek"
               />

               <span class="time" aria-hidden="true">
                  {{ formattedCurrent }}<span class="time-sep">/</span>{{ formattedDuration }}
               </span>

               <button
                  v-if="isFullscreen"
                  type="button"
                  class="ctrl-btn"
                  :aria-label="muteLabel"
                  @click="toggleMute"
               >
                  <Volume2 v-if="!isMuted && volume > 0" aria-hidden="true" />
                  <VolumeX v-else aria-hidden="true" />
               </button>

               <input
                  v-if="isFullscreen"
                  type="range"
                  class="volume"
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
                  class="ctrl-btn"
                  :aria-label="fullscreenLabel"
                  @click="toggleFullscreen"
               >
                  <Maximize v-if="!isFullscreen" aria-hidden="true" />
                  <Minimize v-else aria-hidden="true" />
               </button>
            </div>
         </template>
      </div>
   </article>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { MemoryRecord } from "../types";
import { useArchiveStore } from "../stores/archive";
import { geocodeLocation } from "../lib/reverseGeocode";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "@lucide/vue";

const props = defineProps<{
   photo: MemoryRecord;
}>();

const archiveStore = useArchiveStore();
const mainBlobUrl = ref<string | null>(null);
const overlayBlobUrl = ref<string | null>(null);
const cityName = ref<string | null>(null);

const mediaWrapper = ref<HTMLDivElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);

const isPlaying = ref(false);
const isMuted = ref(false);
const isFullscreen = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);

onMounted(async () => {
   document.addEventListener("fullscreenchange", onFullscreenChange);
   const { mainFilePath, overlayFilePath } = props.photo;
   [mainBlobUrl.value, overlayBlobUrl.value, cityName.value] = await Promise.all([
      archiveStore.resolveMediaUrl(mainFilePath),
      overlayFilePath ? archiveStore.resolveMediaUrl(overlayFilePath) : Promise.resolve(null),
      geocodeLocation(props.photo.location),
   ]);
});

onUnmounted(() => {
   document.removeEventListener("fullscreenchange", onFullscreenChange);
   if (mainBlobUrl.value) URL.revokeObjectURL(mainBlobUrl.value);
   if (overlayBlobUrl.value) URL.revokeObjectURL(overlayBlobUrl.value);
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

function onSeek(event: Event) {
   const value = Number((event.target as HTMLInputElement).value);
   currentTime.value = value;
   if (videoEl.value) videoEl.value.currentTime = value;
}

function toggleMute() {
   if (videoEl.value) videoEl.value.muted = !videoEl.value.muted;
}

function onVolume(event: Event) {
   const value = Number((event.target as HTMLInputElement).value);
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
   if (document.fullscreenElement) document.exitFullscreen();
   else mediaWrapper.value?.requestFullscreen();
}

function onFullscreenChange() {
   isFullscreen.value = document.fullscreenElement === mediaWrapper.value;
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

const playLabel = computed(() => (isPlaying.value ? "Pause video" : "Play video"));
const muteLabel = computed(() => (isMuted.value ? "Unmute" : "Mute"));
const fullscreenLabel = computed(() =>
   isFullscreen.value ? "Exit fullscreen" : "Enter fullscreen",
);

const formattedDate = computed(() => {
   const date = new Date(props.photo.date);
   if (Number.isNaN(date.getTime())) return props.photo.date;
   return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
   });
});

const isVideo = computed(
   () =>
      props.photo.mediaType.toLowerCase() === "video" ||
      props.photo.mainFilePath.toLowerCase().endsWith(".mp4"),
);

const mediaLabel = computed(() => {
   return `${props.photo.mediaType} memory from ${props.photo.date}`;
});

const photoLabel = computed(() => {
   return `Memory metadata from ${props.photo.date}`;
});
</script>

<style scoped>
.photo-card {
   display: flex;
   flex-direction: column;
   gap: var(--space-md);
   cursor: pointer;
   transition: all var(--transition-fast);
   min-height: 100%;
   border-radius: var(--space-sm);
}

.photo-card:hover {
   transform: translateY(-2px);
   box-shadow: var(--shadow-md);
}

.photo-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: var(--space-md);
}

.photo-meta {
   display: flex;
   align-items: center;
   gap: var(--space-xs);
   font-size: 0.75rem;
   color: var(--text-soft);
   text-transform: capitalize;
}

.meta-dot {
   width: 9px;
   height: 9px;
   border-radius: 50%;
   background: var(--secondary);
}

.photo-date {
   font-size: 0.8rem;
   color: var(--text-soft);
   white-space: nowrap;
}

.photo-media-wrapper {
   position: relative;
   border-radius: var(--radius-sm);
   overflow: hidden;
}

.photo-media,
.photo-media-placeholder {
   width: 100%;
   aspect-ratio: 4 / 5;
   border-radius: var(--radius-sm);
   background: rgba(255, 255, 255, 0.62);
}

.photo-media {
   display: block;
   object-fit: cover;
}

.photo-overlay {
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   object-fit: cover;
   pointer-events: none;
}

.photo-media-video {
   background: #000;
}

.photo-media-placeholder {
   display: flex;
   align-items: center;
   justify-content: center;
   color: var(--text-soft);
   font-size: 0.85rem;
   text-align: center;
}

/* Center play affordance shown while paused */
.play-badge {
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

.play-badge svg {
   width: 26px;
   height: 26px;
   margin-left: 2px;
}

.play-badge:hover {
   background: rgba(18, 14, 11, 0.6);
   transform: translate(-50%, -50%) scale(1.04);
}

/* Control bar — always visible, calm scrim for readability */
.video-controls {
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

.ctrl-btn {
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

.ctrl-btn svg {
   width: 18px;
   height: 18px;
}

.ctrl-btn:hover {
   background: rgba(255, 255, 255, 0.18);
}

.time {
   flex: 0 0 auto;
   font-size: 0.7rem;
   font-variant-numeric: tabular-nums;
   letter-spacing: 0.01em;
   color: rgba(255, 255, 255, 0.92);
   white-space: nowrap;
}

.time-sep {
   margin: 0 3px;
   opacity: 0.55;
}

/* Range inputs (seek + volume) share a flat, accent-filled look */
.seek,
.volume {
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

.seek {
   flex: 1 1 auto;
   min-width: 28px;
}

.volume {
   flex: 0 0 auto;
   width: 80px;
}

.seek::-webkit-slider-thumb,
.volume::-webkit-slider-thumb {
   -webkit-appearance: none;
   appearance: none;
   width: 12px;
   height: 12px;
   border-radius: 50%;
   background: #fff;
   box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.seek::-moz-range-thumb,
.volume::-moz-range-thumb {
   width: 12px;
   height: 12px;
   border: none;
   border-radius: 50%;
   background: #fff;
   box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.ctrl-btn:focus-visible,
.play-badge:focus-visible,
.seek:focus-visible,
.volume:focus-visible {
   outline: 2px solid var(--accent);
   outline-offset: 2px;
}

/* Fullscreen — wrapper becomes the composed media surface */
.photo-media-wrapper.is-fullscreen {
   display: flex;
   align-items: center;
   justify-content: center;
   background: #000;
   border-radius: 0;
}

.photo-media-wrapper.is-fullscreen .photo-media,
.photo-media-wrapper.is-fullscreen .photo-overlay {
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   aspect-ratio: auto;
   object-fit: contain;
   border-radius: 0;
   background: transparent;
}

.photo-media-wrapper.is-fullscreen .video-controls {
   padding: 32px 24px 20px;
   gap: var(--space-sm);
}

.photo-media-wrapper.is-fullscreen .ctrl-btn {
   width: 40px;
   height: 40px;
}

.photo-media-wrapper.is-fullscreen .ctrl-btn svg {
   width: 22px;
   height: 22px;
}

.photo-media-wrapper.is-fullscreen .time {
   font-size: 0.85rem;
}

.photo-media-wrapper.is-fullscreen .play-badge {
   width: 76px;
   height: 76px;
}

.photo-media-wrapper.is-fullscreen .play-badge svg {
   width: 34px;
   height: 34px;
}
</style>
