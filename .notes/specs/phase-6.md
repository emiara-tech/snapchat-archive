# Phase 6: Portable bundles and explicit media transfers

## User value

The owner can leave with a readable collection they control. It contains conversation context and explains missing material instead of presenting a folder of unexplained pictures as a complete backup. Separate destination transfers put selected supported memories in the owner's photo service without granting that service access to the entire archive.

## Baseline and dependencies

`ExportConfig` is a JSON-only settings type; it is not a working export. The current archive reader creates local object URLs, so bundle writing needs a local byte/stream read operation that does not treat those URLs as portable files. Consume the phase-5 frozen effective selection and phase-3 media/overlay evidence. Follow [the destination contract](../../docs/export-destinations.md) for all adapter details and release boundaries.

## Download behavior

Offer curated collection, complete readable archive, and separate original preservation copy. The curated collection uses the reviewed shared query. Complete mode clears temporary screen filters explicitly and still respects current exclusion policy. Including previously excluded items requires a separate deliberate choice and a refreshed preview. Original preservation copies untouched selected input ZIPs and warns that they include source data omitted from cleaned views. Never package unfiltered source JSON or original ZIPs inside a cleaned bundle.

Preview the frozen selection's period, people, event and physical asset counts, estimated bytes, exclusions, postponed decisions, missing files, unresolved links, source sections, metadata policy, originals, and requested composed variants. Distinguish estimate from measured output size. Export starts only from a current approved preview. Any relevant dataset/query/review change invalidates it.

Bundles contain a versioned manifest, machine-readable selected records, escaped readable conversation pages, original media, allowed overlay sources, optional composed derivatives, and selected sidecar metadata. Relative local links work after unzip without the website, account, object URLs, third-party scripts, or external media requests. Filenames derive from safe stable IDs. Preserve Unicode meaning in content while rejecting traversal, separators, absolute paths, reserved/colliding names, and platform-unsafe names.

The manifest records dataset/export revisions, selected query/policy, timezone, versions, per-file relative path/MIME/byte count/SHA-256, source timestamps and precision, event/conversation/asset links and their evidence states, overlay inputs, derivative recipes, coverage, missing/damaged/unsupported items, and skipped transforms. Identical asset bytes can be written once while distinct historical references remain in records.

Privacy policy covers every output file, filename, thumbnail, title, sidecar, and provenance field. Excluded participant labels and excluded context must not reappear through a shared asset's metadata or retained source references. A preview that cannot guarantee a chosen cleaned policy must flag the affected items or withhold them; it cannot claim automatic removal of a person's visual likeness. Original-byte export explicitly states that embedded GPS and other original metadata may remain. Removing that metadata creates a disclosed derivative, not byte-preserved originals.

Offer preserved originals and optional flattened images. Composite only supported archive overlay images or recorded structured text using documented position, orientation, alpha, dimensions, and layering. Preview full-size output and record renderer/source hashes/output format/metadata changes. Baked-in captions are not added twice. Missing layers, fonts, effects, or uncertain placement produce an omission report. OCR/AI text cannot masquerade as an original overlay.

Video composition is a separate capability gate. Verify overlay timing, orientation, every frame, audio, decoding/encoding, and destination-compatible output. If unsupported, retain original and overlay sidecar and report the unavailable derivative. A still preview does not establish composed-video success.

Write incrementally to a supported directory or streaming archive with bounded memory, progress based on actual bytes/items, cancellation, and a labelled partial-output state. Where capabilities require split downloads, explain the parts and how to reopen them. Do not materialize the whole multi-gigabyte bundle in memory. Detect write/disk/format failures and never announce success until payloads and checksums match the frozen plan. Reopening the written bundle verifies its integrity and relative media links.

## Transfer behavior

Destination adapters receive the same immutable `ExportPlan`; they cannot expand its IDs or change its privacy policy. A connection authorizes destination capabilities. A separate transfer action approves exactly the reviewed files/metadata/account or server origin. Product login, AI access, import, and reminders grant no transfer consent.

Each adapter declares accepted formats/sizes, metadata mappings, authorization, readback, and deletion limits. Preview transformations and omissions. Send private bytes directly from the owner's computer to the reviewed destination. Do not add a hosted media relay or arbitrary-URL fetch proxy. Browser CORS, resumable upload, creation, and readback require synthetic verification; unsupported browser/private-network routes use an implemented local connector.

Keep a private per-item journal bound to dataset/export revision, destination identity/origin, source checksum, transform recipe, and remote ID. Outcomes are queued, uploading, accepted, processing, verified, failed, unknown, omitted, and cancelled as applicable. Reconcile unknown responses before retrying possible duplicate creation. Bound backoff and concurrency; stop on revoked access, permission/account changes, cancellation, and selection changes. Cancellation reports accepted remote items and does not claim rollback.

