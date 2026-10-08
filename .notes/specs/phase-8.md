# Phase 8: A connected immersive observatory

## User value and full gate

An owner can travel through their imported years, understand a recorded relationship, and reopen the memory behind an observation. Spatial arrangement should answer a question the owner already has. Every meaningful object has an explanation and a route to its evidence.

The full phase requires the timeline, relationship constellation, memory gallery, language landscape, and map room. The scenes must look distinct, share selection, open correct evidence, meet recorded desktop performance budgets, and recover after GPU failure. A working timeline is a slice, not completion of the phase. The controlling sources are [MASTERPLAN.md](../../MASTERPLAN.md#phase-8-the-immersive-observatory) and [docs/visualization.md](../../docs/visualization.md).

## Current baseline and prerequisites

The Vue/Vite application imports archives and resolves local Memories media. `src/lib/computeStats.ts` and the analyzers calculate a few observations. `src/router/index.ts` has no observatory route, and `package.json` has no Three.js dependency. There is no scene renderer, shared reading mode, or performance evidence for a 3D experience.

Phases 2, 5, and 7 supply stable source references, an effective curated collection, `ArchiveQuery`, and versioned observations. Phase 3 supplies supported media links. Develop the renderer and synthetic scene fixtures before those phases finish, but do not manufacture real-archive relationships to populate it.

## Art direction and interaction

Build a desktop archive observatory with warm paper-colored interfaces, dark ink, restrained brass accents, soft architectural lighting, and procedural geometry. Real photos provide the strongest personal color. A timeline appears as a curved activity ribbon, the constellation as a suspended instrument, and the gallery as framed local memories. The language room uses a labelled terrain; the map room uses a locally drawn coordinate plane or globe. These are reproducible scene implementations rather than remote assets or presumed native AI mesh output.

HTML carries navigation, filters, readable labels, legends, source inspection, and decisions. Canvas provides spatial exploration. Keep a stable workspace bar with the active collection, year, participant, coverage, reading-mode switch, and return action. Scene transitions preserve context. Camera movement changes the view, never the effective selection.

Do not start sound automatically. An explicit sound setting may enable locally supplied effects. Keep settings accessible without entering the canvas. Reduced motion disables automatic travel, parallax, continuous particles, and animated lighting. Selection uses an immediate view change when motion is disabled.

## Data and scene contracts

1. Every render request captures dataset, query, review, and calculation revisions, workspace timezone, effective selection, and coverage. Worker results and scene proposals from an older request cannot replace newer results.
2. Scenes consume Phase 7 observations. Numeric labels resolve metric identifiers into deterministic values. A renderer or model cannot supply its own count, denominator, unit, or inferred personal conclusion.
3. Scene items carry stable event, conversation, participant, asset, or observation identifiers. Picking and the HTML reading mode resolve those same identifiers. Decorative geometry has no fabricated archive identifier and does not appear in the evidence list.
4. A source panel displays an observation's definition and selected population, then its contributing records. A media selection shows the original asset, supported overlays, timestamp status, link evidence, and conversation context where known. An inferred association retains its evidence state.
5. Excluded items do not appear as thumbnails, labels, examples, links, or cached interpretations. Explicit reconsideration belongs to the review interface.
6. A versioned `SceneSpec` accepts only approved scene types, existing metric/group/evidence identifiers, bounded layout settings, style presets, and camera intents. Reject executable code, arbitrary markup, shaders, import paths, remote URLs, unknown references, oversized counts or assets, and stale revisions before allocating resources.
7. Invalid, refused, or timed-out model proposals select the deterministic local template. Optional AI planning follows [auth.md](../../auth.md), needs inspected content consent and the owner's funded connection, and has no shared paid fallback. Local scenes remain usable with no AI access.

## Required scene behavior

| Scene | Defined visual meaning | Selection and missing-data behavior |
| --- | --- | --- |
| Timeline landscape | Position means time under the active timezone. Height or width encodes a named recorded-event observation. | Year and month selection update the shared query. Coverage gaps have a separate marking and cannot imply inactivity. Opening a bin shows its exact contributing events. |
| Relationship constellation | Node size encodes a labelled interaction count. Lines represent recorded participation or another explicitly defined relationship. Layout distance has a visible explanation. | A participant or conversation opens its actual history. Distance never claims emotional closeness. Group conversations retain all known participants. |
| Memory gallery | Frames represent selected local media in stated chronological or geographic order. | Opening a frame reveals media and known conversation context. Missing media produces a labelled frame with available metadata. Thumbnails decode on demand. |
| Language landscape | Height represents raw frequency or a named normalized rate for owner-authored vocabulary. | Selecting a term shows count, denominator, tokenizer policy, language filters, and examples. A larger year cannot silently appear to show a stronger preference. |
| Map room | Position represents an available recorded location and its known precision. | A point opens corresponding records and their source location. Unknown locations appear in a separate list. Geographic coordinates never become precise places through an unsupported guess. |

Geospatial calculations and base geometry run locally. Opening the map sends no location, viewport, archive identifier, or media URL to an external map or geocoder. A later external map service needs a separate consent and privacy design before it can be enabled.

## Renderer lifecycle and performance

Use a small scene-controller contract to mount a scene, update a validated selection, focus an item, pause, and dispose. Components do not own duplicate archive calculations. Keep costly layout and aggregation in cancellable workers. Use instanced geometry, distant aggregates, bounded labels, culling, and detail only near the current view. Never decode every archive photo during scene creation.

Detect actual renderer capability. Prefer WebGPU where supported, verify the WebGL 2 path, and provide semantic HTML reading mode without GPU support. Report the backend used in verification. Device loss preserves the archive and selection, attempts a bounded rebuild, then offers reading mode if rebuilding fails. Route exit, archive replacement, and reset dispose geometry, materials, buffers, render targets, bitmaps, video decoders, textures, and owned object URLs. Pause decoration while hidden.

Each scene declares budgets for visible instances, labels, texture bytes, buffers, effects, and worker payloads. Record named desktop hardware, browser, renderer, fixture size, and measured resources. The target on reference hardware is 60 frames per second, control feedback within 100 milliseconds, and 30 frames per second on the reduced-quality path. Test growing fixtures including one million events. Do not call targets measured successes without the corresponding run. Adaptive quality reduces effects and detail before disabling useful controls.

## Acceptance criteria

1. A synthetic import can open all five scenes, with a distinct composition and a visible explanation of every factual encoding.
2. The same effective selection yields the same observations in a scene and its reading mode. Changing year, participant, or review decisions updates every affected scene without moving excluded evidence back into view.
3. Picking a synthetic item and activating its keyboard equivalent open the identical source record. Opening conversation context and returning retain the selected item and filters.
4. Scene labels equal independent fixture values for counts, time bins, vocabulary rates, and locations. Missing coverage cannot appear as measured zero activity.
5. Ambiguous links, absent media, unknown timestamps, sparse years, and unknown locations remain inspectable without invented context.
6. Every unsupported `SceneSpec`, fabricated reference, factual numeric override, remote asset URL, stale response, and resource-limit violation fails validation before rendering. The local template continues to work.
7. WebGPU, forced WebGL 2, unavailable GPU, and simulated device loss preserve selection and useful controls. Actual WebGPU verification remains outstanding if only a fallback backend was exercised.
8. Keyboard selection, reading mode, explicit motion controls, and system reduced-motion settings preserve the entire evidence and curation journey.
9. Large synthetic fixtures meet the declared measured budgets on recorded reference hardware. Repeated scene switches and archive replacement release resources instead of increasing resident media indefinitely.
10. Importing, opening scenes, browsing local media, and using the map create no archive-related external requests. Optional AI work follows the approved packet, account, funding, cancellation, and usage contracts.
11. Synthetic visual checks use a stable seed, fixed camera, and fixed animation time. Resource/selection assertions accompany images; an attractive screenshot cannot establish correct evidence selection.

## Verification and delivery slices

Use `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e`. Add meaningful boundary checks for scene validation, revision rejection, selection resolution, and disposal. Browser checks cover all renderer paths, keyboard operation, reduced motion, and network requests. Generate large archives during verification rather than committing large binaries. Public screenshots and benchmarks use synthetic content.

Deliver a local timeline with a source panel and reading mode first. Add constellation and gallery using the same selection contract, then language and map rooms. Complete capability and benchmark checks across all scenes before passing the full gate. Renderer assets and local interactions need no provider access. Optional runtime scene proposals require Phase 1; absence of that access cannot block deterministic scene delivery or be hidden behind a simulated AI result.
