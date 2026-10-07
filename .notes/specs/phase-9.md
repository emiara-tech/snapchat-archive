# Phase 9: Evidence-backed language by year

## User value and full gate

The owner can see how they actually wrote in a chosen year and decide what evidence an imagined self should use. A recognizable phrase is more useful when the owner can open its messages, remove a conversation, and see the profile change.

The full gate requires reproducible measured features, owner-authored year-scoped evidence, visible coverage and uncertainty, editable evidence and style choices, and inspected consent for any AI enrichment. Excluded text, incoming messages, and later years cannot shape the profile. The sources are [MASTERPLAN.md](../../MASTERPLAN.md#phase-9-understand-how-i-wrote-in-a-chosen-year), [CONTEXT.md](../../CONTEXT.md), [auth.md](../../auth.md), and [docs/visualization.md](../../docs/visualization.md).

## Current baseline and prerequisites

The archive store holds chat history and can run a word-cloud analyzer. `src/lib/analyzers/wordCloudAnalyzer.ts` currently counts all participants' messages with ASCII-only tokenization and a short English stop-word list. It has no year boundary, collection revision, sampling report, or evidence references. It cannot be used unchanged as the owner's voice. No year-profile editor or profile route exists.

Consume Phase 2 ownership and timestamp evidence, Phase 5 `ArchiveQuery` and review decisions, and Phase 7 defined language observations. The local profile builder requires no sign-in or inference connection. Optional enrichment uses Phase 1. Shared workspace timezone determines year membership, including boundary events around midnight.

## Evidence selection

The default source includes only proven owner-authored nonempty text within the selected calendar year and effective curated collection. Unknown timestamps and uncertain authorship do not silently enter a year profile. Report them as unavailable evidence with their reason. Known quoted, forwarded, or copied portions stay identifiable and are excluded from representative style samples by default. If the export cannot establish whether text is original, disclose that limitation rather than claiming to detect every copied message.

Keep raw source text unchanged. Derived tokenization, duplicate-grouping, quotation handling, and context sampling use versioned policies. The owner can exclude topics, messages, or conversations through stable review decisions or profile-specific evidence exclusions. Profile-specific exclusions do not silently alter the shared collection; their scope is visible. Shared exclusions always apply.

Do not let the most prolific conversation dominate examples without explanation. Show each conversation's contribution, period coverage, audience distribution, duplicate-text treatment, and selected versus eligible counts. A deterministic sample may balance contexts, but all measured population statistics retain their stated denominator. The sample and full population must remain distinguishable.

## Profile contract

The local `YearProfile` contains:

- A stable profile identifier, profile schema/calculation versions, selected year, timezone, dataset/query/review revisions, and approved evidence references.
- Eligible owner-message count, selected example count, conversation distribution, observed active periods, available time span, omitted records by reason, and missing-history limitations.
- Deterministic message-length summaries, punctuation and capitalization measurements, emoji counts and rates, vocabulary and phrase counts/rates, and context comparisons supported by the data.
- A versioned tokenizer and language policy. Preserve accented words and emoji clusters. Language identity is unknown when evidence or detection support is insufficient; code switching is allowed.
- Each measured feature's value, unit, denominator, policy, and evidence references. A displayed aggregate can reopen its contributing source messages.
- Separate interpretation entries with source references and uncertainty. AI prose never overwrites measured features or turns an unsupported personality claim into a fact.
- Editable style choices such as punctuation, emoji use, and intensity. Distinguish an owner preference from a measured tendency.
- A sufficiency result, its evaluated policy version, and a reason the year supports a profile, a limited sketch, or no simulation.

The profile is a private local derivative. Signing in does not upload or persist it remotely. Allow discarding the profile without changing originals. Replacement or clearing of the archive invalidates its references and releases private caches.

## Owner workflow

The year selector shows available evidence and unavailable periods before generation. Local calculation displays genuine progress and cancellation for large collections. The resulting page presents a compact language summary, measured counts, coverage, contribution distribution, representative examples, and separate interpretations. Every representative example opens its original conversation context.

An evidence editor can remove a conversation, a topic's selected records, or specific examples. Topic exclusion must disclose whether it is a literal local query or a reviewed set; it cannot promise complete semantic removal through a keyword match. Show before/after counts and rebuild the profile under a new revision. Unrelated choices remain intact where possible. A changed collection invalidates stale results and any earlier approval.

The sufficiency policy must be based on evaluated fixtures with varied message counts, active periods, repeated messages, conversation diversity, and language mix. The implementation records its chosen thresholds and evidence for them. A sparse sketch is labelled sparse and cannot masquerade as a reliable recreation. An unusable year explains what is missing and offers another available year.

## Optional AI enrichment

Enrichment starts only after the owner inspects the exact proposed packet. Show purpose, selected year, text/aggregate fields, recipients including gateway and upstream provider, budget estimate, and billing source. Allow reducing the packet. Approval binds to the evidence and profile revision; changes require fresh approval.

Send bounded owner-authored excerpts and selected local measurements. Reject enrichment output that cites unknown or excluded records, claims fabricated measured values, or follows instructions embedded in archive text. Interpretations without clear support carry uncertainty or are removed. Future profile use consumes the approved packet and local profile, never an unreviewed larger history.

Every paid operation requires the initiating account's active funded connection, a verified finite provider cap, and a bounded job budget under [auth.md](../../auth.md). Missing, depleted, revoked, or unknown allowance disables enrichment while leaving local features available. Do not substitute a shared key, another account, or an unapproved model. Cancellation, timeout, and partial results cannot silently retry a potentially billed request. Keep profiles and excerpts out of logs and automatic provider evaluations.

## Acceptance criteria

1. Independent synthetic fixtures prove that only proven owner-authored text in the selected year, timezone, and effective collection contributes to measured features and examples.
2. Boundary fixtures include December/January across timezones, invalid or absent timestamps, incoming messages, uncertain authorship, quoted text, and excluded conversations. None silently becomes approved year evidence.
3. Identical input revisions and policy versions reproduce measurements, evidence sets, and deterministic samples. Population counts and sample counts have separate labels.
4. Unicode and multilingual fixtures preserve supported accented text and emoji. Unsupported language judgments remain unknown, and mixed-language evidence does not inherit an English-only claim.
5. Message length, punctuation, capitalization, emoji, terms, phrases, and supported context comparisons display their definitions, denominators, and source links.
6. Contribution reports expose prolific conversations and repeated text. Removing one contributor updates the counts, examples, and profile without leaving an old interpretation visible.
7. Every interpretive claim has supporting approved references or an uncertainty label. A suggested preference is visibly separate from measured language.
8. The owner can inspect examples in conversation context, exclude supported material, edit style choices, regenerate, and discard the derivative. The source archive remains unchanged.
9. Sufficiency fixtures demonstrate supported, sparse-sketch, and insufficient states. The UI cannot start a convincing-self claim for a rejected year.
10. Before enrichment, the UI displays the exact bounded packet and all recipients. No text leaves the device before separate consent and successful funding admission.
11. Stale worker/model responses, fabricated references, cross-year evidence, and excluded evidence are rejected. Curation or evidence changes invalidate previous approval and dependent persona state.
12. Enrichment failure, cancellation, exhausted allowance, and disconnection preserve the local profile and cannot trigger an unfunded fallback or automatic paid retry.

## Verification and delivery slices

Run `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e` for user-facing changes. Verify measured values against independently specified synthetic messages, rather than calling the implementation to construct its expectations. Check the evidence editor, revision changes, network silence, and local discard in a real browser. Public examples use fictional messages and participants.

First deliver a fully local owner-authored year profile with count/emoji/punctuation/word observations and inspectable examples. Extend multilingual and context policy, then evaluated sufficiency and evidence editing. Prepare the consent and enrichment contract without claiming live provider success. The full optional enrichment path needs an authorized bounded synthetic provider check; private archive permission does not grant external processing permission.
