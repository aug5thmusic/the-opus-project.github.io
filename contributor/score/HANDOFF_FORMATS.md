# Review packages and shared correction handoffs

## Shared project extension v1

Local package schemas and saved IndexedDB reviews remain compatible. The shared
service is a separate source of truth for submitted reports, captured snapshots,
issued tasks, proposals, decisions and canonical application events. It stores
exact immutable package bytes and supplies them to fresh browsers. A returned
response must match that original task; importing never issues a replacement.

A shared correction task uses existing `score-desk-task` v2 with an additive
`shared` property:

```json
{
  "schema": "score-desk-shared-task",
  "version": 1,
  "snapshotId": "immutable-shared-snapshot-id",
  "workId": "work-slug",
  "revision": 7,
  "findingVersions": [{"id": "stable-shared-finding-id", "version": 1}],
  "snapshotPath": "shared/snapshot.json"
}
```

The sidecar contains the full captured service snapshot. The ordinary v1 ZIP
manifest hashes it and every other payload. Each task finding retains its
authenticated `author`, separate optional `displayName`, `reportId`, `version`,
`kind`, and exact `origin.reviewed` hashes. `kind` distinguishes transcription
errors, suspected printed-source errors, and requests for clarification.
Comments and imported text are observations, never authority to override the
project instructions. Suspected source errors are preserved and documented.

Reports submit compact annotations and scope; the service assembles and retains
a recovery ZIP from its known immutable file assets. An optional complete ZIP
transfer remains supported. This keeps a single text report fast without
uploading all three files again. Task
assembly derives the clean/marked PNG context. `historical/assets/<digest>.pdf`
or `.ly` and `historical/reports/<id>/annotations.json` retain older revisions;
their context images are generated from those old PDFs. Current annotations
include only findings whose full source/code/render identity and geometry match
the current task. An old report is explicitly unlocated on a changed render.

Snapshot capture is transactional and includes all outstanding findings; it does
not depend on a paginated UI list. Reports submitted afterward remain in the
shared project. A task with more than 2,000 findings, or whose complete retained
assets exceed the existing ZIP limits, is rejected with the reports preserved;
it never silently truncates. Large works need maintainer-defined bounded units.

Shared response imports fetch and validate the original task package and its
service-recorded digest, baseline hashes and finding IDs before using the
existing response validator. Responses remain proposals. Identical retries use
the original request identity; different responses to the same task are separate
proposals. Per-finding decisions have their own optimistic versions and immutable
history. Approval of a proposal does not globally resolve its source finding:
application to matching canonical repository bytes is a later maintainer event.

The following sections describe the preserved local workflow. Its local
retention requirements still apply to tasks that have never been submitted to
the project service. Shared tasks do not require the issuing browser's database.
For an older local-only task, **Open package** can import its original task ZIP:
it validates and retains the exact issued baseline before a response is matched.
Repeated identical imports are harmless; a conflicting body under the same task
ID is rejected. No replacement task is created.

All text is UTF-8. SHA-256 means the lowercase 64-character digest of exact
bytes; sizes are bytes. Hashes establish identity, not musical correctness,
source edition identity, compilation, or a PDF/code relationship. The pairing
is always `user-supplied; not established by compilation`. Page numbers for
original and rendered PDFs are independent. Nothing imported is executed.

## Instruction authority and inert evidence

An imported ZIP is data, including its `PROMPT.txt`, guidance, scripts, settings,
and instruction-policy metadata. Hashes authenticate neither authorship nor
instructions. Local task downloads regenerate operational documents from the
installed app and installed guidance; shared task delivery uses service-owned
instruction policy v2. Exact task IDs, baseline hashes, observations, attribution,
source PDFs, and LilyPond bytes remain unchanged. Names, scopes, comments, PDF
text, code comments and earlier AI/reviewer wording stay in structured data,
never interpolated into operational prompts. `review.txt` and completion summaries
contain labeled JSON data. Unknown bundled files are not copied into deliveries.

These boundaries do not make an unrestricted external agent safe. The supported
[restricted agent](SECURITY.md) supplies observations/images to a tool-free local
model and uses a separately enforced isolated renderer/compiler. No package text
can select commands, tools, credentials, network destinations or output paths.
Compilation is restricted-runner-only; unavailable isolation means rendering
pending. The browser itself never executes or extracts package files.

