# Phase 1. Account identity and user-funded AI

This spec implements Phase 1 in [MASTERPLAN.md](../../MASTERPLAN.md). [auth.md](../../auth.md) is the authority for identity, connection, consent, and spending contracts. Its initial, ChatGPT identity, ChatGPT plan usage, and public agent-access gates are separate.

## User value

An owner can use account features without handing over their archive. When they choose AI, the app identifies the connected payer, verifies a finite allowance, asks for a bounded job budget, and lets them stop. A declined login, missing credits, or expired credential does not prevent private browsing and local exports.

## Current baseline

The repository is a browser-only Vue/Vite app. It has no account store, backend session routes, durable auth transactions, protected connection storage, allowance admission, or agent registration service. `.env.schema` contains an optional development OpenRouter credential. That credential cannot fund production requests. A catch-all host rewrite currently serves the SPA document and must preserve the new backend routes when they are introduced.

## Required behavior

### Real app identity

Keep Vue/Vite and add a same-origin Node backend. WorkOS AuthKit supplies the initial hosted identity flow using its supported Node SDK. Verify installed SDK contracts and current provider requirements during implementation. Configure distinct local, preview, and production callback environments. The production app callback is `https://goodbye.chat/auth/callback`.

Create a cryptographically random browser-bound OAuth transaction with fresh state and PKCE S256. Store it durably with expiry, owner/purpose where applicable, allowed return path, and single-use consumption across function instances. The callback verifies the transaction and actual issuer, exchanges the code server-side, and establishes a rotated app session. Reject mismatched state, wrong browser, expired transaction, replay, unsafe return path, and wrong issuer. Provider denial ends the pending attempt without erasing another valid session or connection.

Use supported session helpers with explicit expected issuer verification. Sessions use host-only HttpOnly, Secure, SameSite=Lax cookies and server-side expiry, revocation, and refresh handling. State-changing endpoints enforce CSRF protection and ownership. Accounts are associated through verified provider identity. Matching email text alone cannot link existing accounts. Logout invalidates the active app session and clears its cookie. The UI accurately represents signed out, signing in, signed in, declined, expired, provider unavailable, and revoked access.

### Separate OpenRouter connection

Only a verified signed-in account can begin a connection. Use the supported public PKCE flow, fresh browser-bound state, and the configured public callback. Exchange the code on the backend. The returned key is an AI credential grant, not verified app identity. Keep the AuthKit account as the owner of the connection. A denied callback without returned state ends only the originating pending attempt through its bound browser context and cannot replace or delete an existing active connection.

Validate the key with the provider's current-key endpoint. Confirm inference permissions, expiry, finite key cap, remaining allowance, and applicable billing metadata. Reject management keys and connections whose funding source or cap cannot be established. Encrypt the credential in durable server storage, bind it to the app account and provider workspace, and decrypt it only for an authorized request. The browser sees safe labels, availability, and allowance information. It never sees the raw key or token exchange.

The public browser grant does not set a provider cap. Direct the owner to the dedicated key's supported provider settings and verify a finite cap before paid work. A provider settings URL uses only the supported key hash, never the credential. Label provider-reported key allowance as key allowance; do not call it the entire account balance. Disconnect blocks new work, cancels pending local admission, and deletes the stored credential. Describe remote revocation separately and claim it only after provider confirmation.

### Paid-job admission and consent

Every inference path, including embeddings, profile enrichment, generated explanations, conversation turns, and delegated jobs, passes one backend admission contract. Require the authenticated owner, active connection, refreshed usable finite allowance, explicit app job budget, bounded request capabilities, current data consent, and an idempotent job identity.

Reserve estimated cost atomically across server instances before calling the provider. Bound context, output, execution time, concurrency, tool iterations, and total job requests. Model/capability prices are runtime inputs rather than permanent spec values. Reject unknown or unbounded cost capabilities. Reconcile provider-reported usage after completion and show unknown usage honestly after interruption. An app budget is admission control and does not configure a provider-side cap or guarantee an exact final invoice.

Do not automatically retry a potentially billed interrupted request. Safe retry logic distinguishes a pre-admission failure from possible provider acceptance. Depletion, expiry, revocation, disconnect, timeout, and rate limit stop or pause the affected job with recovery guidance. No error chooses another account, an owner-funded credential, a development key, a more expensive model, a new provider, or an automatic top-up.

