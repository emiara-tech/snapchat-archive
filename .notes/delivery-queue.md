# Delivery queue

This queue orders the remaining local work in the [original phase specs](specs/README.md). [Progress](progress.md) records active ownership, accepted outcomes and external gates. Promote a bounded task into that record when work starts, then preserve its review result there. A completed slice does not complete its parent phase.

Every task uses an author, an independent reviewer against the original spec, a distinct fixer for valid findings, and reviewer recheck. The manager also inspects the running user journey. TDD tests public behavior; domain and application rules stay independent of pages. Synthetic inputs remain inside tests through real import/API paths. The [full visual revamp](backlog.md) belongs to its separate future session.

| Order / task | Required local outcome | Depends on |
| --- | --- | --- |
| 1 / CHECKPOINT-01 | Close current AI-04 and SCOPE-02 correction loops, pass integrated build/unit/browser checks and commit an explicit private-safe delivery checkpoint. | Current progress handoffs. |
| 2 / [QUERY-01](tasks/query-01.md) | Pure versioned compound query validation/evaluation, timezone years/ranges, Unicode literal search, explicit undated behavior and exact ordered matched/effective IDs. | Current application interfaces; Phase 5. |
| 3 / OCCURRENCE-01 | Stable historical media occurrences distinct from physical files and copied source provenance. All contextual facets must match the same occurrence. Missing/ambiguous references remain explicit. | Query contract; phases 2/3/5. |
| 4 / FILTER-01 | One workspace adapter, removable filters/counts, no-op revision handling, validated saved-query compatibility and cross-room exact selection/timezone parity. | Query and occurrence contracts. |
| 5 / RULES-01 | Previewed participant/conversation exclusions with persistent precedence, shared-media protection, explicit exceptions, effect history and exact undo/redo. | Shared effective selection; Phase 5. |
| 6 / COVERAGE-01 | Inspectable source coverage, observed periods, malformed/unsupported/missing evidence and exact source pointers without inferring missing history. | Normalization/source identities; phases 2/3. |
| 7 / MEDIA-02 | Bounded mixed-media preview/download and bidirectional context for supported GIF/sticker/audio/video and every link state. Preserve original bytes. | Occurrences, coverage and effective exclusions; phases 3/4. |
| 8 / PERFORMANCE-01 | Indexed/paged query and conversation summaries, stale-work cancellation and measured large-history interaction/DOM/resource bounds. | Shared query/coverage; phases 2/4/5. |
| 9 / EXPORT-03 | Per-item failed/missing/unsupported/retry receipts, complete privacy/provenance audit and reopened realistic multipart context/composition bundles. | Effective collection and mixed media; Phase 6. |
| 10 / OBSERVATION-03 | Versioned metric/population/denominator/coverage/evidence contracts and independently checked writing-change and before/after-curation questions. | Query, rules and coverage; Phase 7. |
| 11 / SCENE-02 | Validated reproducible evidence-based scene preparation, factual style constraints, recorded-location precision and measured desktop budgets. | Observation contracts; Phase 8. Presentation revamp remains separate. |
| 12 / YEAR-03 | Complete measured language/context/contribution/copy/uncertainty/sufficiency/edit/temporal contracts with source-linked evidence. | Shared scope, rules and query; Phase 9. |
| 13 / AI-06 | Browser packet inspection/reduction, separate backend/provider consents, current authority/collection binding and explicit budget/status/cancel UI. | Accepted backend/client and effective scope; Phase 1. No automatic paid call. |
| 14 / DIALOGUE-01 | UI-independent grounded session/turn state, bounded retrieval, exact quotes, temporal evaluation, uncertainty and interruption handling. | Year profile, reviewed AI flow and deliberate result contract; Phase 10. |
| 15 / GUIDE-02 | Expanded typed local query/observation/navigation/export-preparation tools, ambiguity, inspected proposals and undo. Any paid interpretation has separate consent. | Shared query/rules/observations and application proposal interfaces; Phase 11. |
| 16 / REMINDER-01 | Verified-recipient consent, durable jobs, send idempotency, restart/cancel/return suppression and minimal retention through replaceable mail/clock/store boundaries. | Account ownership; Phase 0.1. Real delivery remains an external gate. |
| 17 / DESTINATION-01 | Account/instance-bound Google Photos and owner-controlled Immich transfer preparation/journals, cancellation, partial outcomes and explicit safe retry. | Export contract and reviewed authority; Phase 6. Real provider access/readback remains an external gate. |
| 18 / REVEAL-02 | Bounded versioned real-evidence highlights and useful missing-data alternatives. | Shared effective query/coverage; Phase 0.1. |
| 19 / RELEASE-01 | Clean-checkout full journey, inspectable private-safe diagnostics, route/asset retry/reset, upstream integration/current review, deployment revision and exercised operational recovery. | Verified required product slices; phases 0/12. |

Do local engineering independently of unavailable external access. Production auth/runtime, owner-funded live inference, ChatGPT client/plan approval, public scoped agent access, destination readback, real reminder delivery, hardware budgets and authorized owner evaluation retain their original separate acceptance gates. Do not substitute mocks or public demos for them.