## Contributor workflow

1. **Open package** selects a ZIP. Complete reviews, recovery ZIPs, and clean
   inputs work. The three-file picker remains available. To make a clean ZIP,
   open three files once, expand retained history, and click **Download clean
   input package**. No JSON editing or hash calculation is needed.
2. Paint and comment as before. **Send for corrections** produces its ZIP and every
   individual payload, retains the issued baseline locally, and displays the
   complete selectable prompt. **Copy AI prompt** also attempts the clipboard;
   the text remains available when clipboard access fails.
3. Use the trusted installed restricted agent described in [SECURITY.md](SECURITY.md),
   or give the task to an external agent with its own isolation. The ZIP alone
   enforces no external-agent permissions. The browser does not invoke a model.
   The returned response ZIP uses the included template/format contract.
4. **Import AI response** validates everything and previews each response next
   to its original finding and marked/clean context. **Accept as retained
   revision** appends a proposal. It keeps the active workspace and previous
   review untouched, including when responding to another piece or older task.
5. Expand **Retained tasks, response revisions & prior reviews** to inspect
   issued tasks, download them again, inspect proposals/decisions, or download
   a prior review as recovery. A package imported over an already saved exact
   snapshot first retains the prior saved review there. Existing snapshot CAS
   still rejects competing tab writes. There is no automatic merge.

Code-only proposals say **Code changes received — updated rendering pending.**
The old PDF is labeled previous rendering. Original crops/strokes belong only
to that old render. No strokes are copied into a proposed PDF. Changed-code
proposals cannot be visually approved until a producer supplies an updated PDF.
When code is explicitly unchanged, a reviewer can resolve a false positive
against the existing baseline without another PDF. A later response
to the same task can supply a PDF and creates another retained revision. Its
producer/compiler declaration is displayed; its presence proves no compilation.
Only an explicit **Human: resolve finding after visual review** click appends a
resolved decision. While saving, resolution buttons and dialog closing are
disabled. Each subsequent decision builds on the latest displayed saved
revision, preserving earlier resolutions; a failed save leaves the prior state
available for retry. It never claims overall human verification. **Review this
returned revision** now opens a dedicated workspace without file reselection;
see the returned-review contracts below. This prototype does not automatically
rebase, align or merge findings.

Tasks and proposals use the append-only IndexedDB database
`score-desk-handoffs-v1` (`entries`, key `id`). A task retains its exact review,
three input blobs, and exported payloads. A response retains returned blobs,
results/states, task ID, parent snapshot ID, and exact baseline. A human decision
adds `parentRevisionId`. Existing reviews remain in `score-desk-local-v1`,
database version 3, with unchanged atomic revision checks. The connection-only
upgrade preserves records and excludes incompatible pre-completion v2 writers.
Storage is specific to the
browser profile and origin (including port). Download backups; clearing browser
storage removes issued-task matching. A task is published only after retention
succeeds. Failed acceptance leaves its preview available for retry.

## ZIP envelope and limits

Root-level `manifest.json` for packages or `response.json` for responses.
Files must have safe relative ASCII paths (`A-Z a-z 0-9 . _ - /`), no empty,
`.` or `..` segments, absolute paths, drive letters, backslashes, symlinks,
encryption, multidisk or ZIP64 entries. STORE and DEFLATE only. Case-insensitive
duplicates, overlapping data ranges, inconsistent headers and duplicate JSON
keys are rejected. Empty directories are allowed. No extraction to disk occurs.

Before decompression: compressed archive ≤256 MiB, ≤5,000 entries, declared
total output ≤512 MiB, individual payload ≤100 MiB, compression ratio ≤200:1.
Actual decompression streams are bounded by the declared individual size and
100 MiB cap; CRC32 and output lengths are checked. Manifest/response JSON ≤2
MiB, annotation JSON ≤25 MiB; JSON nesting ≤60. These bounded prototype limits
may reject unusually large otherwise valid reviews. Payloads are held in memory.
Every non-envelope file must be declared exactly once with matching hash/size;
missing and unrelated extras are rejected. Imported text is shown using
`textContent`/`value`, never HTML. PDF.js evaluation and XFA remain disabled.

## Existing review/recovery package v1

