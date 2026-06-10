<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useArchiveStore } from "../stores/archive";
import MediaCard from "../components/media/MediaCard.vue";
import type { MediaRecord } from "../types";

const archiveStore = useArchiveStore();

const selectedType = ref<string>("all");
const selectedYear = ref<string>("all");
const selectedPhoto = ref<MediaRecord | null>(null);

const types = computed(() => {
   const typeSet = new Set(
      archiveStore.mediaRecords
         .map((record) => record.mediaType)
         .filter(Boolean),
   );
   return ["all", ...Array.from(typeSet).sort()];
});

const years = computed(() => {
   const yearSet = new Set<string>();
   archiveStore.mediaRecords.forEach((record) => {
      if (record.date.length >= 4) yearSet.add(record.date.substring(0, 4));
   });
   return ["all", ...Array.from(yearSet).sort().reverse()];
});

const filteredPhotos = computed(() => {
   return archiveStore.mediaRecords
      .filter((record) => {
         if (
            selectedType.value !== "all" &&
            record.mediaType !== selectedType.value
         )
            return false;
         if (
            selectedYear.value !== "all" &&
            !record.date.startsWith(selectedYear.value)
         )
            return false;
         return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

onMounted(() => {
   archiveStore.loadStats();
});

function selectPhoto(photo: MediaRecord) {
   selectedPhoto.value = photo;
}

function closeDetail() {
   selectedPhoto.value = null;
}
</script>

<template>
   <div class="page">
      <div class="container">
         <header class="page-header">
            <span class="eyebrow">Memories metadata</span>
            <h1>Review what the export says is in Memories.</h1>
            <p class="page-subtitle">
               {{ filteredPhotos.length }} metadata records in the current
               filter set.
            </p>
         </header>

         <section class="card diagnostics-card">
            <h2 class="section-heading">Archive detection</h2>
            <div class="diagnostics-grid">
               <span
                  >memories_history.json:
                  {{
                     archiveStore.archiveCapabilities.hasMemoriesHistoryJson
                        ? "found"
                        : "missing"
                  }}</span
               >
               <span
                  >memories folder:
                  {{
                     archiveStore.archiveCapabilities.hasMemoriesDirectory
                        ? "found"
                        : "missing"
                  }}</span
               >
               <span
                  >chat_media folder:
                  {{
                     archiveStore.archiveCapabilities.hasChatMediaDirectory
                        ? "found"
                        : "missing"
                  }}</span
               >
            </div>
         </section>

         <div class="filters-bar">
            <div class="filter-group">
               <label for="type-filter" class="filter-label">Type</label>
               <select
                  id="type-filter"
                  v-model="selectedType"
                  class="filter-select"
               >
                  <option v-for="type in types" :key="type" :value="type">
                     {{ type === "all" ? "All types" : type }}
                  </option>
               </select>
            </div>

            <div class="filter-group">
               <label for="year-filter" class="filter-label">Year</label>
               <select
                  id="year-filter"
                  v-model="selectedYear"
                  class="filter-select"
               >
                  <option v-for="year in years" :key="year" :value="year">
                     {{ year === "all" ? "All years" : year }}
                  </option>
               </select>
            </div>
         </div>

         <div class="photos-grid" v-if="filteredPhotos.length > 0">
            <MediaCard
               v-for="(photo, index) in filteredPhotos"
               :key="`${photo.date}-${index}`"
               :record="photo"
               @click="selectPhoto(photo)"
            />
         </div>

         <div v-else class="empty-state">
            <p>No Memories metadata matches those filters.</p>
            <button
               class="btn btn-secondary"
               @click="
                  selectedType = 'all';
                  selectedYear = 'all';
               "
            >
               Clear filters
            </button>
         </div>
      </div>

      <Transition name="slide">
         <div
            v-if="selectedPhoto"
            class="detail-overlay"
            @click.self="closeDetail"
         >
            <div class="detail-drawer card">
               <button
                  class="close-btn"
                  @click="closeDetail"
                  aria-label="Close"
               >
               </button>

               <div class="detail-header">
                  <span class="detail-type badge">{{
                     selectedPhoto.mediaType
                  }}</span>
                  <span class="detail-date">{{ selectedPhoto.date }}</span>
               </div>

               <dl class="detail-info">
                  <div>
                     <dt>Location</dt>
                     <dd>{{ selectedPhoto.location || "Not included" }}</dd>
                  </div>
                  <div>
                     <dt>Download Link</dt>
                     <dd>{{ selectedPhoto.mainFilePath || "Not included" }}</dd>
                  </div>
               </dl>
            </div>
         </div>
      </Transition>
   </div>
</template>

<style scoped>
.page-header {
   margin-bottom: var(--space-lg);
}

.page-header h1 {
   margin: 16px 0 12px;
}

.page-subtitle {
   color: var(--text-soft);
}

.diagnostics-card {
   margin-bottom: var(--space-lg);
}

.section-heading {
   font-size: 1rem;
   margin-bottom: var(--space-md);
}

.diagnostics-grid {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: var(--space-sm);
   color: var(--text-soft);
   font-size: 0.9rem;
}

.filters-bar {
   display: flex;
   gap: var(--space-md);
   margin-bottom: var(--space-xl);
   flex-wrap: wrap;
   padding: var(--space-md);
   background: rgba(255, 255, 255, 0.56);
   border: 1px solid var(--border);
   border-radius: 24px;
}

.filter-group {
   display: flex;
   flex-direction: column;
   gap: var(--space-xs);
}

.filter-label {
   font-size: 0.75rem;
   font-weight: 500;
   color: var(--text-soft);
   text-transform: uppercase;
   letter-spacing: 0.05em;
}

.filter-select {
   padding: var(--space-sm) var(--space-md);
   font-size: 0.9rem;
   border: 1px solid var(--border);
   border-radius: var(--radius-sm);
   background: rgba(255, 255, 255, 0.82);
   color: var(--text-h);
   min-width: 140px;
   cursor: pointer;
}

.filter-select:focus {
   outline: none;
   border-color: var(--accent);
}

.photos-grid {
   display: grid;
   grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
   gap: var(--space-md) - 200;
}

.empty-state {
   text-align: center;
   padding: var(--space-3xl);
   color: var(--text-soft);
}

.empty-state p {
   margin-bottom: var(--space-md);
}

.detail-overlay {
   position: fixed;
   inset: 0;
   background: rgba(16, 12, 10, 0.42);
   display: flex;
   justify-content: flex-end;
   z-index: 200;
}

.detail-drawer {
   width: 100%;
   max-width: 460px;
   height: 100%;
   border-radius: 0;
   border-left: 1px solid var(--border);
   padding: var(--space-xl);
   overflow-y: auto;
   position: relative;
}

.close-btn {
   position: absolute;
   top: var(--space-md);
   right: var(--space-md);
   width: 32px;
   height: 32px;
   display: flex;
   align-items: center;
   justify-content: center;
   background: rgba(255, 255, 255, 0.68);
   border: none;
   border-radius: var(--radius-sm);
   font-size: 1.2rem;
   cursor: pointer;
   color: var(--text-h);
}

.detail-header {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: var(--space-md);
   margin-bottom: var(--space-lg);
}

.detail-date {
   color: var(--text-soft);
   font-size: 0.875rem;
}

.detail-info {
   display: grid;
   gap: var(--space-md);
   margin: 0;
}

.detail-info dt {
   color: var(--text-muted);
   font-size: 0.75rem;
   font-weight: 700;
   letter-spacing: 0.06em;
   text-transform: uppercase;
}

.detail-info dd {
   margin: 0;
   color: var(--text);
   word-break: break-word;
}

@media (max-width: 760px) {
   .diagnostics-grid {
      grid-template-columns: 1fr;
   }
}
</style>
