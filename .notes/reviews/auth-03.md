# AUTH-03: account-store lifetime review accepted

Scope: R1 from the independent account-routing review against [Phase 1](../specs/phase-1.md) and the modularity/TDD conventions. Author: manager. Reviewer: `specs_workspace`. Third fixer: `specs_foundation`. The original reviewer rechecked the frozen result and accepted it.

The account store previously acquired another native SQLite handle when Vite invalidated the API module and kept those handles after shutdown. A process-owned resource registry now survives SSR module replacement. Each development/preview server holds an idempotent owner lease; the last server shutdown closes the local connection. Changing the local path closes the previous connection. Shared Redis precedence and deployed rejection of local-only storage remain intact.

Verification: eight account-routing tests passed. Real Vite HTTP/SSR invalidation holds one SQLite handle instead of growing from one to two; shutdown releases it. Preview restart reopens persisted sessions and releases the handle. Overlapping servers keep the resource until the last close. Fixtures use synthetic credentials/stores and reject external network calls. Typecheck passed at handoff.

The manager inspected the extracted `server/accountRouting.ts` adapter and process ownership in `api/service.ts`. They provide a real server/I/O boundary without page dependencies. Subsequent POST-body and paid-job wiring are separate changes requiring their own review; this acceptance does not establish production auth, paid inference, or a full release.