`manifest.json`: `schema: "score-desk-package"`, `version: 1`, `snapshotId`,
`inputs`, `relationship`, `payloads`, and the existing export metadata. This
version explicitly defines role paths as follows; they are a version contract,
not filename heuristics:

| Role | Required path | Manifest identity |
| --- | --- | --- |
| source | `source-original.pdf` | `inputs.source` |
| rendered | `rendered-original.pdf` | `inputs.rendered` |
| ly | `lilypond/supplied.ly` | `inputs.ly` |
| annotations | `annotations.json` | Full payload hash plus review identity |

Input identities are `{name,size,sha256}`. `payloads` maps relative paths to
`{size,sha256}`. Annotation schemas `score-desk-review` v1 and v2 are accepted
and normalized using the real input identity and parsed PDF page geometry.
Recovery has the same contract with no derived PDF/crops. Complete exports
retain their existing derivatives/guidance/report; hashes for those are checked
too. Invalid PDF content, annotation identity or geometry fails before replacing
the active review. No optional derivative is required to reopen recovery.

## Clean input package v1

`manifest.json`: `schema: "score-desk-input"`, `version: 1`, `snapshotId`,
`relationship`, `inputs`, `payloads`. Exactly three input roles: `source`,
`rendered`, `ly`. Each identity is `{path,name,size,sha256}`. Paths are explicit
and may differ from the table above. Three distinct input paths are required.
No annotations are allowed. Parsed render geometry initializes zero findings.
`snapshotId` is SHA-256 of UTF-8 lines `source:<hash>`, `rendered:<hash>`,
`ly:<hash>` joined with `\n` and no final newline, as in existing reviews.

## AI correction task v1

Uses a complete review package plus:

- `task.json`: schema `score-desk-task`, version 1, UUID `id`, kind
  `correction-existing-transcription`, creation time, `baseline`, numbered
  stable finding IDs/page/comments, rendering constraint and relationship.
- `PROMPT.txt`: complete correction instructions, including Step 3 override,
  checking observations against the print, ambiguity/source-error handling,
  score-recognition prohibition, restricted-runner requirements, and no publication
  or verification authority. Finding IDs and observations are read as task data.
- `response-template.json`: the matching task ID and baseline already filled.
  The agent replaces placeholder explanations and declarations.
- `RESPONSE_FORMAT.txt`: exact return contract.

`baseline` has exactly `snapshotId`, `sourceSha256`, `codeSha256`,
`renderSha256`, `annotationSha256`. Annotation hash covers exact exported JSON
bytes including its final newline. Manifest payload hashes cover task/prompt/
template/format too, and manifest `taskId` links the task. An existing task
inspected after edits is explicitly historical; editing invalidates current
task download links/prompt. It never mutates the retained baseline.

## Agent response v1

ZIP root `response.json` (no package manifest required):

```json
{
  "schema": "score-desk-response",
  "version": 1,
  "taskId": "UUID copied from task.json",
  "baseline": {
    "snapshotId": "exact task baseline",
    "sourceSha256": "exact task baseline",
    "codeSha256": "exact task baseline",
    "renderSha256": "exact task baseline",
    "annotationSha256": "exact task baseline"
  },
  "code": {"status": "changed", "path": "proposed.ly"},
  "rendering": {"status": "pending", "path": null, "producer": null, "compiler": null},
  "files": {"proposed.ly": {"size": 1234, "sha256": "digest of returned bytes"}},
  "results": [
    {"id": "exact issued finding ID", "status": "changed", "explanation": "Source-checked explanation", "codeLocation": "optional line/voice reference"}
  ]
}
```

The example is illustrative; use the task's generated template. The agent,
not the contributor, writes the response and computes returned file hashes.
`code.status` is `changed` (one valid UTF-8 `.ly`, different bytes) or
`unchanged` (`path: null`, baseline code retained). No code change permits
zero returned files. `rendering.status` is `pending` (`path: null`) or
`supplied` (returned `.pdf` and nonempty `producer` required;
`compiler` optional). A supplied PDF is parsed before preview. The integrated
task permits compilation only through the installed isolated runner and requires
an exact compiler/version declaration. If isolation is unavailable or unsuccessful,
the agent returns pending and explains the limitation. Host compilation is not
a fallback. The
browser never compiles code; a producer declaration does not prove compilation.

