# Project progress

Read this file when starting or resuming delivery, including after context compaction. Inspect the current diff and live agent ownership before editing. Update the relevant task after a review handoff, verified result, or change in product direction. Keep one current entry per task rather than an execution diary.

[The masterplan](../MASTERPLAN.md) and [phase specifications](specs/README.md) define acceptance. A verified local slice does not complete a phase, external integration, or production release. Reproducible repository tests and recorded outcomes preserve handoff meaning if temporary reports disappear. Keep secrets and private archive contents out of this file.

## Product decisions

- Build real archive features. Synthetic fixtures are internal test inputs through actual import/API paths. Public demo modes, fabricated histories, and scripted substitutes for AI are outside scope.
- TDD guides correctness and simple modular code. Distinct agents implement, review against the original spec, fix findings, and recheck. The manager also evaluates the running product.
- Keep domain, query, curation, export and inference behavior independent of page components. The UI consumes small application interfaces; rendering and browser/provider I/O have replaceable boundaries.
- A full visual revamp, including dark mode and a cinematic treasure-chest front page, belongs to a separate future session in the ideas backlog. It is not added to the current implementation plan.

New delivery context lives in [this notes directory](README.md). [VISUAL-001](backlog.md) is the future-session visual revamp; its detail is preserved under `ideas/`.

The [delivery queue](delivery-queue.md) orders the remaining local work. It preserves the original phase gates and the distinction between local engineering and external acceptance.

## Completed slices

These outcomes were completed locally. Later edits still require their affected checks. Full phase gates remain below.

| Task | Completed outcome | Evidence and limits |
| --- | --- | --- |
| PLAN-01 | Specs written for all phases: 0, 0.1, and 1–12. Distinct implement/review/fix/recheck loop defined. | [Spec index](specs/README.md); full gates remain binding. |
| DOC-01 | TDD correctness and code-quality principle recorded in AGENT.md and linked from project instructions. | Commit `9cd6e9b`. |
| CTX-01 | New delivery specs, progress and ideas organized under `.notes/`; resume instructions point to the progress record. Full visual revamp preserved separately in the backlog. | [Notes index](README.md), [backlog](backlog.md), and checked relative links. |
| AUTH-01 | Real staging WorkOS sign-in survives reload; sign-out remains signed out after reload. | User verified both journeys. [Account](../tests/accounts.test.ts), [identity](../tests/identity.test.ts), and [browser](../e2e/accounts.spec.ts) checks cover failures. Local staging only; production auth is not established. |
| AUTH-02 | Verified identity, one-use browser-bound PKCE, encrypted sessions, refresh/logout races, persistent isolated sessions, and separate AI-provider connection boundaries passed review/fix/recheck. | Account, identity, and [local-store tests](../tests/localAccounts.test.ts). Paid requests remain open; AUTH-03 closes store lifetime. |
| AUTH-03 | Account-store lifetime correction R1 passed independent re-review: reload-stable resource ownership and last-server cleanup. | [Accepted review](reviews/auth-03.md). Eight actual HTTP/Vite routing regressions include SSR invalidation, preview restart, overlapping servers and zero handles after final close. Paid/body integration remains separate. |
| DATA-01 | Traceable records, stable source identities, owner evidence, uncertainty, media inventory, and conservative overlay associations passed review/fix/recheck. | [Dataset](../tests/dataset.test.ts) and [lifecycle](../tests/archiveLifecycle.test.ts) tests. Supported inputs are covered; arbitrary undocumented formats are not claimed. |
| DATA-02 | Corroborated mislabeled timestamp units corrected without guessing from magnitude; raw evidence and explicit uncertainty preserved. | [Accepted review](reviews/data-02.md): independent 38 checks, final affected 42 checks/build, and a populated actual private year profile. Normalization version 4 invalidates older derivations. |
| WORK-01 | Conversations, source inspection, media context, bounded lists, shared exclusions, undo, explicit review-file save/restore, and association review passed review/fix/recheck. | [Workspace unit](../tests/workspace.test.ts) and [browser](../e2e/workspace-review.spec.ts) checks. Full filtering/performance gates remain. |
| EXPORT-02 | Export correction loop E1–E5 passed independent re-review: frozen source sizes, bounded split-download leases/cancel, pre-decode budgets, conservative transforms, indexed snapshot. | [Accepted review](reviews/export-02.md): build, 30 units, independent composed pixels/original bytes, saved multipart hashes and one active ZIP URL. Full Phase 6 remains open. |
| OBS-02 | Observatory correction loop O1–O5 passed independent re-review: GPU recovery/cleanup, source return, excluded review, evidence-based conversation scope and correct units. | [Accepted review](reviews/obs-02.md): 35 units and nine actual-import browsers, with a global thumbnail decoder budget. Full phases 7/8 remain open. |
| GUIDE-01 | A real local command interface finds evidence and previews reversible curation; unsafe/ambiguous requests are refused. | [Experience unit](../tests/experience.test.ts) and [browser](../e2e/experience.spec.ts) checks. Open-ended AI assistance remains undelivered. |
| YEAR-02 | Year-profile correction loop Y1–Y3 passed independent re-review: durable session drafts, eligible-only processing limits and paged exact evidence matches. | [Accepted review](reviews/year-02.md): 28 units, seven actual-import browsers and a genuine populated private profile. Full Phase 9 remains open. |
| AI-05 | UI-independent same-origin inference client and C1 recovery compatibility correction passed manager re-review. | [Accepted review](reviews/ai-05.md): 17 client/actual-HTTP/SQLite contract checks and build. Separate approvals, immutable packet, stale authority/scope, no retry and explicit cancel. No page wiring or paid call. |
| AI-04 | Paid backend correction loop I1–I3 and follow-up races passed independent re-review. | [Accepted review](reviews/ai-04.md): 85 checks/build, actual rewritten HTTP, durable admission, unknown-token honesty, fenced recovery, final-CAS cancellation and lost commit acknowledgement. No paid call; full Phase 1 remains open. |
| PRIVATE-01 | The available private multipart archive was imported locally; actual image decoding and video playback worked with no external archive requests or browser errors. | Private evidence stays outside git. This does not prove every media/export format or production readiness. |
| PRIVATE-02 | A genuinely imported, curated private photo bundle reopened locally with matching manifest sizes/checksums and exact original image bytes. No unfiltered source JSON, page errors or external archive requests appeared. | Aggregate-only local verification; private bytes stayed outside git. Full private bundle/context/scale coverage remains open. |
| SCOPE-01 | Public demo route/factory and canned year-room dialogue removed. Arrival/request now lead to actual import/request. | [Product-scope browser checks](../e2e/productScope.spec.ts) and SCOPE-02 independent integrated recheck passed. |
| SCOPE-02 | No-demo/truthful local-action slice and application-boundary corrections S1/S2 passed independent re-review. | [Accepted review](reviews/scope-02.md): exact unchanged compact-menu test, 59 affected units, 21 browser checks/probes and a secret-safe build. Guide/topic proposals are tested independently of views. Full gates remain open. |
| CHECKPOINT-01 | Frozen correction loops accepted and integrated local delivery checkpoint committed as `38984dbc`. | [Checkpoint evidence](reviews/checkpoint-01.md): build, 213 regular units, one opt-in large-export check, all 33 browsers rerun on the committed build and independent zero-match public-path/build privacy audit. This is a local checkpoint, not a release. |

