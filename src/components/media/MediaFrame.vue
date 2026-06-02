<template>
   <div
      ref="frameEl"
      class="media-frame"
      :class="[`media-frame--${kind}`, { 'is-fullscreen': isFullscreen }]"
   >
      <slot v-if="hasMedia" name="media" />
      <div v-else class="media-frame__placeholder">Media unavailable</div>

      <img
         v-if="overlaySrc"
         class="media-frame__overlay"
         :src="overlaySrc"
         alt=""
         aria-hidden="true"
      />

      <slot name="controls" />
   </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

withDefaults(
   defineProps<{
      kind: "image" | "video";
      overlaySrc: string | null;
      hasMedia: boolean;
      isFullscreen?: boolean;
   }>(),
   {
      isFullscreen: false,
   },
);

const frameEl = ref<HTMLDivElement | null>(null);

function requestFullscreen() {
   return frameEl.value?.requestFullscreen();
}

function exitFullscreen() {
   return document.fullscreenElement ? document.exitFullscreen() : undefined;
}

function toggleFullscreen() {
   return document.fullscreenElement ? exitFullscreen() : requestFullscreen();
}

function isFullscreenElement() {
   return document.fullscreenElement === frameEl.value;
}

defineExpose({
   requestFullscreen,
   exitFullscreen,
   toggleFullscreen,
   isFullscreenElement,
});
</script>

<style scoped>
.media-frame {
   position: relative;
   border-radius: var(--radius-sm);
   overflow: hidden;
}

:deep(.media-frame__media),
.media-frame__placeholder {
   width: 100%;
   aspect-ratio: 4 / 5;
   border-radius: var(--radius-sm);
   background: rgba(255, 255, 255, 0.62);
}

:deep(.media-frame__media) {
   display: block;
   object-fit: cover;
}

.media-frame--video :deep(.media-frame__media) {
   background: #000;
}

.media-frame__overlay {
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   object-fit: cover;
   pointer-events: none;
}

.media-frame__placeholder {
   display: flex;
   align-items: center;
   justify-content: center;
   color: var(--text-soft);
   font-size: 0.85rem;
   text-align: center;
}

.media-frame.is-fullscreen {
   display: flex;
   align-items: center;
   justify-content: center;
   background: #000;
   border-radius: 0;
}

.media-frame.is-fullscreen :deep(.media-frame__media),
.media-frame.is-fullscreen .media-frame__overlay {
   position: absolute;
   inset: 0;
   width: 100%;
   height: 100%;
   aspect-ratio: auto;
   object-fit: contain;
   border-radius: 0;
   background: transparent;
}
</style>
