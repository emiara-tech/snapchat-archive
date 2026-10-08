# Phase 2. A trustworthy dataset

This spec implements Phase 2 in [MASTERPLAN.md](../../MASTERPLAN.md). [CONTEXT.md](../../CONTEXT.md) supplies the domain vocabulary. Phase 0 owns session cancellation and resource limits. This phase supplies the normalized evidence consumed by all later conversations, curation, statistics, and profiles.

## User value

The owner learns what their export actually contains. They can inspect where a displayed message, date, participant, or asset came from. Missing files and uncertain authorship remain visible, so later analysis does not invent a complete life history or attribute someone else's words to the owner.

## Current baseline

ZIP entries retain source IDs and paths, and metadata reports capabilities, missing expected paths, unknown JSON files, and duplicate paths. Source IDs depend on selected-file order. Parsers return loosely filtered export-shaped records. Most records lack source pointers, stable normalized identities, time precision, ownership certainty, unsupported-field evidence, and coverage. Memory parsing derives local paths from media IDs and discards remote URLs, but drops records that cannot produce a supported path. Duplicate path lookup can select one occurrence without resolving conflicts.

## Required behavior

### Evidence preservation and normalization

Build a versioned local dataset of participants, conversations, conversation events, media assets and physical occurrences, source records, media links, review decisions, and observations. Keep parsing, normalization, querying, and indexing deterministic and browser-local. Later link and curation phases add their behavior through these contracts rather than rebuilding another dataset.

Every normalized item resolves to one or more source occurrences. A source occurrence identifies the original ZIP part, internal entry occurrence, and record pointer or file. Preserve original meaningful values alongside normalized interpretation, including sender, identifiers, captions, timestamp text, time precision, and conversation context. Preserve unsupported records as inspectable local evidence with a reason. A malformed record does not become a valid zero-valued event or disappear without an inventory diagnostic.

Do not copy expiring remote media URLs or credential-like fields into the ordinary normalized item model. Extract only supported local identifiers, retain a reference to the original local occurrence, and display a redacted original-field view where needed. Reading original local source bytes is not permission to fetch or transmit their URLs. The original files remain unchanged.

### Stable identities and duplicates

Stable item IDs and the dataset fingerprint are computed locally from supported evidence under a versioned rule. Re-importing the same ZIP parts in a different selection order produces the same item IDs, fingerprint, supported item ordering, and coverage. A material change to evidence cannot reuse an unrelated item's identity. A normalization schema change has an explicit version boundary and must not silently apply old decisions to different items.

Distinguish source occurrences from logical items. Repeated identical source records can contribute duplicate provenance without multiplying a confirmed duplicate event. Identical text and timestamp alone do not prove duplication. Preserve genuine repeated messages within one conversation and repeated uses of a media asset. Conflicting records sharing a path or identifier remain separate inspectable evidence until a supported rule resolves them. Source identity must distinguish duplicate entry names within one ZIP as well as across ZIPs.

Content equality of two physical assets requires byte evidence when needed; file name, length, or timestamp alone cannot establish it. Hashing and comparison respect Phase 0 resource limits and do not decode full media at import. Preserve all physical occurrences and explain any deduplication rule to consumers.

### Participants, owner, and conversations

Prefer exported stable account identifiers over display names. Keep original identity fields and evidence. Two accounts sharing a display name remain distinct. Unknown identity stays unknown. Group conversations have their exported conversation identity and supported participant set; their title does not turn the group into one person.

Identify the archive owner from supported account metadata and sender semantics for the actual export variant. Owner-authorship classification requires explicit supporting evidence and has `owner`, `other`, `unknown`, or `conflicting` outcomes. A missing account record, inconsistent sender field, unverified parser variant, or name match cannot silently classify text as the owner. Only verified `owner` events are eligible for later imagined-self evidence. A user-selected working label does not rewrite recorded authorship.

### Time and ordering

Retain original time values and represent normalized instant, supported precision, source zone/offset, interpretation basis, and validity. Preserve microsecond ordering without losing precision through JavaScript floating-point conversion. Reconcile conflicting timestamp fields with an explicit rule and diagnostic. Do not parse an unzoned timestamp according to whichever computer imported it.

Use an explicit dataset display/year-filter time zone. UTC is the deterministic initial zone. A deliberate display-zone change creates a new query revision and recomputes affected period membership. Date-only evidence remains date precision, and unknown time cannot receive a fabricated midnight instant. Invalid or unknown time appears in an undated group with coverage impact.

Sort timed events by normalized instant and retained precision, then by a documented stable source/conversation order. Tied times remain reproducible after re-import and do not imply a causal ordering beyond the available evidence. Queries make their time zone and unknown-time policy inspectable.

### Inventory, coverage, and local queries

Inventory metadata records, physical files, supported and unsupported types, invalid records, missing media, unknown identity/time, duplicate/conflicting occurrences, unmatched items, and incomplete sections. Distinguish absent section, unreadable section, partially supported section, and successfully parsed empty section.

Coverage reports the available evidence by category and supported period. An interval observed in a history file is not proof that every event in that interval was retained. Missing months, absent files, and unknown dates stay unknown. A Memories-only import explains which conversation and owner-language experiences lack evidence. Later results attach coverage and scope instead of implying inactivity in a gap.

Normalize and index in browser workers. Publish revision-tagged batches and a versioned local query contract for item lookup, period/category/participant filtering, evidence resolution, and coverage. Reject stale responses after cancellation or replacement. Read media bytes and decode full images/videos on demand. The inventory can list unrecognized physical assets without decoding or inventing a history record.

## Interface and data contracts