## Active tasks and next handoffs

Assignments describe current ownership. Check live agents when resuming.

| Task | Status and owner | Required next result |
| --- | --- | --- |
| QUERY-01 | Manager resolving the pure query contract; proposed author `specs_workspace`, independent design reviewer `specs_foundation`. | Freeze independently worked same-occurrence, uncertainty, timezone, exact-time, review and supporting-layer cases before implementation. No query implementation has started. Normalization and UI adapters are subsequent tasks. |

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
| 6 | Realistic private round-trip; full privacy/provenance and supported composition coverage; complete-bundle scale/cancel; separately authorized Google Photos/owner-controlled Immich transfers. |
| 7 | All specified questions, population/coverage explanations, independent expected values and evidence navigation. |
| 8 | All distinct connected rooms and versioned scene contracts; measured large-history desktop budgets. Software GPU recovery checks passed but do not establish hardware performance. |
| 9 | Full evidence editing/scope/temporal isolation/responsiveness/uncertainty; separately consented enrichment if used. Y1–Y3 re-review is accepted. |
| 10 | Actual authorized grounded dialogue, grounding/temporal evaluation, budget/interruption and full immersive room. No scripted substitute. |
| 11 | Full exploration/curation, tested previews/undo and separately authorized AI interpretation within tool permissions. |
| 12 | Coherent visitor-to-export/persona journey; truthful copy; upstream integration/review; deployment; private-safe measurement; recovery. |

## Release handoff

Feature work is not released. TDD documentation is committed in `9cd6e9b`; specs, resume tracking, backlog and modularity guidance are committed in `1248f62`. CHECKPOINT-01 records the accepted integrated feature checkpoint; use git history for its exact revision and inspect the current diff for later work.

A read-only audit found newer upstream changes to review policy and analytics. Preserve them during integration, follow current branch requirements, and prevent analytics from receiving private workspace/auth callback data. After feature freeze use an isolated integration checkout; do not move/reset another checked-out branch. Re-fetch actual heads and requirements. `/tmp/goodbye-release-compatibility.md` is a snapshot report, not permanent configuration or authority.
