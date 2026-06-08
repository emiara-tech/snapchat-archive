<template>
   <div
      class="file-dropzone"
      :class="{ 'is-dragging': isDragging, 'has-file': files.length > 0 }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="handleClick"
      role="button"
      tabindex="0"
      @keydown.enter="handleClick"
      @keydown.space.prevent="handleClick"
      aria-label="Drop your archive zip here or click to browse"
   >
      <input
         ref="fileInput"
         type="file"
         accept=".zip,application/zip"
         multiple
         class="visually-hidden"
         @change="handleFileSelect"
      />

      <div v-if="files.length === 0" class="dropzone-content">
         <div class="dropzone-icon" aria-hidden="true">ZIP</div>
         <p class="dropzone-title">Drop your archive zips</p>
         <p class="dropzone-subtitle">or click to choose the files</p>
         <p class="dropzone-hint">
            Works with the zip files from the account export flow
         </p>
      </div>

      <div v-else class="dropzone-file">
         <div class="file-icon" aria-hidden="true">ZIP</div>
         <div class="file-info">
            <p class="file-name">{{ fileLabel }}</p>
            <p class="file-size">{{ fileSizeLabel }}</p>
         </div>
         <button
            class="file-remove"
            @click.stop="removeFile"
            aria-label="Remove files"
         >
            ×
         </button>
      </div>
   </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const emit = defineEmits<{
   file: [files: File[]];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const files = ref<File[]>([]);
const isDragging = ref(false);

const fileLabel = computed(() =>
   files.value.length === 1
      ? files.value[0].name
      : `${files.value.length} zip files selected`,
);

const fileSizeLabel = computed(() => {
   const totalSize = files.value.reduce((sum, file) => sum + file.size, 0);
   return formatFileSize(totalSize);
});

function handleDragEnter() {
   isDragging.value = true;
}

function handleDragOver() {
   isDragging.value = true;
}

function handleDragLeave() {
   isDragging.value = false;
}

function handleDrop(event: DragEvent) {
   isDragging.value = false;
   const files = event.dataTransfer?.files;
   if (files && files.length > 0) {
      handleFiles(Array.from(files));
   }
}

function handleClick() {
   fileInput.value?.click();
}

function handleFileSelect(event: Event) {
   const target = event.target as HTMLInputElement;
   if (target.files && target.files.length > 0) {
      handleFiles(Array.from(target.files));
   }
}

function handleFiles(selectedFiles: File[]) {
   files.value = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".zip"),
   );
   emit("file", files.value);
}

function removeFile() {
   files.value = [];
   if (fileInput.value) {
      fileInput.value.value = "";
   }
}

function formatFileSize(bytes: number): string {
   if (bytes < 1024) return bytes + " B";
   if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
   return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
</script>

<style scoped>
.file-dropzone {
   display: flex;
   align-items: center;
   justify-content: center;
   min-height: 280px;
   padding: var(--space-xl);
   border: 2px dashed var(--border-strong);
   border-radius: 26px;
   background:
      radial-gradient(
         circle at top left,
         rgba(243, 203, 69, 0.16),
         transparent 30%
      ),
      rgba(255, 255, 255, 0.52);
   cursor: pointer;
   transition: all var(--transition-fast);
}

.file-dropzone:hover,
.file-dropzone.is-dragging {
   border-color: var(--secondary);
   background:
      radial-gradient(
         circle at top left,
         rgba(243, 203, 69, 0.2),
         transparent 30%
      ),
      rgba(255, 255, 255, 0.74);
}

.file-dropzone:focus-visible {
   outline: 2px solid var(--secondary);
   outline-offset: 2px;
}

.dropzone-content {
   text-align: center;
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: var(--space-md);
}

.dropzone-icon {
   width: 78px;
   height: 78px;
   display: grid;
   place-items: center;
   border-radius: 24px;
   background: linear-gradient(
      145deg,
      var(--accent) 0%,
      var(--accent-strong) 100%
   );
   color: var(--accent-text);
   font-size: 1rem;
   font-weight: 700;
   letter-spacing: 0.12em;
}

.dropzone-title {
   font-size: 1.25rem;
   font-weight: 600;
   color: var(--text-h);
}

.dropzone-subtitle {
   color: var(--text-soft);
}

.dropzone-hint {
   font-size: 0.875rem;
   color: var(--text-soft);
}

.dropzone-file {
   display: flex;
   align-items: center;
   gap: var(--space-md);
   width: 100%;
}

.file-icon {
   width: 62px;
   height: 62px;
   display: grid;
   place-items: center;
   border-radius: 20px;
   background: linear-gradient(
      145deg,
      rgba(243, 203, 69, 0.22),
      rgba(255, 255, 255, 0.72)
   );
   font-size: 0.95rem;
   font-weight: 700;
   letter-spacing: 0.08em;
}

.file-info {
   flex: 1;
   min-width: 0;
}

.file-name {
   font-weight: 500;
   color: var(--text-h);
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
}

.file-size {
   font-size: 0.875rem;
   color: var(--text-soft);
}

.file-remove {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 36px;
   height: 36px;
   border-radius: 50%;
   background: rgba(255, 255, 255, 0.7);
   color: var(--text-soft);
   font-size: 1.5rem;
   line-height: 1;
   border: none;
   transition: all var(--transition-fast);
}

.file-remove:hover {
   background: var(--danger);
   color: white;
}
</style>