Before archive material leaves the browser, show purpose, selected period/collection, exact kinds and amount of content, gateway and upstream recipient, billing source, and estimated bounded cost. Let the owner inspect and reduce the packet. Authentication and a funded connection do not grant this consent. Exclusions apply before packet construction. An imagined-self packet uses verified owner-authored messages; including other people's text requires a deliberate separate choice. Provider data-use and retention requirements must pass the agreed privacy policy before a route is enabled.

### Separate ChatGPT gates

Prepare a provider-neutral tested transaction boundary while hosted ChatGPT registration is pending. Real hosted sign-in needs an issued OpenAI application client, approved callbacks, and its actual identity permissions. Do not advertise an active ChatGPT login button without that access. Do not transplant the open-source localhost listener flow into the hosted page.

ChatGPT plan usage needs its own granted capability and account-bound funding connection. Identity sign-in does not establish plan spending permission or access to ChatGPT history. Account linking and a change of payer require explicit confirmation. The initial OpenRouter result cannot satisfy either ChatGPT gate. A local companion would need a separate agreed distribution contract.

### Scoped agent access

Implement real protected-resource discovery, registration, authorization, scope enforcement, owner claim, expiration, and revocation before publishing a public `/auth.md` registration guide. The repository auth.md remains an internal engineering document. Use only provider features available for the configured environment. Ordinary login is independent of optional Agent Registration enablement.

Unclaimed or anonymous agents cannot access private context or paid capabilities. Reading private owner-selected context requires the supported user-bound claim and actual owner confirmation. Running paid analysis additionally requires the same connection, budget, and packet consent as interactive use. Agents receive scoped short-lived credentials for the correct user and resource. They never receive administration credentials, the provider inference key, or unrestricted local archive access. Since the archive is browser-local, any approved context sharing requires a deliberate local packet transfer; registration alone does not create a server archive.

## Interface and data contracts

| Route or record | Required behavior |
| --- | --- |
| `GET /auth/login` | Start a browser-bound identity transaction with an allowlisted return path. |
| `GET /auth/callback` | Validate and consume the transaction, verify identity, rotate session, then remove credential-bearing callback query data. |
| `GET /api/session` | Return minimal verified account and capability state. Never return tokens or infer archive access from login. |
| `POST /auth/logout` | Require the valid session and CSRF contract, invalidate the session, and clear the cookie. |
| `GET /connections/openrouter/start` | Start a connection transaction for the verified session owner. |
| `GET /connections/openrouter/callback` | Validate the account and browser binding, consume once, exchange server-side, and verify connection allowance. |
| `POST /connections/openrouter/disconnect` | Verify owner and CSRF, disable new requests, and remove the encrypted local credential. |
| OAuth transaction | Opaque ID, purpose/provider, browser binding, state digest, protected PKCE verifier, created/expiry times, allowed return path, and consumption status. |
| Connection | Opaque ID, owner ID, provider/workspace metadata, encrypted key reference, validation time, expiry, finite cap, remaining allowance, and availability reason. |
| AI job | Idempotency ID, owner/connection, approved consent revision, job budget, capability bounds, estimated reservation, current state, reported usage, and cancellation state. Server records contain no archive excerpts. |
| AI packet | Explicit purpose and selected evidence, minimized content, collection/revision references, recipient disclosure, and consent. Payloads are transient unless a separately approved derivative-retention contract permits storage. |
| Delegated credential | User/resource binding, granted scopes, expiry, revocation, owner-claim state, and consent/budget requirements. |

## Failure and privacy states

Show connection states for absent, authorizing, denied, connected but cap required, usable, unknown allowance, depleted, expired, revoked, provider unavailable, and disconnected. Preserve local functionality in every state. A session expiry during callback cannot attach a new key to a different account. A session switch during a paid operation fails owner validation.

Keep identity, secrets, budgets, reminders, and archive data separate. Credentials stay out of localStorage, `VITE_` variables, URLs, logs, source control, analytics, and agent output. Sensitive endpoint errors use safe codes and scrubbed context. Return paths reject external redirects. OAuth and session records work across different backend instances. Revoked consent prevents queued jobs from starting.

