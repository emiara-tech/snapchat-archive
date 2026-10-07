# Identity, AI connections, and user-funded usage

Use WorkOS AuthKit for initial app identity. Every user funds AI requests through their own connected account. Genuine ChatGPT sign-in remains a future identity option with its own OpenAI registration requirements. Archive browsing, filtering, statistics, and local exports remain available without signing in or paying for AI.

App authentication, an AI billing connection, and consent to send archive excerpts are separate permissions. Connecting an inference key never grants access to another user's account or archive.

## Initial app identity

WorkOS AuthKit owns the hosted sign-in experience and verified account identity. Keep the existing Vue/Vite interface and add same-origin Node backend routes on Vercel. The server SDK handles authorization, code exchange, and session verification; Vue reads minimal session information from our backend. This avoids a framework migration. [AuthKit Node integration](https://workos.com/docs/authkit/vanilla/nodejs).

Use the ordinary core authentication product. Do not add enterprise SSO, paid custom domains, or unrelated security products to establish basic login. Check current provider terms before provisioning paid resources. No free-tier amount or price is a permanent project guarantee.

The coding agent must be able to configure callbacks and environments, inspect sessions, and run integration checks through documented CLI or API operations. WorkOS documents agent and CI modes, structured output, resource configuration, and local emulation. Keep production configuration reproducible and verify the installed CLI's command schema before using it. Development emulation does not establish live authentication. [WorkOS CLI](https://workos.com/docs/cli).

Initial account access and provider consent can still require a person. Product features such as WorkOS Agent Registration are separate from the coding agent's ability to operate this project; they are not prerequisites for ordinary login.

| Route | Responsibility |
| --- | --- |
| `GET /auth/login` | Create a pending transaction and start AuthKit sign-in. |
| `GET /auth/callback` | Validate the transaction, exchange the code, and establish a session. |
| `GET /api/session` | Return minimal account and capability information. |
| `POST /auth/logout` | End the session and clear its cookie. |
| `GET /connections/openrouter/start` | Begin an AI connection for the signed-in app account. |
| `GET /connections/openrouter/callback` | Validate the pending connection and exchange its code. |
| `POST /connections/openrouter/disconnect` | Stop using the connection and delete its stored credential. |

Generate fresh random state and a PKCE S256 challenge for sign-in. Bind the pending transaction to the initiating browser. Expire it and consume it once across server instances. Allow only configured callbacks and return locations. Register the production callback as `https://goodbye.chat/auth/callback`; other environments use their own approved callbacks.

Use the maintained WorkOS session helpers with sealed cookies and an explicitly configured expected issuer. The Node SDK checks token signatures, but its README states that issuer validation requires explicit configuration. Keep session secrets server-side. [WorkOS Node SDK](https://github.com/workos/workos-node/blob/main/README.md).

Sessions use host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Verify authentication and ownership on every protected server route. Enforce CSRF protections for state-changing operations, rotate sessions on sign-in, and handle expiry, revocation, and refresh failures. Do not trust a browser-supplied user ID. Use the verified provider identity to associate app accounts; email alone cannot authorize a merge.

Keep AuthKit API credentials, session encryption secrets, and per-user inference credentials out of browser storage, `VITE_` variables, source control, URLs, logs, analytics, and agent output. Validate deployment secrets through the repository's environment schema. Per-user inference keys are connection records, not shared deployment environment variables.

## OpenRouter connection contract

Users authorize a dedicated OpenRouter key for Goodbye Chat through the documented PKCE flow. It supports a public HTTPS callback. Start with `https://openrouter.ai/auth`, a configured `callback_url`, fresh `state`, and a base64url SHA-256 challenge using `code_challenge_method=S256`. The provider returns state on successful authorization; it does not return state on denial. Denial must end the pending attempt without changing an active connection. [OpenRouter OAuth guide](https://openrouter.ai/docs/guides/overview/auth/oauth).

Run code exchange on our backend. POST `code`, `code_verifier`, and `code_challenge_method` to `https://openrouter.ai/api/v1/auth/keys`. Require the original app account and browser-bound transaction, consume it once, and reject expired or replayed callbacks. Clear the callback query before returning to the interface.

The current exchange schema returns an API `key` and a nullable `user_id` associated with that key. It does not supply an OIDC identity token, verified email, or profile. Treat this result as an AI credential grant. Keep the authenticated AuthKit account as the app identity and retain provider IDs only as connection metadata. [Exchange schema](https://openrouter.ai/docs/api/api-reference/oauth/exchange-authorization-code-for-api-key).

Validate the key through `GET /api/v1/key`. Inspect its expiry, inference permission, key allowance, and billing metadata. The response can identify a key creator, organization, and workspace; an organization key's creator is not necessarily its billing owner. Reject management keys for ordinary inference connections. [Current-key schema](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key).

Encrypt each key in server-side connection storage, bind it to its app account and provider workspace, and decrypt it only for that account's authorized request. Return labels, connection state, and allowance information to Vue, never the key. Disconnect cancels further work and deletes the local credential. Provider-side revocation is a separate operation; do not claim remote revocation unless it succeeds.

Offer a link to the key's provider settings for cap changes and revocation. OpenRouter documents owner-only settings links using a SHA-256 key hash. Do not place the raw key in a URL. Never request an account management key for normal onboarding.

## Who pays

Every production inference request, including profile generation, embeddings, image analysis, retries, and conversation turns, uses the requesting user's authorized connection. Its OpenRouter account or workspace funds the request. No owner-funded shared key, automatic top-up, credit purchase, or switch to another billing account is allowed.

An account-less visitor can inspect and export locally. A signed-in user without a usable funded AI connection can do the same. AI stays disabled until a usable connection and an accepted budget exist. A development credential must never become the public application's fallback.

The initial connection uses OpenRouter credit-backed inference. OpenRouter's separate upstream BYOK feature lets users supply provider credentials to OpenRouter and can introduce upstream provider charges. It is not the same as supplying an OpenRouter app key. Do not enable an upstream BYOK workflow until its billing source, limits, and fallback behavior are explicit. [OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok).

## Spending limits and admission

Require a finite provider-side USD cap on the dedicated inference key before enabling paid work. The ordinary public PKCE exchange schema has no cap field, and the documented browser authorization parameters do not establish one. An app-side budget field does not configure a provider cap.

A separate authenticated `POST /api/v1/auth/keys/code` accepts `limit` and an optional reset interval. That operation is not the normal public browser connection flow. Do not call it with the project owner's credential to provision keys for users, and do not assume access to the user's management permissions. Users configure their dedicated key's finite cap in provider settings; we verify the result. [Authorization-code creation schema](https://openrouter.ai/docs/api/api-reference/oauth/create-authorization-code).

Read `limit`, `limit_remaining`, `limit_reset`, and expiry through the current-key endpoint before admission. Refresh this information for each paid operation, including multi-request jobs. An unlimited, unknown, expired, revoked, or exhausted allowance cannot authorize new paid work. A key's remaining allowance is not the user's entire account balance. The separate account-credit endpoint requires management privileges; normal onboarding does not request those privileges. [Key allowance](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [account-credit permissions](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits).

Require an explicit app-side budget for a conversation or analysis job. Bound context size, completion size, execution time, tool iterations, and concurrent requests. Reserve estimated cost atomically across app instances, reconcile reported usage, and stop when the job's admitted budget is exhausted. Do not allow a batch or agent loop to continue spending without a bound.

Show estimated cost before expensive work and reported usage afterward. Estimates must use current model and capability prices, with a margin for uncertainty. Reject capabilities whose cost we cannot bound. Do not record temporary prices, model choices, or tuning values as permanent conventions.

Provider caps and our admission controls work together. Do not promise that a stale balance check or UI cap alone guarantees an exact final bill. OpenRouter's in-flight credit safeguards cover only certain accounts and cost components; image and plugin fees do not share all token-cost safeguards. [Provider credit limits](https://openrouter.ai/docs/api_reference/limits).

Stop on insufficient credits or an exhausted key cap. Distinguish temporary in-flight congestion from a job too expensive for the allowance, and honor provider retry hints where safe. Never retry a potentially billed interrupted request automatically. Rate-limit and connection failures must not trigger another user's key, an owner key, or a more expensive unapproved model.

If an upstream BYOK workflow is added, require limits that cover its external charges. OpenRouter records BYOK usage separately, and budget accounting can omit it unless explicitly enabled. Do not present the OpenRouter credit cap as a universal cap on third-party invoices. [BYOK budget accounting](https://openrouter.ai/docs/guides/best-practices/spend-controls).

## Archive and consent boundaries

Login transfers identity information, not the imported archive. Keep raw ZIPs, chats, media, statistics, and review selections on the user's device unless a separate feature requires a disclosed transfer. Authentication and connection storage contain accounts, credentials, and budget records, not archive payloads.

Before an AI request, show its purpose, selected year, kinds of content, recipients, and billing source. Let the user inspect and reduce the material. Preserve exclusions in context generation, retrieval, and exports. An imagined self uses the archive owner's messages; including other people's messages requires a deliberate separate choice. Ordinary browsing and local statistics never trigger AI requests.

Minimize transmitted context. Account for the gateway and upstream model provider in the disclosure. Choose routes whose retention and data-use policies meet the agreed privacy requirements; an account connection does not establish those policies. Keep archive text and media out of authentication records, logs, telemetry, and error reports.

Treat AI profiles, embeddings, summaries, and generated conversations as private archive derivatives. Allow users to discard them independently of source files. The real test archive and its derivatives remain private. Use synthetic content for committed fixtures, automated provider tests, and public examples. Local archive testing permission does not authorize external AI requests with it.

## Genuine ChatGPT sign-in later

Keep genuine Sign in with ChatGPT as a separately registered identity method. AuthKit is not evidence of an available ChatGPT social provider and cannot bypass OpenAI registration. Hosted website sign-in requires an issued OpenAI client and approved callbacks; current website access is a selected-partner trial. [OpenAI website integration](https://developers.openai.com/siwc/website), [client registration](https://developers.openai.com/siwc/request-client-id).

OpenAI's open-source dynamic flow requires a protected local runtime and a `127.0.0.1` callback listener. It cannot be transplanted into the hosted Vue page. Paid or remotely hosted plan-usage integrations require provider access. A local companion would be a separate distribution decision. [Open-source registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [open-source usage policy](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt).

If ChatGPT plan usage becomes available, treat it as another explicit per-user billing connection. Identity verification alone does not grant plan usage or ChatGPT conversation history. Apply its actual granted scopes and supported capabilities. Require deliberate account linking and budget selection before switching from OpenRouter. [ChatGPT integration options](https://developers.openai.com/siwc/quickstart).

## Future agent registration and auth.md discovery

This repository document records engineering conventions. A future public `/auth.md` is a separate protocol entrypoint that tells external agents how to register, discover supported scopes, and obtain service credentials. The open protocol composes existing OAuth standards and is not restricted to WorkOS. Its Protected Resource Metadata remains the machine-readable authority. [Open auth.md protocol](https://workos.com/auth-md), [application integration contract](https://workos.com/auth-md/docs/apps).

For the selected AuthKit implementation, verify that Agent Registration is enabled for the environment before integrating it. The managed documentation requires explicit enablement and directs unavailable environments to WorkOS. Its discovery chain connects an API's `WWW-Authenticate` challenge, `/.well-known/oauth-protected-resource`, the authorization server's metadata, and an `agent_auth` block. The provider can generate the public instructions for the configured environment. Publish or proxy those instructions only after their endpoints and permissions work. Do not serve this internal planning document as a functioning registration guide. [AuthKit Agent Registration](https://workos.com/docs/authkit/agent-registration).

Personal archive access requires a user-bound agent. Use the supported `service_auth` claim flow for external agents, and require the authenticated owner to confirm the claim before private access or paid work. An email hint is not verified ownership. An optional anonymous demonstration may use only synthetic data and cannot read private records, alter a review, or start a billable job.

The open protocol also describes an agent-verified flow using trusted provider identity assertions. Enable that path only after the chosen issuer and actual integration support are verified. Validate signatures, expected issuer and audience, authentication freshness, and replay protection. Existing accounts require confirmation before a newly asserted identity is linked. A model's stated identity is not an identity assertion. [Agent-verified application requirements](https://workos.com/auth-md/docs/apps#agent-verified-flow).

Future agent permissions must distinguish synthetic demonstration, connection-status inspection, reading an owner-selected context, and running an approved analysis. Credentials are short-lived, scoped, revocable, and bound to the correct resource and user. API authorization enforces the granted scopes and user ownership on every call. Registration does not grant arbitrary archive access or expose the owner's provider key. Delegated paid requests still pass the same connection, budget, and data-consent checks as interactive requests.

For first-party agents built into Goodbye Chat, AuthKit's separate Agent Auth feature can mint delegated sessions with permissions limited by the user and the configured blueprint. That feature also requires environment access. The application backend holds WorkOS administration credentials; product agents receive only their scoped credentials. Verify expiry, refresh rotation, revocation, and removal of delegated authority before exposing it. [First-party Agent Auth](https://workos.com/docs/authkit/agent-blueprints).

Keep coding-agent test access separate from production users. Use synthetic accounts and scopes, and revoke test credentials after verification. Agent registration does not make user claims, AI spending consent, OpenAI client approval, or other provider access requirements automatic.

## Completion criteria

Call app login complete only after real approved accounts can sign in, retain verified sessions after reload, and sign out. Verify denied, expired, and replayed callbacks; invalid sessions; account isolation; and provider-initiated login and recovery journeys. Emulation and mocked tokens do not establish live access.

Call an AI connection complete only after a real authorized grant binds to the correct app account, its finite provider cap is verified, and a synthetic bounded request completes using that account's funds. Test insufficient allowance, revoked credentials, interrupted streams, duplicate requests, and disconnect. Confirm every inference path rejects absent user connections and never uses an owner-funded fallback.

Call public agent registration complete only after a fresh agent follows the deployed discovery instructions, obtains the permitted identity, completes any required owner claim, and can use exactly its granted scopes. Verify that unclaimed, expired, replayed, revoked, and other-account credentials cannot access private data or spend credits. The public instructions must describe only implemented and tested flows.

The coding agent can implement, configure, and test these flows once authorized provider access exists. Account ownership, user authentication, and provider consent remain real access boundaries. No implementation or live-provider verification is implied by this document alone.
