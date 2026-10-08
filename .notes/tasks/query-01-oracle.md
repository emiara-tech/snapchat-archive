# QUERY-01 independent literal oracle

This augments the frozen author's Q01–Q15, R01–R08 and complete fixtures. It is an implementation checklist, not a query evaluator or new interface. All expected IDs and counts below are handwritten. Each case starts from the named fixture with empty decisions/deny sets unless explicitly stated. Unstated facets are neutral, reviews are active and unavailable handling is automatic.

Use `E` for ordered event IDs, `O` for ordered historical occurrence IDs, `M` for ordinary selected media records, `I` for standalone inventory, `S` for support resources and `C` for candidate references. Inline associations require both selected owning event and selected confirmed occurrence. Compare complete effective records, proof, diagnostics and resource relationships as well as ID arrays.

## Exact time boundaries

Use an isolated three-event fixture, each with one confirmed original and a same-time owning occurrence:

| Event | Epoch microseconds | Occurrence | Original |
| --- | --- | --- | --- |
| N_NEG | -1 | ON | NEG |
| N_ZERO | 0 | OZERO | ZERO |
| N_POS | 1 | OPOS | POS |

The exact instants are 1969-12-31T23:59:59.999999Z, 1970-01-01T00:00:00Z and 1970-01-01T00:00:00.000001Z. Neutral order is E=[N_NEG,N_ZERO,N_POS], O=[ON,OZERO,OPOS], M=[NEG,ZERO,POS]. Stable ID order must not replace exact chronological order.

| Query | Literal effective arrays |
| --- | --- |
| UTC years [1969] | E=[N_NEG], O=[ON], M=[NEG] |
| UTC years [1970] | E=[N_ZERO,N_POS], O=[OZERO,OPOS], M=[ZERO,POS] |
| Europe/Oslo years [1970] | E=[N_NEG,N_ZERO,N_POS], O=[ON,OZERO,OPOS], M=[NEG,ZERO,POS] |
| UTC calendar days [1969-12-31,1970-01-01) | E=[N_NEG], O=[ON], M=[NEG] |
| Instant range [1969-12-31T23:59:59.999999Z,1970-01-01T00:00:00Z) | E=[N_NEG], O=[ON], M=[NEG] |
| Instant range [1970-01-01T00:00:00Z,1970-01-01T00:00:00.000001Z) | E=[N_ZERO], O=[OZERO], M=[ZERO] |

Every case has I/S/C empty. Declaring -1 microsecond with millisecond or second precision is invalid input; it cannot round into another instant. Canonical signed integers reject `-0`, `01`, `+1` and noninteger values.

In the author's date-only fixture, unavailable-only selects D_DATE/D_BAD/D_UNZONED and their occurrences. D_DATE retains the recorded 2019-12-31 date. A year or nonneutral range combined with unavailable-only returns validation failure, not a silently ignored filter. Years 2020 with include selects the two 2020 instants and those three unavailable records, without adding the 1969/1970 instants.

## Candidate facts cannot supply occurrence kind

Use the base O4 reference, recorded event E4 kind audio, declared reference kind unknown, ALT/Q physical kinds gif.

| Query | Literal effective membership and counts |
| --- | --- |
| kinds [gif], links [ambiguous] | E/O/M/I/S/C all empty; historical count 0 and original physical count 0 |
| kinds [unknown], links [ambiguous] | E=[], O=[O4], M/I/S empty, C=[{O4:[ALT,Q]}]; historical count 1, original physical count 0, candidate files 2, inline empty |
| kinds [gif] | E/O/S/C empty, M=[ALT,Q], I=[ALT,Q]; physical originals 2, historical count 0, inline empty |

The second case demonstrates that a selected occurrence need not force its audio event into the event set. The third selects standalone physical bytes without O4 time, recipient, caption or inline association. One surviving candidate after rejection remains ambiguous/inferred with the supplied uncertain state.

## Denied candidates and proof are scoped together

In the base fixture assign Q's physical evidence the source ID SOURCE-Q-CANARY. O4 has separately attributed ALT and Q candidate proofs. Deny media Q.

With links [ambiguous], effective E=[E4], O=[O4], M/I/S empty and C=[{O4:[ALT]}]. Inline is empty, historical count is 1, candidate references 1, candidate files 1 and ordinary physical files 0. Q and SOURCE-Q-CANARY must be absent from every effective occurrence association, candidate proof, resource, owned diagnostic and count. Permitted O4 reference proof and ALT proof remain. Matched review evidence and immutable input retain Q.

