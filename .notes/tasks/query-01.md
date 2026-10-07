# QUERY-01: Pure archive collection selection

Accepted bounded specification, 2026-10-07. Baseline checkpoint is `38984dbc`. This task implements two pure functions against complete hand-authored evidence. It does not change normalization, the workspace store, persistence, routes, pages, exports, profiles, or browser controls. The manager accepted both independent preflight reviews before authoring. The implementation still requires independent code review, a distinct fixer for valid findings and reviewer recheck.

## Value and original requirements

An owner should be able to ask for one exact period, person, source section, and kind without combining facts from different appearances of a shared file. A kept file must not silently add unreviewed or excluded chat context. An uncertain reference must not become a claimed attachment or a relationship statistic.

The originating requirements are [Phase 5](../specs/phase-5.md), especially criteria 1–4 and 10, with the exclusion and revision protections of criteria 5–9. Phase 2 supplies stable source identity and timestamp precision. Phase 3 supplies conservative, inspectable associations. All original acceptance criteria remain required. QUERY-01 proves the local query rules, not cross-room integration or full Phase 5 completion.

The existing dataset flattens several Memories rows into one asset and has no complete occurrence collection. Existing scalar queries and accumulated asset dates/raw metadata cannot prove the conjunction cases below. This task accepts a complete typed input authored in tests. OCCURRENCE-01 will produce that input from real archive bytes. FILTER-01 will adapt current callers and saved state atomically.

## Owned files and small interface

Proposed author ownership is `src/types/archiveQuery.ts`, `src/lib/archiveQuery.ts`, and `tests/archiveQuery.test.ts`. A small public fixture may live under `tests/fixtures/`. No other file is needed for QUERY-01. The canonical occurrence shape described below is an additive domain contract for a later author to place in `src/types/dataset.ts`; do not edit that shared file in this task.

The module exports exactly these behavior functions and their types:

```ts
normalizeArchiveQuery(input: unknown, context: QueryContext): QueryValidation
selectArchiveCollection(input: CollectionInput): CollectionValidation
```

Validation returns `{ ok: true, query }` or `{ ok: false, errors }`. Selection returns `{ ok: true, collection }` or the same safe error form. An error contains a stable code and field path, without echoing private input, raw values, stack traces, or source contents. Paths use fixed known schema fields and validated numeric indexes only. An unknown input property uses the root/nearest fixed schema path, never its supplied name. Invalid input never means a wider query. Expected validation failures do not throw.

`QueryContext` contains the known participant and conversation IDs and the supported query/occurrence version. `CollectionInput` contains the canonical query, complete evidence described below, explicit review decisions, explicit effective deny IDs, and dataset/query/review revision strings. The result echoes these revisions; it does not create, increment, persist, or authorize them. Selection validates the canonical query against the input's IDs rather than trusting a cast.

The module owns matching, review inheritance, effective exclusions, candidate partitioning, supporting resources, ordering, and counts. Callers do not assemble these stages. It has no Vue, Pinia, DOM, ZIP reader, worker, storage, fetch, provider, or renderer imports. It performs no I/O, logging, state mutation, current-clock reads, or automatic retries. No matcher callbacks, filter language, generic plugin system, classes, or rule framework are part of the interface.

## Complete evidence input

All arrays are readonly. IDs are stable, unique within their target namespace, and validated when referenced. Review/deny targets explicitly distinguish `event`, `occurrence`, and `media` so an ID collision cannot apply a choice to another entity. Unknown targets and dangling references are errors. The input declares `occurrenceVersion: 1` and `occurrencesComplete: true`. Missing capability is an error, with no approximation using flat asset dates.

Each chats/snaps occurrence must have a valid owning event of that same origin. Each Memories occurrence must have no owning event. A resolved supporting edge connects an available physical original to an available physical layer and cites known exact proof source IDs. Distinct independently proven edges may support multiple layers on one base or reuse one layer on multiple bases. Preserve a supplied proven layer order when available; do not invent composition order. Duplicate or contradictory edges are invalid input. Ambiguous competing associations must remain unresolved evidence; the evaluator never chooses a winner. These checks validate supplied facts and do not infer a resolver decision.

The input contains these typed facts:

- Events have their existing event ID, proven origin `chats` or `snaps`, author ID or null, conversation ID, recorded event kind, text or null, time, and source IDs. Existing asset IDs are not themselves proof of an attachment.
- Conversations have their existing ID and separately typed proven member IDs with source proof. Observed authors or an unknown scope do not establish membership. QUERY-01 accepts these facts; it does not infer membership from titles, usernames, or a count of observed authors.
- Media records have their existing asset ID, physical entry identity or null, filename, physical kind, available flag, physical source IDs, and role `original` or `layer`. A physical entry identity includes source ID, path, and entry ordinal. A missing-media metadata record has a null physical entry and `available: false`.
- Historical occurrences have a new occurrence ID, origin `chats`, `snaps`, or `memories`, owning event ID or null, their own time, declared per-reference kind or unknown, scoped metadata/source IDs, and one typed reference/association. Event-owned occurrences take contextual facets from that exact event. Conflicting owning-event origin/time facts are invalid input. Memories occurrences have their own row facts and no inferred conversation or recipient.
- Resolved supporting-layer relations identify one base media ID, one layer media ID, and exact source proof. Unresolved/orphan layer inventory carries its own physical identity and unresolved state. Supporting layers do not create historical occurrences.
- Diagnostics have an opaque diagnostic ID, code, known source IDs, and optional typed owning event/occurrence/media target. They contain no raw source row. Only source IDs within an owning selected target's scoped evidence may enter its ordinary diagnostic projection. Extra source evidence remains review-only/immutable input. Unowned/global diagnostics cannot enter either matched or effective entity projection. Unsupported evidence is diagnostic data, not an origin section.

