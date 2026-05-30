<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useArchiveStore } from "../stores/archive";
import StatCard from "../components/StatCard.vue";

const archiveStore = useArchiveStore();

const stats = computed(() => archiveStore.archiveStats);
const isLoadingStats = computed(() => archiveStore.isLoadingStats);

const importedDate = computed(() => {
   if (!archiveStore.importedDate) return "";
   return new Date(archiveStore.importedDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
   });
});

function formatNumber(num: number): string {
   return num.toLocaleString();
}

onMounted(() => {
   archiveStore.loadStats();
});
</script>

<template>
   <div class="page">
      <div class="container">
         <header class="page-header">
            <div>
               <span class="eyebrow">Recap overview</span>
               <h1>Your Snapchat chapter, compressed.</h1>
               <p class="page-subtitle">
                  Session opened on {{ importedDate }}. These numbers come from
                  detected Snapchat export files and Memories metadata.
               </p>
            </div>
            <nav class="dashboard-nav">
               <router-link to="/photos" class="btn btn-secondary"
                  >Review metadata</router-link
               >
               <router-link to="/summary" class="btn btn-primary"
                  >Run analysis</router-link
               >
            </nav>
         </header>

         <section class="stats-section">
            <div class="stats-grid">
               <StatCard
                  icon="M"
                  :value="
                     isLoadingStats
                        ? '...'
                        : formatNumber(stats?.totalMemories || 0)
                  "
                  label="Saved memories"
               />
               <StatCard
                  icon="💬"
                  :value="
                     isLoadingStats ? '…' : formatNumber(stats?.totalChats || 0)
                  "
                  label="Chat messages"
               />
               <StatCard
                  icon="S"
                  :value="
                     isLoadingStats
                        ? '...'
                        : formatNumber(stats?.totalSnaps || 0)
                  "
                  label="Snap events"
               />
               <StatCard
                  icon="👥"
                  :value="formatNumber(stats?.totalFriends || 0)"
                  label="Friends"
               />
            </div>
         </section>

         <section class="hero-strip card">
            <div class="hero-strip-copy">
               <span class="strip-label">Fast read</span>
               <h2>
                  {{ stats?.longestChatActiveRunDays }} days was your longest
                  chat activity run, across {{ stats?.totalDays }} days of dated
                  records.
               </h2>
               <p>
                  Your parsed records stretch from
                  {{ stats?.dateRange.start || "unknown" }} to
                  {{ stats?.dateRange.end || "unknown" }}. Indexed Memories and
                  chat media currently total
                  {{ stats?.totalIndexedMediaSize || "0 B" }}.
               </p>
            </div>
            <router-link to="/export" class="btn btn-primary"
               >Prepare export</router-link
            >
         </section>

         <section class="timeline-section">
            <h2 class="section-heading">Timeline window</h2>
            <div class="card timeline-card">
               <div class="timeline-content">
                  <div class="timeline-range">
                     <div class="range-point">
                        <span class="range-date">{{
                           stats?.dateRange.start
                        }}</span>
                        <span class="range-label">First dated record</span>
                     </div>
                     <div class="range-line"></div>
                     <div class="range-point">
                        <span class="range-date">{{
                           stats?.dateRange.end
                        }}</span>
                        <span class="range-label">Latest dated record</span>
                     </div>
                  </div>
                  <div class="timeline-stats">
                     <div class="timeline-stat">
                        <span class="stat-value">{{ stats?.totalDays }}</span>
                        <span class="stat-label">days in range</span>
                     </div>
                     <div class="timeline-stat">
                        <span class="stat-value">{{
                           stats?.longestChatActiveRunDays
                        }}</span>
                        <span class="stat-label">chat activity run</span>
                     </div>
                     <div class="timeline-stat">
                        <span class="stat-value">{{
                           stats?.totalIndexedMediaSize
                        }}</span>
                        <span class="stat-label">indexed media size</span>
                     </div>
                  </div>
               </div>
            </div>
         </section>

         <section class="highlights-section">
            <h2 class="section-heading">Recap highlights</h2>
            <p class="section-subtitle">
               Run local analyzers to generate inspectable, non-AI summaries of
               your Snapchat history.
               <router-link to="/summary">Open the full narrative</router-link>
            </p>
         </section>

         <section class="friends-section">
            <h2 class="section-heading">Most messaged friends</h2>
            <p v-if="isLoadingStats" class="section-subtitle">Loading...</p>
            <div v-else-if="stats?.topFriends?.length" class="friends-grid">
               <div
                  v-for="(friend, index) in stats.topFriends.slice(0, 4)"
                  :key="index"
                  class="card friend-card"
               >
                  <div class="friend-avatar">
                     {{
                        (friend.displayName || friend.username)
                           .charAt(0)
                           .toUpperCase()
                     }}
                  </div>
                  <div class="friend-info">
                     <h3 class="friend-name">
                        {{ friend.displayName || friend.username }}
                     </h3>
                     <p class="friend-stats">
                        {{ formatNumber(friend.totalMessages) }} messages
                        &middot; {{ formatNumber(friend.sentMessages) }} sent
                     </p>
                  </div>
               </div>
            </div>
            <p v-else class="section-subtitle">No chat data found.</p>
         </section>

         <section class="card export-section">
            <div class="export-content">
               <div class="export-icon" aria-hidden="true">↗</div>
               <div class="export-text">
                  <h3 class="export-title">Ready to export metadata</h3>
                  <p class="export-description">
                     Download a JSON bundle of the normalized metadata,
                     diagnostics, and computed stats.
                  </p>
               </div>
               <router-link to="/export" class="btn btn-primary">
                  Export JSON
               </router-link>
            </div>
         </section>
      </div>
   </div>
