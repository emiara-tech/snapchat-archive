# A vision alignment
Make sure that the current UX/UI of the website generally fits with the values and ideas that are outlined in [VISION.md](./VISION.md).

done when:
[] - all images and text fit the plan and vision.
[] - all prototype wording is removed.

next step:
alignment 


# A FLOW alignment

Make sure that the ux/ui aligns with the intended workflow. The "meat" so to speak of the application should start to appear.

done when:
[] for every step of the indended flow we can point to where in the application it is addressed.



# HomeView.vue — copy alignment (from VISION + FLOW review)

The landing page is structurally sound but the copy is generic and mostly speaks to one user type (the Escapee). Four actionable items:

[x] **Hero subtitle** — Rewrite to address all three personas (Escapee, Eulogist, Curious). Lead with nostalgia/forgotten-memory recognition, end with the exit. Currently "You leave Snapchat." cuts off the Eulogist and Curious entirely.

[x] **Secondary CTA for FLOW step 2** — Add a small link below the "Open archive" button for users who don't have their archive yet (links to the get-your-data page). Without it, first-time visitors without an archive have no path forward.

[] **Preview card headline** — Replace "What you'll see" with copy that signals *surprise and scale* — the "Social Media Wrapped" / forgotten-memory-recognition moment that VISION calls the north star.

[] **Two-endings teaser** — Add a short line at the bottom of the how-it-works section hinting at the "further reading" ending (FLOW step 9) to give the Curious user a reason to continue.


# ImportView.vue — copy alignment (from VISION + FLOW review)

The import page is functional but reads like a dev tool, not a threshold moment. The vision calls this screen the point where you "open a personal memories box buried in the yard when you were 8." Five actionable items:

[x] **Eyebrow + H1** — Replace "Import your takeout" / "Drop the archive zip and start the goodbye flow." The eyebrow should name the moment (e.g. "Your archive, your browser"), the H1 should signal the crossing — you are about to open your past, not upload a zip file.

[x] **Page subtitle** — Remove all technical implementation detail ("detects the export structure", "reads metadata in your browser"). Replace with a single line that names the privacy guarantee as a value, not a feature: everything stays local, no one else sees it.

[x] **"What this session is for" sidebar card** — Rewrite the three bullets to speak to all three personas instead of listing technical capabilities. Escapee: clean export path. Eulogist: revisit before you leave. Curious: understand the shape of your digital life.

[x] **"Where to get the zip" card** — Make the steps Snapchat-specific. "Open the account settings for the service" is generic placeholder copy. Name Snapchat and describe the exact path (Account > Privacy > My Data).

[x] **Footnote** — "Detected files, metadata review, and a truthful JSON export" is a pipeline description. Replace with a one-liner that hints at the emotional arc ahead — what the user is about to feel, not what the code is about to do.
