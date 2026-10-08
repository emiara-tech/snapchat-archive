# Phase 4: Reconstructed conversations

## User value

The owner can reopen an exchange and recognize its sequence, participants, and available media. An old photo gains meaning when its surrounding conversation is one action away. Missing evidence stays visible rather than becoming an invented memory.

## Baseline and dependencies

The Vue application currently parses `ChatHistory` and `SnapHistory`, but does not provide a conversation browser. `PhotosView.vue` displays Memories records and local media. Reuse the archive session, Pinia lifecycle, and local media components. Consume the normalized dataset from phase 2 and media links from phase 3. Do not reconstruct participant identity from a display name or timestamp proximity.

This phase is local work. App identity, AI, external destinations, and provider registrations are not prerequisites.

## Required behavior

Provide a desktop conversation room with a searchable list and a readable thread. Each conversation shows its known participants, direct/group/unknown kind, recorded date range, available event count, and a safe preview. Conversation identity comes from source context and stable identifiers. Different people with the same display name remain separate. Incomplete participant lists and unknown membership have explicit labels.

Display events in chronological order with stable source-order ties. Events with invalid or absent timestamps have an undated section and retain source order. Day separators, sender grouping, and displayed times use the workspace timezone. Alignment distinguishes proven owner authorship, another participant, and uncertain authorship. Do not label unknown authorship as the owner.

Support text, images, videos, audio, stickers, GIFs, attachments, and recorded system events when the export and browser support them. Unsupported types remain inspectable placeholders. Missing text and missing physical files retain the known event and its context. Confirmed links can appear as reconstructed attachments. Inferred and ambiguous links appear as candidates with their evidence and resolver action. They cannot silently appear as confirmed attachments.

Selecting an attachment opens a focused viewer that retains its conversation, event, timestamp, link state, original, and available overlays. Original and composed views are separate choices. Repeated occurrences of one asset appear at their separate events without duplicating its identity. Closing the viewer restores the thread position and focus.

Support jumps to the first or last recorded event, a selected date/year, a search result, and an event ID from another room. Load the requested event and neighboring context even when it is outside the currently rendered window. A jump that conflicts with filters explains the conflict and offers an explicit filter change. Curation exclusions remain enforced until the owner enters review mode.

Long threads use bounded rendered windows or virtualization. Resolve and decode media on demand. Dispose object URLs and decoded resources when the owning view/session ends. Replacing an archive, changing the selected conversation, or clearing the workspace invalidates pending reads.

Source inspection is a secondary panel. It shows stable IDs, original fields, normalized timestamps, source occurrence, authorship evidence, coverage warnings, and link evidence without making technical fields the primary reading experience.

Render archive text as text. Do not inject its HTML, execute instructions, embed remote resources, or activate unsafe URL schemes. Explicitly opened external links show their destination and never receive archive content automatically.

## Data contracts

Use the phase-2 `ArchiveDataset` with stable participant, conversation, event, asset, and source IDs. Use the phase-3 link state and evidence; preserve one asset to many events and one event to many assets. Existing raw `ChatMessage` fields remain source evidence rather than the UI's identity model.

The navigation intent carries `conversationId`, optional `eventId`, and the current shared query/review revision. The workspace supplies the query from phase 5, selected conversation/event, timezone, and source inspector target. Selection and focus changes must not rewrite source data.

Thread results include ordered event IDs, available participant IDs, coverage, excluded-result counts when review mode allows disclosure, and pagination/window boundaries. Media loading accepts only current local asset references. An archive change rejects stale results before they can replace the current thread.

## Failure and privacy handling

Keep usable text when one media decode fails. A retry targets the failed asset and preserves the selected event. Empty history, a fully excluded thread, unsupported content, absent files, and invalid dates have different messages. Local browsing requires no account and sends no media, messages, participant labels, search text, or derived evidence to a service.

## Acceptance criteria

1. A synthetic direct conversation containing text, an image with overlay, video, audio, sticker, GIF, attachment, system event, repeated media, and missing content displays all available events in the expected stable order.
2. Equal timestamps retain source-order ties across re-import. Invalid timestamps appear as undated evidence without a fabricated date.
3. Two participants with the same display name and a group with incomplete membership remain separate identities. Proven owner, other, and uncertain authorship receive distinct readable labels.
4. Explicit attachments render at their events. Inferred and ambiguous candidates require review and show their match basis. Missing files never resolve to a different asset.
5. Selecting a library occurrence opens the exact conversation event with neighboring context. Viewer close, back navigation, and a date jump preserve the intended thread position.
6. Shared year, participant, conversation, text, media, link, section, and review filters match the phase-5 selection. Excluded material cannot appear in previews, attachments, search results, or cached threads during ordinary browsing.
7. A generated 100,000-event conversation renders a bounded event window, answers a jump without rendering the entire thread, and keeps direct controls responsive within 100 milliseconds on the recorded desktop benchmark. A failed media decode leaves text and navigation usable.
8. Source inspection identifies the original occurrence and explains normalization, authorship, and attachment evidence for each inspected event.
9. Markup, script-like text, unsafe links, and message instructions remain inert. Network inspection during local browsing shows no archive-content transmission or Snapchat CDN request.
10. Reset/replacement cancels pending reads, releases media resources, clears previous selections, and prevents the previous conversation from reappearing.

## Verification and delivery slices

First deliver list, safe text thread, stable event jumps, source inspection, and coverage. Next add confirmed media and overlay viewers. Then verify all supported kinds and long-thread windows. A text-only slice does not complete the phase.

Use generated fixture expectations for ordering, identity, and link placement. Browser checks cover list search, event navigation from the library, keyboard operation, viewer focus return, filter changes, malformed media, reset, and hostile text. Measure long-thread interaction latency and rendered node/resource counts with synthetic history. Run `pnpm test`, `pnpm build`, and affected `pnpm test:e2e` checks. Publish only synthetic screenshots and benchmark evidence.