Google Photos supports only the documented user-initiated upload and app-created-data scope described in the destination contract. Implement upload tokens, serialized per-user creation batches, partial-item results, token expiry, supported-format/storage failures, app-created album choices, and processing/readback checks. Do not claim broad library sync, arbitrary timestamp mutation, byte-perfect later download, or library-item deletion.

Immich uses a dedicated least-privilege key tied to a validated exact server origin. Send the key in the supported header, reject credential-bearing URLs and cross-origin redirects, and probe installed capabilities. Implement checksum preflight without losing historical occurrences, disclosed date fallback, supported XMP, optional appropiately permitted album actions, and duplicate reconciliation. Existing duplicate metadata changes need separate approval. A local route can reach supported private installations; the hosted browser path requires its actual network/CORS capabilities. Never enable delete-after-upload.

Disconnect stops jobs and clears retained connector credentials. Explain provider-specific revocation and that accepted assets remain remotely. Journals and credentials persist only under the owner's explicit local storage choice. Logs and public telemetry contain no private bytes, labels, filenames, keys, destination addresses, or account identity.

## Data contracts and prerequisites

`ExportPlan` has schema/version, dataset/query/review revision, mode, selected stable event/asset/overlay IDs, metadata/variant policy, safe planned paths, byte estimates, omissions, and destinations only after separate consent. Preview and writer use the same frozen plan. The output report maps each planned item to written/skipped/failed/cancelled status with actual size and checksum. The manifest contains only disclosure-permitted references.

Local bundle work needs no provider credentials. Large-output writing and composed video depend on tested desktop browser codecs/storage APIs; unsupported paths remain explicit. Google release requires registered OAuth client, verified branding/domain/redirects and required scope approval, plus a scoped disposable test account. Immich verification requires a reachable disposable installation and limited key. Agents can implement adapters and synthetic mocks before those gates, but cannot call real transfers or public OAuth availability complete without that evidence.

## Acceptance criteria

1. Complete and curated synthetic bundles reopen offline with correct selected text, media, overlays, stable context links, manifest scope, and coverage. The current screen filter cannot silently narrow complete mode.
2. A cleaned bundle contains no excluded record, participant label, context, source ZIP, or unfiltered JSON in any payload, path, sidecar, HTML, thumbnail, or manifest. Including exclusions requires an explicit preview policy change.
3. Every written payload's recorded size and SHA-256 match its bytes. Original assets match source bytes. Identical bytes retain all permitted historical references without filename collision.
4. Hostile names, markup, unsafe URLs, Unicode paths, traversal attempts, and identical basenames produce safe portable files and inert readable pages with local relative links.
5. Supported image overlays match full-size expected fixtures for alignment, orientation, alpha, dimensions, and layering. Original and derivative paths/claims remain distinct. Missing/unsupported transforms appear in both preview and report.
6. Supported composed-video fixtures preserve audio, frame content, duration, timing, and orientation. Unsupported codecs produce original-plus-sidecar output and an honest unavailable-derivative result.
7. A generated multi-gigabyte multipart archive exports with bounded memory. Cancellation, disk refusal, insufficient space, and interrupted output preserve sources and never show completion. A split path identifies every required part.
8. A changed query/review/dataset invalidates the prior approved plan before writing or uploading. Destination preview shows the exact account/origin, bytes, variants, metadata, omissions, and consent.
9. Approved synthetic Google media arrives in the intended account/app-created album. Tests cover partial batches, expiry, duplicate retries, processing failure, revoked access, storage limits, and app-created readback. Registration/verification remains an explicit unmet gate until exercised.
10. Synthetic Immich transfers use only the reviewed origin and limited permissions. Tests cover metadata/date mapping, duplicate reconciliation, denied keys, versions, local-network/CORS failure, reconnect/resume, and refused cross-origin redirects.
11. An interrupted transfer retries only reconciled unresolved work. Its receipt distinguishes verified, processing, omitted, failed, cancelled, and unknown outcomes. Disconnect/cancel never claims remote deletion.
12. Network inspection shows no archive bytes on Goodbye Chat's backend and no transfer before explicit consent. Private real archives are verified locally unless their owner separately authorizes an external transfer.

## Verification and delivery slices

Deliver a small offline ZIP with selected records, readable text, original bytes, and verified manifest first. Then finish policy/redaction, overlays, local reopen, and large-output handling. Destination adapters are independent slices with separate real-access gates; disabled buttons and mocked success do not complete them.

Use independent payload enumerations and hashes, reopen/scan every synthetic payload for exclusions and external references, and compare image/video fixtures. Browser tests cover frozen-preview changes, download, cancel, retry, unavailable capabilities, and source preservation. Adapter verification uses synthetic data, scoped test accounts, and a disposable Immich server. Run `pnpm test`, `pnpm build`, and affected `pnpm test:e2e` checks. Record external prerequisites separately from passed local behavior.
