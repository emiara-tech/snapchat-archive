# Development principle

Use test-driven development as a guiding principle for correctness and code quality. Let meaningful tests drive simple, modular code with clear interfaces and focused responsibilities.

Project-wide instructions live in [agents.md](agents.md).

Build real product features. Do not add public demo modes, fabricated user histories, or scripted substitutes for AI. Keep synthetic fixtures confined to automated tests.

Keep archive, query, curation, export, and inference logic independent of page components. Views consume small application interfaces. Put rendering and browser/provider I/O behind clear boundaries so a visual redesign can reuse the product behavior. Let tests guide useful module boundaries; avoid abstractions introduced only for hypothetical reuse.