An occurrence's association is one of:

```ts
{ state: 'confirmed', mediaId, proof: ExportExactProof | OwnerConfirmedProof }
{ state: 'inferred' | 'ambiguous', referenceSourceIds,
  candidates: [{ mediaId, proofSourceIds }] }
{ state: 'unlinked', missingMediaId: string | null, proofSourceIds }
```

`ExportExactProof` and `OwnerConfirmedProof` are distinct discriminated records. The first cites exact exported-reference evidence. The second cites an owner decision ID, evidence revision, and its source evidence. Never parse an English `basis` string to manufacture either proof. An available original is required for a confirmed association. A missing-file record stays unlinked. At most one confirmed media ID exists for one occurrence. Competing confirmations, malformed proofs, or a confirmation to absent/layer bytes are input errors.

Each candidate target must also be a distinct available physical original. Missing metadata records, unavailable bytes, layers, duplicate candidate targets, and unknown IDs are invalid candidate input.

Candidate proof is attributed to one candidate, not an aggregate list. `referenceSourceIds` cite the occurrence's own reference evidence. A candidate's proof source IDs may cite that occurrence's reference evidence and that candidate's physical source evidence, never another candidate's physical evidence. Validate this attribution against the complete input. Input reference evidence is retained separately from physical candidate evidence, even if the original source row mentions several candidates.

Scoped metadata consists of optional caption and location literals plus exact source IDs for this occurrence. Source IDs resolve to exact source references, including record pointer and physical entry ordinal. Projection consumers must not recover historical dates, location, captions, whole raw records, or accumulated provenance from a selected physical media object.

### Occurrence identity and copy proof

QUERY-01 does not read, hash, deduplicate, or normalize documents. The complete fixture already distinguishes logical occurrences from copied source evidence. The additive occurrence contract records `identityVersion: 1`, original document SHA-256, proven origin, document path, exact row pointer, repeat rank, and reference ordinal. Every physical copy retains a separate source reference.

The future supported copy rule may merge corresponding rows only when the original document bytes have the same locally computed digest, document path, row pointer, repeat rank, and reference ordinal. The archive reader must compute that digest from original bytes before decoding, parsing, redaction, or re-encoding. A digest asserted by exported JSON is not proof. Each source copy retains its source ID/path/entry ordinal. Two identical rows at different pointers or repeat ranks remain two occurrences. An overlapping document with different original bytes remains distinct. Same media bytes, same media ID, same timestamp, or equal sanitized rows never prove a copied historical occurrence. Conflicting captions/locations remain separate evidence.

The pure module validates the proof's shape and cross-references. It cannot attest byte equality without reader bytes. Test fixtures are trusted hand-authored inputs, not a production proof adapter. A malformed duplicate occurrence ID is rejected rather than silently merged. QUERY-01 never rewrites supplied event, asset, link, occurrence, or physical entry IDs. The future normalizer preserves valid identities and may make an explicitly versioned correction to IDs that previously conflated unsupported evidence, with visible migration/rejection rather than silent reuse. The new occurrence namespace has a versioned identity rule. Source-order changes cannot change logical occurrence membership or output order.

### Time facts

Use a discriminated calculation-time value for events and occurrences:

```ts
{ kind: 'instant', epochMicroseconds: string,
  precision: 'second' | 'millisecond' | 'microsecond', sourceTimeId }
{ kind: 'date-only', recordedDate: 'YYYY-MM-DD', sourceTimeId }
{ kind: 'unavailable', reason: 'absent' | 'invalid' | 'un-zoned', sourceTimeId }
```

`epochMicroseconds` is a canonical signed decimal integer, with no leading zeros except `0`, within calendar years 0001–9999 in UTC. Validate declared second/millisecond precision against the corresponding divisibility. BigInt or equivalent exact integer arithmetic preserves all six fractional digits. Date-only is valid evidence with unavailable instant. Retain its recorded date and precision; never invent midnight or a zone. Invalid/un-zoned/absent evidence retains its distinct reason. QUERY-01 does not reinterpret source timestamp units.

## Canonical query

Version 1 contains `queryVersion: 1`, `matchingVersion: 'literal-nfc-lower-v1'`, `timezone`, sets `years`, `participantIds`, `conversationIds`, `kinds`, `sections`, `linkStates`, `reviews`, literal `text`, `range`, and `unavailable`.

Sets are disjunctions. Different facets are conjunctions. Deduplicate and sort sets by numeric year or code-unit string order, never locale collation. Years are integers 1–9999. Each supplied set has at most 64 members; IDs have at most 256 Unicode code points. Reject unknown IDs, enum values, fields, versions, malformed Unicode, or malformed collection facts. Validation completes before selection. Empty nonreview sets impose no constraint. Missing reviews default to active statuses `unreviewed`, `keep`, `later`. An explicitly empty reviews set means all four statuses and canonicalizes to that explicit four-status set.