With a neutral query, effective E=[E0,E1,E2,E3,E5,E6,E7,E4], O=[O0,M0,O1,MMISS,O2,O3,O4], M=[SHARED,MISS,PHOTO,VIDEO,ALT,ORPHAN], I=[ALT,ORPHAN], S=[], C=[{O4:[ALT]}]. Counts are 8 events, 7 historical occurrences, 5 original physical files, 1 missing record, 2 standalone inventory originals, 1 candidate reference, 1 candidate file and 5 unique physical resources. Denied Q cannot reappear through inventory or a copied association object.

Deny event E4 instead, without a Q file deny. With a neutral query, effective E=[E0,E1,E2,E3,E5,E6,E7], O=[O0,M0,O1,MMISS,O2,O3], M=[SHARED,MISS,PHOTO,VIDEO,ALT,ORPHAN,Q], I=[ALT,ORPHAN,Q], S/C empty. Q/ALT remain independently permitted physical inventory, with no O4 context. A later participant rule that withholds those bytes must provide explicit media deny targets.

Candidate MISS, a layer candidate, unavailable candidate bytes, duplicate candidate IDs or an unknown candidate ID fail before a collection is produced. ALT proof citing Q's exclusive physical source fails attribution validation.

## Own decisions do not override exclusions

Start from the base with media SHARED=keep, occurrence O0=keep and event E0=exclude. Query reviews [keep]. Matched E=[], O=[O0,M0], M=[SHARED], I/S/C empty. Effective E=[], O=[M0], M=[SHARED], I/S/C empty. The effective SHARED context contains only M0 and its exact copied sources. E0/O0 text and source pointers are absent. Historical counts are matched 2 and effective 1; original physical count is 1 in both.

Add media SHARED=exclude, keeping O0=keep, and use reviews [keep]. Matched O=[O0], M=[SHARED]. Effective E/O/M/I/S/C are all empty. The child status affects review matching, never exclusion authority.

Namespace collision is a separate invalid-target oracle. Give an event and media record the same allowed ID, then deny the typed event only. Its event and occurrences disappear; unrelated standalone media with that same string remains selectable. No untyped string expansion is allowed.

## Proven support edges do not add history

Use an isolated fixture with B1/B2 originals, V1/V2 owning events, OV1/OV2 confirmed occurrences and available layer L. Exact source proof independently supports B1→L and B2→L. No orphan inventory exists. A neutral query selects both original occurrences and S=[L], with historical count 2, original physical count 2, support count 1 and unique physical resource count 3.

Deny event V1. Effective E=[V2], O=[OV2], M=[B2], S=[L], with one composition edge B2→L. Historical count 1, original physical count 1 and unique physical resources 2. The denied V1/B1 edge and its context are absent. Deny both V1 and V2 and every effective set/resource is empty. L never becomes standalone inventory merely because its proven contexts were withheld.

Deny layer L while both events remain eligible. Both originals/events/occurrences remain, S and composition references are empty, and unique physical resources are 2. A separate fixture with one base and two independently proven distinct layers selects both support IDs without adding historical counts. Duplicate or contradictory edges, missing targets or reversed layer→original roles fail validation. The module never resolves ambiguous competing edges or invents order.

## Diagnostic and source canaries

Use the author's copied Memories fixture M0/M1/M2/M3→SHARED. Deny occurrence M3. Effective O=[M0,M1,M2], M=[SHARED], historical count 3 and original physical count 1. A global DU citing M3 sources appears only in reviewOnlyDiagnostics. A diagnostic owned by M0 and citing both M0 and M3 projects only permitted M0 sources in effective. Serialize the complete effective projection and assert absence of M3 source IDs and CANARY-OTHER. Immutable input still contains both.

This guarantee concerns generated contextual metadata and proof. It does not promise to edit intrinsic pixels or metadata inside preserved original file bytes, and it does not suppress deliberate raw-source inspection.

## Validation and immutable transactions

Failure cases include chats/snaps occurrence without an owning event, Memories occurrence with an owning event, conflicting owner time/origin, dangling source/proof references, incomplete occurrence capability, duplicate occurrence identity, malformed original-document digest, unknown IDs and unsupported versions. None produces a partial or broadened collection. Unknown private property names, overlong private text and private dangling proof values must be absent from serialized safe errors.

Literal full-query compatibility cases are scalar year 2020 plus years [2020] succeeds; scalar year 2019 plus years [2020] fails; neutral scalar null plus years [2020] preserves [2020]. Omitted reviews normalize to [keep,later,unreviewed] under the specified code-unit sort; explicit reviews [] means [exclude,keep,later,unreviewed]. Query/review/dataset revisions are echoed unchanged, never created by selection.

Freeze input, decisions and a prior result before both successful and failing calls. Reorder complete source/entity input arrays and require the same literal ordered selections and scoped source memberships. Mutating a returned nested projection must neither change input nor another independently returned projection. These public tests establish the module's contract without testing internal index helpers.
