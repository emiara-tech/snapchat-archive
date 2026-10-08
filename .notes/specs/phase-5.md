# Phase 5: Shared search and reversible curation

## User value

The owner can find a period or person, decide what to keep, and take the same collection into every room. Excluding a painful conversation is reversible and does not damage the original export. A selection preview makes the consequence of a large decision understandable before it happens.

## Baseline and dependencies

The Memories browser currently has independent year/type filters and no review state. The archive Pinia store owns import/reset and local session references. Extend this with one workspace query and review model over phases 2 through 4. Keep raw source records unchanged.

All required curation and state download/restoration work runs locally. An account, external database, model, or paid service is not a prerequisite. Browser storage and file permissions are optional capability gates, not reasons to prevent temporary-session curation.

## Required behavior

Use one typed `ArchiveQuery` for the library, conversations, observations, exports, year profiles, and assistant tools. Combine timezone-aware year/time range, participant IDs, conversation IDs, media types, archive sections, text search, link states, and review statuses. Define conjunction between categories and disjunction within each category. Text matching and normalization are versioned, Unicode-safe, and deterministic. Invalid/undated records have an explicit selectable category instead of falling into an arbitrary year.

Show active filters as removable controls, the matched result count, the effective collection count, and a clear reset action. Changing rooms preserves the query. A scene or thread can request focus without silently changing exclusions. Empty results explain active constraints and offer specific clearing actions.

The library includes available Memories, supported chat media, unlinked assets, and missing-media metadata occurrences. Show source category and known conversation context. Multiple historical occurrences can reference one physical asset. Asset and occurrence counts have distinct labels.

Review statuses are `unreviewed`, `keep`, `exclude`, and `later`. Ordinary effective collections include nonexcluded items unless the shared query narrows review statuses. Marking an item `later` records a postponed decision; export previews show the unresolved review count. Owners can explicitly filter out `later` before exporting. Review mode can display excluded items for reconsideration, but they remain excluded from ordinary observations, exports, highlights, scenes, and profile evidence.

Store review decisions separately from the dataset. Individual and bulk decisions carry explicit stable targets, the dataset revision, decision ID, prior decisions, and effect summary. A bulk action freezes its proposed target IDs before preview. Later filter changes cannot silently expand that proposal. Undo/redo restores exact prior decisions and updates the effective revision. Making a new decision after undo discards the redo branch.

Participant exclusion requires an impact preview. The default excludes all recorded events in conversations with that confirmed participant, including owner-authored events and known groups, plus every occurrence of assets associated with those conversations. Shared assets are withheld across rooms by default to avoid reintroducing excluded context. Show direct/group conversation counts, owner text affected, shared assets, and unresolved memberships. An explicit exception must be a separate reviewed choice that identifies possible disclosure. Unproven membership must not become a claim that all material involving a person has been found.

Review history shows choices, scope, timestamps, and their effects. A participant or conversation rule cannot be silently bypassed by keeping an individual child. Present the blocking rule and offer an explicit change of that rule. Independent item decisions use the most recent explicit decision for that stable target. Effective exclusions remain deterministic regardless of the view that created them.

Persistence starts as a temporary session. Offer an explicit save choice for local browser storage or a portable review-state file. Save only review/query state and minimum local identity metadata, not archive bytes. Explain that names, IDs, and dataset fingerprints are still private. Storage failure leaves session decisions working and offers the downloadable state. Clear saved state is distinct from clearing the imported source selection.

Restore only after checking schema version and stable evidence fingerprint. Re-importing the same supported evidence restores decisions despite ZIP selection order. Different evidence requires a visible mismatch report and explicit compatible-target import; unmatched decisions are never silently applied to another participant/item. Missing file permissions require reselection rather than an unattended restore promise.

## Data contracts

`ArchiveQuery` refers to phase-2 IDs and phase-3 link states, not display labels or expiring media URLs. It contains an explicit IANA timezone and optional undated inclusion. Query revisions change when effective filters change. Review revisions change after apply/undo/redo/restore. Every async consumer receives dataset, query, and review revisions and rejects stale results.

The workspace provides `query`, `decisions`, effective ordered event/asset/occurrence IDs, selected item/context, `previewDecision`, `applyDecision`, `undo`, `redo`, `saveState`, `restoreState`, and `reset`. Equivalent narrower names are allowed if they preserve one shared contract. The effective result includes counts by source category and media type, coverage, unresolved links, postponed reviews, and reasons for exclusions. Downstream rooms consume this result rather than rebuilding their own filters.

Serialized review state includes schema version, dataset fingerprint, stable target IDs, decision scope/status, timezone/query choices, and calculation version. It contains no credentials, object URLs, provider links, or source ZIPs.

## Failure and privacy handling

Cancellation closes a bulk preview without applying it. Archive replacement invalidates previews/history scoped to its old fingerprint. A storage quota error reports that saving failed without claiming choices were lost. All local indexing/search stays on the device. Ordinary counts cannot disclose an excluded participant through a thumbnail, label, evidence example, or stale cache.

## Acceptance criteria

1. A synthetic mixed archive can combine every required filter category. Equivalent queries produce the same ordered selection in the library, conversation room, observation evidence, export preview, and year-profile input.
2. Year and range filters use the selected timezone, including records around New Year and daylight-saving boundaries. Undated records follow their explicit query choice.
3. The library displays Memories, chat media, unlinked assets, repeated occurrences, and missing-file records with accurate source/context labels and separate physical-asset/occurrence counts.
4. Keep/exclude/later apply to individual IDs without editing original files. Ordinary exclusion removes every excluded item from all downstream ordinary selections and examples.
5. Participant exclusion previews direct/group events, owner-authored material, shared assets, and unresolved membership. Applying it matches the preview exactly and conservative shared-asset exclusions prevent another room from reintroducing the asset.
6. Bulk apply affects the frozen preview IDs only. Cancel applies nothing. Undo/redo restores exact decisions, selection counts, and observation/profile/export invalidations. A new decision after undo clears redo.
7. Active filters can be removed individually or reset. Room navigation preserves the current query and selection. A review-mode view cannot silently alter an export's exclusion policy.
8. A saved state round-trips for an identical reordered multipart import. A different dataset fingerprint produces a mismatch report and no automatic decision application.
9. Browser storage denial/quota failure leaves temporary choices usable and permits local state download. Reset/replacement removes stale work and closes old media references.
10. Synthetic searches containing Unicode, markup, blank strings, long strings, and absent fields remain deterministic and safe. No search, decision, fingerprint, or selected evidence is transmitted externally.

## Verification and delivery slices

First deliver the shared query, mixed-source library, item decisions, and undo/redo. Next add previewed rules/bulk actions and cross-room parity. Then add persistence/restoration and large-query worker checks. Do not describe saved browser state or participant exclusions as complete before their failure cases pass.

Use independent fixture tables for query intersections, exclusion precedence, group/shared-asset consequences, and restoration. Browser checks follow a user choosing a year, excluding a person, checking counts in every room, undoing, saving, and re-importing. Inspect network activity and original ZIP checksums. Run `pnpm test`, `pnpm build`, and affected `pnpm test:e2e` checks.