Supported kinds are the existing `MediaKind` values, including `text` and `unknown`. Proven origins are `chats`, `snaps`, `memories`, and physical `inventory`. Reject `sections: ['unsupported']` with a typed `unsupported_section` error; unsupported diagnostics have their own projection and never silently behave as an empty origin.

Timezone defaults to UTC. Accept supported IANA timezone IDs through the runtime's Intl timezone validation; canonicalize equivalent aliases with its resolved timezone. Reject unsupported/invalid IDs. The implementation uses the chosen zone for calendar year and calendar-day comparisons, without changing the recorded time. Document the Intl timezone dependency in module comments. QUERY-01 tests UTC and Europe/Oslo explicitly.

`range` is null or exactly one of:

- `{ mode: 'calendarDays', start: 'YYYY-MM-DD' | null, end: 'YYYY-MM-DD' | null }`, inclusive start and exclusive end in the chosen timezone.
- `{ mode: 'instants', start: zonedISOString | null, end: zonedISOString | null }`, inclusive start and exclusive end. Each nonnull bound has an explicit Z or offset, a valid civil date/time, and at most six fractional digits. Compare exact instants independently of display timezone.

Both null bounds canonicalize to no range. Empty strings, rollover dates, missing offsets, leap seconds, invalid order, or conflicting range modes are errors. Years may combine with a range using AND. Calendar-day comparisons use actual local dates; no assumption makes every day 24 hours.

`unavailable` is `auto`, `include`, `exclude`, or `only`. `auto` includes unavailable instants when no year/range is active and excludes them when a temporal facet is active. `include` adds unavailable instants to the temporal predicate while all other facets still apply. `exclude` requires a usable instant even without another temporal facet. `only` selects unavailable instants and rejects combination with a year or nonneutral range. This includes date-only without labelling its known date unknown.

Text has at most 1,000 Unicode code points before trimming. NFC-normalize, trim, and apply locale-independent Unicode lowercase to query and searchable literals. Compare literal substrings. Preserve accents, markup characters, and distinct dotted-I forms. No regex, HTML evaluation, token query language, or accent folding is permitted. Blank/whitespace text canonicalizes to an empty constraint. Null searchable fields match only a neutral text constraint.

### Existing scalar compatibility

Accept the current seven legacy fields as full-query inputs: `year`, `participantId`, `conversationId`, `kind`, `review`, `linkState`, and `text`. A nonneutral scalar becomes an equivalent singleton/set. Neutral year/participant/conversation is null; neutral kind/link is `all`. Legacy review `active` maps to the three active statuses, `all` to all four, and each specific status to its singleton. Omitted fields receive canonical defaults.

If a nonneutral scalar and its plural are both supplied, their normalized sets must agree exactly or validation fails with `conflicting_filters`. A neutral scalar does not erase a plural constraint. Full validation cannot infer patch intent. Scalar patch replacement, chip clearing, equivalent-query revision suppression, and atomic whole-state restore are FILTER-01 responsibilities. QUERY-01 returns equivalent canonical values for equivalent full inputs and does not mutate existing state.

## Matching and effective collection rules

### Predicate sources

| Entity | Time / section | Person / conversation | Kind / text | Link / review |
| --- | --- | --- | --- | --- |
| Event | Its own time and proven chats/snaps origin | Its author OR proven conversation member; its exact conversation | Recorded event kind; event text only | Any of its reference states, or unlinked if it has no references; its own decision or unreviewed |
| Event-owned occurrence | Its exact owning event time and origin | Same exact owning event predicates | Confirmed file's physical kind; otherwise declared per-reference kind or unknown. Text is owning event text plus this occurrence's caption/location | This reference state; precedence below |
| Memories occurrence | Its row time and memories origin | No person or conversation claim | Confirmed physical kind, or missing/unresolved declared kind. Text is this row's caption/location | This reference state; precedence below |
| Standalone inventory record | Unavailable instant and inventory | No person or conversation claim | Physical kind; filename only | Unlinked; its own decision or unreviewed |

A candidate's filename, kind, or accumulated metadata does not supply occurrence facts. Confirmation may supply the physical kind; uncertainty does not guess it from candidate consensus. Event link matching is OR over its references, independently of event kind; no-reference events are unlinked. Matching an occurrence does not force its event into the event set when event kind or another event-specific predicate fails.

All occurrence facets must match one eligible occurrence. Selecting a physical record collects only its matching occurrences. A file's occurrence in 2019 and a different occurrence in a 2020 conversation do not jointly match 2019 AND that conversation. The same rule applies to text and section. Events, occurrences, and inventory each evaluate their complete conjunction independently.

### Review inheritance and exclusions

Stored decisions have statuses keep, exclude, or later. Unreviewed is virtual, not a new persistence sentinel in QUERY-01. For an occurrence:

1. Its own explicit occurrence decision supplies its facet status.
2. Otherwise, if an owning event exists, that event's decision or virtual unreviewed supplies its status. Event presence stops fallback even when the event is undecided.
3. Otherwise, its confirmed/missing media record decision or virtual unreviewed supplies its status. Ambiguous/inferred references without one resolved record are unreviewed unless decided directly.

