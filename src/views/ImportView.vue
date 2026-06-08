<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useArchiveStore } from "../stores/archive";
import FileDropzone from "../components/FileDropzone.vue";

const router = useRouter();
const archiveStore = useArchiveStore();

const files = ref<File[]>([]);
const isStarting = ref(false);

function handleFiles(selectedFiles: File[]) {
   files.value = selectedFiles;
   archiveStore.setSelectedFiles(selectedFiles);
}

function resetFiles() {
   files.value = [];
   archiveStore.setSelectedFiles([]);
}

async function startImport() {
   if (!files.value.length) return;

   isStarting.value = true;
   archiveStore.startProcessing();
   archiveStore.updateProgress(
      8,
      files.value.length === 1
         ? `Opening ${files.value[0].name}`
         : `Opening ${files.value.length} zip files`,
   );
   isStarting.value = false;
   router.push("/processing");
}
</script>

<template>
   <div class="page">
      <div class="container import-shell">
         <header class="page-header">
            <span class="eyebrow">Import your takeout</span>
            <h1>Drop the archive zip and start the goodbye flow.</h1>
            <p class="page-subtitle">
               This opens the takeout locally, detects the export structure, and
               reads metadata in your browser.
            </p>
         </header>

         <div class="import-content">
            <section class="card import-panel">
               <FileDropzone @file="handleFiles" />

               <div v-if="files.length" class="import-actions">
                  <button
                     class="btn btn-primary"
                     @click="startImport"
                     :disabled="isStarting"
                  >
                     {{
                        isStarting ? "Preparing session..." : "Build my recap"
                     }}
                  </button>
                  <button class="btn btn-secondary" @click="resetFiles">
                     Pick different zips
                  </button>
               </div>
            </section>

            <aside class="import-sidebar">
               <section class="card info-card emphasis">
                  <h3 class="info-title">What this session is for</h3>
                  <ul class="info-list">
                     <li>
                        Turn an archive takeout into a readable end-of-era
                        recap.
                     </li>
                     <li>
                        Review Memories metadata without leaving the browser.
                     </li>
                     <li>
                        Export a JSON bundle of parsed metadata and diagnostics.
                     </li>
                  </ul>
               </section>

               <section class="card info-card">
                  <h3 class="info-title">Where to get the zip</h3>
                  <ol class="info-steps">
                     <li>Open the account settings for the service.</li>
                     <li>
                        Find <strong>My Data</strong> or the export request area.
                     </li>
                     <li>Request the archive download link by email.</li>
                     <li>Download the zip once it is ready.</li>
                  </ol>
               </section>

               <section class="card info-card">
                  <h3 class="info-title">Privacy notes</h3>
                  <ul class="info-list">
                     <li>No sign-in wall.</li>
                     <li>No analytics or background upload flow.</li>
                     <li>
                        Session data is meant to stay in-browser while you
                        review.
                     </li>
                  </ul>
               </section>
            </aside>
         </div>

         <section class="import-footnote card">
            <div>
               <span class="footnote-label">After import</span>
               <p>
                  The next screens focus on detected files, metadata review, and
                  a truthful JSON export.
               </p>
            </div>
         </section>
      </div>
   </div>
</template>

<style scoped>
.page-header {
   max-width: 720px;
   margin-bottom: 28px;
}

.page-header h1 {
   margin: 16px 0 12px;
}

.page-subtitle {
   color: var(--text-soft);
   font-size: 1.05rem;
   max-width: 620px;
}

.import-content {
   display: grid;
   grid-template-columns: minmax(0, 1.1fr) 360px;
   gap: 24px;
   align-items: start;
}

.import-panel {
   padding: 18px;
}

.import-actions {
   display: flex;
   gap: 12px;
   justify-content: center;
   flex-wrap: wrap;
   margin-top: 18px;
}

.import-sidebar {
   display: grid;
   gap: 16px;
}

.info-card {
   display: grid;
   gap: 14px;
}

.info-card.emphasis {
   background:
      radial-gradient(
         circle at top left,
         rgba(243, 203, 69, 0.25),
         transparent 40%
      ),
      rgba(255, 251, 245, 0.9);
}

.info-title {
   font-size: 1rem;
}

.info-list,
.info-steps {
   margin: 0;
   padding-left: 18px;
   color: var(--text-soft);
}

.info-list li,
.info-steps li {
   margin-bottom: 10px;
}

.footnote-label {
   display: inline-block;
   margin-bottom: 10px;
   font-size: 0.78rem;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: var(--text-soft);
}

.import-footnote {
   margin-top: 24px;
   background: rgba(255, 255, 255, 0.48);
}

.import-footnote p {
   color: var(--text-soft);
}

@media (max-width: 960px) {
   .import-content {
      grid-template-columns: 1fr;
   }
}

@media (max-width: 640px) {
   .import-actions {
      flex-direction: column;
   }
}
</style>
