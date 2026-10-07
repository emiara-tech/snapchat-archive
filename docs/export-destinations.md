# Archive downloads and media destinations

Goodbye Chat should let people keep a complete, readable copy of their imported history, make a cleaned selection, and send chosen memories to Google Photos or their own Immich server. This document defines planned contracts and release gates. It does not describe an implemented connector or a completed transfer.

The local bundle is the authoritative export. A photo service receives supported media and selected metadata; it does not replace the bundle's conversations, source evidence, overlays, and unresolved records. Every export uses the same archive selection and exclusion rules as browsing, statistics, and highlights.

## Download choices

| Choice | Contents | Privacy behavior |
| --- | --- | --- |
| Selected collection | The selected chats, media, and supported links | Apply the current exclusions and metadata choices to every output |
| Complete readable archive | Every available record allowed by the current export policy, reconstructed conversations, media, overlays, and a coverage report | Explain that "complete" means the imported data, subject to the choices shown in the preview |
| Original preservation copy | An explicitly requested copy of the imported source files and their checksums | Explain that untouched originals contain the original private data, including material removed from a cleaned view |
| Media destination | The chosen supported photos and videos, with optional composited derivatives and selected destination metadata | Require separate consent for each account or server and show omissions before transfer |

An original preservation copy is a separate action. Do not include original ZIPs or unfiltered source JSON inside a cleaned bundle, since they can disclose excluded conversations or metadata. Keep the user's input files unchanged. If stripping private metadata changes a media file, identify it as a derivative and report the transformation. Byte preservation and metadata removal must have separate, accurate claims.

Before writing, show the selected period and people, media counts, estimated bytes, original and composited variants, metadata to include, exclusions, and unsupported cases. A complete download must not inherit a temporary screen filter without explaining the resulting scope. Show a final report after writing, and let the user reopen the bundle locally to verify it.

## Bundle contract

Use a versioned manifest and stable archive record identifiers. A bundle contains readable conversation pages, machine-readable records, media, overlay sources, optional rendered derivatives, and sidecar metadata. Keep original media and derivatives in distinct paths. Use collision-safe filenames and relative links that work without the website, an account, or expiring object URLs.

The manifest records:

- The export schema, archive revision, selection policy, time zone, and calculation or rendering versions.
- Each payload file's path, MIME type, byte count, and SHA-256 checksum. Preserve multiple historical references when identical media bytes appear in several messages.
- Available original timestamps, their source fields, normalized values, and any missing or conflicting time information.
- Media-to-message and media-to-conversation links, with confirmed, inferred, ambiguous, or unlinked states and their evidence. A confirmed link retains the identifier match or owner decision that established it.
- Overlay inputs and transformations, with links between the original media, its overlay, and each derivative.
- Missing files, damaged inputs, unsupported records, and skipped transformations. An absent attachment remains a gap in the reconstructed chat.

Manifest and sidecar content follows the export privacy policy too. An excluded name must not reappear in a filename, album title, checksum journal label, HTML transcript, thumbnail, or provenance note. Retain only evidence that the chosen output is allowed to disclose. Readable pages escape archive text and work without third-party scripts or external media requests.

Write large bundles incrementally with bounded memory. Offer a directory or a streaming archive where the desktop browser supports it, and a documented split-download path where necessary. Detect disk and format limits before reporting success. Cancellation leaves the source intact and labels any partial output. Reopening a permitted directory or reselecting source files may be necessary after restarting the browser; do not promise unattended browser transfers after the tab closes.

## Images and text overlays together

Users can export memories as they appeared, while retaining their available source components. Use actual overlay images or supported structured text from the archive. Preserve orientation, canvas size, transparency, layering, and supported placement. Text inferred by OCR or a model must not replace a missing original overlay as though it were historical evidence.

Offer an original and an optional flattened image with the overlay included. Preview the flattened result at full size. Record the renderer, source checksums, output format, and any color or metadata changes. A caption baked into the original must not be added again. Unsupported fonts, effects, missing layers, and uncertain positioning appear in the report.

Video composition is a separate capability. It requires supported decoding and encoding, correct overlay timing, audio preservation, orientation, and an output the destination accepts. A still preview does not establish that the exported video includes its overlay. If a browser cannot perform a supported composition, retain the original and overlay sidecar, explain the unavailable derivative, and offer a local processing path when implemented. Never silently drop audio, animation, frames, or timed text.

## Shared transfer contract

Destination adapters consume a frozen, reviewed export plan. They do not independently expand the archive selection. Connecting an account authorizes the requested capabilities; pressing transfer authorizes the particular files and metadata in the preview. Archive import, product sign-in, email reminders, and AI access grant no destination permission.

Each adapter declares accepted formats and sizes, metadata mappings, authentication requirements, readback support, and deletion limits. Show the destination account or exact server origin, album choice, bytes to send, and any changes required for compatibility. Unsupported items remain downloadable locally. Do not silently convert an original or upload both original and flattened versions.