`files` lists all and only returned code/PDF files, excluding response.json.
Exactly one result per issued finding, no missing/unknown/duplicate IDs:

| Result | Retained proposal state |
| --- | --- |
| changed | corrected_pending_review |
| unchanged_with_reason | open |
| needs_clarification | needs_source_clarification |

All explanations must be nonempty (≤8,000 characters); optional codeLocation
≤1,000. `changed` requires changed code. `resolved` is never an agent result.
Wrong task/baseline, tampered files, contradictory paths/statuses or results
reject the whole response. Response metadata is untrusted producer text, not
evidence that corrections or compilation occurred. No automatic correction,
alignment, recognition, publication or verification is implemented.

## Returned-review workspace v1

Accepted responses have **Review this returned revision** and **Attach updated
rendering** actions, also when reopened from history. A supplied rendering opens
with the exact proposed code and retained original source. Explicitly unchanged
code uses the baseline rendering. Changed code with no PDF opens an **Updated
rendering pending** panel with historical context and the previous PDF available;
approval and a visual follow-up for that proposal require attaching a PDF first.

Workspace identity is `returned:<response revision ID>:<attachment ID or received>`.
It is separate from `review.snapshotId`, which remains the ordinary SHA-256 of
the three content roles. Two responses can use identical bytes and still have
separate review histories. Reopening the same response/attachment resumes its
saved workspace, annotations and decisions; it does not create another revision.

Heads are ordinary `score-desk-local-v1` v2 records with a separate key and a
`returned` object, schema `score-desk-returned-workspace`, version 1:

- `id`, `responseId`, `taskId`, `parentRevisionId`, optional `attachmentId`.
- `contentSnapshotId`, `codeSha256`, `renderSha256` and supplier `provenance`.
- `reported`: stable IDs/numbers, original comments/anchors, historical image
  paths, AI results, reviewer explanation, state, optional `associationId`, and
  optional explicit human `decision`.

`review.findings` contains only newly drawn CURRENT-geometry marks. An optional
association links a reported finding to one of those new mark IDs. Historical
page numbers/images/anchors remain historical; they are never used as new PDF
coordinates. Inspecting a finding does not require a current association.

A decision is `{state, explanation, at, reviewed:{snapshotId,codeSha256,
renderSha256}}`. Looks correct records `resolved`; Still needs correction records
`open`; Needs clarification records `needs_source_clarification`. The last two
require an explanation. Every new returned rendition starts fresh decisions;
old approval is never carried onto different code/render bytes. Legacy human
decisions may resume only on their same exact received rendition.

Every returned head save atomically appends an immutable `kind: returned-event`
record in the same IndexedDB read/write transaction as the CAS-protected head.
Each event has `workspaceId`, `parentHistoryId`, `storageRevision`, full review
and returned state. The head's `historyId` identifies its committed event.
Events are excluded from the ordinary saved-snapshot selector; **Inspect decision
history** shows their states and parent chain. Failed/stale writes cannot append
a successful history event. Stale tabs get an explicit error and may reload the
saved review; local unsaved marks still use existing recovery/switch guards.
Separate historical/recovery branches are identified, not presented as merged.

## Rendering attachment v1

The append-only handoff store retains `kind: render-attachment`, version 1,
with `id`, `responseId`, `taskId`, `parentRevisionId`, exact `codeSha256`,
`rendered:{name,blob,size,sha256}`, and `provenance` including local supplier,
declaration time, `relationship: supplier-declared; not established by
compilation`, unknown `compiler` (null), and
`compilationPerformedByScoreDesk:false`.

Selection captures the target response/code before loading. PDF.js validates the
existing PDF before retention. A delayed job never retargets a newly selected
response; it remains attached to the captured revision, and only opens if that
selection/workspace is still current. Invalid PDF/storage failures keep the
previous state. The original code-only response stays pending in history; the
new attachment is a separate rendition. No code is compiled or executed.

## Follow-up AI task v2 (response v1 remains compatible)

Ordinary first-round tasks remain `score-desk-task` v1. Follow-ups use task v2
with the same baseline hash fields, ZIP manifest v1, ordinary annotation v2,
ready-to-use prompt, response template and the same bounded local-compilation
instructions as a first-round task.
`parent` identifies the workspace, response, task and content snapshot.

`task.findings` is the authoritative outstanding request list and contains:

