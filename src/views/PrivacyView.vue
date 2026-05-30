<template>
   <div class="page">
      <div class="container container-narrow">
         <header class="page-header">
            <span class="eyebrow">Privacy and framing</span>
            <h1>Why this is designed like a goodbye tool.</h1>
            <p class="page-subtitle">
               The site is positioned around local review, recap, and clean
               export. The product promise only works if the archive stays under
               the user’s control.
            </p>
         </header>

         <section class="privacy-section">
            <h2>What we collect</h2>
            <p>
               <strong
                  >Nothing in this concept flow is meant to be
                  collected.</strong
               >
               Goodbye Snapchat is framed as a client-only experience that opens
               the archive locally and keeps the session in the browser.
            </p>
         </section>

         <section class="privacy-section">
            <h2>How it works</h2>
            <p>
               The import, recap, review, and export screens are all designed
               around browser-side handling of the takeout so the archive does
               not need to bounce through a hosted backend.
            </p>
            <ul>
               <li>No account creation requirement</li>
               <li>No analytics framing in the product copy</li>
               <li>No server-side storage in the intended flow</li>
               <li>
                  No reason to hand your takeout to a third party just to read
                  it
               </li>
            </ul>
         </section>

         <section class="privacy-section">
            <h2>Recap logic</h2>
            <p>
               The analysis language is intentionally conservative. It surfaces
               simple patterns from parsed JSON and avoids claiming more than
               the data supports.
            </p>
            <p>
               If a summary feels wrong, trust the raw export more than the
               summary layer. The archive diagnostics should always remain
               visible.
            </p>
         </section>

         <section class="privacy-section">
            <h2>Data lifecycle</h2>
            <ul>
               <li><strong>Import:</strong> Open the takeout zip locally</li>
               <li>
                  <strong>Session:</strong> Review metadata and diagnostics
                  in-browser
               </li>
               <li>
                  <strong>Export:</strong> Download normalized JSON metadata
               </li>
               <li>
                  <strong>Close:</strong> End the session without leaving a
                  cloud copy behind
               </li>
            </ul>
         </section>

         <section class="privacy-section">
            <h2>Project angle</h2>
            <p>
               The product direction is simple: Snapchat exports should be
               portable, legible, and honest about what has and has not been
               parsed.
            </p>
         </section>

         <section class="about-section">
            <h2>About the project</h2>
            <p>
               Goodbye Snapchat was built around a stronger narrative than
               “archive viewer.” It is meant to feel like a deliberate off-ramp
               from a platform era that mattered.
            </p>
            <p>
               That means detection first, review second, export third. The
               interface should help people understand what is in the archive
               before it promises media migration.
            </p>
            <p class="about-tagline">
               &quot;Load the zip. Verify the structure. Export what was
               parsed.&quot;
            </p>
         </section>

         <section class="contact-section card">
            <h2>Design principles</h2>
            <p>
               Local-first by default. No account trap. Clear diagnostics. A
               visual tone that treats the archive like a personal chapter, not
               just a dataset.
            </p>
         </section>
      </div>
   </div>
</template>

<style scoped>
.container-narrow {
   max-width: 700px;
}

.page-header {
   text-align: center;
   margin-bottom: var(--space-2xl);
}

.page-header h1 {
   margin: 16px 0 12px;
}

.page-subtitle {
   color: var(--text-soft);
}

.privacy-section {
   margin-bottom: var(--space-xl);
   padding-bottom: var(--space-xl);
   border-bottom: 1px solid var(--border);
}

.privacy-section h2 {
   font-size: 1.25rem;
   margin-bottom: var(--space-md);
}

.privacy-section p {
   color: var(--text-soft);
   line-height: 1.7;
   margin-bottom: var(--space-md);
}

.privacy-section ul {
   list-style: none;
   padding: 0;
   margin: 0;
}

.privacy-section li {
   color: var(--text-soft);
   padding: var(--space-sm) 0;
   padding-left: var(--space-lg);
   position: relative;
}

.privacy-section li::before {
   content: "✓";
   position: absolute;
   left: 0;
   color: var(--success);
}

.privacy-section li strong {
   color: var(--text-h);
}

.about-section {
   margin-bottom: var(--space-xl);
   padding-bottom: var(--space-xl);
   border-bottom: 1px solid var(--border);
}

.about-section h2 {
   font-size: 1.25rem;
   margin-bottom: var(--space-md);
}

.about-section p {
   color: var(--text-soft);
   line-height: 1.7;
   margin-bottom: var(--space-md);
}

.about-tagline {
   font-family: var(--font-serif);
   font-size: 1.25rem;
   font-style: italic;
   color: var(--text-h) !important;
   margin-top: var(--space-lg);
}

.contact-section h2 {
   font-size: 1.25rem;
   margin-bottom: var(--space-md);
}

.contact-section p {
   color: var(--text-soft);
   line-height: 1.7;
}
</style>
