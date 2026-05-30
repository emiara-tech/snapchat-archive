<template>
   <div class="home-page">
      <section class="hero">
         <div class="container hero-grid">
            <div class="hero-copy">
               <span class="eyebrow">Free software · Local-first</span>
               <h1>Your archive, your machine.</h1>
               <p class="hero-subtitle">
                  Drop your Snapchat takeout zip. Inspect metadata, run local
                  summaries, and export JSON. Nothing leaves your browser.
               </p>
               <div class="hero-actions">
                  <router-link to="/import" class="btn btn-primary"
                     >Open archive</router-link
                  >
               </div>
            </div>

            <div class="hero-preview card">
               <div class="preview-topline">
                  <span class="preview-kicker">What you'll see</span>
                  <span class="preview-chip">Your browser only</span>
               </div>

               <div class="preview-stats">
                  <article>
                     <strong>564</strong>
                     <span>memories</span>
                  </article>
                  <article>
                     <strong>9.2 GB</strong>
                     <span>local fixture</span>
                  </article>
                  <article>
                     <strong>JSON</strong>
                     <span>export</span>
                  </article>
               </div>

               <div class="preview-story">
                  <p class="story-label">Your recap</p>
                  <h2>
                     Detected files first: Memories metadata, chat history, snap
                     history, story history, and archive diagnostics.
                  </h2>
               </div>

               <div class="preview-rail">
                  <div class="rail-block">
                     <span class="rail-title">Review</span>
                     <p>Filter Memories metadata by year and type.</p>
                  </div>
                  <div class="rail-block accent">
                     <span class="rail-title">Export</span>
                     <p>Download normalized metadata and diagnostics.</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      <section class="section how-it-works">
         <div class="container">
            <div class="flow-steps">
               <div class="flow-step">
                  <span class="step-num">1</span>
                  <h3>Drop your zip</h3>
                  <p>Snapchat Settings → My Data → Submit Request</p>
               </div>
               <div class="flow-step">
                  <span class="step-num">2</span>
                  <h3>Inspect locally</h3>
                  <p>
                     Metadata, stories, chats, and diagnostics in your browser
                  </p>
               </div>
               <div class="flow-step">
                  <span class="step-num">3</span>
                  <h3>Export clean</h3>
                  <p>JSON metadata now. Media packaging later.</p>
               </div>
            </div>

            <div class="trust-line">
               <div class="trust-item">
                  <span>No account</span>
                  <span>No server</span>
                  <span>No tracking</span>
               </div>
               <p>
                  Free as in freedom. Runs entirely in your browser. Your data
                  never leaves your machine.
               </p>
            </div>
         </div>
      </section>
   </div>
</template>

<style scoped>
.hero {
   padding: 154px 0 48px;
}

.hero-grid {
   display: grid;
   grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
   gap: 36px;
   align-items: center;
}

.hero-copy h1 {
   max-width: 11ch;
   margin: 18px 0;
}

.hero-subtitle {
   max-width: 540px;
   font-size: 1.08rem;
   color: var(--text-soft);
}

.hero-actions {
   display: flex;
   gap: 14px;
   flex-wrap: wrap;
   margin: 28px 0;
}

.hero-preview {
   padding: 24px;
   background:
      linear-gradient(
         180deg,
         rgba(255, 255, 255, 0.78),
         rgba(255, 248, 236, 0.9)
      ),
      linear-gradient(135deg, rgba(243, 203, 69, 0.18), rgba(31, 105, 88, 0.08));
}

.preview-topline {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 18px;
}

.preview-kicker,
.story-label,
.rail-title {
   font-size: 0.78rem;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: var(--text-soft);
}

.preview-chip {
   padding: 8px 12px;
   border-radius: 999px;
   background: var(--secondary-soft);
   color: var(--secondary);
   font-size: 0.82rem;
   font-weight: 700;
}

.preview-stats {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: 12px;
}

.preview-stats article,
.rail-block {
   padding: 14px;
   border-radius: 20px;
   background: rgba(255, 255, 255, 0.68);
   border: 1px solid var(--border);
}

.preview-stats strong {
   display: block;
   font-size: 1.45rem;
   color: var(--text-h);
}

.preview-stats span,
.rail-block p {
   color: var(--text-soft);
   font-size: 0.84rem;
}

.preview-story {
   display: flex;
   flex-direction: column;
   gap: 10px;
   margin: 18px 0;
   padding: 20px;
   border-radius: 24px;
   background: #171411;
   color: #fff8eb;
}

.preview-story h2 {
   font-size: clamp(1.2rem, 2.5vw, 1.6rem);
   color: inherit;
}

.preview-rail {
   display: grid;
   gap: 12px;
}

.rail-block.accent {
   background: color-mix(in srgb, var(--accent-soft) 80%, white);
}

.rail-block.accent .rail-title,
.rail-block.accent p {
   color: var(--text-h);
}

.section {
   padding: var(--space-3xl) 0;
}

.how-it-works {
   padding-top: 64px;
}

.flow-steps {
   display: grid;
   grid-template-columns: repeat(3, 1fr);
   gap: 24px;
   margin-bottom: 48px;
}

.flow-step {
   text-align: center;
}

.step-num {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 48px;
   height: 48px;
   margin-bottom: 16px;
   border-radius: 50%;
   background: var(--secondary-soft);
   color: var(--secondary);
   font-size: 1.25rem;
   font-weight: 700;
}

.flow-step h3 {
   margin-bottom: 8px;
}

.flow-step p {
   color: var(--text-soft);
   font-size: 0.92rem;
}

.trust-line {
   text-align: center;
   padding-top: 32px;
   border-top: 1px solid var(--border);
}

.trust-item {
   display: flex;
   justify-content: center;
   gap: 32px;
   margin-bottom: 16px;
}

.trust-item span {
   font-weight: 700;
   color: var(--text-h);
}

.trust-line > p {
   color: var(--text-soft);
   font-size: 0.95rem;
   max-width: 480px;
   margin: 0 auto;
}

@media (max-width: 960px) {
   .hero-grid {
      grid-template-columns: 1fr;
   }
}

@media (max-width: 720px) {
   .hero {
      padding-top: 128px;
   }

   .preview-stats,
   .flow-steps {
      grid-template-columns: 1fr;
   }
}
</style>