Every applicable explicit exclusion dominates the effective collection, even if a more specific facet status is keep or later. An occurrence is withheld if its own target, owning event, or confirmed/missing media record is explicitly excluded or appears in effective deny IDs. A media record is withheld if its own target is excluded/denied. A candidate pool honors occurrence/event exclusions/denies and each candidate file exclusion/deny. A selected kept file never adds unmatched occurrence IDs.

Event evidence remains selectable when only attached file bytes are excluded; its effective attachments and associated occurrences are withheld. Excluding the event withholds all its occurrences, candidates, and attachments. A participant/conversation rule author must supply its explicit frozen event/occurrence/media deny targets, including shared-file withholding across other contexts. QUERY-01 accepts those targets and never lets child keep/later decisions override them. It does not author, preview, change, or persist rules.

`matched` applies all query facets before effective exclusion. It can be used deliberately for review and reconsideration. `effective` removes blocked evidence and is the only ordinary collection for observations, profiles, exports, highlights, scenes, and ordinary counts. Explicit reviews exclude therefore yields an empty effective collection. Exclusion reasons identify typed blocked targets and stable reason codes in the review projection only. Effective labels, metadata, examples, counts, and candidate pools contain no blocked target.

### Proven attachments, candidates, and inventory

A confirmed selected occurrence can select its original media record. An unlinked occurrence with a missing media record can select that logical missing record. Ambiguous/inferred occurrences select candidate references separately; they do not select those files as ordinary attachments, dates, recipients, or proven historical appearances. Inline associations require both effective owning event and effective confirmed occurrence. Owner-confirmed proof stays distinguishable from exported exact proof.

An effective occurrence's association is a fresh scoped projection. It contains only effective candidate records and their attributed proof source IDs, plus permitted reference evidence. Never copy its unfiltered original association into an otherwise filtered occurrence. Removing a candidate removes that candidate's ID and exclusive physical proof/source references everywhere in effective records, resources, diagnostics, and candidate pools. The surviving uncertain state remains uncertain even if only one permitted candidate remains. Full resolver evidence remains in immutable input for deliberate review.

Inventory consists of available physical originals with no proven historical association anywhere in the complete input, plus physical orphan/unresolved layers. Candidate-only originals are eligible independent inventory bytes. Inventory does not borrow candidate occurrence time, text, recipient, or history. Whether a record has a proven historical association is determined globally before filters/exclusions, so a known contextual file does not reappear as an orphan after its context is withheld. Missing records are never physical inventory. Resolved supporting layers are never standalone inventory.

Thus Q/ALT can be selected as independent bytes by a neutral or inventory query while remaining candidates for O4. `links: ['ambiguous']` selects O4's candidate projection, with no ordinary Q/ALT attachment or inventory record because inventory itself is unlinked. Deliberately selected standalone originals may later be exported as standalone files, without asserted uncertain context. That export adapter is outside this task.

The pure input represents association states after the current owner decision. Confirm/reject/undo tests compare separate immutable input snapshots. Rejecting a candidate removes it from that reference's candidate pool; its standalone physical inventory eligibility remains independent. Undo restores the prior reference snapshot. The module never writes association decisions.

### Supporting layers

Selecting an original base can add its proven supporting layer as a resource even if an image layer fails a video kind facet. It adds no historical occurrence or independent original-photo count. The supporting layer bypasses query facets, not exclusion authority. Effective layer exclusion clears every composition reference and resource ID while retaining an otherwise eligible base. A withheld base or its sole selected context supplies no effective layer. A resolved layer cannot fall back to inventory when the base/context is excluded. Unresolved/orphan layers have unavailable instant and no inherited context.

## Result projection, counts, and ordering

Return the canonical query, versions/timezone/revisions, plus `matched` and `effective` projections with:

- Ordered `eventIds`, historical `occurrenceIds`, selected `mediaRecordIds`, standalone `inventoryIds`, and separate `supportingLayerIds`.
- Scoped event and occurrence records containing only selected literals/time labels, exact source IDs, and typed proof. Original full source inspection uses the immutable dataset separately.
- Minimal resource records containing identity, physical kind/filename/entry/availability, and physical source IDs. No accumulated history, raw metadata, guessed dates/recipients, object URLs, or provider links.
- Separate candidate references `{ occurrenceId, state, candidateMediaIds }`, and separate confirmed inline associations. Candidate files are not ordinary media solely by membership in this projection.
- Effective composition references connecting selected bases to permitted support resources.
- Counts for events, historical occurrences, selected original physical files, missing-media records, standalone inventory originals, standalone unresolved layers, supporting layers, unique physical resource files, candidate references, and unique candidate files. Unique physical resource count is the union of selected originals, standalone layers, and supporting layers, by physical entry identity. Candidate files count separately unless independently selected as inventory. No diagnostic or layer adds an event/occurrence.
- Counts by proven origin and by kind for each entity category separately. Do not mix text-event kind with image-attachment kind or count a support layer as a selected original photo. Postponed counts use selected entity statuses, separately by event/occurrence/media.

Owned diagnostics form a separate typed diagnostic field within each selection, not a historical entity. They appear only when their exact owning target appears in that corresponding selection. Their projected source references are the intersection of their known source IDs and that selected target's permitted scoped source IDs. Extra source evidence stays review-only/immutable input. Denied owning targets remove them from effective. They never change event/occurrence/physical counts or introduce raw captions, names, or source rows.

