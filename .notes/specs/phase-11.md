# Phase 11: Safe exploration and curation assistance

## User value and full gate

The owner can express a useful goal such as finding a year's videos, locating the conversation around an image, or understanding a changed count. The assistant turns that goal into an inspectable local query or proposed action. It saves navigation time while preserving the owner's decisions and originals.

The full gate requires correct supported query results, source-backed explanations, accurate previews of batch changes, working undo, preserved account and collection boundaries, and explicit owner authorization for exports/transfers. Sources are [MASTERPLAN.md](../../MASTERPLAN.md#phase-11-an-assistant-for-exploring-and-curating), [auth.md](../../auth.md), [docs/export-destinations.md](../../docs/export-destinations.md), and Phases 4-7.

## Current baseline and prerequisites

The app has no natural-language assistant, tool registry, assistant action preview, or streaming backend. The archive store and Memories filters are insufficient to authorize or execute generated actions.

Use the same `ArchiveQuery`, review-decision, export, and observation contracts as direct navigation. Stable identifiers and typed ownership boundaries must exist before tools become available. Live language interpretation needs Phase 1's authorized per-user inference and a consented bounded context. Deterministic direct controls continue to work without AI.

## Supported capabilities

| Capability | Contract | Authority |
| --- | --- | --- |
| Query items | Validate a typed filter covering supported years, participants, conversations, content, media types, and review states; evaluate it locally. | Read the authorized effective collection. |
| Explain an observation | Retrieve the definition, population, coverage, revisions, and local evidence; calculate a requested supported comparison locally. | Explain actual tool results, never invent counts. |
| Find context | Resolve a known media/event identifier into supported conversation links and neighboring events. | Preserve uncertain and unresolved link states. |
| Propose a review | Produce a typed keep/exclude/later proposal with exact affected identifiers and before/after counts. | Prepare a preview; applying it requires the owner. |
| Prepare export | Produce the explicit bundle or destination preview through Phase 6. | Prepare only; download or transfer requires a deliberate owner action. |
| Navigate | Suggest a known room or source identifier and preserve shared selection. | Navigate within authorized app content. |

Unsupported requests explain the limitation and offer a supported local route. The assistant cannot read arbitrary files, execute code, fetch generated URLs, modify originals, delete source ZIPs, change authentication or billing, subscribe the owner, bypass review exclusions, or contact another person.

## Query and result contracts

Treat model output as untrusted structured data. Reject unknown operators, fields, identifiers, excessive depth, overly broad payloads, unbounded limits, remote URLs, executable text, and unsupported semantics. Resolve ambiguous participant names before acting; display-name matches cannot merge identities. A request involving an excluded participant in a group follows the same group policy as direct filters.

Execute validated queries on the owner's device. Result envelopes carry dataset/query/review revisions, exact total, bounded item previews, stable evidence references, coverage, and any unsupported filter portions. The model receives only the separately approved minimum result packet needed for an explanation. Names, terms, counts, and filenames are private too; aggregates are not anonymous by default.

Numeric explanations display values from tool-result references. Any requested additional count runs a deterministic query before display. Validate source references and result revisions before accepting an answer. A stale result cannot explain a newer collection. The owner can open the corresponding direct view and receive the identical selection and count.

Archive text is data, not authority. Quoted instructions and fabricated tool requests cannot expand access or authorize a mutation. Tools verify ownership and granted scope independently of the model. The first-party assistant receives narrow capabilities and no administration credential. Future external agents retain [auth.md](../../auth.md)'s separate registration and owner-claim gates.

## Proposal and approval workflow

Show the interpreted request, exact effective scope, count, representative affected items, and any unresolved parts before applying a batch. The owner can edit the filter or cancel. Apply is a direct UI action against an immutable proposal identifier and its revisions, not an instruction inferred from old chat text.

Before committing a review proposal, revalidate the original collection revisions and affected identifiers. If the archive or review state changed, show a fresh preview and require a new action. A successful batch creates one reversible review transaction; undo restores the prior decisions accurately. The assistant cannot declare success until the local transaction succeeds.

Exports and transfers follow Phase 6's preview, destination verification, consent, and partial-result rules. Approval to prepare a collection does not approve downloading it or sending it to a destination. The assistant cannot press its own Apply, Export, or Transfer control. An owner's deliberate direct action completes the task and the transcript reflects the actual operation result.

## AI and lifecycle boundaries

Before external interpretation, show the purpose, packet, recipients, billing source, and bounded job budget. Queries can often send only the owner's new request and supported schema; do not attach archive samples preemptively. Requests that need private labels or evidence disclose those additions separately.

Enforce finite provider allowance, atomic job reservations, payload/output limits, request count, tool iterations, recursion depth, execution time, and concurrency. Admission uses the initiating account's connection only. Missing, revoked, depleted, or unknown allowance stops inference and preserves direct local functions. No shared key, automatic paid model switch, or potentially billed silent retry is permitted.

Cancel stops the assistant loop and pending unapproved proposals. Applied review changes remain undoable; confirmed transfer results are not misrepresented as undone by cancellation. Archive replacement, logout, account change, or curation changes invalidate old result packets and proposals. Keep transcripts and result previews local unless separately authorized persistence is implemented. Clearing derivatives removes reusable assistant context while preserving originals.

## Acceptance criteria

1. Each supported capability resolves a synthetic request to the same exact identifiers, counts, coverage, and evidence as the direct interface.
2. Ambiguous names, unsupported filters, absent media, uncertain links, sparse data, and impossible requests produce an explicit limitation rather than a fabricated result.
3. Invalid schemas, unknown identifiers, oversized descriptions, arbitrary code/URLs, and stale revisions are rejected before local evaluation or allocation.
4. Observation explanations display deterministic tool values and valid source links. A changed curation decision produces a new explanation with accurate before/after scope.
5. Batch proposals show exact affected items and counts. Owner application records one reversible transaction, and undo restores all prior decisions.
6. Concurrent curation or archive changes invalidate a proposal; the owner sees a recalculated preview before any mutation.
7. Preparing an export or transfer cannot start one. A direct owner action shows the selected policy/destination and the actual operation result.
8. Archive prompt injection cannot alter authority, bypass exclusions, read another account's material, modify originals, or trigger network transfers.
9. Account-bound authentication, finite provider allowance, and bounded loop budget guard every paid operation. Cancellation and failures cannot switch accounts or billing sources.
10. The owner's approved packet contains only needed content, and private records, profiles, queries, and transcripts stay out of logs and public fixtures.
11. Keyboard and semantic HTML support every result, preview, approval, cancellation, and undo. GPU availability does not affect assistant controls.
12. Authorized synthetic live inference and deployed integration are verified independently of mocked tool-planning tests. Missing provider access remains an explicit completion gate.

## Verification and delivery slices

Run `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e`. Start with typed local query/observation/context tools and deterministic proposal previews. Exercise known expected identifiers on synthetic archives and review transactions under concurrent revision changes. Then integrate approved language interpretation and real funded synthetic checks. Adversarial cases cover old-chat instructions, fake tool output, account confusion, broad queries, recursion, cancellation, and a fabricated transfer destination.

Local tool contracts, previews, undo, and direct controls are achievable before provider access. Exercise those contracts with internal automated fixtures. Product controls must perform real local operations or authorized inference; scripted substitutes do not establish language understanding or safe funded behavior.
