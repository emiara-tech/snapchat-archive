# QUERY-01 correction acceptance

Workspace authored the four-file pure query slice against baseline `04308fde`, the [accepted contract](../tasks/query-01.md) and [literal oracle](../tasks/query-01-oracle.md). Foundation independently reviewed original phases 2, 3 and 5 and repository standards. Experience made the distinct test-first corrections; foundation rechecked the frozen candidate. Root inspected the public interface and reran four independent manager probes. Both review axes are accepted.

| Finding | Accepted correction |
| --- | --- |
| Q-S1 | All own keys/descriptors validate before data reads. Accessors, symbols, unknown/known hidden DTO fields and hidden numeric array indexes reject without executing getters or echoing private keys. Standard array length and frozen enumerable DTOs remain valid. |
| Q-S2 | Numeric Gregorian calendar components and explicit era handle local years 0 and 10000 at the supported UTC limits. Negative microseconds, timezone years, exclusive ranges and DST retain precision. |
| Q-S3 | Total layer presentation order preserves known numeric order across all six mixed known/null permutations. Null remains unknown; stable IDs break presentation ties. |
| Q-S4 | Complete source/proof/copy/candidate/diagnostic memberships canonicalize deterministically without mutating input. Nested reorder checks compare complete projections. |
| Q-S5 | Export confirmation needs an attributable reference witness while reference-only and supplementary physical proof remain valid. A composition without permitted attributable proof and its support resource are withheld; global resolved-layer classification prevents orphan resurrection. Known supplemental input evidence remains filtered. |

The two public behavior functions are [query normalization and selection](../../src/lib/archiveQuery.ts), with [readonly types](../../src/types/archiveQuery.ts). Matching, review inheritance, typed denials, scoped candidates/resources, ordering and counts stay inside that module. Type-only imports introduce no page/store/reader/provider I/O, current-clock reads, retries or generic framework. The nonblocking readability judgment was addressed with concrete private helpers.

Verification on the final frozen code:

- [Repository query tests](../../tests/archiveQuery.test.ts) pass all 25 public behavior cases against internal [hand-authored evidence](../../tests/fixtures/queryArchive.ts).
- Foundation independently passed 18 public-interface probes, including original reproductions, hidden object/array fields, frozen input/output isolation and positive/scoped proof cases.
- The fixer passed 238 regular unit tests in 29 files and the production build. The existing opt-in large-export test was skipped; its earlier checkpoint result is separate.
- Root reran four public-interface probes for complete diagnostic order, mixed layer order and both extreme calendar boundaries. All passed. The required compile hook also passed while committing accepted design contracts.

No browser behavior changed or browser acceptance is inferred. No private archive, paid request, external transfer or public demo was used. Original-byte attestation and runtime complete occurrences remain OCCURRENCE-01; atomic consumer/state integration remains FILTER-01. The original Phase 4 source-order tie/undated requirement needs a separately reviewed producer-backed canonical amendment before thread/performance acceptance. Full phase, funded inference, hardware and release gates remain open.