The result has a separately named `reviewOnlyDiagnostics` inventory outside both matched and effective projections. It may carry unowned/global opaque diagnostic IDs, codes, and exact source IDs for deliberate diagnostic inspection. It is not ordinary selected context, evidence, a count, or input to exports/profiles/observations. Full diagnostic evidence remains in immutable input. Unselected or excluded source IDs in this review-only inventory must never enter any complete effective projection, including resource metadata, counts, labels, and owned diagnostics.

Sort events and occurrences by exact epoch microseconds ascending, then stable ID with code-unit comparison. Usable instants precede unavailable instants. Among unavailable instants, date-only records sort by recorded date then ID, followed by invalid/un-zoned/absent records by ID. Do not convert date-only into an instant. Media records sort by the earliest usable time of their selected proven/missing occurrences, then ID; records with no selected usable occurrence sort last by ID. Candidate references follow occurrence order, with candidate IDs sorted by ID. Inventory/support resource IDs sort by ID. Input array order never changes the result.

Create fresh readonly projections. Mutating a returned nested array/object must not mutate input or another call's result. Never return an original mutable raw object. The implementation may keep local indexes for linear scans and use sorting for output; no page-specific recomputation belongs in the contract.

## Independent base fixture

All fixture content is public test-only evidence. No demo route, production factory, fixture selector, provider call, or private archive is involved. Construct expected sets literally without running any query function or production matcher to calculate the oracle.

Participants are owner, Maya, and Jules. CM has proven direct owner/Maya membership, CG has proven group owner/Maya/Jules membership, CJ has proven direct owner/Jules membership, and CU has unknown membership.

| Event | Exact instant | Origin / conversation / author | Kind / literal text | Reference |
| --- | --- | --- | --- | --- |
| E0 | 2019-12-31T23:30:00Z | chats / CM / owner | text / `CAFE\u0301 <b>coast</b>` | O0 confirmed SHARED |
| E1 | 2020-01-01T00:30:00Z | snaps / CM / Maya | image / `café coast` | O1 confirmed SHARED |
| E2 | 2020-03-29T00:30:00Z | chats / CG / owner | image / `meet coast` | O2 confirmed PHOTO |
| E3 | 2020-03-29T01:30:00Z | chats / CG / Jules | video / `coast` | O3 confirmed VIDEO |
| E4 | unavailable, invalid | chats / CU / null | audio / null | O4 ambiguous, declared kind unknown, candidates ALT/Q |
| E5 | 2020-10-25T00:30:00Z | chats / CJ / owner | text / `first repeated clock` | None |
| E6 | 2020-10-25T01:30:00Z | chats / CJ / Jules | text / `second repeated clock` | None |
| E7 | 2021-01-02T10:00:00Z | chats / CJ / Jules | text / `café` | None |

The six available originals are SHARED=image, PHOTO=image, VIDEO=video, ALT=gif, Q=gif, and ORPHAN=audio. Their filenames contain none of the searchable literals. ORPHAN has no reference. Each has a distinct exact physical entry. Base fixture has no layers.

M0 is a Memories occurrence confirmed to SHARED at 2020-01-01T00:30:00Z, with caption `memory coast` and location `CANARY-M0`. It has two proven copies of the same original document and row pointer. They remain one occurrence with both source references. MMISS is a Memories unlinked occurrence at 2020-01-03T01:00:00Z, with declared kind image and missing metadata record MISS. It has no caption/location. No other occurrence has scoped caption/location. All decisions and deny sets start empty.

The seven historical occurrences are O0/O1/O2/O3/O4/M0/MMISS. Inventory originals are ALT/ORPHAN/Q. Candidate-only files are inventory eligible; only ORPHAN has no possible candidate mention. Neutral effective counts are 8 events, 7 occurrences, 6 physical original files, 1 missing record, 3 standalone inventory originals, 1 candidate reference and 2 candidate files. There are no layers and 6 unique physical resources. Selected media records are ALT/MISS/ORPHAN/PHOTO/Q/SHARED/VIDEO. Only O0–O3 produce confirmed inline associations.

The exact neutral event order is `[E0,E1,E2,E3,E5,E6,E7,E4]`. Occurrence order is `[O0,M0,O1,MMISS,O2,O3,O4]`. Media order is `[SHARED,MISS,PHOTO,VIDEO,ALT,ORPHAN,Q]`. Each table below states membership; these ordering rules determine the exact returned arrays.

### Literal base oracle

Every row uses active reviews and automatic unavailable handling unless specified. Unstated supporting resources are empty. `C` means candidate projection; `I` means standalone inventory IDs. These are distinct from ordinary media records `M`.

