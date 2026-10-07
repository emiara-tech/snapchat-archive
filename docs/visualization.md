# Visualization contracts

Goodbye Chat should make a desktop archive feel like a place to explore. Users should be able to move through years, follow a conversation to its photos, inspect how their language changed, and open the evidence behind a statistic. Three-dimensional scenes are part of that product direction. This document defines planned behavior and acceptance criteria; it does not describe completed features.

## Supported capability boundary

OpenAI documents interactive visualizations in ChatGPT and publishes examples of generated 3D browser experiences. Its physics museum example uses authored 3D assets exported into an interactive website. That supports the ambition to build a rich browser world with agents. The implementation still needs scene code, assets, and a renderer. [ChatGPT Visualizations](https://learn.chatgpt.com/docs/visualizations), [OpenAI physics museum example](https://developers.openai.com/showcase/physics-museum).

The official OpenAI model catalog and the documented flagship model modalities do not establish a native 3D mesh or GLB generation interface. The product must not depend on an assumed ChatGPT 3D asset endpoint. This is a boundary inferred from the surveyed documentation, not a claim about every research system or future release. Model selection remains an implementation decision. [OpenAI model catalog](https://developers.openai.com/api/docs/models/all), [documented model modalities](https://developers.openai.com/api/docs/models/gpt-6-astra).

OpenAI documents structured text responses and a separate image-generation tool. The image tool produces raster image output. A picture with 3D shading can supply artwork or a texture, but it does not provide an interactive mesh. Our supported integration is a model proposing a constrained scene description or explanation, followed by application code that validates and renders it. Structured Outputs constrain response shape; their contents can still contain mistakes. [Image generation](https://developers.openai.com/api/docs/guides/tools-image-generation), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Three.js supplies the rendering layer. Its `WebGPURenderer` uses WebGPU where available and can fall back to WebGL 2. WebGPU availability, optional features, and resource limits depend on the browser and adapter. The application must detect actual capability and recover from device loss. These are desktop requirements even though mobile layouts are outside the product scope. [Three.js renderer](https://threejs.org/docs/pages/WebGPURenderer.html), [WebGPU device capabilities and loss](https://gpuweb.github.io/gpuweb/explainer/), [WebGPU secure context requirement](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

## What users should be able to explore

| Experience | Visual treatment | What selection reveals |
| --- | --- | --- |
| History | A navigable timeline with year landmarks and activity bands | The selected period, its available records, and gaps in the export |
| Conversations | A constellation of people and conversation activity | The actual thread, its participants, and media linked to its messages |
| Memories | A gallery with chronological and geographic arrangements | The original media, overlays, timestamp, and supported conversation links |
| Language | A terrain of word frequency and change over time | Counts, normalized rates, example messages, and the active language filters |
| Past self | A room themed around a selected year | A clearly identified imagined persona, its source period, and evidence for its language profile |

These scenes share the same archive selection. Selecting a year in the timeline updates the gallery, conversation list, statistics, and past-self source period. Selecting a conversation narrows the relevant media. Opening a photo can return to its message with the surrounding thread intact. Camera movement alone does not change which records are selected.

Scene layouts describe their meaning. Distance in the conversation constellation means a chosen layout relationship, such as similar activity timing. It does not imply emotional closeness. Activity height means recorded events under a stated denominator. Empty space can mean absent export coverage rather than an inactive period. Decorative particles, light, and generated artwork do not represent archive events.

## Facts are calculated locally

Archive parsing, record normalization, joins, filtering, and exact statistics belong to deterministic application code. Extend the existing statistics approach in `src/lib/computeStats.ts` behind a shared query contract. The renderer and any model interpretation consume its results rather than each calculating their own counts.

Every aggregate carries its definition, unit, selected record population, time zone, denominator, and missing-data policy. The application distinguishes a message count from a conversation count and an observed active-day run from a Snapchat streak. Comparisons use the same counting rules. Word-rate comparisons report their denominators so a larger archive period does not automatically look like a stronger preference.

Language statistics identify whose messages they include. A past-self language profile uses the archive owner's authored messages; other participants' words do not become the owner's vocabulary. Tokenization rules account for the supported languages, emoji, links, and punctuation. Raw counts remain available beside derived rates.

Missing timestamps, ambiguous ownership, and unavailable media stay visible in coverage reports. The product says "in your imported archive" when coverage is incomplete. It does not turn a gap into a personal conclusion or present an inferred mood as a measured fact.

Results are identified by archive revision, query revision, and calculation version. A filter change cancels obsolete work. The UI discards stale worker and model responses before they can replace a newer scene or explanation.

## Evidence and linking

Each conversation-media link records the source record identifiers, match method, and evidence. The UI distinguishes an explicit archive reference, a candidate inferred from partial metadata, a user-confirmed association, an ambiguous match, and an unresolved item. These are evidence states, not model-provided probability scores.

An inferred media match never silently becomes an attachment in reconstructed history. The user can inspect and confirm it. Ambiguous candidates remain available for review, and unresolved media stays browsable without an invented recipient or message time.

Both scene selection and the desktop reading mode resolve to the same stable record identifiers. An evidence panel can open a linked message, its neighbors, the media item, and the reason for a proposed match. The app preserves original fields alongside normalized values so a user can see where a display value came from.

Exclusion decisions apply to the shared query. A record excluded from a year or collection cannot reappear through a scene thumbnail, a statistics example, or a cached AI interpretation. The original archive remains unchanged. Explicit review controls can reveal excluded items locally when the user wants to reconsider a decision.

## The model-to-scene contract

Runtime model output is data under a versioned `SceneSpec` schema. It refers to approved scene types, metric identifiers, selected groups, bounded layout parameters, style presets, labels, camera intents, and evidence identifiers. Application code resolves the data and constructs the scene. Models can help agents write new scene implementations during development through the ordinary code and verification process.

Reusable generated geometry and assets include editable sources, asset provenance, and a reproducible generation or export process. An agent can improve a scene or regenerate an asset without reconstructing an undocumented manual workflow. Historical photos remain the user's original media; illustrative artwork does not replace them.

The runtime contract does not accept executable JavaScript, arbitrary HTML, shaders, import paths, network URLs, or model-created archive identifiers. Its accepted operations come from an application-owned catalog. This prevents a scene response from executing code or fetching a private file through a fabricated asset address.

Before rendering, the application checks:

1. The schema version and operation types are supported, and the response is complete.
2. Every metric, group, record, and evidence reference exists in the current authorized selection.
3. Layout parameters, object counts, label lengths, camera bounds, and asset sizes fit the renderer's configured budgets.
4. Numeric labels and visual encodings resolve to calculated values. Render factual numeric claims from metric references, so a generated annotation cannot introduce its own total or denominator.
5. The archive and query revisions still match the request that produced the response.

The renderer uses a deterministic scene template if a proposal fails validation, times out, or is refused. Locally computed statistics remain available throughout. Users can inspect the same selection without a successful AI request.

Explanations are separate from measured facts. The application labels an interpretation, shows its supporting records or aggregate identifiers, and lets the user open those sources. The model may suggest a useful comparison. Application code calculates the comparison before displaying a numerical claim.

External AI remains optional. The local renderer receives local media handles. A remote model receives only a user-authorized analysis packet for the feature in use. Aggregates, vocabulary, locations, and contact labels can still reveal private information, so they are not treated as anonymous by default. Authentication does not authorize archive upload. Public development artifacts use synthetic data under the repository privacy rules.

## Rendering responsibilities

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| Archive query | Resolve filters, exclusions, joins, and evidence | Preserve originals and expose coverage |
| Calculation worker | Produce aggregates and deterministic layout inputs | Never decide which unsupported fact is true |
| Scene planner | Choose a supported scene and optional explanatory text | Return bounded data that passes validation |
| Three.js renderer | Build geometry, lighting, camera motion, picking, and effects | Use approved templates and local asset handles |
| Desktop interface | Present controls, labels, media viewers, and evidence | Share selection state with every other view |
| Reading mode | Present tables, threads, and explanations in semantic HTML | Keep the same selected records and capabilities |

Keep archive work and costly layout preparation away from the main interaction thread. Web Workers provide background execution and message passing; large buffers should use transfer where appropriate rather than repeated full-archive copies. A worker alone does not enforce privacy, so the application still controls network access and authorized data flow. [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Use Three.js scenes for spatial exploration and effects, with HTML controls and evidence panels above them. Readable text, chat composition, filter controls, and export decisions belong to the desktop interface. The selected-year persona can have expressive lighting and an illustrative character, while its message transcript remains readable and clearly identifies the conversation as an imagined reconstruction.

## Large archive performance

Do not create one fully decoded texture or individual scene object per archive entry. Render aggregates at distant zoom levels, then add detail as the user approaches or selects a region. Use instancing for repeated geometry, chunked layout data, spatial indexing for picking, and bounded label density. Three.js documents instancing as a way to reduce draw calls for repeated meshes. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

Load media thumbnails on demand, with a bounded cache. Decode full images and video only when the user opens them. Release resources when their owner no longer needs them, including textures, geometry, materials, render targets, decoded image bitmaps, and object URLs. Removing a mesh does not itself release all its resources. [Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

Rendering quality adapts to measured frame cost and device limits. Reduce post-processing, pixel density, particles, labels, and visible detail before interrupting core controls. Pause decorative animation when the document is hidden. Use GPU compute for effects or layout acceleration only with a tested equivalent path for unsupported hardware; it does not replace exact archive calculations.

Each released scene declares budgets for visible instances, resident textures, buffers, and effect passes. Acceptance runs use named desktop reference hardware and generated archives with increasing event counts, including a million-event case. The targets are smooth 60-frame-per-second exploration on the reference GPU, immediate control feedback within 100 milliseconds, and a responsive 30-frame-per-second reduced-quality path. These are planned targets to verify, not current performance claims. Import and analysis jobs report progress and support cancellation.

Device loss preserves archive and selection state. Attempt a bounded renderer rebuild, then offer the reading mode if recovery fails. An unsupported GPU does not prevent reading a thread, filtering records, or exporting a selection.

## Desktop reading and motion controls

Desktop is the design target. Phone layouts and touch-specific interactions are outside this plan. Desktop accessibility still requires a way to understand and operate the same data without interpreting a moving canvas.

Reading mode provides the current selection as tables, a conventional chat thread with attachments, and plain-language statistics. It exposes the same filters, source links, exclusion decisions, and export controls. The switch preserves context rather than restarting the user's exploration. Text equivalents for charts and keyboard equivalents for interactions follow the relevant W3C guidance. [Non-text content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content), [keyboard operation](https://www.w3.org/WAI/WCAG22/Understanding/keyboard).

Respect reduced-motion preferences and provide an explicit motion setting. Disable automatic camera travel, parallax, and continuous decorative movement in that mode. Instant scene changes and stable lighting can preserve the visual identity. Essential selection and evidence navigation remain available. This follows the W3C guidance that nonessential interaction animation can be disabled. [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions).

## Verification artifacts and release gates

Committed visual fixtures contain generated names, messages, timestamps, locations, and media. Include empty periods, duplicate timestamps, an ambiguous attachment, a broken media handle, multilingual text, exclusions, and sparse years. Generate large performance archives during a test run rather than committing enormous binary fixtures. Real archive screenshots, vocabulary, derived metrics, and persona profiles stay outside public artifacts.

Use stable seeds, fixed cameras, and fixed animation time for visual comparisons. Maintain separate baselines where rendering backends differ, and combine screenshots with assertions about selections, counts, evidence links, labels, and camera state. A scene that looks plausible while selecting the wrong message fails verification.

Scene-spec evaluations include fabricated metric references, impossible counts, oversized scenes, stale responses, remote asset URLs, and text that attempts to request code execution. Reject every unsafe or unsupported proposal. Evaluate explanations for evidence accuracy, numerical accuracy, unsupported personal claims, and consistency with the selected year.

Browser verification covers real WebGPU where available, forced WebGL 2 rendering, absent GPU support, renderer recovery, reduced motion, and keyboard reading mode. Record the backend actually used. A headless run that falls back to WebGL 2 does not establish WebGPU behavior. Performance reports include hardware, browser, backend, fixture size, frame times, and resource counts without private archive contents.

A scene is ready when its facts agree with the query results, every selectable item opens the correct evidence, filters and exclusions stay consistent across views, resource use remains within its budgets, and failed AI or GPU work leaves the archive usable.
