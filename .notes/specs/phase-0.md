# Phase 0. Delivery, privacy, and stability

This spec implements the Phase 0 gate in [MASTERPLAN.md](../../MASTERPLAN.md). [agents.md](../../agents.md) defines the release authority and required checks. Passing local tests alone does not complete the deployed gate.

## User value

An owner can open a large, imperfect archive without losing control of the browser. A failed attempt explains the next useful action. Replacing or clearing an archive removes the previous person's records and media before the new archive appears. These behaviors establish the trust needed for later personal experiences.

## Current baseline

The Vue/Vite app has pnpm build, Vitest, and Playwright commands, a Varlock schema, multipart ZIP indexing, import routes, and synthetic import tests. ZIP reads close their temporary readers. The archive store keeps active state in memory and resets its fields when starting another import. There is no store-level cancellation or disposal contract, and pending reads can outlive a reset. Progress uses fixed stage percentages. Duplicate paths appear in diagnostics, but path lookup selects the first matching entry. The repository contains a current-commit CodeRabbit approval workflow. Its existence does not prove that host branch protection or deployment verification is configured.

## Required behavior

### Reproducible delivery

Use the repository's declared Node and pnpm versions. A clean checkout can install from the lockfile, validate its environment, type-check, build, run the unit suite, and run browser checks with synthetic data. CI runs the same required checks. Missing optional credentials do not prevent local archive features from building or running.

Varlock validates environment contracts before a server feature uses them. Environment values default to sensitive. Only explicitly public configuration can enter client code. Secrets live in ignored local files or deployment secret stores. Commands that need secrets follow the redacted execution convention in agents.md. Generated environment types are generated from the schema.

### Archive-session lifecycle

One active archive revision owns its workers, ZIP reads, cached buffers, media handles, and published results. Starting a replacement, canceling import, or clearing local working data invalidates that revision before another asynchronous operation can publish. Cancellation stops further work and closes or releases acquired resources. Repeated cancellation and disposal are safe.

The browser keeps the original selected files unchanged. A failed import can retry the selection or choose different ZIPs. Fatal errors do not mark the import successful. Recoverable missing sections leave supported content usable and report coverage. Clearing the working session removes all dataset-derived UI, pending work, cached observations, media URLs, and selection state. Any separately stored curation or derivative data has an explicit clear control; it cannot appear in a new archive by accident.

### Input and resource safety

Treat ZIP metadata and JSON as untrusted input. Validate paths, source identity, file format, actual readable data, entry counts, entry size, total uncompressed size, and expansion limits before costly decoding. Every limit has a named configuration contract and a supported failure state. Tests set deliberately small limits to verify rejection without creating a dangerous archive.

Distinguish a missing optional file, an unsupported section, malformed JSON, a damaged ZIP, a duplicate path, and a resource-limit failure. Do not silently replace a conflicting occurrence. Until Phase 2 provides full conflict inspection, reject an unresolved conflicting required file or present a safe partial result with an explicit diagnostic. Do not execute or fetch URLs found in archive content. Keep media decoding on demand and cap concurrent reads and resident media handles.

### Honest progress and browser recovery

Progress reports completed work in the current revision. A known total permits a percentage; an unknown total shows a stage and completed count. A completed label corresponds to a completed operation. No artificial timer advances success or delays a finished import. Costly indexing and analysis run in a worker or a bounded yielding path that keeps controls responsive.

The import page handles direct navigation, reload, leaving during work, and a missing browser capability. Reloading without persisted archive access asks for local files rather than pretending the archive is available. Cancel, retry, clear, and navigation work with a keyboard. Reduced motion disables nonessential animation. Rendering failure preserves a usable desktop interface.

### Deployed checks and release evidence

The deployed host serves the SPA document on document routes and serves each hashed asset with its correct content type. API, authentication, and discovery routes introduced later remain backend routes rather than receiving index.html. Verify direct loading and reload of important routes, referenced assets, and an unknown document route.

Detect stale HTML that references missing hashed assets. Give the visitor a bounded reload or update action rather than an endless blank page. Publish an identifiable revision through a non-sensitive version endpoint, build metadata, or equivalent host evidence. Preview and production verification record revision, check outcome, and synthetic journey result. Keep a tested rollback procedure for the host.

Protect main with the required checks and CodeRabbit approval of the current pull request head. Follow only the documented exhausted-review-allowance exception in agents.md. A skipped review, outdated approval, generic provider failure, or workflow file without active protection does not satisfy the rule.

## Interface and data contracts