| Case | Query | Literal expected effective membership |
| --- | --- | --- |
| Q01 | UTC, years 2019 | E={E0}; O={O0}; M={SHARED}; I={}; C={} |
| Q02 | Oslo, years 2020 | E={E0,E1,E2,E3,E5,E6}; O={O0,O1,M0,MMISS,O2,O3}; M={SHARED,MISS,PHOTO,VIDEO}; I={}; C={} |
| Q03 | UTC, years 2020 | E={E1,E2,E3,E5,E6}; O={O1,M0,MMISS,O2,O3}; M={SHARED,MISS,PHOTO,VIDEO}; I={}; C={} |
| Q04 | Oslo, calendar days [2020-03-29,2020-03-30) | E={E2,E3}; O={O2,O3}; M={PHOTO,VIDEO}; I={}; C={} |
| Q05 | Oslo, calendar days [2020-10-25,2020-10-26) | E={E5,E6}; O/M/I/C={}. Both instants display 02:30 locally and remain distinct. Instant range [2020-10-25T00:00Z,2020-10-25T01:00Z) gives E={E5}. |
| Q06 | unavailable only | E={E4}; O={O4}; M={ALT,ORPHAN,Q}; I={ALT,ORPHAN,Q}; C={O4:[ALT,Q]}. These files have no asserted O4 attachment/date/recipient. |
| Q07 | Oslo 2020 AND people Maya/Jules AND conversations CM/CG AND kinds image/video AND sections chats/snaps AND links confirmed | E={E1,E2,E3}; O={O0,O1,O2,O3}; M={SHARED,PHOTO,VIDEO}; I/C={}. O0 selects an image occurrence although E0 is a text event. |
| Q08 | sections memories | E={}; O={M0,MMISS}; M={SHARED,MISS}; I/C={}. Only M0 supplies SHARED metadata/provenance. |
| Q09 | literal CAFÉ | E={E0,E1,E7}; O={O0,O1}; M={SHARED}; I/C={}. Literal `<b>coast</b>` instead gives E={E0}, O={O0}, M={SHARED}. Neither result contains CANARY-M0. |
| Q10 | links ambiguous | E={E4}; O={O4}; M/I={}; C={O4:[ALT,Q]}; inline={}; physical ordinary count 0, candidate files 2, historical occurrences 1. |
| Q11 | links unlinked | E={E5,E6,E7}; O={MMISS}; M={MISS,ALT,ORPHAN,Q}; I={ALT,ORPHAN,Q}; C={}. Missing count 1, physical originals 3, occurrences 1. |
| Q12 | sections inventory | E/O/C={}; M/I={ALT,ORPHAN,Q}; physical originals 3, occurrences 0. Adding years 2020 gives all sets empty. Adding unavailable include to that year query restores those three files. Adding participant Maya still gives all sets empty. |
| Q13 | In this case only, add E7's confirmed SHARED reference OCJ at E7's 2021 time; then UTC years 2019 AND conversations CJ | E/O/M/I/C={}. O0 supplies SHARED's 2019 fact and OCJ supplies its CJ fact, but no single occurrence proves both. |
| Q14 | sections memories AND literal CAFÉ | E/O/M/I/C={}. M0 cannot borrow café from O0/O1. |
| Q15 | years 2019 AND literal memory coast | E/O/M/I/C={}. M0 cannot borrow O0's year. |

### Literal review oracle

Start from the base fixture with media SHARED=keep and event E1=later. O0 is unreviewed, O1 is later, and M0 is keep. All other entities are unreviewed. A media projection may represent a matching later occurrence even though its own file decision is keep.

| Case | Query / additional decisions | Literal matched and effective membership |
| --- | --- | --- |
| R01 | reviews keep | E={}; O={M0}; M={SHARED}; I/C={}. Both projections agree. Only M0 context is returned. |
| R02 | reviews later | E={E1}; O={O1}; M={SHARED}; I/C={}. Both projections agree. Only O1 context is returned; M0 and O0 do not appear. |
| R03 | reviews unreviewed | E={E0,E2,E3,E4,E5,E6,E7}; O={O0,O2,O3,O4,MMISS}; M={SHARED,PHOTO,VIDEO,MISS,ALT,ORPHAN,Q}; I={ALT,ORPHAN,Q}; C={O4:[ALT,Q]}. M0/O1 do not appear. |
| R04 | Add E0=exclude; reviews exclude | Matched E={E0}, O={O0}, M={SHARED}; effective E/O/M/I/C={}. A kept shared file cannot override its excluded context. |
| R05 | Add E0=exclude; reviews all | Effective E excludes only E0; O excludes only O0; M still has all seven records through other eligible contexts/inventory. SHARED's scoped context has only O1/M0. No E0 text/provenance enters ordinary projections. |
| R06 | Replace SHARED decision with exclude; reviews later | Matched E={E1}, O={O1}, M={SHARED}; effective E={E1}, O/M/I/C={}. The historical event remains without its withheld attachment; direct keep on O1 cannot bypass file exclusion. |
| R07 | Rule deny inputs E0/E1 and SHARED; reviews all | Effective E={E2,E3,E4,E5,E6,E7}; O={O2,O3,O4,MMISS}; M={PHOTO,VIDEO,MISS,ALT,ORPHAN,Q}; I={ALT,ORPHAN,Q}; C={O4:[ALT,Q]}. M0 is also withheld across context by shared-file deny. Child keep on M0 changes nothing. |
| R08 | Clear that explicit deny snapshot, restore SHARED=keep/E1=later | Selection returns exactly the initial R01/R02/R03 results. Rule changes/undo are performed by a later adapter, not QUERY-01. |

Also test an own occurrence decision M0=later overriding file keep for its review facet. reviews keep then has E/O/M empty; reviews later has E={E1}, O={O1,M0}, M={SHARED}, each occurrence's exact scoped source IDs. Adding any explicit file exclusion still withholds both occurrences effectively.

