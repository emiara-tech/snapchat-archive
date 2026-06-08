<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useArchiveStore } from "../stores/archive";

const archiveStore = useArchiveStore();
const exportComplete = ref(false);

const config = computed(() => archiveStore.exportConfig);

onMounted(() => {
   archiveStore.loadStats();
});

function updateConfig(key: keyof typeof config.value, value: boolean) {
   archiveStore.updateExportConfig({ [key]: value });
}

function downloadMetadataJson() {
   const payload = {
      exportedAt: new Date().toISOString(),
      capabilities: archiveStore.archiveCapabilities,
      diagnostics: archiveStore.archiveDiagnostics,
      stats: archiveStore.archiveStats,
      memories: archiveStore.mediaRecords,
      chats: config.value.includeChats ? archiveStore.chatHistory : undefined,
      snaps: config.value.includeSnaps ? archiveStore.snapHistory : undefined,
      stories: config.value.includeStories
         ? archiveStore.storiesList
         : undefined,
      metadata: config.value.includeMetadata
         ? {
              importedDate: archiveStore.importedDate,
              friendCount: archiveStore.friendsList.length,
           }
         : undefined,
   };

   const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
   });
   const url = URL.createObjectURL(blob);
   const link = document.createElement("a");
   link.href = url;
   link.download = `goodbye-chat-metadata-${new Date().toISOString().slice(0, 10)}.json`;
   document.body.appendChild(link);
   link.click();
   link.remove();
   URL.revokeObjectURL(url);
   exportComplete.value = true;
}
</script>

<template>
   <div class="page">
      <div class="container container-narrow">
         <header class="page-header">
            <span class="eyebrow">Metadata export</span>
            <h1>Download what the parser can prove.</h1>
            <p class="page-subtitle">
               This export writes normalized metadata, diagnostics, and stats to
               JSON. Media packaging and Immich import are intentionally
               disabled until media mapping is implemented.
            </p>
         </header>

         <div class="export-options card">
            <h2 class="option-heading">Export format</h2>
            <div class="format-content">
               <span class="format-icon">{}</span>
               <div class="format-info">
                  <span class="format-name">JSON metadata</span>
                  <span class="format-desc"
                     >Includes Memories metadata and optional chat, story, and
                     diagnostic data.</span
                  >
               </div>
            </div>
         </div>

         <div class="export-options card">
            <h2 class="option-heading">Include in JSON</h2>

            <div class="checkbox-group">
               <label class="checkbox-item">
                  <input
                     type="checkbox"
                     :checked="config.includeSnaps"
                     @change="
                        updateConfig('includeSnaps', !config.includeSnaps)
                     "
                  />
                  <span class="checkbox-label">Archive event metadata</span>
               </label>

               <label class="checkbox-item">
                  <input
                     type="checkbox"
                     :checked="config.includeChats"
                     @change="
                        updateConfig('includeChats', !config.includeChats)
                     "
                  />
                  <span class="checkbox-label"
                     >Chat message metadata and content from the export</span
                  >
               </label>

               <label class="checkbox-item">
                  <input
                     type="checkbox"
                     :checked="config.includeStories"
                     @change="
                        updateConfig('includeStories', !config.includeStories)
                     "
                  />
                  <span class="checkbox-label">Story metadata</span>
               </label>

               <label class="checkbox-item">
                  <input
                     type="checkbox"
                     :checked="config.includeMetadata"
                     @change="
                        updateConfig('includeMetadata', !config.includeMetadata)
                     "
                  />
                  <span class="checkbox-label"
                     >Import metadata and friend count</span
                  >
               </label>
            </div>
         </div>

         <div class="export-info card">
            <h3>Not implemented yet</h3>
            <p>
               This refactor does not package media files or generate Immich
               imports. The app first needs reliable mapping between Memories
               metadata, local `memories/` files, and `chat_media/` attachments.
            </p>
         </div>

         <div v-if="exportComplete" class="export-success card">
            <div class="success-icon">✓</div>
            <h3>Metadata JSON downloaded.</h3>
            <p>
               The file contains only data already parsed in this browser
               session.
            </p>
         </div>

         <div class="export-actions">
            <button
               class="btn btn-primary btn-lg"
               @click="downloadMetadataJson"
            >
               Download metadata JSON
            </button>
         </div>
      </div>
   </div>
</template>

<style scoped>
.container-narrow {
   max-width: 640px;
}

.page-header {
   text-align: center;
   margin-bottom: var(--space-xl);
}

.page-header h1 {
   margin: 16px 0 12px;
}

.page-subtitle {
   color: var(--text-soft);
}

.export-options {
   margin-bottom: var(--space-lg);
   padding: var(--space-lg);
}

.option-heading {
   font-size: 1rem;
   font-weight: 600;
   margin-bottom: var(--space-md);
}

.format-content {
   display: flex;
   align-items: center;
   gap: var(--space-md);
   padding: var(--space-md);
   border: 2px solid var(--secondary);
   border-radius: 18px;
   background: rgba(31, 105, 88, 0.08);
}

.format-icon {
   width: 40px;
   height: 40px;
   display: grid;
   place-items: center;
   border-radius: 14px;
   background: rgba(255, 255, 255, 0.78);
   font-size: 1.1rem;
   font-weight: 700;
}

.format-info {
   display: flex;
   flex-direction: column;
}

.format-name {
   font-weight: 600;
   font-size: 0.95rem;
}

.format-desc {
   font-size: 0.8rem;
   color: var(--text-soft);
}

.checkbox-group {
   display: flex;
   flex-direction: column;
   gap: var(--space-md);
}

.checkbox-item {
   display: flex;
   align-items: center;
   gap: var(--space-md);
   cursor: pointer;
   color: var(--text-soft);
}

.checkbox-label {
   font-size: 0.95rem;
}

.export-info {
   margin-bottom: var(--space-xl);
   padding: var(--space-lg);
   background: rgba(255, 255, 255, 0.5);
}

.export-info h3 {
   font-size: 1rem;
   margin-bottom: var(--space-md);
}

.export-info p {
   color: var(--text-soft);
   line-height: 1.7;
}

.export-success {
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: var(--space-md);
   padding: var(--space-xl);
   margin-bottom: var(--space-lg);
   background: rgba(43, 138, 104, 0.08);
   border: 1px solid rgba(43, 138, 104, 0.22);
}

.success-icon {
   width: 52px;
   height: 52px;
   display: grid;
   place-items: center;
   border-radius: 18px;
   font-size: 1.5rem;
   background: rgba(43, 138, 104, 0.16);
   color: var(--success);
}

.export-actions {
   display: flex;
   justify-content: center;
   margin-top: var(--space-xl);
}

@media (max-width: 640px) {
   .format-content {
      align-items: flex-start;
   }
}
</style>
