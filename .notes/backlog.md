# Ideas backlog

This is future-session work, separate from [the active masterplan](../MASTERPLAN.md). Maintain stable idea IDs and update an existing entry when the idea changes. Promote an idea only when its session establishes scope, dependencies and reviewable acceptance criteria; then link its active tasks from [progress](progress.md).

| ID | Idea | Status | Session boundary |
| --- | --- | --- | --- |
| VISUAL-001 | Full visual revamp: dark mode, typography, navigation, layouts, archive rooms, and a flowing cinematic Three.js front page with a high-fidelity treasure chest and controllable autoscroll. | Backlogged | A separate proper design/implementation session. Not part of the current plan. |

## VISUAL-001

The owner wants an inspiring, surprising visual experience throughout the product. The front page should feature a detailed wooden/brass treasure chest, opening lid, warm light, flowing transitions and an expressive camera journey. Dark mode and the surrounding rooms belong to the same redesign. [Detailed idea context](ideas/cinematic-arrival.md) preserves the direction and proposed motion/accessibility/resource criteria for later scoping.

Current engineering supports this future work by keeping archive, query, curation, export and inference behavior independent of page components. The redesign should reuse these behaviors and replace their presentation. This modularity rule applies now; building the revamp does not.
