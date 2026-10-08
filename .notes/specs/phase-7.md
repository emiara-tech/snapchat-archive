# Phase 7: Understandable observations

## User value

The owner can answer a simple question about their recorded history, understand the answer's limits, and inspect the messages behind it. The product should create surprise through real evidence while avoiding claims about personality or relationships that a count cannot establish.

## Baseline and dependencies

`computeStats.ts` provides basic archive totals, date range, chat-active runs, and top conversation counts. Existing analyzers read raw chat files independently, use UTC/English-only tokenization in places, and cache by analyzer ID. These are foundations, not shared-selection observations. Replace or adapt them to consume the phase-2 dataset and phase-5 effective query. `ComputedArchiveStats` can remain a compatibility summary; it cannot bypass exclusions or become persona evidence without the normalized contracts.

All deterministic observation work is local. No login, model request, provider key, paid allowance, or registration is required. Optional AI interpretation is a later independent permission path and cannot be necessary to see facts.

## Required questions and interface

Offer guided question cards for recorded activity over time, most recorded exchanges in a chosen period, changes in the owner's writing, selected content/media proportions, coverage gaps, and the effect of curation. Opening a card shows the current scope, an exact-value chart/table, a plain explanation, and evidence actions. Changes in filters recalculate every visible card or show it as pending without presenting stale values as current.

Counts, time distributions, word/emoji frequencies, media distribution, and supported relationship observations use deterministic local calculations. Define whether a measure counts events, text messages, physical assets, media occurrences, conversations, participants, tokens, or active calendar days. Never interchange these units.

Authorship distinguishes proven owner, other participant, and uncertain. "My words" uses proven owner-authored text by default; incoming/uncertain text can appear only in separately named scopes. Quoted/copied text is flagged where evidence supports that classification and does not silently dominate a year profile. Multilingual text and complete emoji sequences survive tokenization. Define the token, case/normalization, stop-word, and phrase policies as calculation versions.

Every observation states unit, denominator, date bounds, timezone, source categories, query/review revision, authorship scope, coverage, calculation version, and evidence IDs or an exact evidence query. Explain missing months/files, invalid dates, partial participant membership, and unlinked media. A zero count in available data does not prove the owner was inactive or had no contact with a person.

An observed consecutive run is named "recorded chat-active days" and explains its calendar-day calculation. It is not an official Snapchat streak. Contact rankings refer to recorded interaction counts. Group conversation counts remain group counts unless participants can be measured without attributing all group traffic to each person. These measures cannot infer closeness, relationship quality, personality, diagnosis, or mental health.

Comparison cards offer raw totals and normalized values when periods differ in length or available evidence. Explicit denominators can include selected calendar days, observed active days, or owner text/token counts. Missing denominator or zero evidence yields unavailable rather than division artifacts. Do not describe absent periods as observed zero coverage or apply a percentage without explaining its base.

Vocabulary changes are frequencies/rates within a defined owner-text scope. Optional tone estimates are labelled interpretations with method, evidence, uncertainty, and language limitations. The current keyword sentiment analyzer cannot present its English word-list score as a factual emotional or relationship measure.

Reading mode presents semantic tables with exact values and the same selection/evidence controls as visual views. Explain chart axes, node size/color/connections, and aggregates near the visualization. Chart selection opens the source items in the conversation/library room while preserving shared context. Observations support the phase-8 observatory; scene rendering cannot recalculate or invent factual totals.

Calculations and costly layout preparation run off the main interaction thread or in bounded cancellable jobs. Cache keys include dataset fingerprint/revision, canonical query, review revision, timezone, authorship scope, and calculation version. Reject late results after replacement or selection changes. Cache invalidation reaches highlights, scenes, and profiles so excluded evidence does not survive as an example.

## Data contracts

An `Observation` has stable metric ID, calculation version, dataset/query/review revisions, title/question, value/series, unit, denominator description/value, normalized optional value, selected time bounds/timezone, source categories, authorship scope, coverage, limitations, and stable evidence IDs or a reproducible evidence query. An interpretation is separate labelled content with supporting observation/evidence references and consent state if external computation is used.

The calculation service consumes `ArchiveDataset` plus `ArchiveQuery` and effective collection. It never rereads an unfiltered raw file as a shortcut. It returns immutable observation packets and deterministic scene inputs. Evidence drill-down resolves through the same authorized selection, including exact group/calendar/token scope.

Year-profile consumers can request measured owner-language features with original source references, authorship evidence, quote/copied flags when known, and conversation context groups. An unknown flag remains unknown; calculations cannot invent classifications. Profile selection never expands observation scope to later years or excluded material.

## Failure and privacy handling

Sparse, empty, invalid, and missing-category datasets receive different explanations. One failed observation leaves others usable and offers a scoped retry. Unsupported languages/methods show their limits without a confident label. Cancellation/reset prevents late private results from replacing a newer room. No aggregate, vocabulary, participant label, location, or evidence sample leaves the device through ordinary statistics.

## Acceptance criteria

1. Independent expected-value fixtures verify event/text/asset/occurrence counts, calendar-day distributions, owner/received/uncertain scopes, Unicode word and complete-emoji frequencies, and media proportions.
2. Every observation exposes its unit, denominator, timeframe, timezone, source category, authorship, coverage, version, and reproducible evidence. Its drill-down contains exactly the contributing authorized items.
3. Shared filters and review apply/undo/redo change observation values and examples consistently with the library and export preview. No excluded material survives in a cached value, label, thumbnail, or evidence sample.
4. Calendar grouping and active-day runs are correct around New Year, timezone offsets, daylight saving, timestamp ties, and invalid dates. UI never calls the proxy an official Snapchat streak.
5. Rankings distinguish direct and group conversations without conflating display names or attributing all group traffic to one person. Their text describes recorded exchanges, not relationship quality.
6. Unequal-period fixtures produce independently verified normalized rates with visible denominators. Zero/unknown denominators show unavailable; missing history is not asserted as inactivity.
7. The owner's vocabulary excludes received/uncertain authorship by default. Multilingual/quoted/copied examples retain their scope/limitations. Any tone result is a labelled interpretation and contains no personality or medical claim.
8. Guided cards answer all required initial questions, explain filters and coverage in plain language, and expose exact semantic tables. Keyboard users can select evidence and return with the query intact.
9. Changing dataset/query/review/timezone/version invalidates the old cache. A delayed old job cannot replace a current result or leak old evidence after reset.
10. Synthetic large histories compute without blocking direct controls beyond the recorded 100-millisecond feedback target. Cancellation and a failed observation preserve the usable workspace.
11. Network inspection during ordinary calculations shows no transmission of archive data, aggregates, labels, vocabulary, or source samples. Local facts remain available without AI/account access.

## Verification and delivery slices

First deliver guided cards for activity, recorded exchanges, and content proportions with source drill-down. Next finish owner-language comparisons, coverage-aware rates, curation comparisons, semantic tables, and worker/cache behavior. All initial questions and required metadata must pass before declaring the phase complete.

Fixture expectations come from hand-enumerated records or an independent reference calculation, not snapshots of the implementation. Browser checks compare visible numbers with selected source items before/after exclusions and undo. Include missing months, ambiguous group membership, Unicode, repeated assets, zero denominators, and delayed jobs. Run `pnpm test`, `pnpm build`, and affected `pnpm test:e2e` checks. Benchmark reports and screenshots use synthetic history only.
