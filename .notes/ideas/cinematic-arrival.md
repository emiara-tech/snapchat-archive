# Backlog: full visual revamp

This idea is reserved for a separate future session. It is not part of the current implementation plan or its acceptance gates. The owner wants a full visual revamp, including dark mode and a flowing, inspiring Three.js front page with autoscroll and a high-fidelity treasure chest. The detail below preserves that direction for later scoping; numerical budgets are draft targets to revisit then. [Visualization contracts](../../docs/visualization.md) remain relevant.

The revamp should extend through navigation, typography, color, layouts, motion and archive rooms, rather than stopping at the front page. Current engineering must keep domain/query/curation/export/inference logic independent of page components so this session can replace the presentation without rewriting the product's behavior. Separate scene models, motion progression and input policies from Vue rendering. Introduce small interfaces where a real boundary exists; avoid abstractions with only hypothetical uses.

One idea to assess in that session is compact workspace headers after import. The current conversation view spends substantial space on its hero before showing filters and messages. More visible history, persistent scope controls and a clear return path could make daily browsing easier. Assess this with real browsing tasks alongside the cinematic arrival; it is a future design question, not a current implementation requirement.

## The experience

A detailed closed chest sits in a carefully lit dark space. Brass highlights and the title lead to visible “Open my archive” and “Request my archive” actions. Scrolling brings the camera closer, opens the lid, and releases warm light and abstract ribbons. The ribbons carry the sequence into readable sections about rediscovery, understanding, and preservation. The final section returns to the import/request decision.

The chest is a real interactive model: arched hinged lid, separate planks, visible grain, bevelled edges, metal bands, rivets, hinges, and latch. Wood, worn brass, and interior lining have distinct materials. Lighting, shadows, reflected highlights, and opening motion remain convincing in close views. A plain box, raster image posed as a model, or unexplained spinning primitive does not meet the visual criterion.

Use an authored local model or authored procedural geometry/materials. Record any imported asset's license and provenance. Load assets from the application. Before import, the decorative chest/ribbons contain no fabricated conversations, photos, names, dates, or archive statistics.

## Theme contract

Offer a labelled System/Light/Dark control in the shared layout before and after import. System follows the current browser preference until the visitor chooses Light or Dark. Persist only that non-sensitive preference. Invalid/unavailable storage falls back to System. Apply the resolved theme before the first styled paint; react to system changes when appropriate.

Shared tokens cover backgrounds, surfaces, text, borders, controls, feedback and focus rings across every route, modal, source inspector, empty state and error. Archived images/videos retain original colors. Native controls and the renderer receive the resolved theme. Even in Light mode the cinematic stage may remain deliberately dark, with legible controls and a considered transition into the surrounding page.

Meet WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text. Controls and focus indicators remain distinguishable. Theme changes preserve archive, selection, curation, modal state and scroll position without reload.

## Motion and navigation

One normalized progression coordinates camera travel, lid opening, light, ribbons and section transitions. Wheel, trackpad, scrollbar, Page Down and keyboard navigation continue to work. Scene motion follows scrolling smoothly without trapping the visitor inside a canvas.

“Play the journey” starts bounded autoscroll and exposes Pause. Wheel, touch, pointer interaction, navigation keys, Escape, opening a menu or following an action stops it immediately. Resume is explicit; the end stops it. Advancing never moves focus. Import/request stay available throughout.

Reduced motion shows a composed static chest and the same sections/actions, with no autoplay, smooth-scroll or animation-dependent content. A visible motion control also permits this static experience. Hiding the page pauses rendering/autoscroll; returning does not unexpectedly resume page travel.

## Rendering and resource limits

Semantic HTML/actions work while the scene loads. GPU initialization, asset failure or device/context loss produces a local static treatment and readable content without a dead overlay or reload. Record the backend actually exercised.

Lazy-load scene code after the actionable page renders. Bound drawing resolution, geometry, textures, particles and frame work. Arrival device pixel ratio is at most 1.5 unless measurements justify increasing it. Target at least 45 frames/second on measured supported desktop hardware; record machine/backend privately. Software-rendered CI establishes behavior, not that hardware target. Compressed scene assets total at most 10 MiB, excluding shared application code/fonts.

Route exit releases owned renderers, geometry, materials, textures, targets, animation frames, observers and listeners. Theme changes update the existing scene without parallel loops. Cancellation and late load completion are safe after unmount. Public arrival never reads an archive.

## Acceptance criteria

| ID | Required result |
| --- | --- |
| A01 | Signed-out visitors can import/request immediately, throughout autoscroll, while loading, and without GPU. No demo route or fabricated personal history. |
| A02 | System/Light/Dark works before first paint and in every room. Storage failure, system changes and reload obey the contract; archive/navigation state survives. |
| A03 | Both themes meet contrast requirements, including focus, modals, source inspection, feedback and native controls. Archived media is unmodified. |
| A04 | The actual rendered chest has the specified detail/materials/lighting/hinge/close-view quality. Manager approves running-browser views at 1280×800 and 1920×1080; selectors alone cannot close this. |
| A05 | Manual scroll produces one coherent chest-opening-to-ribbons-to-actions sequence with readable transitions and working keyboard navigation. |
| A06 | Autoscroll starts explicitly, exposes state, stops for every specified interaction and at the end, preserves focus and resumes only on request. |
| A07 | Reduced motion and the motion control preserve all content/actions without animated travel. Visibility changes pause work without surprise resumption. |
| A08 | Asset/GPU failure and context loss recover; route exit/late loading leave no unhandled errors or surviving scroll loop. |
| A09 | Measured asset/rendering budgets hold on the stated desktop/backend. No third-party asset request, archive read or private telemetry is introduced. |

## Proposed future delivery

1. Scope the complete visual revamp in its own session, agree on its acceptance criteria, and then promote work from the backlog into the active plan.
2. Build theme, shared visual language and archive-room presentation through the existing independent implementation/review/fix loop. Reuse current application behavior and actual imported records.
3. Build and review the actual chest, motion controls, recovery and import/request journey. The manager assesses the running product, not selectors alone. Record accepted outcomes/open gates in [project progress](../progress.md).
