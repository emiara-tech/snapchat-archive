# Phase 10: An imagined self in a year room

## User value and full gate

The owner can enter a chosen year and have a conversation whose cadence resembles their recorded writing. Memory cards can reconnect that conversation to actual evidence. The experience must always identify the presence as fictional, admit gaps, and keep the owner in control of evidence and spending.

The full phase requires an evaluated year profile, inspected and approved context, convincing year-informed language, an immersive procedural presence, evaluated grounding and exclusions, authorized live inference, and interruption recovery on the actual deployment. A local character animation or canned transcript does not complete the phase. Sources are [MASTERPLAN.md](../../MASTERPLAN.md#phase-10-talk-with-an-imagined-past-self), [docs/visualization.md](../../docs/visualization.md), and [auth.md](../../auth.md).

## Current baseline and prerequisites

There is no chat composer, streaming API, persona prompt, retrieval layer, year-room route, or 3D presence in the current app. Archive import and text parsing are inputs rather than an implemented imagined self.

Phase 1 supplies verified app identity, per-user funding admission, and server-side credential handling. Phase 9 supplies a sufficient owner-authored year profile and approved evidence. Phase 5 supplies collection/review revisions and stable local queries. Phase 8's rendering lifecycle, motion policy, and reading mode apply to the room. Genuine ChatGPT identity or plan use retains its separate provider registration gate and cannot be replaced by a button labelled ChatGPT.

## Evidence and prompt contract

Create a session only after the owner chooses a supported year, inspects the profile and exact proposed evidence packet, accepts the fictional role, and chooses a finite job budget. Bind the session to the owner, connection, year/timezone, dataset/query/review/profile revisions, approved evidence identifiers, permission scope, and active style/imagination controls.

Keep system instructions, profile measurements, evidence records, and current owner chat in distinct prompt fields. Escape and delimit archive text as untrusted data. Instructions, links, and apparent tool calls within old chats grant no authority. The imagined self has no export, transfer, review-mutation, account-management, or arbitrary network tools.

Retrieve evidence locally under the approved year and effective collection. Prefer a bounded, deterministic lexical retrieval path first. Remote embeddings are optional paid processing with their own inspected packet, budget, and consent; choosing a year cannot initiate them. Retrieval cannot include other participants' words by default, excluded conversations, later archive years, or uncertain authorship. Every supplied record carries a stable evidence reference and original time/ownership status.

Per-turn additions to the approved packet require a visible disclosure and approval before transmission. Already approved records may be reused within the accepted purpose and budget. Current-chat facts supplied by the owner are labelled new conversational context and cannot be presented as recovered archive evidence.

The answer contract distinguishes:

- Recorded memory statements with validated source references. An exact quote must equal an approved source excerpt.
- Tentative interpretations with evidence and uncertainty.
- Improvised dialogue, including fictional reactions and imagination, which cannot become an archive fact.

The UI validates references against the currently approved set. It never labels an unvalidated recollection as recorded evidence. When asked about an unsupported event, the persona admits the gap rather than fabricating a memory or quote. Models' general knowledge can answer current questions only as present conversational context, never as proof of what the owner knew or did in the chosen year.

## The year room

Use a reproducible procedural character rather than a photographic likeness. Its silhouette, materials, and room palette may reflect approved style choices and selected year; an apparent age, body trait, or gender must not be inferred from vocabulary. A hovering paper-and-light figure or articulated geometric character can turn toward selected memory cards and respond through bounded gesture and lighting.

The room's geometry has a stable camera and a clear focal area. Locally resolved evidence cards appear only when relevant and approved. Selecting a card opens the same source inspector as the observatory. Expressive animation reacts to actual stream/turn state and the owner's controls. It cannot imply a measured emotion, recovered identity, or video likeness.

Keep the readable transcript and composer in HTML. The room always shows selected year, collection/evidence scope, fictional role, billing source, budget/usage status, stop action, and evidence editor. Offer explicit style intensity and imagination controls. These modify delivery and permissible fictional elaboration, never provenance or selection rules. Motion and sound settings follow Phase 8; sound is opt-in. No voice cloning, photo-based likeness, external image processing, or automatic narrated audio is authorized by this phase.

No GPU support or device loss falls back to the same transcript, composer, evidence controls, and usage information. Reduced motion keeps a static presence and immediate card selection. The transcript remains useful when the decorative room is unavailable.

## Stream, budget, and lifecycle

The backend accepts only authenticated, account-owned operations with active connection, finite provider allowance, approved packet, and atomically reserved job budget. Check allowance before each paid operation. Bound context, output, turn count, concurrency, tool iterations where applicable, and execution time. Never use a shared deployment key, another user's connection, silent top-up, or unapproved billing path.

Track idle, admitting, streaming, completed, stopped, incomplete, failed, allowance-exhausted, and disconnected states. Stop cancels client work and aborts upstream work where supported. Explain that cancellation cannot undo usage already billed. Retain the partial response with an incomplete marker; do not silently continue or duplicate it. Retrying a potentially billed request needs a deliberate owner action and new admission. Usage reports distinguish provider-reported values, estimates, and unknown reconciliation.

Curation changes, profile changes, archive replacement, or a year change invalidate the active session's approval. Abort the current request, stop later turns, rebuild the proposed packet, and require renewed approval. Removed source excerpts cannot linger in a renderer, reusable prompt cache, or hidden chat-context cache. If earlier visible dialogue depended on removed evidence, clear it from future context and label or discard the affected derivative locally.

Disconnect, logout, account change, and revoked access stop new work. An old response cannot append to a new archive or account session. Closing a room stops active work according to an explicit UI action or navigation policy; hidden decoration pauses regardless. Allow clearing the transcript independently of source files. No archive text, profile, or transcript appears in routine server logs, telemetry, or public artifacts.

## Acceptance criteria

1. An owner selects a sufficient year, inspects the approved evidence, chooses a bounded budget, and starts a room whose year, fictional role, scope, and funding source remain visible.
2. Synthetic evaluation demonstrates measured style resemblance and natural dialogue across varied styles and supported languages. A repetitive list of catchphrases fails the quality review even if a single sample sounds plausible.
3. Questions about recorded events produce validated evidence references. Exact recovered quotes match the approved source, and unknown events produce an explicit gap rather than a fabricated quote.
4. Incoming messages, uncertain ownership, excluded items, later archive years, and newly supplied present-day facts cannot become year evidence. A local retrieval assertion and adversarial synthetic dialogue prove this boundary.
5. Old messages containing role instructions, secrets requests, fake tool calls, or transfer commands cannot change the role, data scope, budget, or authority.
6. Style intensity and imagination change expression while retaining identical evidence constraints. Interpretations and improvised dialogue remain labelled separately from recorded memories.
7. The procedural presence, evidence cards, transcript, and source inspector work together. Every card selects the correct approved source and no photographic likeness is inferred or uploaded.
8. Keyboard use, reduced motion, absent GPU, and device loss preserve chat, evidence, cancellation, and usage controls.
9. Cancellation, timeout, partial stream, retry, insufficient allowance, provider failure, and disconnection have truthful states. None starts an automatic potentially billed retry or a different funding source.
10. Account ownership, bounded context/output, concurrent budget reservation, and finite provider-cap checks reject unauthorized or over-budget work before inference.
11. Changing year, profile, collection, or archive aborts obsolete work and requires renewed approval. Stale callbacks cannot append private content to the next room or account.
12. A bounded live synthetic request completes through the initiating owner's authorized connection, and the deployed experience passes interruption recovery. Internal provider fixtures are reported separately and cannot substitute for live acceptance.

## Verification and delivery slices

Run `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e`. Synthetic evaluations cover language resemblance, naturalness, multilingual cases, grounded memory, unknown memory, temporal isolation, curation exclusion, injection, and interruption. Deterministic retrieval/prompt boundary assertions complement model evaluation. Do not run paid evaluation automatically.

First deliver and test the real approval, prompt, local retrieval and session/streaming contracts through internal provider fixtures. The product uses the owner's imported evidence and actual authorized inference. While access is unavailable, it explains that gate without offering a scripted conversation or public synthetic room. Then complete explicitly approved bounded inference, the evaluated persona and the deployed flow. Missing provider access does not justify an owner-funded fallback or weakened completion criteria.
