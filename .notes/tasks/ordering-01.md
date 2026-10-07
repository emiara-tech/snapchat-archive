# ORDERING-01: Canonical recorded source order

Accepted canonical amendment design after independent review, distinct correction and recheck. It changes no runtime behavior. Final OCCURRENCE-01 stage-1 and stage-2 producer facts, identity tests, supported container traversal and field names must freeze before implementation. [Design acceptance](../reviews/ordering-01-design.md) records the bounded correction.

Originating requirements are [Phase 4](../specs/phase-4.md), especially criteria 1, 2, 5 and 7; [QUERY-01](query-01.md) and its [independent oracle](query-01-oracle.md); the accepted original-byte/identity policy in [OCCURRENCE-01](occurrence-01.md); and the source-order prerequisite in PERFORMANCE-01. Original phase gates remain binding.

## Value and current difference

The owner can recognize the recorded sequence of equal-time messages and attachments. Undated evidence remains readable in its recorded sequence, with an honest limitation when unrelated documents cannot establish chronology. Re-importing parts or adding a proven copy cannot move a logical message merely because a runtime source handle changed.

Accepted QUERY-01 currently sorts usable instants by exact epoch microseconds, then stable ID. It sorts date-only records by recorded date and ID, then unavailable records by ID. This is deterministic and passed its original literal oracle. A stable hashed ID does not establish source order. Original Phase 4 separately requires source-order ties and source-order undated evidence. This proposal changes only that canonical ordering behavior through an explicit reviewed version boundary.

The canonical matcher continues to own selection, review inheritance, exclusions, resources, proof, counts and ordering. Views, the performance worker, thread indexes, profiles and exports consume its returned order. No page sorter, worker sorter, injected comparison callback, timeline parser, parallel matching engine or new public behavior function is introduced. Retain `normalizeArchiveQuery` and `selectArchiveCollection` as the two public behavior interfaces.

## Producer prerequisite and minimum facts

For each logical historical row, ordering needs the proven origin, original document path and original document SHA-256, plus a numeric recorded row position. Each event-owned reference additionally has its existing numeric reference ordinal. An event-owned occurrence uses its owning event's exact row position; a Memories occurrence uses its own row position. Original document identity comes from byte proof, not a source ZIP digest, runtime source ID, first copy, ZIP selection index or media filename.

The row position must be captured in the existing normalization pass before filtering, event-copy grouping, credential redaction and skipped-row compaction. It must resolve to the exact original row pointer and be identical for corresponding rows in byte-proven document copies. Array element positions compare numerically. Position 2 precedes position 10 regardless of stable item IDs or lexical pointer order.

Final producer binding must answer the multi-container case explicitly. If it supplies one document-wide numeric position, its supported container traversal rule must be source-backed and stable, with every original slot represented before skipped-row compaction. If only a within-container row position is supported, the typed fact must also retain the supported container position/order and the limitation between independent containers. A JSON pointer string or arbitrary Object.keys traversal cannot silently claim original byte-level member order. Numeric object-key behavior deserves its own literal fixture. Do not build another parser to hide missing producer facts. Freeze the narrow supported rule or keep that capability unavailable.

The minimum logical facts are therefore a document identity and an exact recorded position, plus reference ordinal for occurrences. Use the producer's existing accepted identity/source facts wherever available. `QueryOccurrence.identity` already contains document digest/path, row pointer and reference ordinal; it does not establish numeric row order. `QueryEvent.sourceIds` establish local references but contain no explicit recorded position. Bind a small readonly ordering fact to those records rather than supplying a generic sort key or a callback.

Do not place the new ordering position inside the version-1 logical identity hash. It describes presentation order of existing proven rows. Preserve valid event/participant/conversation/media/link/occurrence IDs and accepted copy membership. Corrected legacy partitions remain OCCURRENCE-01's responsibility. The amendment cannot merge or split evidence to obtain a convenient order.

## Total canonical order

Use a total lexicographic comparison. A comparator that compares row positions for same-document pairs but stable IDs for cross-document pairs can be nontransitive. The following rule gives every eligible row one stable position:

