<template>
   <article class="highlight-card card">
      <div class="highlight-header">
         <div class="highlight-category">
            <span class="category-icon">{{ categoryIcon }}</span>
            <span class="category-label">{{ highlight.category }}</span>
         </div>
         <div class="confidence-indicator" :title="confidenceLabel">
            <span class="confidence-dots">
               <span
                  class="dot"
                  :class="{ active: highlight.confidence === 'high' }"
               ></span>
               <span
                  class="dot"
                  :class="{ active: highlight.confidence !== 'low' }"
               ></span>
               <span class="dot active"></span>
            </span>
         </div>
      </div>

      <h3 class="highlight-title">{{ highlight.title }}</h3>
      <p class="highlight-description">{{ highlight.description }}</p>

      <div v-if="relatedCount > 0" class="highlight-related">
         <span class="related-label">{{ relatedCount }} related photos</span>
      </div>
   </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Highlight {
   category: string;
   title: string;
   description: string;
   confidence?: string;
   relatedPhotos?: string[];
}

const props = defineProps<{
   highlight: Highlight;
}>();

const categoryIcon = computed(() => {
   const icons: Record<string, string> = {
      relationship: "❤️",
      milestone: "🎯",
      photo: "💭",
      stat: "📊",
   };
   return icons[props.highlight.category] || "✨";
});

const confidenceLabel = computed(() => {
   const labels: Record<string, string> = {
      high: "High confidence",
      medium: "Medium confidence",
      low: "Low confidence",
   };
   const confidence = props.highlight.confidence || "medium";
   return labels[confidence] || "Unknown confidence";
});

const relatedCount = computed(() => props.highlight.relatedPhotos?.length || 0);
</script>

<style scoped>
.highlight-card {
   display: flex;
   flex-direction: column;
   gap: var(--space-md);
   min-height: 220px;
}

.highlight-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
}

.highlight-category {
   display: flex;
   align-items: center;
   gap: var(--space-xs);
   font-size: 0.75rem;
   color: var(--text-soft);
   text-transform: capitalize;
}

.category-icon {
   font-size: 1rem;
}

.confidence-dots {
   display: flex;
   gap: 3px;
}

.dot {
   width: 6px;
   height: 6px;
   border-radius: 50%;
   background: rgba(89, 69, 48, 0.14);
   transition: background 0.2s;
}

.dot.active {
   background: var(--secondary);
}

.highlight-title {
   font-size: 1.1rem;
   font-weight: 600;
   color: var(--text-h);
   line-height: 1.3;
}

.highlight-description {
   font-size: 0.9rem;
   color: var(--text-soft);
   line-height: 1.6;
   flex: 1;
}

.highlight-related {
   margin-top: auto;
   padding-top: var(--space-md);
   border-top: 1px solid var(--border-subtle);
}

.related-label {
   font-size: 0.75rem;
   color: var(--text-soft);
}
</style>