| Entity | Minimum contract |
| --- | --- |
| Dataset | Local fingerprint, normalization version, active archive revision, display/year-filter zone, indexed entities, coverage, and diagnostics. |
| Source occurrence | Stable source-part identity, internal entry identity including duplicate occurrence, path, record pointer or file reference, and local raw-value access. Never use selected-file position as permanent identity. |
| Participant | Stable ID, exported identity fields, names as labels, source references, owner classification, and identity uncertainty. |
| Conversation | Stable ID, supported exported identity, participant IDs, title as a label, source references, ordered event IDs, and gaps/coverage. |
| Conversation event | Stable ID, conversation ID, kind, author participant or unknown, authorship outcome/evidence, normalized time, original fields, source references, and media reference tokens. |
| Time value | Raw fields, valid instant where supported, precision, source zone/offset, normalization basis, conflict/invalid reason, and stable ordering key. |
| Media asset | Stable logical ID, supported media identifier/type, source references, physical occurrence IDs, availability, and decode capability. No expiring remote playback URL. |
| Physical asset occurrence | Source entry reference, local path, advertised and actual size where read, supported type, optional verified content digest, and integrity state. |
| Media link | Event/context ID, asset/occurrence ID, status, basis, evidence, candidates, and optional separate owner decision. Phase 3 defines resolution behavior. |
| Coverage | Per-section presence/readability/support, record and file counts, time/owner uncertainty, observed periods, gaps with unknown meaning, duplicate policy, and missing-content diagnostics. |
| Review decision and observation | Stable referenced item IDs and dataset/calculation versions. Phase 5 defines reversible decisions, and Phase 7 defines scoped observations. |
| Query request/result | Dataset and query revisions, explicit filters and zone, unknown-time policy, bounded page/count, resolved IDs, attached coverage, and cancellation. |

## Failure and privacy states

An invalid section can coexist with supported evidence when the import contract permits a safe partial dataset. Fatal conflicts in required identity or indexing information prevent a false success. Raw unsupported evidence is displayed as inert text or typed local fields, never executable HTML. Unknown types do not receive a guessed JPEG decoder or false supported status.

All fingerprints, normalized records, indexes, and source lookups stay on the device. They are private derivatives, including aggregate indexes and vocabulary. Diagnostic traffic outside the browser contains safe counts and error codes only if that telemetry has its own authorization; it does not contain fingerprints, source paths, participants, or text by default.

## Acceptance criteria

1. P2-01. A synthetic split-ZIP archive produces normalized participants, group and direct conversations, events, assets, and source references. Every displayed item can open its exact originating local record or file occurrence.
2. P2-02. Re-importing identical supported evidence with ZIP selection reordered produces identical stable item IDs, fingerprint, coverage, and deterministic event order.
3. P2-03. Changed evidence produces the appropriate identity/fingerprint change. A different normalization version cannot silently reinterpret a stored review decision against a different item.
4. P2-04. Exact duplicate source records have inspectable provenance and the documented logical counting result. Genuine repeated text events and repeated uses of one asset remain distinct events.
5. P2-05. Conflicting same-path entries across ZIPs and duplicate names within a ZIP remain separately addressable. No first-match rule silently erases the other evidence.
6. P2-06. Shared display names, renamed labels, missing account metadata, groups, contradictory sender fields, and unknown export variants cannot create false participant merges or verified owner-authored text.
7. P2-07. UTC, explicit-offset, unzoned, date-only, invalid, conflicting, tied, and microsecond timestamp fixtures follow the stated time rules. Year-boundary queries use the explicit zone and preserve unknown-time records in their stated group.
8. P2-08. Unsupported fields, unknown record kinds, invalid rows, absent sections, unreadable sections, and parsed empty sections have distinct inspectable diagnostics and inventory counts.
9. P2-09. Missing physical media does not erase its metadata event. Unmatched physical assets remain browsable in inventory. Unsupported media is not mislabeled as a supported image.
10. P2-10. Coverage distinguishes absent history from empty supported history and observed records from complete calendar coverage. A missing month never becomes a claim of zero actual activity.
11. P2-11. Normalization/query worker results carry current revisions. Canceling or replacing the archive prevents an old batch or query from changing the active dataset.
12. P2-12. Inventory and normalization require no full-media decoding or network access. Expiring URLs remain outside the normalized playback/export model, and malicious source strings render inertly.

## Verification plan

Build table-driven synthetic fixtures with hand-written expected entities, source pointers, ownership results, coverage, and order. Include split sources in reversed order, duplicated entries, identical repeated messages, groups, ambiguous names, malformed values, unsupported fields, all supported timestamp variants, and missing files.

Run pnpm build and unit checks. Use browser checks to inspect inventory, open source evidence, select an explicit year zone, and replace an archive while its worker is active. Measure generated larger datasets for responsive cancellation and bounded media reads. Inspect network activity to verify that normalized evidence and fingerprints stay local. Private realistic checks may inform supported variants but never become public fixtures or external payloads.

## Implementation slices and prerequisites

1. Versioned entity/source contracts, inventory, and unsupported-evidence preservation.
2. Stable identities, duplicate/conflict provenance, participants, and proven owner authorship.
3. Explicit time normalization, deterministic order, and coverage.
4. Worker indexing/query integration and a user-visible evidence/inventory view.

All slices are locally achievable after Phase 0 and require no account or inference provider. Supporting a new export variant requires actual structural evidence and synthetic regression fixtures that reproduce the structure without private values. An unseen schema remains unsupported or uncertain rather than gaining a guessed parser. No later phase can mark unknown authorship or incomplete coverage as established evidence.
