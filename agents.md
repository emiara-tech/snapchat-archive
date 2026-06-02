# Agents.md

## Project Snapshot

`snapchat-archive` is a local-first Vue/Vite app for importing Snapchat export zips, parsing the archive in the browser, and browsing, remenising on the photos chats, and metadata in a fun and engaging way.

## Core Priorities

1. Keep user data local and predictable.
2. Prefer correctness and robustness over clever shortcuts.
3. Preserve maintainability by extracting shared logic instead of duplicating it.
4. Make changes that are easy to verify and hard to regress.

## Working Rules

- Read the existing code and tests before changing behavior.
- Keep edits small unless a broader refactor clearly improves the project.
- Do not edit generated output, build artifacts, `node_modules`, or imported example data.
- Treat archive parsing and export paths as sensitive: avoid assumptions that could drop, misread, or silently rewrite user data.
- When behavior changes, update or add tests in the same change.

## Repo Boundaries

- `src/` contains application code.
- `tests/` contains Vitest coverage for parser, archive, and stats behavior.
- `public/` contains static assets.
- `dist/` is build output and should not be edited by hand.

## Success Criteria

- Keep the app working as a local archive browser and exporter.
- Preserve privacy-focused behavior: nothing should require sending user archives to a remote service.
- For code changes, pass the project checks before considering the task done:
  - `npm run build`
  - `npm run test`

## Implementation Guidance

- Prefer shared helpers over one-off logic in views or components.
- Keep parser and archive code deterministic and explicit.
- If you need a tradeoff, choose readability and failure safety over brevity.
- Avoid broad rewrites unless the current structure is actively blocking a fix.
