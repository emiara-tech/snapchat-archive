# Phase 3. Connect media, messages, and overlays

This spec implements Phase 3 in [MASTERPLAN.md](../../MASTERPLAN.md). It consumes the normalized entity and source contracts in [phase-2.md](phase-2.md). [CONTEXT.md](../../CONTEXT.md) defines media links and composed media. [docs/visualization.md](../../docs/visualization.md) controls how uncertain relationships appear in views. [docs/export-destinations.md](../../docs/export-destinations.md) controls later export policy for original and composed files.

## User value

A photo can reveal the exchange around it, and a message can open its available photo or clip. This is the first connected-memory experience. The owner can inspect the evidence behind an attachment and resolve uncertainty without the app inventing who received a photo. Original images and their separate captions or drawings remain available alongside a faithful composed copy.

## Current baseline

Memories derive local main and overlay filenames from a media ID and date. Image and video cards can load local files and display an overlay layer. Chat records retain a `Media IDs` field, but there is no normalized event-to-asset graph, bidirectional context query, four-state resolver, owner confirmation record, or verified overlay transform contract. File existence and a derived path do not prove a conversation recipient or event association.

## Required behavior

### Exact evidence before candidates

Resolve exported explicit media identifiers, supported local paths, and documented reference fields against the current dataset's indexed physical files before generating weaker candidates. Reference parsing handles supported multi-ID formats without treating an entire list as one ID. Keep case/path normalization rules explicit for the actual supported export variants. A partial or malformed identifier cannot use substring matching to attach an unrelated file.

One event may reference several assets, and one logical asset may occur in several events. Preserve each relationship and its originating occurrence. A byte-identical file is not a duplicated event. A physical filename shared by conflicting entries cannot silently select the first. Resolve a documented exact unique match as confirmed. A missing target retains a reference and an unlinked/missing state.

### Four relationship states and a resolver

Store `confirmed`, `inferred`, `ambiguous`, and `unlinked` relationships. Record the match rule and source evidence for every state. Confirmed links distinguish export-supported exact evidence from owner confirmation. Inferred means a supported candidate basis exists but does not prove the attachment. Ambiguous means multiple plausible candidates or conflicting evidence remain. Unlinked means no supported resolved association exists.

Timestamp proximity can produce candidates, with its window and limitations recorded. It never proves who received a photo or turns a candidate into an attachment. Display-name similarity, activity counts, and a model statement cannot confirm a link. Unknown participant identity remains unknown even after an owner confirms an event-to-asset association.

The resolver shows available candidates, original local reference fields, media previews where supported, and the reason for uncertainty. The owner can confirm or reject a proposed association and undo the decision. Store this as a separate local decision referencing stable IDs and evidence revision. It does not rewrite the source event or manufacture export proof. Rejected candidates remain rejected across views; changed evidence invalidates or flags a decision whose targets no longer apply.

### Bidirectional context and missing media

Event lookup returns every confirmed attached asset and its occurrence, with separate inferred/ambiguous candidates. Asset lookup returns every supported context occurrence, event, conversation, period, and status. Inferred candidates remain visually separate until confirmed. Evidence actions open source records and explain the match basis. Switching between event, media, resolver, and conversation context preserves the current dataset and selection.

Missing or unreadable physical files produce a placeholder with the available media kind, recorded date, event/conversation context, and explanation. They do not erase a message or fetch an expired remote URL. Unsupported codecs produce an honest playback state and access to metadata/original file where safe. A failed preview never changes link evidence.

### Overlay reconstruction

Associate original images/videos with separate overlay layers only when their shared identifiers and supported export structure establish the relationship. Missing overlays and an overlay without a base asset remain explicit states. Multiple competing layers or unsupported transforms remain unresolved rather than silently choosing.

Represent the supported canvas dimensions, placement, scaling, rotation, alpha, orientation, ordering, and timing where supplied or proven by the export format. Do not guess a transform merely to fill the viewer. A supported same-canvas overlay can use its documented normalized full-frame placement. Original orientation and video aspect ratio follow their supported decoding metadata. Unsupported animated or timed overlays remain identified as unsupported rather than becoming a static claim about the original appearance.

Render local composed previews from the original and supported layers. Keep originals, layers, and composed media separate. Both viewer and later export composition consume the same versioned composition contract. Compare the result against the individual layers with synthetic reference media that makes placement and alpha errors visible. Videos retain original audio and chronology; a viewer overlay cannot silently become a lossy rewritten video.

Composing an export requires a later explicit policy for supported media, missing layers, metadata, and format. This phase provides the reproducible inputs and preview; it does not imply every video can be flattened or every destination accepts it.

## Interface and data contracts

