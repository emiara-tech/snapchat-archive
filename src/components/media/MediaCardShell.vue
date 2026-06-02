<template>
   <article class="media-card card" :aria-label="label" @click="emit('click')">
      <div class="media-card__header">
         <div v-if="cityName" class="media-card__meta">
            <span class="media-card__meta-dot" aria-hidden="true"></span>
            <span class="media-card__meta-info">{{ cityName }}</span>
         </div>
         <time :datetime="date" class="media-card__date">
            {{ formattedDate }}
         </time>
      </div>

      <slot />
   </article>
</template>

<script setup lang="ts">
defineProps<{
   date: string;
   formattedDate: string;
   cityName: string | null;
   label: string;
}>();

const emit = defineEmits<{
   (event: "click"): void;
}>();
</script>

<style scoped>
.media-card {
   display: flex;
   flex-direction: column;
   gap: var(--space-md);
   cursor: pointer;
   transition: all var(--transition-fast);
   min-height: 100%;
   border-radius: var(--space-sm);
}

.media-card:hover {
   transform: translateY(-2px);
   box-shadow: var(--shadow-md);
}

.media-card__header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   gap: var(--space-md);
}

.media-card__meta {
   display: flex;
   align-items: center;
   gap: var(--space-xs);
   font-size: 0.75rem;
   color: var(--text-soft);
   text-transform: capitalize;
}

.media-card__meta-dot {
   width: 9px;
   height: 9px;
   border-radius: 50%;
   background: var(--secondary);
}

.media-card__date {
   font-size: 0.8rem;
   color: var(--text-soft);
   white-space: nowrap;
}
</style>