1. Usable exact instants precede rows whose instant is unavailable.
2. Two usable instants compare by exact signed epoch microseconds. Unequal instants determine chronology, even if their source positions are reversed.
3. Equal usable instants compare by logical-document order, then numeric recorded row position, then numeric reference ordinal where applicable, then stable item ID as the final deterministic fallback.
4. All rows without usable instants compare by that same logical-document/recorded-position/reference/ID order. They are not reordered by date-only labels or absent/invalid/un-zoned reason.

Logical-document order is a deterministic presentation rule. Proposed fixed comparison is origin in `chats`, `snaps`, `memories` order, then original document path by code-unit comparison, then original document SHA-256 by code-unit comparison. All fields must already be validated. Document path and digest identify evidence; this tuple does not claim that one unrelated document happened before another. Do not use localeCompare, file picker order, ZIP filename, filesystem modification time or runtime source ID.

If the final supported position is a numeric tuple, compare each component numerically in the frozen order, never as a joined string. For the current per-event reference sequence, reference ordinal is subordinate to its owning row, so all slots of row 2 precede slots of row 10 at an equal instant. A repeat rank describes occurrence identity and does not override the recorded row position.

All byte-proven copies of a logical row have the same document identity and position. CopySourceIds and their ordering remain provenance, not chronology inputs. Adding, removing or reordering copies may change archive authority but cannot reorder unchanged logical rows. Reordered multipart selection retains supported IDs, fingerprint and canonical order under OCCURRENCE-01's existing identity rule.

## Date-only and unavailable evidence

Date-only, invalid, absent and un-zoned records remain in the partition without a usable instant. Preserve the exact recorded date and distinct reason in their existing time DTOs. A date-only value is a known date with unavailable time/zone, not an unknown date. It does not become midnight, acquire the workspace timezone or enter the usable chronological partition.

Within that partition, recorded source positions determine order, including interleaved date-only and invalid/absent records in one document. Across documents, use the documented stable document rule and label chronology as unavailable where the product explains that ordering. A recorded date is displayed as evidence and is not used as an invented instant or a reason to move a row out of its source sequence.

Temporal facets remain exactly QUERY-01's accepted semantics. `unavailable: auto/include/exclude/only`, years, calendar-day ranges, exact instant ranges and timezone calculations are unchanged. Date-only still satisfies unavailable-instant eligibility, and unavailable-only combined with a nonneutral year/range still fails. This amendment changes ordering of eligible rows, never temporal matching.

## Other collection behavior remains binding

The amendment orders canonical event and occurrence arrays and their ID arrays. Candidate references follow the amended occurrence order; candidate IDs retain their existing code-unit order. Confirmed inline associations retain the corresponding selected occurrence order and still require both selected event and selected confirmed occurrence.

Preserve selected media-record ordering by earliest usable time among that record's selected proven/missing occurrences, then media ID. Records without selected usable occurrence time remain last by media ID. Preserve inventory/support resource ID ordering, candidate/proof/source canonicalization, diagnostic ordering and the accepted total layer-presentation order, including unknown null order. A physical file is not assigned one historical source-row position by borrowing from an unrelated appearance.

Membership, counts, facets, review inheritance and exclusion authority are unchanged for equivalent eligible evidence. Source-order facts cannot grant a recipient, attachment, date or composition proof. An excluded row or candidate cannot re-enter via an ordering index. Copy provenance cannot increase historical counts. Reordering complete input arrays remains observationally irrelevant.

Ordinary output contains only the selected record's minimal validated ordering facts if consumers require them. Do not add a document-wide row table, all copy pointers, denied target list, raw fields, diagnostic inventory or arbitrary source references to ordinary projections. Pure matching may validate complete input, but profiles/exports/observations continue to receive scoped effective records. Numeric source positions do not authorize raw-source inspection or broader source-context lookup.

## Validation and version authority

Final typed facts must bind ordering to the exact row and immutable evidence revision. Validate document digest/path/origin against the record's established row source facts and existing occurrence identity. Validate numeric positions and reference ordinals as finite safe nonnegative integers. Distinct logical rows cannot share one recorded position inside one supported sequence; corresponding proven copies can. Several references in one row share the row position but have their distinct exact reference ordinals.

Event-owned occurrences must agree with the owning event's row/document position. Validate any supplied container tuple against its supported producer rule. Supplementary physical association proof does not supply historical row order. Missing, contradictory, stale or dangling facts fail safely with fixed field paths and error codes. They never fall back silently to hashed-ID ties. Preserve QUERY-01's getter-free descriptor validation, strict own-key policy, dense arrays, frozen enumerable DTO support, safe errors and fresh isolated projections.