- Stable `id`, number and original comment; `page` is CURRENT page or null if
  not located on this render.
- `origin` identifies the originating task/finding, historical page/render hash.
- `reviewer` includes state, explanation and explicit decision when present.
- `priorResponse` links the previous task/response/result.
- Optional `currentAnchor` references the current annotation ID/page/bounds
  and its exact `comment`. The annotation comment remains the region-specific
  wording; `reviewer.explanation` is separate and never replaces it.
- `instructionHistory` preserves earlier human wording, with entries containing
  `taskId`, `codeSha256`, `renderSha256`, `explanation`, and `regionComment`.
  These are historical instructions, not approvals of the current revision.
  Response opening appends the issued task's reviewer/region wording to this
  history and starts a fresh explanation/decision. Each later task carries the
  history forward, including when no new region has been marked.
- `historicalContext` identifies old page/render hash and marked/clean PNG paths.

Resolved reported findings and resolved new findings are not outstanding tasks.
All unresolved reported findings are included, even without a current anchor.
`annotations.json` and `rendered-marked.pdf` contain current geometry only;
unlocated historical findings do not appear as fabricated current strokes.
`historical/*` contains labeled old marked/clean context, the previous rendering,
and prior response JSON. `review.txt` and PROMPT.txt list every outstanding ID,
reviewer explanation, region comment, earlier human instructions and explicit
current/unlocated/historical distinctions. These additive v2 fields are optional
for older tasks. Existing saved workspaces missing instruction history recover
it from their retained issued task on reopening. Text already lost from that
task's exported payload cannot be inferred or reconstructed.
The complete current rendering is included unchanged. The source and every
version's pagination remain independent.

Response schema v1 is unchanged: exact task/baseline, every issued ID once,
returned file hashes and explicit code/render declarations. Response retention
and subsequent workspaces use the v2 task request list, including unlocated
findings, rather than assuming every request has current PDF geometry.

## Returned workspace recovery extension v1

Ordinary package/recovery contracts stay unchanged. Exports of returned
workspaces add a manifest `extensions` entry:
`{schema:score-desk-returned-workspace-backup,version:1,
path:returned-workspace.json}` (JSON strings in the actual manifest).
Its sidecar contains the returned state, issued task and response metadata,
with exact issued payloads in `history/task/` and response payloads in
`history/response/`. All are covered by manifest payload hashes; ordinary
`review.txt` also includes every original comment, AI explanation and decision.

The current app validates identities, payloads, task/response contracts and
decisions before opening recovery. It restores an explicitly named
`returned:recovery:<UUID>` branch with `recoveredFrom`, preserving any newer head.
The contributor selects the ZIP; no JSON repair/reconstruction is needed.
Older readers can read current ordinary annotations, but need this extension to
resume returned-review decisions. No older annotation/task/response contract
has been repurposed or silently assigned historical geometry.

New returned backups place a canonical task delivery under `history/task/`.
An optional `originalTaskData: "history/original-task-data.json"` in the returned
sidecar preserves differences from the exact original imported task. This data
file uses schema `score-desk-inert-original-task`, version 1, with `entries`
(`path`, `size`, `sha256`, `base64`) and a `remove` path list. It is bounded to
25 MiB and decoded only into an in-memory ZIP map, which passes the ordinary
package/baseline checks again. Original scripts/configuration therefore retain
exact recovery bytes without becoming extracted active files. Older readers can
use the canonical task and unchanged response baseline; current readers recover
the byte-identical original for collision-safe local retention. Re-export always
regenerates safe instructions again.

## Completed-review handoff extension v1

**Finish review** reuses the full review package, with optional returned
workspace extension, and adds a manifest extension:
`{schema:"score-desk-completions",version:1,path:"completion-history.json"}`.
This is a completed-review handoff, not an AI task. No finding is filtered out.
New finish packages set manifest `kind:"completed-review-handoff"` and
`completionId` referencing the current record; the validator checks that link.
Older packages remain supported; known extensions may coexist, each once.
Unknown versions, duplicate extensions/record IDs, conflicting immutable IDs,
invalid metadata or mismatching hashes are rejected before replacing work.

The sidecar has schema/version, `revisionId`, `stateSha256`, and `records`.
Each immutable `score-desk-completion` v1 record includes:

- Stable ID, timestamp, explicit `scope` (`corrections`, `entire`, `partial`),
  optional `scopeNote`, and supplied `reviewer` or null. Identity is unauthenticated.
- `revision`: opaque review-state ID, originating workspace/input snapshot,
  captured persisted revision, and available task/response/parent/attachment IDs.
- `hashes`: exact source, LilyPond, rendering and annotation SHA-256, plus state
  SHA-256. Annotation hash is of the actual UTF-8 exported JSON bytes.
- `findings`: all reported findings and unassociated current annotations,
  retaining states, decisions, explanations, region comments and earlier
  instructions. Associated geometry is `region` with its own number/ID/state;
  a reported item with no current geometry has null region. Totals count that
  reported item once, including when resolved or unlocated. Missing human
  decisions are counted explicitly, independently of state.
- `history`: references to recorded returned-review events up to the captured
  persisted revision, plus task/response lineage. Current human decisions and
  earlier instructions remain inline in findings. No visit/time/activity log
  is inferred or collected.
- Existing supplier provenance, unknown compiler, no-compilation and
  no-verification limits. `evidence` preserves the exact annotation object and
  returned metadata needed to inspect historical records and validate hashes.

The opaque state ID rotates on every annotation, preference, explanation or
decision edit, including Undo/Redo. It remains stable across saving and viewing.
A completion alone does not edit the review or its decisions. Imported completion
packages restore the exported state ID only after validating the content hashes.
Canonical state hashing sorts object keys and excludes clock-only annotation
dates and recovery branch IDs; exact annotation byte hashes remain separately
verified. Reopening retains the original annotation date and property ordering
only after comparing that representation against the validated, whitelisted
model. Recovery branches
retain their own workspace identity and the completion's originating identity.
A matching imported declaration still makes no approval/verification claim.

`completion-summary.txt` is ordinary UTF-8 text identifying scope, revision,
all file hashes, unresolved/missing decisions, every comment/explanation,
earlier instructions, current region number/ID and completion-history labels.
The marked PDF, context images, original inputs and existing `review.txt` remain.
For returned reviews, historical task contexts remain under `history/task/`,
with the issued task and response retained through the recovery extension.

### Persistence and ordering

1. Lock editing/switching, flush current work, capture one consistent state.
2. Verify selected input bytes; generate the entire full package/sidecars/summary
   and ZIP. Cancellation or generation failure records no completion.
3. Atomically check the saved head revision and append the immutable completion
   to that head in the existing IndexedDB transaction. Returned history events
   and the head still commit together. Stale writers cannot finalize older work.
4. Only after successful persistence publish ZIP/individual links synchronously.
   Wording is **Package ready**, never a claim of a completed disk download.

Preparation is cancellable (including Escape); editing stays blocked until it
stops. The short atomic persistence phase cannot be cancelled. Retries of one
operation reuse its stable ID/body. If acknowledgement is lost after the actual
commit, the storage transaction recognizes that exact already-committed record
without adding another event. A deliberate later finish gets a new ID.
All writes merge immutable completion history; imports cannot replace earlier
records with another body under the same ID. Failures publish no partial links
and preserve edits and retry fields. Existing recovery/unload guards remain.
An immutable completion-ID registry in the same IndexedDB store/transaction
also prevents a conflicting body from entering a different recovery branch.
Registry entries are excluded from snapshot choices. Completion-package imports
pass those checks before the visible workspace is replaced.

Completion history is capped at 500 records and a 25 MB JSON sidecar. Existing
ZIP/file/count/memory limits apply; oversize new handoffs fail before completion
persistence. No completion, including entire-work scope, resolves findings,
authenticates identity, sets `verified_by`, or establishes compilation or score
verification. Older readers can access ordinary inputs/annotations but require
this extension to retain completion declarations.

Completed-review packages include manifest-hashed `SUBMIT_TO_GITHUB.txt` as an ordinary declared payload. It identifies the exact completion/candidate and available task-baseline chain, with unknown repository paths/commits explicit. The browser only prepares local files. The receiving Git-capable agent resolves and validates the target before opening a correction PR at https://github.com/the-opus-project/the-opus-project.github.io. Old packages need no new extension. Historical completion records, region fields and totals retain their existing semantics; text-only annotations have page context without marked geometry.