## Acceptance criteria

1. P1-01. Synthetic identity tests cover successful sign-in, denial, provider failure, explicit issuer verification, expired/replayed state, wrong browser, invalid sessions, refresh failure, unsafe return paths, and CSRF rejection.
2. P1-02. Transactions and app sessions work across backend instances. Concurrent callbacks consume a transaction once. Login rotates the session and logout prevents its reuse.
3. P1-03. On the deployed site, a real authorized AuthKit account signs in, retains a verified session after reload, and signs out. Provider-initiated and recovery journeys have verified supported outcomes.
4. P1-04. Synthetic connection tests prove account/browser binding, denial without state, single-use exchange, finite-cap verification, management-key rejection, provider workspace metadata handling, and credential deletion.
5. P1-05. A real authorized deployed account connects its own OpenRouter key, verifies its finite cap, approves one bounded synthetic request, sees usage, disconnects, and signs out. That request uses that account's funds.
6. P1-06. Absent, unlimited, unknown, expired, revoked, or exhausted allowance blocks paid admission. Local import, browsing, statistics, and export remain available without signing in or connecting AI.
7. P1-07. Concurrent jobs and duplicate requests cannot exceed their admitted reservations or send the same paid request twice. Tool loops and batches stop at their configured job bounds. Potentially billed interrupted requests do not retry automatically.
8. P1-08. Requests from account A cannot inspect, use, disconnect, or charge account B's connection. Switching account or revoking consent invalidates queued admission. No inference path accepts a browser-supplied owner ID as authority.
9. P1-09. No raw credential enters browser storage, a URL, a client bundle, logs, or test output. No server-side account/budget record contains archive canary text or media. Ordinary local analysis makes no inference request.
10. P1-10. A consented synthetic AI packet contains only allowed current selected evidence, preserves exclusions, identifies gateway/upstream recipient and payer, and stays within configured context and output bounds. Missing consent blocks transfer.
11. P1-11. The ChatGPT identity gate passes only after real approved hosted sign-in. Its plan-usage gate passes only after a separately authorized synthetic request uses that account's granted allowance. While registration is pending, no UI pretends either works.
12. P1-12. A fresh agent can follow deployed discovery, register, complete any required owner claim, and use exactly its granted scopes. Unclaimed, expired, replayed, revoked, other-resource, and other-account credentials cannot access private context or spend credits. Public instructions describe only those implemented flows.
13. P1-13. Authentication and connection routes receive backend responses rather than the SPA catch-all document. Server secret requirements validate through Varlock and clients expose only minimal account and allowance information.

## Verification plan

Run pnpm build, unit, and browser checks with synthetic providers and a durable test store. Exercise OAuth races, transaction consumption across instances, issuer/audience failure, cookie attributes, CSRF, ownership, redirects, session refresh, and disconnect during admission. Use synthetic allowance responses and a deterministic pricing fixture to verify budget races and bounded jobs without paid calls.

Inspect browser network traffic, client bundles, redacted server logs, and durable records for credential and archive canaries. Complete separately authorized live-provider checks using synthetic content and finite limits on the deployed site. Record actual provider/environment and gate results without credentials. Mocked identity, emulator success, and a documented callback cannot substitute for these live gates.

## Implementation slices and prerequisites

1. Same-origin backend, durable transaction/session contracts, minimal session UI, and synthetic identity tests.
2. Real AuthKit integration and deployed account verification.
3. OpenRouter PKCE grant, encrypted connection storage, allowance states, and disconnect.
4. Atomic job admission, explicit packet consent, synthetic bounded inference, and live user-funded verification.
5. Hosted ChatGPT identity and separately granted plan usage.
6. Implemented scoped agent discovery, registration, owner claim, and revocation.

Slices 1, 3, and 4 can be developed with synthetic services locally. Real gates require approved AuthKit access, configured callbacks, server secret/encryption configuration, durable multi-instance storage, a real owner's sign-in and OpenRouter grant, finite funded allowance, and authorized synthetic spending. ChatGPT requires its issued hosted client and separate plan access. Agent registration requires actual provider enablement. Missing access leaves those specific gates open and does not block the local archive phases. Paid provisioning and acceptance of provider terms remain external decisions under agents.md.
