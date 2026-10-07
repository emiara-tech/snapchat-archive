# Agent instructions

## Project snapshot

`snapchat-archive` is a local-first Vue/Vite app for importing Snapchat export zips, parsing the archive in the browser, revisiting photos and conversations, and exporting memories.

## Responsibility

- The agent owns engineering delivery, including implementation, debugging, testing, maintenance, and verification of authorized releases.
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
- Real archives and personal media are private, ignored test inputs. Preserve the originals and keep their contents out of commits, screenshots shared with others, and external services.

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