| Contract | Required fields and rules |
| --- | --- |
| Media reference token | Original sanitized reference, parsed identifier/path, source record ID, supported parser rule/version, and invalid-reference reason. |
| Media link | Stable ID, context/event ID, logical asset and occurrence IDs where resolved, status, match method/version, evidence references, candidate IDs, and missing/conflict reason. |
| Owner association decision | Stable link/candidate IDs, dataset/evidence revision, confirm/reject action, previous decision for undo, and local timestamp. Owner confirmation is distinct from export confirmation. |
| Context lookup | Current dataset/query revision, selected event or asset ID, all occurrence/context IDs, their link status, coverage, and stable navigation/evidence targets. |
| Overlay association | Base asset occurrence, layer occurrences, source evidence, association state, supported composition capability, and missing/ambiguous reasons. |
| Composition | Versioned original/layer IDs, canvas and orientation, supported transforms/order/timing, render dimensions, supported output capabilities, and evidence basis. No arbitrary executable code or external asset URL. |
| Composed preview | Current revision, composition version, bounded local media handle, original/layer references, capability state, and explicit release ownership. |

## Failure and privacy states

All link resolution and composition use local indexed evidence. An asset with no event stays available in the library/inventory; it does not acquire an invented conversation. A known metadata reference with no file stays in its conversation as missing media. Ambiguity stays visible until supported evidence or an owner decision resolves it.

Archive strings render inertly and cannot choose a network URL, path outside the archive namespace, script, shader, or fetch. Preview buffers and URLs follow Phase 0 session cleanup. Replacement cancels link and composition work, and stale results cannot attach to another dataset. Decisions and composed previews are private derivatives and stay out of server logs and committed public examples.

## Acceptance criteria

1. P3-01. Synthetic exact-reference fixtures resolve every supported image, video, audio, sticker, and attachment reference to its correct indexed occurrence or explicit unsupported/missing state.
2. P3-02. One event with several assets and one asset in several events retain every occurrence. Repeated asset bytes do not collapse genuine events. Bidirectional lookup returns the same supported relationships.
3. P3-03. Duplicate identifiers, conflicting paths, prefix collisions, missing IDs, missing files, and malformed multi-ID fields never attach an unrelated file. Ambiguous exact candidates remain ambiguous.
4. P3-04. A time-near candidate remains inferred or ambiguous, with its basis visible. It does not establish a recipient or appear as a confirmed attachment. A model or name similarity cannot confirm it.
5. P3-05. Every relationship, including unlinked and missing, exposes its match basis and correct local source evidence. Moving between media, event, resolver, and context preserves that evidence and selection.
6. P3-06. Confirm, reject, and undo use separate local decisions. Their effects persist across views for the same dataset, preserve original source bytes, and identify owner confirmation separately from export-supported confirmation.
7. P3-07. A changed or replaced dataset cannot apply a stale owner decision or link worker result to different evidence. Missing targets produce a visible invalid/needs-review state.
8. P3-08. Synthetic original/layer fixtures verify placement, scale, alpha, orientation, layer ordering, and supported video presentation. The composed preview agrees with the reference pixels within a declared rendering tolerance.
9. P3-09. Missing bases/layers, competing overlays, unknown transforms, unsupported animation, and unavailable codecs remain explicit states. The app preserves originals and does not claim unsupported flattened media.
10. P3-10. Missing-media placeholders preserve available event and conversation metadata. Media opening and composition make no remote media request, even when the original record includes an expired URL.
11. P3-11. Repeated opening, closing, cancellation, and archive replacement release preview URLs/buffers. Costly composition is bounded and leaves navigation and cancellation usable.
12. P3-12. The exact-match, ambiguous, unlinked, owner-confirmed, missing-media, and overlay journeys pass in a desktop browser, including keyboard evidence navigation and reduced motion.

## Verification plan

Use tiny synthetic images with colored corner markers, transparent layers, known orientation, and fixed expected composite pixels. Use a small synthetic video with known aspect ratio, frame timing, and audio. Hand-author event/asset references and expected graph edges separately from the resolver implementation. Include many-to-many relationships, collisions, rejected candidates, stale revisions, and unavailable files/codecs.

Run pnpm build and unit checks plus browser verification for selection in both directions, source evidence, confirm/reject/undo, missing placeholders, and overlay comparison. Inspect network traffic while opening each supported local media type. Verify cleanup with repeated viewer cycles and replacement. Private archive inspection can establish additional export structures, but derived examples stay private and supported behavior receives synthetic regression fixtures.

## Implementation slices and prerequisites

1. Explicit reference parser, exact resolution, four-state graph, and bidirectional context queries.
2. Reviewable candidate resolver with separate confirm/reject/undo decisions.
3. Supported overlay association/composition contract and local preview comparison.
4. Missing-media, codec, resource cleanup, and connected browser verification.

All slices are locally achievable after Phase 2 and require no AI provider. New identifier, overlay, or codec support requires structural evidence and a repeatable synthetic fixture. If the archive does not establish a transform or relationship, its unresolved state is the correct supported result. Full conversation browsing belongs to Phase 4, and portable composed exports belong to Phase 6; their later work cannot waive this phase's evidence gates.