</template>

<style scoped>
.page-header {
   display: flex;
   justify-content: space-between;
   align-items: flex-start;
   margin-bottom: var(--space-xl);
   gap: var(--space-md);
   flex-wrap: wrap;
}

.page-subtitle {
   color: var(--text-soft);
   margin-top: 12px;
   max-width: 640px;
}

.dashboard-nav {
   display: flex;
   gap: 12px;
}

.stats-section {
   margin-bottom: var(--space-2xl);
}

.stats-grid {
   display: grid;
   grid-template-columns: repeat(4, 1fr);
   gap: var(--space-md);
}

.hero-strip {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 18px;
   margin-bottom: var(--space-2xl);
   background:
      radial-gradient(
         circle at top left,
         rgba(243, 203, 69, 0.22),
         transparent 32%
      ),
      rgba(255, 251, 245, 0.92);
}

.hero-strip-copy h2 {
   margin: 8px 0;
   font-size: clamp(1.4rem, 2.8vw, 2.2rem);
}

.hero-strip-copy p {
   color: var(--text-soft);
   max-width: 760px;
}

.strip-label {
   font-size: 0.78rem;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: var(--secondary);
}

.section-heading {
   font-size: 1.25rem;
   font-weight: 600;
   margin-bottom: var(--space-md);
}

.section-subtitle {
   color: var(--text-soft);
   margin-bottom: var(--space-lg);
}

.timeline-section {
   margin-bottom: var(--space-2xl);
}

.timeline-card {
   padding: var(--space-xl);
}

.timeline-content {
   display: flex;
   flex-direction: column;
   gap: var(--space-lg);
}

.timeline-range {
   display: flex;
   align-items: center;
   gap: var(--space-md);
}

.range-point {
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: var(--space-xs);
}

.range-date {
   font-weight: 600;
   color: var(--text-h);
   font-size: 0.9rem;
}

.range-label {
   font-size: 0.75rem;
   color: var(--text-soft);
}

.range-line {
   flex: 1;
   height: 2px;
   background: linear-gradient(to right, var(--secondary), var(--accent));
   min-width: 100px;
}

.timeline-stats {
   display: flex;
   justify-content: space-around;
   padding-top: var(--space-lg);
   border-top: 1px solid var(--border-subtle);
}

.timeline-stat {
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: var(--space-xs);
}

.timeline-stat .stat-value {
   font-size: 1.5rem;
   font-weight: 700;
   color: var(--text-h);
}

.timeline-stat .stat-label {
   color: var(--text-soft);
}

.highlights-section {
   margin-bottom: var(--space-2xl);
}

.highlights-grid {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: var(--space-md);
}

.friends-section {
   margin-bottom: var(--space-2xl);
}

.friends-grid {
   display: grid;
   grid-template-columns: repeat(4, 1fr);
   gap: var(--space-md);
}

.friend-card {
   display: flex;
   align-items: center;
   gap: var(--space-md);
}

.friend-avatar {
   width: 56px;
   height: 56px;
   display: flex;
   align-items: center;
   justify-content: center;
   background: linear-gradient(
      145deg,
      var(--accent-soft),
      rgba(255, 255, 255, 0.72)
   );
   border-radius: 18px;
   font-size: 1.4rem;
   font-weight: 700;
}

.friend-name {
   font-size: 1.05rem;
}

.friend-stats {
   color: var(--text-soft);
   font-size: 0.9rem;
}

.export-section {
   margin-top: var(--space-2xl);
   background:
      linear-gradient(
         135deg,
         rgba(31, 105, 88, 0.08),
         rgba(243, 203, 69, 0.14)
      ),
      rgba(255, 251, 245, 0.9);
}

.export-content {
   display: flex;
   align-items: center;
   gap: var(--space-lg);
   flex-wrap: wrap;
}

.export-icon {
   width: 56px;
   height: 56px;
   display: grid;
   place-items: center;
   border-radius: 18px;
   background: rgba(255, 255, 255, 0.7);
   font-size: 1.6rem;
}

.export-text {
   flex: 1;
}

.export-description {
   color: var(--text-soft);
}

@media (max-width: 900px) {
   .hero-strip {
      flex-direction: column;
      align-items: flex-start;
   }

   .stats-grid,
   .friends-grid {
      grid-template-columns: repeat(2, 1fr);
   }

   .highlights-grid {
      grid-template-columns: 1fr;
   }
}

@media (max-width: 640px) {
   .page-header,
   .dashboard-nav,
   .export-content,
   .timeline-range,
   .timeline-stats {
      flex-direction: column;
      align-items: flex-start;
   }

   .stats-grid,
   .friends-grid {
      grid-template-columns: 1fr;
   }

   .timeline-stat,
   .range-point {
      align-items: flex-start;
   }
}
</style>