| Contract | Required fields and rules |
| --- | --- |
| Archive revision | A unique operation identity. Every asynchronous result and progress event carries it. Results for a canceled, disposed, or superseded revision are rejected. |
| Session lifecycle | Creation accepts local File objects and an abort signal. The session exposes safe cancellation and idempotent disposal. Media handles have an owner and a release operation. |
| Progress event | Revision, stage, completed work, optional total work, and state. States distinguish running, completed, canceled, and failed. Percentages derive from these fields. |
| Import diagnostic | A stable code, severity, safe user explanation, optional local source reference, and recovery action. External logs omit filenames and archive-derived values. |
| Resource policy | Explicit limits for indexed entries, per-entry decompression, total decompression, expansion ratio, concurrent work, and retained media. Enforce limits against actual reads as well as advertised ZIP sizes. |
| Release evidence | Repository commit, deployed revision, host environment, affected routes, required check results, and synthetic fixture identity. No archive contents or private derivatives. |

## Failure and privacy states

Local archive features make no archive-bearing network request. Authentication, optional reminder delivery, AI, and destination transfers have later separate contracts. Opening a local image never uses an expired Snapchat URL as a fallback. Console output, error tracking, browser recordings intended for public use, screenshots, and CI artifacts use synthetic data. Real archive checks keep their evidence in private untracked locations.

An import failure preserves enough information to retry safely but does not expose partial stale results as a completed archive. A cancellation error is displayed as cancellation. A resource-limit error explains which limit was reached and offers a smaller or more focused import without modifying the original files. An unsupported worker or GPU provides an honest capability state and the available local reading path.

## Acceptance criteria

1. P0-01. A clean checkout passes `pnpm run env:check`, `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e` without a private archive or a funded AI key.
2. P0-02. A synthetic multipart archive imports and opens its supported media. A damaged ZIP and malformed required JSON produce distinct recoverable errors; choosing valid ZIPs afterward succeeds.
3. P0-03. Missing optional history, unknown files, duplicate paths, unsupported formats, and each configured resource limit produce explicit diagnostics rather than silent success or unbounded decoding.
4. P0-04. Canceling during indexing or reading releases the work. Completing that old operation afterward cannot update the dataset, progress, error panel, or route of a later import.
5. P0-05. Replacing archive A with archive B, then clearing B, leaves no record, thumbnail, statistic, selected participant, or live object URL from A or B visible or retained by the disposed session.
6. P0-06. Repeated reset and cancellation are safe. Readers close after successful reads and thrown errors. Object URLs and worker resources release when their owner ends.
7. P0-07. Recorded progress events agree with completed operations. Unknown totals use counts or an indeterminate stage. Cancellation remains responsive during the generated large-import case.
8. P0-08. Direct navigation, back/forward navigation, and reload have defined outcomes for `/`, `/import`, `/processing`, `/welcome`, `/photos`, and `/privacy`. Protected local routes never claim to have data after its session is absent.
9. P0-09. Keyboard and reduced-motion browser checks pass the import, failure, retry, replacement, and clear journeys. A missing relevant browser capability leaves the recovery controls usable.
10. P0-10. No synthetic canary message, private field, archive name, credential, or remote media token appears in client-secret bundles, notification traffic, external logs, deployment uploads, or committed fixtures.
11. P0-11. CI and active main-branch protection enforce the applicable checks and current-head CodeRabbit rule. A new head invalidates an earlier approving review.
12. P0-12. The deployed preview and production revisions are identifiable. Important document routes load directly, every referenced hashed asset resolves correctly, stale-asset recovery works, and the affected synthetic journey succeeds on the host. The documented rollback procedure can identify and restore a verified release.

## Verification plan

Run the repository checks with generated synthetic archives. Add behavior tests for revision races, cleanup after failures, conflict handling, path rejection, and resource policy enforcement. Inspect actual browser network requests and console output while importing, opening media, canceling, replacing, and clearing. Use a generated large archive to test control response without committing a large fixture.

On the deployed host, verify document routing and each script asset from the returned document. Record the revision and execute the affected desktop journey. Exercise stale-asset recovery through a controlled synthetic response. Inspect host branch protection through its supported management interface. Release evidence identifies which local and deployed gates passed; a local result cannot stand in for a host result.

## Implementation slices and prerequisites

1. Session ownership, cancellation, stale-result rejection, and media cleanup.
2. Input diagnostics, conflict safety, decompression limits, and measured progress.
3. Clean-checkout CI, environment validation, route and asset recovery.
4. Active release protection, deployed journey verification, and rollback evidence.

The first three slices are locally achievable. Host configuration, active branch protection, CodeRabbit review, preview/production access, and rollback verification require repository or deployment authority. Missing access is recorded as an external prerequisite, and the relevant exit criterion remains open.
