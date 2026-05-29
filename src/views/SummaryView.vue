<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useArchiveStore } from '../stores/archive'

const archiveStore = useArchiveStore()
const runningAnalyzer = ref<string | null>(null)

const stats = computed(() => archiveStore.archiveStats)
const isLoadingStats = computed(() => archiveStore.isLoadingStats)
const analysisResults = computed(() => Array.from(archiveStore.analysisResults.entries()))

const analyzers = [
  { id: 'timeline', label: 'Chat activity timeline' },
  { id: 'bestFriends', label: 'Top conversations' },
  { id: 'wordCloud', label: 'Common words' },
  { id: 'streaks', label: 'Conversation activity runs' },
  { id: 'sentiment', label: 'Keyword sentiment prototype' },
]

onMounted(() => {
  archiveStore.loadStats()
})

async function runAnalyzer(id: string) {
  runningAnalyzer.value = id
  try {
    await archiveStore.runAnalyzer(id)
  } finally {
    runningAnalyzer.value = null
  }
}
</script>

<template>
  <div class="page">
    <div class="container container-narrow">
      <header class="page-header">
        <span class="eyebrow">Local analysis</span>
        <h1>Inspectable summaries, not invented certainty.</h1>
        <p class="page-subtitle">
          These analyzers run in the browser against parsed Snapchat JSON. They are simple heuristics and expose their
          raw output.
        </p>
      </header>

      <section class="stats-summary">
        <h2 class="section-heading">Parsed archive numbers</h2>
        <p v-if="isLoadingStats" class="section-subtitle">Computing stats...</p>
        <div v-else class="stats-grid-simple">
          <div class="stat-item">
            <span class="stat-value">{{ (stats?.totalMemories ?? 0).toLocaleString() }}</span>
            <span class="stat-label">saved Memories metadata records</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ (stats?.totalChats ?? 0).toLocaleString() }}</span>
            <span class="stat-label">chat messages</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ (stats?.totalDays ?? 0).toLocaleString() }}</span>
            <span class="stat-label">days between first and last dated record</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats?.totalFriends ?? 0 }}</span>
            <span class="stat-label">friends in friends.json</span>
          </div>
        </div>
      </section>

      <section class="analysis-section">
        <h2 class="section-heading">Run analyzers</h2>
        <div class="analyzer-actions">
          <button
            v-for="analyzer in analyzers"
            :key="analyzer.id"
            class="btn btn-secondary"
            :disabled="runningAnalyzer !== null"
            @click="runAnalyzer(analyzer.id)"
          >
            {{ runningAnalyzer === analyzer.id ? 'Running...' : analyzer.label }}
          </button>
        </div>

        <div v-if="analysisResults.length > 0" class="analysis-results">
          <div v-for="[key, value] in analysisResults" :key="key" class="analysis-item card">
            <h3>{{ key }}</h3>
            <pre>{{ JSON.stringify(value, null, 2) }}</pre>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>No analysis results yet.</p>
        </div>
      </section>

      <section class="disclaimer card">
        <h3>Limits</h3>
        <p>
          The sentiment analyzer is keyword based. Activity runs are not Snapchat streaks. Media files are not rendered
          or matched to chats in this refactor.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.container-narrow {
  max-width: 900px;
}

.page-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.page-header h1 {
  margin: 16px 0 12px;
}

.page-subtitle,
.section-subtitle {
  color: var(--text-soft);
  font-size: 1.05rem;
  line-height: 1.6;
}

.stats-summary,
.analysis-section {
  margin-bottom: var(--space-2xl);
}

.section-heading {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.stats-grid-simple {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-lg);
}

.stat-item {
  text-align: center;
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.stat-item .stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-h);
}

.stat-item .stat-label {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.analyzer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.analyzer-actions .btn:disabled {
  cursor: wait;
  opacity: 0.68;
}

.analysis-results {
  display: grid;
  gap: var(--space-md);
}

.analysis-item pre {
  max-height: 360px;
  overflow: auto;
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.64);
  color: var(--text);
  font-size: 0.82rem;
}

.empty-state {
  color: var(--text-soft);
}

.disclaimer {
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.44);
  border: 1px solid var(--border);
}

.disclaimer h3 {
  font-size: 1rem;
  margin-bottom: var(--space-sm);
}

.disclaimer p {
  font-size: 0.9rem;
  color: var(--text-soft);
  line-height: 1.6;
}

@media (max-width: 640px) {
  .stats-grid-simple {
    grid-template-columns: 1fr;
  }
}
</style>

