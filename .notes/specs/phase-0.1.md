# Phase 0.1. Arrival, waiting, and the first reveal

This spec implements both Phase 0.1 gates in [MASTERPLAN.md](../../MASTERPLAN.md). [docs/onboarding.md](../../docs/onboarding.md) controls notification and readiness boundaries. [docs/visualization.md](../../docs/visualization.md) controls scene evidence, motion, and rendering recovery. Arrival alone does not complete the personal reveal gate.

## User value

A visitor sees why their archive is worth opening before they request it. They can immediately open their own archive, understand what to request from Snapchat, and return without making an account. After import, a private reveal supplies a concrete reason to explore. Surprise comes from a real old photo, an unexpected recorded pattern, or the owner's chosen words, with its evidence close at hand.

## Current baseline

The home page links to local import and Snapchat's My Data page. Its previews are static and contain claims that the app has not established, including a Snapchat streak and unsupported export destinations. The welcome page only opens Memories. There is no request checklist, saved wait state, verified reminder service, evidence-linked reveal, or shared starting-route contract.

## Required behavior

### Arrival and real archive import

The desktop arrival page offers "Open my archive" and "Request my archive" immediately. Product navigation and capability claims lead to actual imported owner records. No public synthetic archive or scripted AI substitute is offered.

After import, the owner can select a year, open a photo into its supported conversation context, inspect a defined observation, and make a reversible export selection. Empty and unavailable states explain what is needed.

Compose one clear visual sequence around the year, a connected photo, and the evidence reveal. Keep readable HTML controls above any scene. Reduced motion and the reading mode preserve the sequence and every action. Evaluate visual quality in a running desktop browser; passing selectors alone does not establish a compelling arrival experience.

### Request, wait, and return

Open Snapchat's official My Data portal. Explain the desired date range, available history categories, Memories/media options, the difference between full-history and Memories-only exports, and how to select all downloaded ZIP parts locally. Verify current official guidance when implementing or changing the guide. State Snapchat's documented timing as an estimate, with a source and no guaranteed deadline.

Opening the portal does not mark a request submitted. The visitor explicitly chooses "I requested my archive". Save only a non-sensitive local checklist, chosen activity, and optional navigation preference. The visitor can choose "Snapchat emailed me" or "I downloaded my archive" on return. Readiness is user-reported and remains separate from successful local validation.

Do not collect Snapchat passwords, export download URLs, tokens, or mail contents. Do not scrape sessions, poll undocumented status endpoints, or imply that a timer detects readiness. Login on another computer restores supported account preferences, then asks for files locally. Loss of browser storage leaves the request and return guide usable.

### Optional verified reminders

Reminder consent is separate from account sign-in and AI access. The recipient must verify ownership before a scheduled reminder becomes active. Show the reminder purpose, chosen time or bounded schedule, finite send limit, and stop control before consent. A verification email has its own rate limit and cannot create an open mail relay. Without provisioned delivery infrastructure, provide a clearly local return option rather than a send-email control that cannot work.

Persist the subscription, consent revision, and timer independently of the browser process. Jobs survive restart and deployment changes. Job arguments use opaque subscription references; the sending operation resolves the recipient and credentials privately. Every send rechecks current consent, recipient verification, ownership, lifetime, and remaining sends. Retries use one logical delivery identifier and provider idempotency key.

Stop future delivery after readiness confirmation, successful import, withdrawal, unsubscribe, account deletion, a complaint or bounce, expiry, or the send limit. For a signed-in import, stop that account's subscription through an authorized minimal event. An account-free local import still succeeds; it can stop only reminders for which the browser holds a valid scoped stop credential. Do not search by email or cancel another account's reminder. Cancellation cannot retract a delivery the mail service already accepted.

If a send times out after possible acceptance, reconcile the delivery result before another attempt. Without reconciliation or provider idempotency, mark the result unknown and do not blindly duplicate the email. Out-of-order events and old consent revisions cannot restart delivery. Publish retention and deletion rules that the actual stores and workflow host can satisfy before launch.

