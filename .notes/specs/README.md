# Delivery specifications

These specifications turn [the masterplan](../../MASTERPLAN.md) into reviewable product contracts. Each phase retains its full exit gate. A working slice is useful evidence, but does not establish completion of a larger phase or an external integration.

Baseline paragraphs describe each phase's planning starting point. Use [progress](../progress.md) for current completion and ownership, and the [delivery queue](../delivery-queue.md) for bounded task contracts and dependency order.

| Phase | Specification | Owner-visible outcome |
| --- | --- | --- |
| 0 | [Delivery foundation](phase-0.md) | Imports recover safely and local work stays private. |
| 0.1 | [Arrival and return](phase-0.1.md) | Open or request your own archive and return for a personal reveal. |
| 1 | [Identity and AI allowance](phase-1.md) | Sign in and authorize your own bounded AI spending. |
| 2 | [Traceable dataset](phase-2.md) | Know what the archive contains and where each item came from. |
| 3 | [Media connections](phase-3.md) | Open photos in their supported conversation context. |
| 4 | [Conversations](phase-4.md) | Read exchanges with text and media together. |
| 5 | [Curation](phase-5.md) | Make reversible choices that apply across the workspace. |
| 6 | [Portable exports](phase-6.md) | Take a complete or curated collection somewhere you control. |
| 7 | [Observations](phase-7.md) | Answer understandable questions with inspectable evidence. |
| 8 | [Observatory](phase-8.md) | Explore your history through meaningful spatial scenes. |
| 9 | [Year profiles](phase-9.md) | Inspect how your own writing shapes a selected year. |
| 10 | [Imagined self](phase-10.md) | Enter a year room and speak with a clearly fictional persona. |
| 11 | [Exploration assistant](phase-11.md) | Find evidence and preview curation changes before applying them. |
| 12 | [Release](phase-12.md) | Complete a coherent journey on the deployed product. |

## Implementation and review loop

1. The manager chooses a bounded slice, its phase acceptance criteria, dependencies, and the files its implementer owns. Independent slices can run in parallel once their shared contracts agree.
2. An implementation agent builds the interaction, data path, failure states, and meaningful checks. It reports the exact acceptance criteria demonstrated and any unmet requirements.
3. A separate reviewer compares the changed code and running behavior with the original phase specification. It also checks the repository's documented standards. Findings cite the criterion, affected code, observed behavior, and required correction.
4. A fixing agent addresses valid findings. The reviewer rechecks the affected criteria against the corrected implementation. A failing review returns to this step.
5. The manager checks the resulting product experience. Navigation, selection, evidence, exclusions, privacy, and recovery must remain consistent across rooms. A feature earns its place by helping someone rediscover, understand, or preserve their history.
6. The manager records accepted task outcomes and remaining gates in [progress](../progress.md), so work survives context clearing. Detailed transient logs/private evidence stay outside committed documentation. External authorization or deployment success requires actual evidence.

Use synthetic archives for committed checks and shared visual evidence. Temporary model choices, service experiments, and benchmark logs belong in delivery reports or issues. Change a specification only for a deliberate product decision, never to make a failed implementation pass.
