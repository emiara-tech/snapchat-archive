# EXPORT-02: correction review accepted

Scope: the export composition/split-output correction loop against [the original Phase 6 spec](../specs/phase-6.md). Author: `specs_foundation`. Independent reviewer: manager. Third fixer: `specs_experience`. The manager independently inspected the final code and reran the affected checks.

| Finding | Accepted correction |
| --- | --- |
| E1 | Original and known overlay byte sizes, including zero, are checked against the frozen plan before that asset can cause payload output. Mismatch rejects completion; output hashes remain recorded. |
| E2 | Split browser output awaits release of the current source URL before accepting another part. Cancel releases it immediately and cannot produce a complete receipt. Refused download initiation fails. The product distinguishes source handoff from disk completion, which page JavaScript cannot observe. |
| E3 | Composition checks source byte limits before copying/decoding; static image dimension limits apply before preview decode. Oversized originals remain downloadable with a diagnostic. Writer checks the composition budget before constructing derivative blobs. |
| E4 | Recorded nested layer transforms/placement are conservatively withheld unless supported, rather than guessed. Unrelated record fields do not suppress an otherwise supported layer. |
| E5 | The public export snapshot indexes events, assets, conversations, participants, physical entries and effective links. Confirmed attachments, mixed evidence states, timestamps and layer provenance survive the frozen snapshot. Views delegate this behavior. |

Standards: the snapshot and writer operate without Vue/page dependencies. Browser output is supplied through an I/O callback; image composition has a separate bounded interface. Originals are preserved and uncertainty is explicit. Public demo branches were removed; browser regressions now import test ZIPs through the actual product path.

Independent verification: production build passed; 30 affected unit checks passed. Three actual-import composition browsers passed, including independently expected pixels and exact oversized-original download. Both multipart browser checks passed on an isolated static build: saved parts/catalogue have independently verified bytes/hashes/inventory, one active ZIP source URL, and cancel produces no complete receipt. An earlier dev-server test was interrupted by a concurrent config reload; the isolated rerun establishes the affected final behavior.

An additional authorized local private check reopened a genuinely imported curated photo bundle. Its manifest payload sizes/hashes matched, original image bytes were exact, unfiltered source JSON was absent, and browser errors/external archive requests were absent. Private contents and downloaded bytes remain outside git. This verifies that small curated path, not a complete private archive or all context/format combinations.

Accepted only for E1–E5. Full Phase 6 remains open for complete privacy/provenance combinations, orientation/layer/video support, large metadata and originals beyond the documented reader limit, realistic private bundle reopen, large browser disk integrity, and genuine destination transfers. A generated large writer benchmark does not close those browser/destination gates.
