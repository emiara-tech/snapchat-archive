# Onboarding and the export wait

Goodbye Chat should earn a return visit before someone has their Snapchat archive. The desktop journey starts with an interactive preview, helps the user request their data, keeps a clear route back while Snapchat prepares it, and reveals personal highlights when the user imports the files. This is a planned product contract. Reminder delivery, export readiness detection, and the proposed highlight experience are not implemented.

The [masterplan](../MASTERPLAN.md), [authentication contract](../auth.md), and [visualization contract](visualization.md) define the wider product. Requesting a Snapchat export and importing an archive must remain available without an account or a paid AI connection.

## What Snapchat supports

The export action opens Snapchat's official [My Data page](https://accounts.snapchat.com/v2/download-my-data). Snapchat instructs users to choose data categories and a date range, confirm a notification email address, then submit. Snapchat sends its own download email when the export is ready; users can also check recent exports in that portal. [Snapchat export instructions](https://help.snapchat.com/hc/en-us/articles/7012305371156-How-do-I-download-my-data-from-Snapchat).

Snapchat aims to deliver exports within seven days, and says large downloads can take longer. This is an estimate, not a completion deadline. Snapchat also says data requests cannot be canceled. Canceling Goodbye Chat reminders must therefore describe only our reminders. [Snapchat timing and cancellation](https://help.snapchat.com/hc/en-us/articles/7012305371156-How-do-I-download-my-data-from-Snapchat).

A full-history guide recommends the available chat/history categories and Memories, with the user's chosen date coverage. It explains that a Memories-only export cannot supply the same conversation analysis. Exports contain retained records, and some older information may be absent. [Snapchat export coverage](https://help.snapchat.com/hc/en-us/articles/7012305371156-How-do-I-download-my-data-from-Snapchat).

The surveyed public export guidance and developer API catalog do not establish a supported third-party My Data status API or readiness webhook. This is a finding from those sources, not proof that no private partnership exists. Login Kit explicitly excludes private messages, shared content, and contacts; connecting a Snapchat identity does not supply an archive or a readiness signal. [Snap API catalog](https://developers.snap.com/api/home), [Login Kit access boundaries](https://developers.snap.com/snap-kit/login-kit/overview).

The initial product uses Snapchat's email and the user's own confirmation. It must not collect Snapchat passwords, use session scraping, poll undocumented export endpoints, or advertise automatic readiness detection. Receiving and parsing someone's Snapchat email would require a separate, explicit mail integration and a reviewed data contract. It is outside the initial reminder journey.

## The connected journey

| Stage | Planned experience | Completion evidence |
| --- | --- | --- |
| Arrive | A short invitation to revisit an old year, follow a friend into a conversation, or take ownership of an archive. Offer "Open my archive" and "Request my archive" immediately. | The user can reach local import or the official request guide. |
| Request | Open the official Snapchat export page, explain the useful categories, media choices, date coverage, and return steps. Keep the guide available in Goodbye Chat. | The user says they submitted a request. Opening the link alone does not establish submission. |
| Wait | Save a non-sensitive local checklist and chosen next activity. Offer an optional, verified-email reminder at a time the user chooses. Keep local import and the export-status portal accessible. | The UI states that Snapchat's current readiness is unknown. |
| Return | The user chooses "Snapchat emailed me" or "I downloaded my archive." Help them find and download their export on Snapchat before selecting local files. | User-reported readiness remains separate from local file validation. |
| Import | Validate and parse local files, associate records and media, calculate coverage and exact statistics, then prepare highlights. | Each displayed result belongs to the current validated import revision. |
| Reveal | Let the user privately discover old photos, evidence-based statistics, conversation connections, and optional embarrassing messages they wrote. | Each highlight opens its source records and can be hidden or skipped. |
| Continue | Offer "Revisit and play," "Understand my history," and "Curate and export." All use the same archive, filters, exclusions, and media links. | The chosen activity opens with the selected year or records intact. |

The pre-import experience supplies a reason to return without inventing facts about the user. Provide the export-request checklist and explain how to open the returned files locally. A saved preference is a navigation choice, not a prediction about their history.

An existing archive bypasses the wait. A return on another computer shows the onboarding guide and optional account preferences, then asks the user to select their files locally. Account login must not imply that private archive content followed them to that computer. Browser storage can disappear, so the guide remains useful without a remembered checklist.

## Readiness and reminder state

Keep two independent state records. A local journey records `not_requested`, `requested_by_user`, `reported_ready`, `validating`, `importing`, and `opened`. A reminder subscription records verified recipient status, consent, the chosen schedule, and `active`, `completed`, `canceled`, or `delivery_failed`. These are application states; none is a status supplied by Snapchat.

A timer can make a reminder due. It cannot change the local journey to `reported_ready`. Only the user's confirmation does that. File validation establishes that the selected local files are supported and readable; it does not prove Snapchat exported every expected record.

Reminder copy should say "Check Snapchat's email or your exports. When you've downloaded your archive, return to open it privately." It must not say "Your archive is ready" or "We've analyzed your history" when the app has not received that evidence. A late export can remain pending without a fake countdown or another automatic request to Snapchat.

## Consent, delivery, and stopping

The user chooses reminders separately from account creation and AI access. Verify the recipient before enabling scheduled sends. Show the purpose, chosen time or bounded schedule, a finite send limit, and the stop control. Do not turn this consent into a marketing subscription or a default stream of retention emails.

The reminder service stores only what delivery needs: an account or recipient reference, verified email, consent revision and time, schedule, delivery state, and limited delivery identifiers. Workflow runs receive opaque references rather than the email address. They must never contain archive bytes, file paths, photos, message excerpts, contact labels, statistics, year profiles, signed Snapchat download links, session cookies, or provider secrets.

Each email contains a plain return link to Goodbye Chat, the Snapchat portal link, and a scoped stop-reminders link. It contains no private highlights, attachments, tracking pixels, or archive-derived claims. A return link can restore the guide; it cannot authorize account changes or reveal private data. Any authenticated action checks the actual signed-in account. Stop links use unguessable, limited credentials rather than workflow tokens.

Stop future delivery after the user reports readiness, reports a local import, withdraws consent, deletes their account, or reaches the agreed send limit. Detect bounces and complaints and suppress further sends. Cancellation cannot retract an email the delivery service has already accepted. Recheck current consent and subscription state immediately before each send, including after a retry or a delayed callback.

Publish reminder-data retention and deletion behavior before launch. Remove recipient data and cancel active jobs when consent is withdrawn or the account is deleted. Verify the chosen workflow host's run-history deletion and retention capabilities before promising erasure of that history. Opaque references and minimal results reduce the personal information a retained operational trace contains.

## Durable orchestration requirements

The wait belongs in a durable server job, so it survives browser closure, process restarts, and deployment changes. Archive import and analysis remain browser-local. A server reminder becoming due must not trigger a remote archive-processing job.

A workflow engine must persist its progress, suspend for a due time, accept authorized user events, retry safe operations, expose delivery failures, and support cancellation. Vercel Workflow documents durable suspension with `sleep()`, external resumption with hooks, and run cancellation. Those are relevant capabilities for the planned Vercel deployment; no workflow engine or email service is provisioned by this plan. [Workflow persistence](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), [durable sleep](https://workflow-sdk.dev/docs/api-reference/workflow/sleep), [external events](https://workflow-sdk.dev/docs/foundations/hooks), [run cancellation](https://workflow-sdk.dev/docs/api-reference/workflow-api/get-run).

Workflow inputs, step arguments, and results can persist across suspensions. Resolve the recipient and delivery credentials inside the sending step, and return only a minimal outcome and delivery identifier. Keep email addresses, request bodies, credential-bearing URLs, and private content out of workflow logs and error messages. [Workflow serialization](https://workflow-sdk.dev/docs/foundations/serialization), [persisted step results](https://workflow-sdk.dev/docs/foundations/workflows-and-steps).

Our event handler authenticates and authorizes the caller, validates the event, and checks subscription ownership before resuming a job. User identity comes from the session. A hook token routes an event; it does not authenticate its sender. Generate verification and stop-link credentials with cryptographic randomness inside a server step, because random values in a workflow function are deterministic. A workflow webhook is also not a Snapchat integration simply because an endpoint exists. [Hook and webhook security](https://workflow-sdk.dev/docs/foundations/hooks#security).

Use one logical delivery identifier for each consented reminder, with the same provider idempotency key across retries. Deduplicate repeated scheduling requests and user events. A transient error can retry within a finite budget; a rejected recipient or withdrawn consent stops. If a send times out after possible provider acceptance, reconcile its result before trying again. Without idempotency or a verifiable delivery result, leave the outcome unknown and avoid a blind duplicate send. Workflow retries alone do not provide exactly-once email delivery. [Side-effect idempotency](https://workflow-sdk.dev/docs/foundations/idempotency), [retry behavior and ambiguous writes](https://workflow-sdk.dev/docs/foundations/errors-and-retries).

Version the reminder contract so a deployment can still cancel or complete an older waiting job. Use bounded per-recipient and service-wide send limits, finite job lifetimes, and a visible delivery-failure state. A delayed, duplicated, or out-of-order event must not re-enable consent or create a second active subscription.

Implementation needs server endpoints, a minimal reminder and consent store, a durable timer mechanism, and an email delivery service with a verified sending domain. Provision and inspect these through available APIs and command-line tools, with credentials kept in the repository's secret-management path. Verify the installed workflow package's documentation before using its APIs. Local import and archive browsing can ship before reminder infrastructure is available; the UI must then offer a user-saved return reminder without claiming email delivery.

## The import reveal

The analysis scene should make real progress visible. Reading files expands a timeline; parsed conversation groups appear as clusters; resolved media links connect photos to threads. Animate completed work and measured counts, and mark decoration as decoration. When total work is unknown, report the current stage and completed items instead of a fabricated percentage. Do not impose a delay just to keep an animation running.

Support cancellation, retry, missing archive parts, damaged files, duplicate media, absent dates, and limited export coverage. Preserve the user's selected files and curation state when recovery permits it. Superseded imports cannot update the new scene. A reduced-motion presentation and the desktop reading mode keep controls and progress available if 3D rendering fails. These requirements follow the shared [visualization contract](visualization.md).

Highlights are calculated locally before any optional AI request. Useful first cards include the earliest available photo, the most active recorded month, a frequently revisited conversation, and a word or emoji the user often wrote. Each card states its record population and coverage, carries stable evidence identifiers, and opens the corresponding records. An observed activity run is not a Snapchat streak, and missing export data does not establish inactivity.

Use exported identities and supported conversation-media links for references to friends. Do not turn display-name similarity, a frequent contact, or nearby photo timestamps into a claimed relationship or attachment. Let the user inspect an ambiguous association. Never infer emotional closeness from activity counts.

Embarrassing-message highlights need a separate opt-in before any excerpt appears. Use only messages confirmed as written by the archive owner. Let the user hide a card, exclude its sources, skip the entire reveal, or go straight to the archive. The default tone is playful and does not judge a person's relationships, identity, or mental health. Exclusions apply to highlights, scenes, statistics, and export previews.

The local reveal costs no model credits. Optional AI interpretation requires a clear view of the exact packet leaving the browser, separate consent, and the connected user's authorized allowance under [auth.md](../auth.md). A failed or unaffordable AI call leaves the locally calculated highlights usable. Neither sign-in nor reminder consent authorizes AI processing.

## Completion evidence

- A new user can open local import or the official export page, save a return choice, and return without an account or private upload.
- The guide distinguishes a full-history export from Memories-only coverage and makes no guaranteed date or readiness claim.
- A timer, forged callback, duplicated request, older consent revision, or unrelated signed-in account cannot mark an archive ready or trigger unauthorized mail.
- Reminder tests cover verification, chosen timing, browser closure, process restart, deployment changes, repeated events, send timeouts, bounded retries, bounces, unsubscribe, readiness confirmation, import completion, and account deletion.
- Cancellation and withdrawal remain effective during a send retry. Delivery receipts, run history, and logs contain only the documented minimal information.
- Synthetic archive tests cover complete and partial imports, missing media, corrupted files, cancellation and retry, incorrect ownership, stale work, hidden highlights, GPU failure, and an unopened AI connection.
- Every personal highlight resolves to its current local source records. The user can skip it and enter any of the three activities without losing the selected period or exclusions.
- Service metrics can count consented requests, return visits, import completion, and activity selection without recording names, words, media, or contact relationships. Establish the telemetry consent and retention contract before collecting those metrics.

The first deliverable is the complete request-to-local-import journey. Add verified, cancelable reminders after the server and delivery contracts pass their checks. Automatic Snapchat readiness detection remains an external capability to establish before promising it to users.
