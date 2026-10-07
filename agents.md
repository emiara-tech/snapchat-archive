# Agent instructions

## Project snapshot

`snapchat-archive` is a local-first Vue/Vite app for importing Snapchat export zips, parsing the archive in the browser, revisiting photos and conversations, and exporting memories.

Use [MASTERPLAN.md](MASTERPLAN.md) for product goals and phase completion criteria, [CONTEXT.md](CONTEXT.md) for domain language, [auth.md](auth.md) for authentication and AI access, and [docs/visualization.md](docs/visualization.md) for rendering contracts. Desktop is the design target; mobile work is outside the product scope.

For onboarding and reminders, read [docs/onboarding.md](docs/onboarding.md). For complete/curated bundles, overlays, or external media transfers, read [docs/export-destinations.md](docs/export-destinations.md).

## Responsibility

- The agent owns engineering delivery, including implementation, debugging, testing, maintenance, and verification of authorized releases.
- The user authorizes pushing verified work to `dev`, opening the `dev` to `main` pull request, obtaining CodeRabbit approval, merging after required checks pass, and verifying the production deployment without asking for confirmation again. A local commit is an intermediate step.
- Every pull request into `main` requires CodeRabbit's approving review of its latest head commit, including documentation and configuration changes, except when CodeRabbit explicitly reports that its review allowance or rate limit is exhausted. Address valid findings or discuss them with CodeRabbit, push fixes to `dev`, and rerun affected checks. An earlier review, generic outage, skipped review, or error does not establish the rate-limit exception.
- When CodeRabbit confirms an exhausted limit, the user authorizes merging without its approval after the agent reviews the current diff, addresses valid outstanding findings, and passes the applicable build and tests. Record the limit evidence and verification in the PR. If necessary, temporarily relax only CodeRabbit-related merge requirements for that release and restore the original protections immediately afterward. Do not use this exception to bypass unrelated checks or push directly to `main`.
- The user sets product direction and evaluates the running app. They do not inspect code, so code review and technical verification are the agent's responsibility.
- Carry authorized work through to a verified outcome. Resolve routine technical decisions independently; ask when a missing product decision or external access prevents progress.
- Treat production readiness, privacy, and stability as requirements for every change. Fix known failures in the affected user journey before releasing it.
- Report what works, what was verified, and any remaining limitations in plain language. Distinguish an unfinished feature from a completed and tested one.

## Core priorities

1. Keep user data local and predictable.
2. Prefer correctness and robustness over clever shortcuts.
3. Preserve maintainability by extracting shared logic instead of duplicating it.
4. Make changes that are easy to verify and hard to regress.

## Working rules

- Use pnpm for Node, JavaScript, and TypeScript work, and pixi for Python environments.
- Read configuration contracts from `.env.schema`. Run agent commands that need secrets with `pnpm exec varlock run --redact-stdout -- <command>` and noninteractive output. Keep secret values in ignored local files or deployment secret stores and out of agent context. Regenerate environment types rather than editing them.
- AI usage must be funded by the connected user's authorized allowance. Do not add a shared owner-funded production key or silently switch billing sources; development keys are only for explicitly authorized checks.
- Read the existing code and tests before changing behavior.
- Keep edits small unless a broader refactor clearly improves the project.
- Do not edit generated output, build artifacts, `node_modules`, or imported example data.
- Treat archive parsing and export paths as sensitive: avoid assumptions that could drop, misread, or silently rewrite user data.
- When behavior changes, update or add tests in the same change.
- Document durable decisions and conventions. Keep temporary provider, tool, and setting experiments out of committed documentation.

## Repo boundaries

- `src/` contains application code.
- `tests/` contains Vitest coverage for parser, archive, and stats behavior.
- `public/` contains static assets.
- `dist/` is build output and should not be edited by hand.
- The user authorizes the agent to use the private test archive for testing, including parsing, browser interactions, media playback, and export verification, without asking for permission again.
- This repository is public. Preserve the original archive and keep it, personal media, and all derived private data out of commits and external services. Keep logs, screenshots, recordings, and extracted files containing real archive data private and outside tracked paths.
- Use synthetic data for committed test fixtures and publicly shared testing evidence.

## Success criteria

- Keep the app working as a local archive browser and exporter.
- Preserve privacy-focused behavior: nothing should require sending user archives to a remote service.
- For code changes, pass the project checks before considering the task done:
  - `pnpm run build`
  - `pnpm run test`
  - `pnpm run test:e2e` for changes affecting browser behavior
- For user-visible changes, verify the affected journey in a real browser, including loading, failure and retry behavior, and relevant screen sizes. Check browser errors and unexpected network requests.
- Use synthetic archives for repeatable edge cases and the available private export for realistic checks. State which archive cases were actually verified.
- For an authorized production release, confirm the deployment succeeds and check the affected pages on the live website. A successful build alone does not establish production readiness.

## Implementation guidance

- Prefer shared helpers over one-off logic in views or components.
- Keep parser and archive code deterministic and explicit.
- If you need a tradeoff, choose readability and failure safety over brevity.
- Avoid broad rewrites unless the current structure is actively blocking a fix.
