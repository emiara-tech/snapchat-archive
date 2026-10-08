# Safe archive import recovery

The original archive must remain unchanged when local preparation fails. Users need an accurate explanation and a working way to select other ZIP files. ZIP indexing finishes before dataset normalization on Welcome, so recovery must cover both stages without adding another normalization pass.

Local implementation is accepted in [the independent review](../reviews/import-failure-01.md), including the actual preparation-failure/replacement browser journey.

## Behavior

- A pure `describeArchiveImportFailure(error: unknown)` returns an inert, fixed failure description. It recognizes only the concrete occurrence preparation error and its approved `budget`, `domain` and `limits` codes. It never reads or renders arbitrary error messages, filenames, tokens, accessors or unknown fields.
- `budget` explains the current app's local processing limit and suggests a smaller ZIP selection. It does not imply that valid source files need to be downloaded again.
- `domain` explains an unsupported identifier format without showing the identifier. `limits` says local processing could not start. Unknown failures receive generic recovery copy.
- The archive store's existing `importError` ref becomes the single safe description or null. Existing cancellation, reset and stale-operation guards remain binding. Processing renders this description and its existing replacement-file action.
- The workspace keeps its existing single string error ref. Its catch maps failures to the helper's fixed description, so all consuming views receive safe copy.
- Welcome says the archive is opening while loading, could not open on failure, and is ready only when the dataset exists. On failure it offers replacement ZIP selection through archive reset and the import route, alongside the existing explicit retry action.
- The change does not add a prepared-dataset cache, repeat normalization, introduce a second mutable error store, or change producer policy.

## Acceptance and ownership

Experience writes the helper, focused unit tests and new actual-ZIP browser test; it owns archive store/Processing and only the catch/recovery/header changes in workspace/Welcome. Root independently reviews the original behavior and repository standards. A separate agent fixes valid review findings; root rechecks.

Meaningful tests cover each known code, unknown private messages and getter canaries. A browser imports an actual ZIP with 4,097 reference slots, receives safe capacity advice through the real worker/Welcome path, sees no filename or token echo, selects valid replacement ZIPs and successfully opens them. Existing broken-ZIP, cancellation and retry behavior must continue to pass.

Freeze both recovery and occurrence-producer code before shared tests, build, browser verification and commit. Passing direct loader tests alone does not accept this user journey.
