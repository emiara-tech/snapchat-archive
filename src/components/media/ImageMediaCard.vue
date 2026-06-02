<template>
   <MediaFrame kind="image" :overlay-src="overlaySrc" :has-media="Boolean(src)">
      <template #media>
         <img
            v-if="src"
            class="media-frame__media"
            :src="src"
            :alt="alt"
            loading="lazy"
         />
      </template>
   </MediaFrame>
</template>

<script setup lang="ts">
import MediaFrame from "./MediaFrame.vue";

defineProps<{
   src: string | null;
   overlaySrc: string | null;
   alt: string;
}>();
</script>