The minimum amendment needs one explicit ordering/calculation-capability version for the changed canonical result, proposed name `recorded-source-v1`. Bind the actual field and required protocol locations after the final producer facts freeze. Carry that version through the canonical calculation/result authority, portable state, async stamps, prepared indexes and page cursors. Do not preselect global queryVersion or occurrenceVersion rewrites. Keep matchingVersion `literal-nfc-lower-v1` and logical identityVersion 1 because text matching and copy/row identity do not change. Any schema adjustment required to admit validated ordering facts receives its own explicit compatibility check during final binding; it cannot become an extra registry or a silent fallback.

OCCURRENCE-01's normalization-5 authority remains the staged source-identity boundary. The ordering amendment alone does not alter original bytes, document proof, valid logical IDs or the immutable base-evidence fingerprint. If a producer correction changes the material source facts, its accepted normalization/identity policy owns the resulting boundary. An ordering/calculation version prevents reuse of an old cached result without relabelling unchanged source proof as different evidence.

Portable restoration validates schema, normalization/evidence fingerprint and supported canonical ordering/calculation capability before applying decisions, proposals, history, selections or page cursors. A prior file without the new capability cannot silently acquire it merely because its facets are equivalent. Explicit verified migration may be a separate FILTER task; default behavior is a visible mismatch and no mutation. Existing normalization-4 rejection remains required. Async stamps/cursors/indexes include the changed capability authority and cannot reuse an old stable-ID or date-first ordering result.

## Independent literal adversaries

Use complete hand-authored evidence after producer fields freeze. Omitted query facets retain QUERY-01's documented defaults, including active reviews. Each case explicitly names any nonneutral facet or all-review request needed for its expected population. IDs deliberately disagree with source order. Expected arrays are literal, not generated by a new comparator, the producer or a thread index.