## Additional complete fixtures and public acceptance tests

These fixtures extend or replace the base explicitly. Expected memberships and counts are literal assertions authored independently of the evaluator.

1. **Copy identity.** A SHARED-only fixture has Memories occurrences M0 and M1 at two different row pointers in one document with identical content/time and caption `repeat coast`. Each has two physical copies of that exact original document. M2 is an overlapping different document with identical visible fields. M3 is a conflicting row with caption/location `CANARY-OTHER`. Neutral O={M0,M1,M2,M3}, M={SHARED}, physical originals 1, historical occurrences 4. Literal `repeat coast` gives O={M0,M1,M2}, M={SHARED} and omits M3's canary. Reordering all source/input arrays preserves IDs/order/provenance. This validates evaluation of complete identity facts; reader digest/dedup behavior remains OCCURRENCE-01.
2. **Unknown membership.** Replace CU's events with U0 authored Maya and U1 authored owner, each with confirmed original UM0/UM1 and owning occurrences OU0/OU1. Scope remains unknown, observed authors include owner/Maya. people Maya selects E={U0}, O={OU0}, M={UM0}; it never selects U1/OU1/UM1. Proven membership added in a separate input snapshot selects both. Unknown recipient must not become a direct/group claim.
3. **Microseconds/date-only.** Use events Z_EARLY at 2020-01-01T00:00:00.000001Z and A_LATE at .000002Z with corresponding OZ/OA, each a distinct original. Their exact order is E=[Z_EARLY,A_LATE], O=[OZ,OA], regardless of opposite ID ordering. Range [.000001Z,.000002Z) selects only Z_EARLY/OZ. Add N_NEG at epochMicroseconds `-1`, exactly 1969-12-31T23:59:59.999999Z, with occurrence ON and original NEG. N_ZERO at `0`, exactly 1970-01-01T00:00:00Z, has OZERO/ZERO. N_POS at `1`, exactly 1970-01-01T00:00:00.000001Z, has OPOS/POS. UTC years 1969 gives E={N_NEG}, O={ON}, M={NEG}; years 1970 gives E={N_ZERO,N_POS}, O={OZERO,OPOS}, M={ZERO,POS}, excluding N_NEG. Exact instant range [1969-12-31T23:59:59.999999Z,1970-01-01T00:00:00Z) selects only N_NEG/ON/NEG; [1970-01-01T00:00:00Z,1970-01-01T00:00:00.000001Z) selects only N_ZERO/OZERO/ZERO. Calendar extraction must floor negative fractional instants rather than use BigInt division's truncation toward zero. Add D_DATE, with 2019-12-31 date-only, D_BAD invalid, and D_UNZONED un-zoned, with corresponding occurrences OD/OB/OU. UTC/Oslo years 2020 auto selects only the 2020 pair. unavailable only selects D_DATE/D_BAD/D_UNZONED and their occurrences; D_DATE keeps its date-only label. Years 2020 plus unavailable include selects that 2020 pair and the three unavailable records, excluding N_NEG/N_ZERO/N_POS. unavailable only plus years/range fails. A no-range query gives E=[N_NEG,N_ZERO,N_POS,Z_EARLY,A_LATE,D_DATE,D_BAD,D_UNZONED], O=[ON,OZERO,OPOS,OZ,OA,OD,OB,OU]. Bounds with both null canonicalize to neutral; blank bounds, 2020-02-30, unzoned bounds, more than six fractional digits, and reversed bounds fail.
4. **Association snapshots.** O4 ambiguous base has C={O4:[ALT,Q]}, no inline attachments. Confirm Q using typed owner proof: links confirmed selects E={E0,E1,E2,E3,E4}, O={O0,O1,O2,O3,O4,M0}, M={SHARED,PHOTO,VIDEO,Q}, C={} and inline O4→Q with owner-confirmed proof. Reject Q instead: links ambiguous retains O4 with C={O4:[ALT]}; no inline attachment. Undo snapshot restores C={O4:[ALT,Q]}. Two active confirmations or confirm MISS fails before producing a collection. Give Q exclusive physical proof source ID `SOURCE-Q-CANARY`, and ALT a different proof source. Deny/exclude Q under links ambiguous leaves E={E4}, O={O4}, C={O4:[ALT]}, M/I/inline={}; every effective association/proof/resource/diagnostic projection omits Q and SOURCE-Q-CANARY. Matched review and immutable input retain the original Q evidence. Deny/exclude E4 removes O4 and its candidate pool. A candidate reference never counts as two historical occurrences.
5. **Layers.** Add resolved image layer LV for VIDEO, plus orphan image layer LO and unresolved image layer LU. No layer has an instant or occurrence. kinds video returns E={E3}, O={O3}, M={VIDEO}, support={LV}, physical originals 1, supporting layers 1, unique physical resources 2, historical occurrences 1. Exclude LV keeps VIDEO/O3, support/compositions={}, unique physical resources 1. Exclude VIDEO keeps E3 but removes O3/VIDEO/LV. Exclude E3 removes E3/O3/VIDEO/LV; none becomes inventory. sections inventory has ordinary originals ALT/ORPHAN/Q and standalone layers LO/LU, history 0, physical resources 5; LV is absent. Year 2020 auto excludes every inventory resource, including LO/LU. Include-unavailable restores them without inherited VIDEO date/context.
6. **Scoped exclusion canary.** In the copy fixture select only chats, or select only a year that matches a chat occurrence but not M3. The complete effective projection must omit CANARY-OTHER and every M3 source ID, while immutable input retains them. Selecting SHARED through another occurrence after explicitly excluding M3 has the same guarantee. Only selected occurrence pointers/copies may enter ordinary metadata. These assertions cover prepared query records, not rewriting intrinsic original-file bytes or a future export adapter.
7. **Diagnostics.** An unknown-kind chats event DX and its occurrence remain one event/one occurrence. A diagnostic owned by DX adds only one scoped diagnostic, never a second historical record. An unowned unsupported diagnostic DU appears only in `reviewOnlyDiagnostics`, without inventing an origin/event/media record. In the copy fixture, DU cites M3's source IDs; explicitly deny M3 while selecting SHARED through M0/M1/M2. Effective O={M0,M1,M2}, M={SHARED}, and serializing the complete effective projection contains no M3 source ID or CANARY-OTHER. DU remains available only for deliberate review outside both selection projections. An owned diagnostic on M0 that also cites M3 similarly retains only M0's permitted source IDs in effective. Excluding/denying DX removes its owned diagnostic from effective. An unknown/dangling diagnostic source ID is invalid input. `sections: ['unsupported']` fails. No raw diagnostic row enters any projection.
8. **Canonical and failure behavior.** Equivalent reordered/duplicated sets and composed/decomposed literal queries yield deeply equal canonical queries and ordered results. Empty/whitespace text is neutral. Markup and regex metacharacters are literal. Turkish dotted-I cases retain the defined Unicode distinction. Reject malformed Unicode, >1,000-codepoint text, >64-member sets, unknown IDs, invalid timezone/enum/operator/version, incomplete occurrence input, dangling targets/proof references, and conflicting nonneutral scalar/plural inputs. Scalar year 2020 plus years [2020] agrees; scalar year 2019 plus years [2020] fails; neutral scalar null plus years [2020] preserves the plural. Separate invalid inputs contain unknown property key `PRIVATE-KEY-CANARY`, invalid/too-long text containing `PRIVATE-TEXT-CANARY`, and dangling proof value `PRIVATE-PROOF-CANARY`. Serialized errors contain none of these literals. Known field paths remain useful, while unknown field names are never echoed. Failed validation/selection leaves all input objects, decisions, revisions, and earlier results unchanged. Returned-array mutation cannot change input or another result.

