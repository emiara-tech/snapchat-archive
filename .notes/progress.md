# Project progress

Read this file when starting or resuming delivery, including after context compaction. Inspect the current diff and live agent ownership before editing. Update the relevant task after a review handoff, verified result, or change in product direction. Keep one current entry per task rather than an execution diary.

[The masterplan](../MASTERPLAN.md) and [phase specifications](specs/README.md) define acceptance. A verified local slice does not complete a phase, external integration, or production release. Reproducible repository tests and recorded outcomes preserve handoff meaning if temporary reports disappear. Keep secrets and private archive contents out of this file.

## Product decisions

- Build real archive features. Synthetic fixtures are internal test inputs through actual import/API paths. Public demo modes, fabricated histories, and scripted substitutes for AI are outside scope.
- TDD guides correctness and simple modular code. Distinct agents implement, review against the original spec, fix findings, and recheck. The manager also evaluates the running product.
- Keep domain, query, curation, export and inference behavior independent of page components. The UI consumes small application interfaces; rendering and browser/provider I/O have replaceable boundaries.
- A full visual revamp, including dark mode and a cinematic treasure-chest front page, belongs to a separate future session in the ideas backlog. It is not added to the current implementation plan.

New delivery context lives in [this notes directory](README.md). [VISUAL-001](backlog.md) is the future-session visual revamp; its detail is preserved under `ideas/`.

## Completed slices

These outcomes were completed locally. Later edits still require their affected checks. Full phase gates remain below.

| Task | Completed outcome | Evidence and limits |
| --- | --- | --- |
| PLAN-01 | Specs written for all phases: 0, 0.1, and 1–12. Distinct implement/review/fix/recheck loop defined. | [Spec index](specs/README.md); full gates remain binding. |
| DOC-01 | TDD correctness and code-quality principle recorded in AGENT.md and linked from project instructions. | Commit `9cd6e9b`. |
| CTX-01 | New delivery specs, progress and ideas organized under `.notes/`; resume instructions point to the progress record. Full visual revamp preserved separately in the backlog. | [Notes index](README.md), [backlog](backlog.md), and checked relative links. |
| AUTH-01 | Real staging WorkOS sign-in survives reload; sign-out remains signed out after reload. | User verified both journeys. [Account](../tests/accounts.test.ts), [identity](../tests/identity.test.ts), and [browser](../e2e/accounts.spec.ts) checks cover failures. Local staging only; production auth is not established. |
| AUTH-02 | Verified identity, one-use browser-bound PKCE, encrypted sessions, refresh/logout races, persistent isolated sessions, and separate AI-provider connection boundaries passed review/fix/recheck. | Account, identity, and [local-store tests](../tests/localAccounts.test.ts). Paid requests and hot-reload store ownership remain separate open tasks. |
| DATA-01 | Traceable records, stable source identities, owner evidence, uncertainty, media inventory, and conservative overlay associations passed review/fix/recheck. | [Dataset](../tests/dataset.test.ts) and [lifecycle](../tests/archiveLifecycle.test.ts) tests. Supported inputs are covered; arbitrary undocumented formats are not claimed. |
| WORK-01 | Conversations, source inspection, media context, bounded lists, shared exclusions, undo, explicit review-file save/restore, and association review passed review/fix/recheck. | [Workspace unit](../tests/workspace.test.ts) and [browser](../e2e/workspace-review.spec.ts) checks. Full filtering/performance gates remain. |
| GUIDE-01 | A real local command interface finds evidence and previews reversible curation; unsafe/ambiguous requests are refused. | [Experience unit](../tests/experience.test.ts) and [browser](../e2e/experience.spec.ts) checks. Open-ended AI assistance remains undelivered. |
| PRIVATE-01 | The available private multipart archive was imported locally; actual image decoding and video playback worked with no external archive requests or browser errors. | Private evidence stays outside git. This does not prove every media/export format or production readiness. |
| SCOPE-01 | Public demo route/factory and canned year-room dialogue removed. Arrival/request now lead to actual import/request. | [Product-scope browser checks](../e2e/productScope.spec.ts) passed. Broader conversions and independent integrated recheck remain pending. |

## Active tasks and next handoffs

Assignments describe current ownership. Check live agents when resuming.