Keep media on a path from the user's computer to the selected destination. The first implementation must not route private archive bytes through Goodbye Chat's hosted backend. A control service may handle approved OAuth exchanges and minimum job information without becoming an archive store. A local connector can handle capabilities that the browser cannot support.

Direct browser transfer has a capability gate for each destination. Verify CORS, authorization, raw and resumable upload, creation, and readback with synthetic files. When that route is unavailable, use the validated local connector rather than assuming an API endpoint can accept browser requests.

Maintain a private transfer journal tied to the destination identity, export revision, source checksum, transformation recipe, and destination object identifier. Distinguish queued, uploading, accepted, processing, verified, failed, and unknown outcomes. A lost response can leave an unknown outcome; reconcile it before retrying an operation that might create another object.

Persist checkpoints only with the user's chosen local storage policy. Keep credentials, media, private filenames, and account details out of logs and public telemetry. Retry transient failures with bounded backoff and respect provider limits. Stop on revoked credentials, permission changes, account changes, or a changed export selection. Cancellation stops further work and reports the items already accepted remotely. It does not claim to undo them.

Deduplicate byte transfers without deleting distinct historical records. Reconciliation must separately check media acceptance, processing, metadata, and album membership. Report partial success per item and let the user retry only the unresolved work. Do not promise exactly-once delivery where a provider lacks an appropriate transaction or reconciliation mechanism.

## Google Photos