## Verification and handoff

The [independent literal oracle](query-01-oracle.md) augments these required cases. [Design review](../reviews/query-01-design.md) records preflight acceptance; it does not accept an implementation.

Implement behavior slices red → green through the two public functions. The hand-authored fixture and literal oracle are the test seam. Tests must exercise conjunctions, uncertainty, privacy and retained precision, rather than reproduce internal helper logic. The independent reviewer freezes or corrects the oracle before code authoring. A distinct fixer handles valid code-review findings.

Run the targeted new tests with pnpm, then `pnpm run build` and the existing unit suite. This pure module changes no browser behavior, so do not claim UI completion or launch unrelated browsers merely for this slice. If the implementation accidentally imports browser/provider IO, fix that dependency before freezing. Inspect input immutability and imports as part of review. No network, credentials, private archive, paid provider, or external service is required for QUERY-01.

Freeze the function/type contract, exact passing test cases, remaining limitations, and the independent review report for root. Root authorizes later occurrence and adapter authors separately. No code or docs should claim Phase 5 completion from these pure tests.

## Explicit follow-on gates

- OCCURRENCE-01 must build complete versioned occurrences from actual ZIP/document bytes, prove copies before decode/redaction, preserve genuine repeats/missing references/conflicts/physical IDs, and provide exact time, membership and association facts. It must verify row/source ordinals and changed normalization fingerprints. QUERY-01's structural checks do not substitute for this proof.
- FILTER-01 must integrate the canonical module into workspace callers, scalar patch intent, equivalent-query revision handling, route/chip/Guide/Year callers, atomic saved-state validation/migration, occurrence decisions, overlay leases, scoped export input, timezone labels, and cross-room parity through actual-import browsers. Old/incomplete data must report missing capability rather than silently approximate.
- Full Phase 5 still needs removable controls/empty states, previewed participant/conversation rules and exceptions, frozen bulk actions, impact/history, exact undo/redo, optional explicit save/storage failure, fingerprint mismatch recovery, and measured large-query worker cancellation/stale-result behavior.
- External destinations and live paid AI require their own verified credentials, allowances, permissions, and approved packets. They are unrelated to QUERY-01 and do not block its local work. No demo product or visual backlog work is included.

## Preflight resolution map

Preflight findings 1–9 are addressed by, respectively: typed original-byte copy proof with distinct repeats; per-entity predicates and Q13–15; separate candidates and association snapshots; event-first review inheritance and R01–08/explicit denies; support-layer projections and layer fixture; scoped metadata/canaries; exact microseconds/date-only/time validation; inventory/diagnostic projections and Q12; full legacy conflict validation with atomic patch/restore explicitly assigned to FILTER-01. Reader-byte proof and adapter state transactions remain visible gates, not claims of completion.
