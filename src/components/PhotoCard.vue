<template>
   <article class="photo-card card" :aria-label="photoLabel">
      <div class="photo-header">
         <div class="photo-meta">
            <span class="meta-dot" aria-hidden="true"></span>
            <span class="meta-info">{{ photo.mediaType }}</span>
         </div>
         <div class="photo-meta">
            <span class="meta-dot" aria-hidden="true"></span>
            <span class="meta-info">{{ photo.location }}</span>
         </div>
         <time :datetime="photo.date" class="photo-date">
            {{ formattedDate }}
         </time>
      </div>
      <video
         v-if="blobUrl && isVideo"
         class="photo-media photo-media-video"
         :src="blobUrl"
         controls
         preload="metadata"
         playsinline
      />
      <img
         v-else-if="blobUrl"
         class="photo-media"
         :src="blobUrl"
         :alt="mediaLabel"
         loading="lazy"
      />
      <div v-else class="photo-media-placeholder">Media unavailable</div>
   </article>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { MemoryRecord } from "../types";
import { useArchiveStore } from "../stores/archive";

const props = defineProps<{
   photo: MemoryRecord;
}>();

const archiveStore = useArchiveStore();
const blobUrl = ref<string | null>(null);

onMounted(async () => {
   blobUrl.value = await archiveStore.resolveMediaUrl(props.photo.filePath);
});

onUnmounted(() => {
   if (blobUrl.value) URL.revokeObjectURL(blobUrl.value);
});

const formattedDate = computed(() => {
   const date = new Date(props.photo.date);
   if (Number.isNaN(date.getTime())) return props.photo.date;
   return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
   });
});

const isVideo = computed(() => {
   return (
      props.photo.mediaType.toLowerCase() === "video" ||
      props.photo.filePath.toLowerCase().endsWith(".mp4")
   );
});

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

.photo-meta {
   display: grid;
   gap: var(--space-sm);
   margin: 0;
}

.photo-meta div {
   display: grid;
   gap: 2px;
}

.photo-meta dt {
   color: var(--text-muted);
   font-size: 0.72rem;
   font-weight: 700;
   letter-spacing: 0.06em;
   text-transform: uppercase;
}

.photo-meta dd {
   margin: 0;
   color: var(--text);
   font-size: 0.9rem;
   word-break: break-word;
}
</style>