Google's Library API remains an upload destination. Since March 31, 2025, library reads and management cover media and albums created by the app. Selecting existing items from the user's broader library requires the Picker API. Shared-album API operations from the former sharing scope are unavailable. Scope this connector as user-initiated export of Snapchat memories, rather than broad library synchronization. [Google Photos API changes](https://developers.google.com/photos/support/updates).

Request `photoslibrary.appendonly` for upload. Add `photoslibrary.readonly.appcreateddata` when the implemented transfer needs readback and reconciliation. Request `photoslibrary.edit.appcreateddata` only for implemented editing operations on app-created content. Google Photos uses user OAuth, does not support service accounts, and requires OAuth verification. Product login does not grant Photos access. [Authorization scopes](https://developers.google.com/photos/overview/authorization).

The public release needs the registered OAuth client, approved redirects, verified domain and branding, an accurate privacy policy, and any required scope review. Verification is an external release dependency that agents can prepare and track; access is not established by writing an integration. [Google OAuth verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

Google allows personal image and video storage or transfer that adds useful functionality, but prohibits a substitute Google Photos gallery and other competing use cases. Keep the integration focused on the user's chosen archive export. Before requesting access, explain the files and metadata to send and obtain affirmative consent. Retain the local bundle independently. [Photos API user data and developer policy](https://developers.google.com/photos/support/api-policy).

Upload bytes first, then create media items with their upload tokens. Tokens expire after one day. Byte uploads may run in parallel, but item-creation calls must run serially for each user. Inspect every result because a batch can partially succeed. Identical uploaded bytes return the same media item identifier. The API has supported-format and size limits, and uploads count toward the user's Google storage. [Upload process and limits](https://developers.google.com/photos/library/guides/upload-media). Use the documented resumable protocol for large files, retaining its checkpoint privately. [Resumable uploads](https://developers.google.com/photos/library/guides/resumable-uploads).

`mediaItems.batchCreate` accepts up to 50 items per call and adds them to the user's library. An album must be app-created. Its creation request accepts a filename, upload token, and user-written description, not an arbitrary archive timestamp or metadata map. Descriptions must not contain generated tags, filenames, or provenance strings. Keep that evidence in the local manifest. [Media creation request](https://developers.google.com/photos/library/reference/rest/v1/mediaItems/batchCreate). The media patch API changes descriptions, not creation time. Treat preservation of date ordering as a tested compatibility requirement for each media format. [Media patch fields](https://developers.google.com/photos/library/reference/rest/v1/mediaItems/patch).

Store stable destination item IDs for reconciliation. Videos can be accepted while still processing, so a successful create response does not establish playback readiness. Image downloads through the API omit location metadata; video download URLs return a transcoded version. These limits prevent a promise that a later Photos API download reproduces the full original archive byte for byte. [Accessing created media and download behavior](https://developers.google.com/photos/library/guides/access-media-items).

The first transfer can use foreground authorization. Offline operation needs an explicitly authorized refresh-token flow and an appropriate protected store. Disconnect must stop jobs, remove retained credentials, and offer Google revocation. Google documents that revocation can affect all scopes granted to the OAuth project; explain that effect if the project also holds another Google connection. Uploaded media remains in the user's account. Do not label disconnect or removal from an album as deletion of a library item. [Offline access and revocation](https://developers.google.com/identity/protocols/oauth2/web-server). The surveyed Library API exposes no library-item deletion method, so automatic rollback must not be promised. [Library media methods](https://developers.google.com/photos/library/reference/rest/v1/mediaItems).

## Immich and independent services

Immich supports third-party integrations with user-scoped API keys and fine-grained permissions. Send a key in the `x-api-key` header rather than a URL, where it can enter history or logs. Connect to the user's own server and account; do not request their administrator password or an unrestricted session token. [Immich authentication](https://api.immich.app/authentication), [endpoint permissions](https://api.immich.app/permissions).

Uploading and the checksum-based preflight use `asset.upload`. Add read or album permissions only when the implemented operations require them. Leave administrator, sharing, deletion, and API-key management permissions out of the normal export connector. Immich's upload API accepts media with an optional sidecar and reports duplicates. Its preflight uses SHA-1 checksums; keep the bundle's independent SHA-256 integrity checks. The request requires file creation and modification times. Map those fields from stated evidence or a disclosed fallback, and never present an upload time as the historical capture date. [Upload endpoint](https://api.immich.app/endpoints/assets/uploadAsset), [duplicate preflight](https://api.immich.app/endpoints/assets/checkBulkUpload), [upload controller](https://github.com/immich-app/immich/blob/main/server/src/controllers/asset-media.controller.ts), [upload request schema](https://github.com/immich-app/immich/blob/main/server/src/dtos/asset-media.dto.ts).

Immich imports selected XMP fields, including descriptions, supported dates, location, ratings, and tags. Its documented naming convention places a sidecar beside its media, preferably `photo.jpg.xmp`. Other fields may remain in the sidecar without becoming searchable. Generate only supported, consented metadata from available evidence and verify what the destination actually displays. Keep chat links and unresolved associations in the complete bundle even when the destination cannot represent them. [Immich XMP support](https://docs.immich.app/features/xmp-sidecars/).

A local connector or the official CLI provides a path for private-network installations. Immich's CLI supports uploads, dry runs, albums, hash deduplication, and machine-readable results. Keep originals intact and never enable its delete-after-upload options as part of the connector. Use protected configuration or environment input for secrets, rather than putting a real API key in a copied command. [Immich CLI](https://docs.immich.app/features/command-line-interface/).

The hosted site's browser connection is conditional on the user's installation and browser. Immich's surveyed server source enables general CORS in development, so production cross-origin access must be checked rather than assumed. An operator may configure a suitable proxy, or use the local route. [Immich HTTP configuration](https://github.com/immich-app/immich/blob/main/server/src/app.common.ts). A custom authorization header requires a permitted cross-origin request. Browser local-network permission and mixed-content rules also apply; Chrome's local-network permission can permit some HTTP local destinations, but that is not a universal browser guarantee. [Fetch CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol), [Chrome local-network access](https://developer.chrome.com/blog/local-network-access).

Do not add a hosted fetch proxy that accepts arbitrary Immich URLs. Cloud infrastructure cannot ordinarily reach a user's private LAN, and arbitrary server-side destinations create an SSRF risk. For a local connector, bind the user's consent and credential to a validated origin, reject credential-bearing URLs, and refuse cross-origin redirects. Any future public-server relay needs a separate reviewed contract with destination verification, IPv4 and IPv6 address checks, connection-time enforcement, and network restrictions. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Probe the installed server's supported operations and report permission or version incompatibility before transferring media. A matching checksum alone does not authorize changing metadata on an existing duplicate asset. Preview that change separately. Disconnect clears the connector's key and tells the user how to revoke the dedicated key on their server. It must not delete remote assets or original local files.

## Release evidence

Implement and verify the local readable bundle before treating a media destination as a backup route. The minimum release evidence covers:

1. Round-trip reopening of a complete and a cleaned synthetic bundle, with correct chat-media links, checksums, coverage, and no excluded content in any file or metadata.
2. Image overlay comparison at original dimensions and tested video overlay, audio, timing, and unsupported-codec behavior.
3. A multi-part, multi-gigabyte synthetic archive, cancellation, insufficient disk space, interrupted output, and bounded memory during export.
4. A test Google account with valid public-release authorization, supported images and videos, unavailable metadata, quota or storage failure, partial batches, expired upload tokens, duplicate retries, revoked access, and video processing failure.
5. A disposable Immich installation with a limited non-admin key, matching metadata, duplicate media, denied permissions, reconnect and resume, private-network or CORS refusal, and no server contact outside the reviewed destination.
6. A per-item final receipt that distinguishes transferred, verified, pending, omitted, failed, and unknown work. Account or selection changes must invalidate old queued work.

Use synthetic fixtures and disposable destination data for committed checks. Real private archives stay local under the repository's testing authorization. Do not send them to Google Photos, Immich, or any external service to demonstrate the connector without separate explicit authorization for that transfer.