| Case | Literal expected result |
| --- | --- |
| O1. Equal instant, numeric row order | In document D, event `Z_ROW_2` is at row 2 and `A_ROW_10` at row 10, both at `0` microseconds. Events are `[Z_ROW_2,A_ROW_10]`, despite opposite ID order and lexical `/10` preceding `/2`. |
| O2. Numeric reference slots | Row 2 has occurrence `Z_SLOT_2` at reference ordinal 2 and `A_SLOT_10` at ordinal 10. Occurrences are `[Z_SLOT_2,A_SLOT_10]`. Add row-10 occurrence `FIRST_BY_ID` at ordinal 0; the result is `[Z_SLOT_2,A_SLOT_10,FIRST_BY_ID]`. Declared duplicate tokens still represent distinct source slots. |
| O3. Exact chronology precedes row order | In D, row-10 `A_EARLY` is at `-1` microsecond and row-2 `Z_LATE` at `0`. Events are `[A_EARLY,Z_LATE]`. Add `M_NEXT` at `+1`; the result is `[A_EARLY,Z_LATE,M_NEXT]`. Rounding to milliseconds cannot create a tie. |
| O4. Same instant, precision labels | Equivalent exact `0` instants with supported second/millisecond/microsecond precision sort by recorded positions, without a precision-rank sorter. Their time DTOs retain the declared precision. Invalid divisibility remains a validation failure. |
| O5. Undated mixed reasons | One document has row-2 `Z_INVALID`, row-3 `Y_DATE_2020`, row-4 `X_ABSENT`, row-10 `A_DATE_2019` and row-11 `B_UNZONED`. Order is exactly that row sequence. Both recorded dates survive unchanged; invalid/absent/un-zoned reasons remain distinct. No fabricated instant exists. |
| O6. Usable partition versus date labels | Add usable event `USABLE_2021` to O5. It precedes all five unavailable-instant rows. A 2019 recorded date cannot become an earlier chronological instant. Unavailable-only omits USABLE_2021 and preserves O5's literal order. |
| O7. Cross-document deterministic rule | Two trusted hand-authored query documents share the same path and equal row times but have document SHA-256 fields `0000000000000000000000000000000000000000000000000000000000000001` and `0000000000000000000000000000000000000000000000000000000000000002`, each with row 2. Their IDs oppose digest order. Document-1's row precedes document-2's row under the frozen document tuple. Swap source selection order and every input array; the result is unchanged. The pure fixture does not claim to attest bytes; actual-ZIP cases use independently computed real document digests. This is presentation order with unknown relative chronology. |
| O8. Transitivity adversary | D1 has row-2 `Z` and row-10 `A`; D2, ordered after D1, has `M`. All instants are equal. Order is `[Z,A,M]` for all six input permutations. Pairwise same-document row order with cross-document ID order would create a cycle and cannot satisfy this case. |
| O9. Byte-copy provenance | Add a proven second copy of D1 to O8, with runtime source IDs and ZIP entry ordinals ordered differently. Events and occurrences retain their exact previous order and count; each copied row gains one provenance. Removing one copy retains logical order. A different overlapping document adds its own row at its document's canonical position. |
| O10. Multiple containers | Freeze the producer's supported numeric container/document traversal facts and handwritten positions before this case is executable. Two containers use positions 2 and 10 and row positions 2 and 10, with IDs and pointer strings opposing numeric order. Verify the exact frozen sequence and reject unsupported claims of original object-member order. This case is a prerequisite, not an invented currently supported export rule. |
| O11. Filters and exclusions | Exclude row 2 in O1. With explicit `reviews: []`, which requests all review statuses, matched order is `[Z_ROW_2,A_ROW_10]` and effective order is `[A_ROW_10]`. With omitted reviews, the active-review default gives `[A_ROW_10]` in both projections. Neither excluded row/source canary nor its occurrence/proof enters the effective result. Undo restores the prior literal order without renumbering positions. Equivalent compound facets retain identical selected sets and counts. |
| O12. Isolated occurrences and media | Select an occurrence whose owning event fails an event-specific kind facet. Its own amended order remains correct without forcing that event into eventIds. Media ID ordering and unique physical counts stay under the prior rule. A shared file's denied Memories date/caption canary cannot supply event order or return through resources. |
| O13. Validation privacy | Individually corrupt/miss position, digest/path relation, owning-event position or protocol version. Every call fails safely, changes nothing and echoes no private key/value/source pointer. Getter/symbol/nonenumerable DTO adversaries remain rejected without executing getters; deep frozen enumerable DTOs remain valid. |
| O14. Portable and index authority | A prior state/result/cursor lacking the accepted recorded-source ordering capability is rejected before mutation, even with equal facet values, unchanged base evidence and bare target IDs. Reordered identical supported multipart evidence restores safely under the complete FILTER contract. A materially different fingerprint is still a mismatch. |

All existing query oracle cases for conjunctions, exact negative microseconds, timezone limits/DST, candidates, review inheritance, layers, diagnostics, canaries, mutation isolation and counts remain binding. Explicitly update only the previously accepted stable-ID tie/date-first ordering expectations through this amendment's independently reviewed recorded-source ordering literals.

## Delivery and verification prerequisites

1. Freeze OCC stage-1 byte/row identity and stage-2 reference facts with their independent review/fix/recheck. Confirm their actual typed ordering capability, supported container traversal, field names and immutable authority. Missing capability keeps amendment implementation blocked; it does not authorize approximating a row position from an opaque ID.
2. Independently review this bounded canonical amendment against Phase 4, the current accepted query contract, exclusion/privacy rules and PERFORMANCE-01. Resolve the proposed version transition and multi-container rule before adding types or tests.
3. Author one meaningful public-interface regression red to green at a time in QUERY and producer-owned files under explicit serial ownership. Use a distinct independent reviewer and third fixer. No callbacks or additional public sorting interface.
4. Run affected producer/query tests, full unit verification once stable and a redacted build. Actual generated ZIP imports must verify equal-time and unavailable source order, proven copies, source lookup and reordered parts before the canonical thread contract is accepted. No private archive, public demo or paid call is needed.
5. PERFORMANCE-01 consumes the amended ordered result and prepares its indexed summaries/windows without sorting again. Its 100,000-event/jump/interaction measurements remain separate gates; passing this small literal oracle does not establish performance.

This design accepts no code, resource measurements or full phase. Original Phase 4/5, OCCURRENCE-01, FILTER-01 and PERFORMANCE-01 acceptance remains open.
