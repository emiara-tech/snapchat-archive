# OCCURRENCE-01 design acceptance

The foundation agent authored the [producer contract](../tasks/occurrence-01.md). Root reviewed it against original phases 2, 3 and 5, the accepted QUERY contract/oracle and the current dataset/reader/store boundaries. The experience agent made the distinct correction; root rechecked the frozen result. Both design findings are closed.

| Finding | Accepted correction |
| --- | --- |
| O-D1 | The pure owner-decision helper requires durable decision ID, exact occurrence/reference/candidate targets, supplied timestamp and immutable source-evidence revision. Missing/stale/dangling/competing proof rejects before projection. Existing type fields may remain optional for staged compilation; FILTER owns complete runtime records, persistence and integration. No-decision exported baseline evidence remains valid. |
| O-D2 | Known possible base/layer relationships remain typed normalized facts separate from resolved query composition. Role/source/revision validation, shared-layer protection and unknown-relation/orphan limitations are explicit. Possible relations cannot authorize composition or historical context. |

The producer fixes losses in the existing normalization pass. It hashes original document bytes before fatal decoding, preserves row/reference multiplicity, corrects sanitization-based merging, publishes exact signed time and separates recorded participation from membership proof. Text-only input cannot attest original bytes or publish complete occurrence capability. Normalization version 5 rejects version-4 portable choices; valid supported identities stay stable and conflated partitions split explicitly.

The per-document 128 MiB and proposed aggregate 256 MiB ceilings require synthetic resource/cancellation validation before implementation acceptance. They do not establish heap budgets or complete history. Unsupported/unreadable sections retain attested source diagnostics and unknown content; canceled, skipped, budget-limited or unverified work cannot publish success.

Design is accepted for staging after QUERY code/type acceptance. Bind final DTO names and validation to that frozen implementation, then use serial author/reviewer/third-fixer/recheck stages over shared normalization files. No loader code, resource measurement, complete phase, external integration or release is accepted by this record.
