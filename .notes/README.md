# Project notes

This directory keeps delivery context together. Product definitions and conventions remain in the root masterplan, domain/auth documents, agent instructions, and `docs/`; application code remains in `src/`, `server/`, and `api/`.

- Read [progress](progress.md) when starting or resuming work, including after compaction. It records completed outcomes, current ownership, open findings, and full phase gates. Inspect the live diff/agents before acting on an assignment.
- Use [specifications](specs/README.md) to implement and review the active masterplan. Change acceptance criteria only for an explicit product decision.
- Follow the [delivery queue](delivery-queue.md) for dependency order. Active ownership and completed results belong in progress; local engineering and external acceptance remain separate.
- Maintain [the ideas backlog](backlog.md) when new ideas arrive. Ideas stay outside the active plan until deliberately promoted in their own session.
- Keep [idea details](ideas/cinematic-arrival.md) as future-session context. Draft targets do not become current delivery requirements by being written down.
- Record concise accepted correction reviews under `reviews/` and link them from progress. Preserve the original findings, resolution, verification and remaining gates; keep raw execution logs outside tracked notes.
- Read the owner's [vision](VISION.md) and [intended flow](FLOW.md) for product motivation. The older [copy checklist](TODO.md) is historical context; current assignments and completion status live in progress.

After a review handoff, update the relevant progress row with its outcome, reproducible checks, unresolved findings and next action. Keep private archive material, credentials, raw logs, temporary experiments and generated screenshots outside tracked notes. Preserve concise task results rather than a transcript of every command.