Reminder text says to check Snapchat's email or export portal and return with downloaded files. It never says the archive is ready without supported evidence. Email contains a plain Goodbye Chat return link, the official portal, and a scoped stop link. It contains no private highlights, tracking pixel, attachment, participant name, archive statistic, or signed Snapchat URL. Return links navigate to the guide and grant no private access or account-changing authority.

### Real progress and private reveal

The import scene consumes current revision progress from Phase 0 and normalized evidence from Phases 2 and 3. Completed indexing, records, media links, and calculations appear as completed work. Decorative activity is identified as decoration. Unknown totals do not produce fake percentages. Cancellation, retry, GPU failure, and reduced motion keep the available desktop controls working.

Calculate initial highlights locally. Eligible cards include the earliest dated available photo, the most active recorded month within stated coverage, a supported conversation/media connection, or a count of the owner's verified authored vocabulary. Use the query and observation definitions from Phase 7 for aggregates. A sparse archive offers the supported cards and a useful coverage explanation; it does not invent a personal fact.

Every card carries current dataset and query revisions, its record population, coverage, calculation or retrieval definition, and evidence identifiers. Opening evidence leads to the actual selected records, with a return path to the reveal. Display-name similarity, timestamp proximity, and activity counts cannot establish a recipient, emotional closeness, or relationship quality.

Embarrassing-message rediscovery requires a separate explicit opt-in before an excerpt appears. Include only verified owner-authored text. The owner can hide a card, exclude its source records, skip the reveal, or go straight to the archive. A hidden card remains hidden across routes for that dataset. Exclusions remove its records from later highlights and ordinary selection results. Changing evidence or calculations invalidates stale reveal work.

Offer "Revisit and play", "Understand my history", and "Curate and export". Each opens the same dataset and collection, preserves the selected period and review decisions, and can switch to another route without re-import. The eventual imagined-self route clearly labels generated conversation as fiction. Optional AI enrichment has its own inspectable outgoing packet, consent, and user-funded budget. The local reveal remains usable without AI.

## Interface and data contracts

| Contract | Required fields and rules |
| --- | --- |
| Local journey | Contract version, state, selected activity, optional non-sensitive preference. States are `not_requested`, `requested_by_user`, `reported_ready`, `validating`, `importing`, and `opened`. Transitions name their user or local-validation cause. |
| Reminder subscription | Opaque ID, owner or verified-recipient reference, consent revision and time, chosen schedule, finite send/lifetime limits, recipient verification, delivery counters, and `active`, `completed`, `canceled`, or `delivery_failed` state. |
| Delivery record | Subscription ID, logical delivery ID, idempotency key, attempt outcome, limited provider receipt ID, and timestamps. A delivery due event cannot change archive readiness. |
| Scoped stop credential | Cryptographically random, limited to stopping one subscription, with expiry or rotation policy. It exposes neither workflow credentials nor private archive access. |
| Highlight | Stable highlight ID, kind, dataset/query revisions, source IDs or observation ID, coverage, scope, local definition, eligibility reason, and visibility decision. Render factual numbers from validated observations. |
| Starting route | Dataset revision, active collection/query, selected year or records, and activity. Route changes preserve the same evidence and exclusions. |

## Failure and privacy states

Keep the local checklist, account identity, reminder subscription, and private archive separate. Local import and browsing never require inference credits. Reminder and authentication servers do not receive archive payloads or local source paths. Worker errors do not embed private text in external reports. With unavailable mail infrastructure, declined verification, a bounce, or a failed reminder, the visitor can still request, return, and import.

Do not advertise unsupported destinations or imaginary provider availability. An observed active-day run is described with its definition and is not a Snapchat streak. Copy about the app's local processing describes the specific local features; later optional AI and transfers disclose their own recipients. No pre-import claim pretends to know the visitor's history.

## Acceptance criteria