| Task | Status and owner | Required next result |
| --- | --- | --- |
| OBS-02 | Third-agent fixes frozen by `specs_foundation`; independent re-review by `specs_experience`. Manager authored this slice. | Recheck O1–O5: GPU lifetime/fallback, source return, excluded-review navigation, conversation scope proof, correct units. Implementer reports 35 units, 9 real-import browser regressions, typecheck; reviewer acceptance still pending. Shared thumbnail queue bounds overlapping generations. |
| AUTH-03 | Third-agent fix by `specs_foundation`; manager authored, `specs_workspace` reviewed. | Close R1: actual Vite invalidation reuses/closes the persistent store and shutdown releases it. Existing routing/privacy tests are green; lifetime regression remains open. |
| EXPORT-02 | Third-agent fixes frozen by `specs_experience`; manager independently rechecking. `specs_foundation` authored. | Recheck E1–E5: frozen-plan byte checks, browser download backpressure/cancel, byte/pixel limits before decode, unsupported placement withheld, indexed export snapshot. Manager independently reran build and 30 units successfully; browser multipart/composition recheck is running. |
| YEAR-02 | Third-agent fixes queued for `specs_experience` after export; `specs_workspace` authored, manager reviewed. | Close Y1–Y3: draft survives source return, budgets apply to eligible owner/year evidence with explicit omissions, every reviewed record is inspectable through bounded paging. |
| AI-04 | API implementation by `specs_workspace`; reviewer/fixer assigned at handoff. | Protected preview/consent/submit/status/cancel, durable per-owner reservations, idempotency, conservative unknown outcomes, real production adapter. Never persist archive prompt contents. Browser wiring follows API review; actual spending requires approval of a concrete packet/job. |
| SCOPE-02 | Manager and agents integrating no-demo scope. | Runtime views/types/stores/docs agree; internal fixtures use real import. Build/unit/browser checks and independent review pass on the integrated tree. |

Current detailed reports, if available: `/tmp/goodbye-review-observatory-next.md`, `/tmp/goodbye-review-account-routing.md`, `/tmp/goodbye-review-export.md`, `/tmp/goodbye-review-year-profile.md`. Finding IDs and requirements are preserved above; losing a report does not imply acceptance.

## Full gates still open

No entire masterplan phase is claimed complete from the slices above.

| Phase | Remaining gate |
| --- | --- |
| 0 | Integrated clean-checkout checks; release routes/retry/reset; deployed revision and operational recovery. |
| 0.1 | Full evidence-linked reveal/navigation; verified durable reminder service with consent/cancel. Local checklist is implemented, not a mail service. The future visual revamp is separately backlogged. |
| 1 | Reviewed browser-wired funded inference; actual owner-funded connection/request/disconnect; deployed auth; independently approved ChatGPT client and scoped agent access. |
| 2 | Complete coverage/query/performance contracts and supported-source adversarial matrix. |
| 3 | Complete bidirectional context/ambiguity checks and supported overlay formats; explicitly retain unsupported transform/video limits. |
| 4 | Full search/context navigation and measured large-thread responsiveness. |
| 5 | Compound-filter parity across every room/profile/observation/export, large datasets and restored reviews. |
| 6 | Export re-review; realistic private round-trip; complete-bundle scale/cancel; separately authorized Google Photos/owner-controlled Immich transfers. |
| 7 | All specified questions, population/coverage explanations, independent expected values and evidence navigation. |
| 8 | Fix re-review; all distinct connected rooms; measured large-history desktop budgets and supported GPU recovery. Software GPU checks do not establish hardware performance. |
| 9 | Fix re-review; full evidence editing/scope/temporal isolation/responsiveness/uncertainty; separately consented enrichment if used. |
| 10 | Actual authorized grounded dialogue, grounding/temporal evaluation, budget/interruption and full immersive room. No scripted substitute. |
| 11 | Full exploration/curation, tested previews/undo and separately authorized AI interpretation within tool permissions. |
| 12 | Coherent visitor-to-export/persona journey; truthful copy; upstream integration/review; deployment; private-safe measurement; recovery. |

## Release handoff

Feature work is not released. The docs-only TDD commit is durable; feature edits are currently uncommitted. Recheck git before relying on this statement.

A read-only audit found newer upstream changes to review policy and analytics. Preserve them during integration, follow current branch requirements, and prevent analytics from receiving private workspace/auth callback data. After feature freeze use an isolated integration checkout; do not move/reset another checked-out branch. Re-fetch actual heads and requirements. `/tmp/goodbye-release-compatibility.md` is a snapshot report, not permanent configuration or authority.
