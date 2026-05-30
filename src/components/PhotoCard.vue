<template>
  <article class="photo-card card" :aria-label="photoLabel">
    <div class="photo-header">
      <div class="photo-type">
        <span class="type-dot" aria-hidden="true"></span>
        <span class="type-label">{{ photo.mediaType }}</span>
      </div>
      <time :datetime="photo.date" class="photo-date">
        {{ formattedDate }}
      </time>
    </div>
				<img :src="photo.filepath" width="100%"/>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MemoryRecord } from '../types'

const props = defineProps<{
  photo: MemoryRecord
}>()

console.log(props.photo)

const formattedDate = computed(() => {
  const date = new Date(props.photo.date)
  if (Number.isNaN(date.getTime())) return props.photo.date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})

const photoLabel = computed(() => {
  return `Memory metadata from ${props.photo.date}`
})
</script>

<style scoped>
.photo-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 100%;
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

.photo-type {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.75rem;
  color: var(--text-soft);
  text-transform: capitalize;
}

.type-dot {
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