1. P01-01. A signed-out visitor can reach the official Snapchat portal and local import from arrival, request, waiting, and return views.
2. P01-02. After a real local import, year selection, supported photo-to-conversation links, defined observations and reversible exclusions use that archive’s records. Public demo modes and scripted AI replies are absent.
3. P01-03. The guide distinguishes requested date coverage and Memories-only coverage, links to current official guidance, and states no guaranteed delivery deadline. Merely opening the portal leaves the request state unchanged.
4. P01-04. The visitor explicitly records request and readiness choices. Reload restores the non-sensitive checklist. Cleared storage and another computer still offer a complete return-to-local-import path.
5. P01-05. Reminder activation requires verified recipient ownership and specific consent for a finite schedule. Duplicate schedule requests create one subscription. Unverified, forged, other-account, expired, or replayed events cannot send mail or mark readiness.
6. P01-06. A synthetic reminder survives browser closure, process restart, and a deployment change. Repeated events, delivery attempts, and old consent revisions stay within the consented total-send and retry limits.
7. P01-07. Cancellation, unsubscribe, reported readiness, successful authorized import, account deletion, bounce, complaint, and expiry stop future mail. Withdrawal during retry wins before the next send. An uncertain provider acceptance is reconciled or held without a duplicate.
8. P01-08. Synthetic notification traffic, job history, logs, return links, and emails contain no archive canary content, names, file paths, photos, statistics, provider secrets, or Snapchat download tokens. A return link grants no private access.
9. P01-09. A complete synthetic archive produces eligible local highlights whose values and source IDs match an independent expected result. Each evidence action opens the corresponding current record.
10. P01-10. Sparse, undated, missing-media, unsupported-owner, or ambiguous-link fixtures produce honest coverage or an alternative card. None claims an unsupported recipient, real streak, relationship quality, or personal trait.
11. P01-11. No embarrassing excerpt appears before explicit opt-in. Non-owner and uncertain-owner messages remain ineligible. Hide, exclude, and skip decisions hold across routes and do not modify source files.
12. P01-12. Import progress reflects real work. Cancellation or replacement rejects old results. Forced GPU failure, reduced motion, and keyboard operation preserve controls and evidence access.
13. P01-13. All three starting routes preserve the same dataset, period, collection, and exclusions and can switch without another import. Disconnected or unavailable AI leaves the local reveal usable.
14. P01-14. Real-browser network inspection confirms local parsing, linking, and reveal analysis. The first reveal makes no archive-bearing network request until a separately approved optional feature runs.

## Verification plan

Run build, unit, and browser checks through pnpm. Use internal synthetic archive and reveal fixtures with hand-calculated expected highlights, sparse periods, unknown authorship, missing media, and hidden/excluded sources. Exercise arrival to request to wait to return to import, plus immediate import. Verify direct loading, keyboard operation, reduced motion, renderer failure, and route state in a desktop browser.

Use a fake clock and synthetic delivery provider to test restart, bounded retries, replayed events, unknown acceptance, withdrawal, and retention/deletion. Before real launch, verify the deployed sender domain, recipient verification, authenticated events, stop links, and provider idempotency using a consented test recipient. Keep that operational evidence free of archive data.

## Implementation slices and prerequisites

1. Immediate local import, truthful arrival copy, official request guide, and locally saved return state.
2. Verified, cancelable durable reminder delivery and published retention rules.
3. Measured import scene, locally grounded first cards, coverage alternatives, and evidence navigation.
4. Opt-in authored-text rediscovery and the connected starting routes.

Slice 1 is local work after Phase 0. Slice 2 depends on Phase 1 for account-bound reminders and on durable storage, a timer host, email delivery, a verified sending domain, and actual recipient consent. Implement and test the contracts synthetically while these resources are pending. Personal reveal depends on normalized evidence in Phase 2, trustworthy links in Phase 3, and defined statistics in Phase 7. A supported Snapchat readiness callback is an additional external contract; it is not required for the initial reminder and cannot be invented.
