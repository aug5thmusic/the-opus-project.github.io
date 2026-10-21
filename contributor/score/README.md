# OPUS proofreading and package workspace

Open `contributor/score/` through the project's preview or static site. Reading,
local drafting, brush editing and recovery work without an account. Shared
submissions require the owner-configured [project service](../../service/README.md)
and GitHub sign-in. The checked-in service configuration is inactive; the UI
does not claim local saves were submitted.

Choose **Project contributions** for three ways to help:

- **Proofread**: compare the score with the printed source and mark or describe
  errors, then **Submit findings**. You can also record which pages you checked,
  including when you found no errors.
- **Send corrections to AI**: **Get correction package**, attach the ZIP to
  your AI, paste its instructions, then **Return AI response**.
- **Check AI corrections**: compare the AI’s changes with the original and
  record a decision for each finding you checked.

The service supplies the exact files and includes everyone's outstanding
findings in a correction task. If the source library cannot be reached, select
its one original PDF; its digest must match the recorded edition. Shared receipt
links reopen reports and proposals on another device. A typed display name is
optional and is distinguished from the authenticated author.

Open one package, or select the source PDF, rendered PDF and LilyPond file once.
Type notes or mark passages. **Send for corrections** supplies the exact files,
marked context, stable finding IDs, and a ready-to-copy prompt. **Import AI
response** retains a proposal; **Review this returned revision** opens it for
human comparison. **Finish review** records an explicit review scope and
packages the findings, revision hashes and available history automatically.

Local files are processed in this browser until an explicit shared submission.
Shared reports and packages retain their exact context in the project service.
The app does not execute LilyPond, imported
scripts, or an AI model. A separately instructed correcting agent may use an
already-installed LilyPond to return an updated PDF; its declared compiler and
file pairing remain unverified until reviewed. Existing encodings are never a
source of musical notes.

Reviews are retained in IndexedDB database `score-desk-local-v1` version 3;
issued tasks and proposals use `score-desk-handoffs-v1`. Storage is specific to
the browser profile and origin, including the port. Existing prototype data is
not silently migrated between origins. Export a recovery or completed package
from the old origin, then use **Open package** here. Keep downloaded backups.
Opening a package does not claim human verification or complete review coverage.

Shared records live in durable service storage. A separate local outbox retains
failed or uncertain submissions for safe retry using the same request identity;
it contains no authentication tokens. **Saved locally**, **Submitted to the
project**, **Awaiting review**, and **Applied to the project** are distinct states.
Human approval of a proposal is not application to the current published score.
A new report submitted during a correction task is retained for a later package.

The package contracts and limits are documented in [HANDOFF_FORMATS.md](HANDOFF_FORMATS.md).
PDF.js, pdf-lib and JSZip are vendored with their licenses so the app does not
fetch dependencies at runtime. Guidance snapshots are refreshed by the site
build from the repository's current `AGENTS.md` and `HANDBOOK.md`.

## Repeated proofreading

The source and rendered scores are side by side by default, including in a
724 × 420 panel. Each has independent page, zoom and scroll controls. On narrow
screens, **Both**, **Source** and **Rendered** let you enlarge either score.
The comment editor appears automatically in a compact dock below both scores
after the first stroke, with the caret ready for typing. Additional strokes join
the same group without repeatedly moving focus. Returned-review region marking
keeps its association workflow and does not move focus to the comment.
**Findings** opens a drawer for older comments and returned-review decisions.
On desktop the editor and findings list stay beside both scores. **Workspace &
files** holds file setup, saved reviews, packages, mark visibility
and histories. **Cycle colors** stays beside the color picker in the review toolbar. **Open package**, **Send for corrections** and **Finish review** stay at the top.
Download the task ZIP and give it with the displayed prompt to your chosen agent;
the desk does not send files or connect to an agent.

Choose **New finding** to type immediately, or **Draw** to mark a passage.
Preparing alone saves nothing and consumes no number or color. Completed strokes
and typing autosave; further strokes join the same finding. **Done** ends editing.
**Done & next** saves the current group and prepares another, without
creating an empty finding. Neither action changes a review decision or coverage.
Done accepts a nonblank comment or one or more strokes. Text-only notes retain their page context without claiming a marked passage; adding marks later keeps the same finding identity. Blank preparation creates no finding.
A failed or conflicted save keeps editing open and offers the existing recovery
ZIP. Undo reverses an automatic finding and its first stroke together.

Saved/saving status appears in the header. The status slot has a fixed height: routine announcements expire without moving controls or PDFs. Errors, conflicts and recovery actions remain readable there. Isolation has a row
only while active, and mode is shown by the selected toolbar button.

**Editing finding #N** beside the comment identifies the stroke destination. **Only showing finding
#N** is a separate visibility filter beside the rendered score. **Show all ×**
clears that filter without changing the editor. In Navigate mode, click a visible
stroke or number to edit its comment; dragging pans without selecting. For
overlapping marks the last painted finding wins; the findings list lets you
select any underlying finding.

The **?** button documents shortcuts: **N** prepares a finding, **D** draws,
**V** selects Navigate, and **Ctrl+Enter** in the comment invokes Done & next.
These hints are visible on the controls. Letter
shortcuts ignore text fields, selects, contenteditable, composition and modifiers.
Text fields keep native undo. Review mutations are blocked during busy operations,
dialogs and previous-render comparison. Escape precedence is: native dialog
behavior; composition/busy protection; cancel an unfinished gesture; otherwise
leave drawing, editing and isolation. Saved marks, comments and decisions remain.

## Regression checks

Run `node contributor/score/qa/check-integration.cjs` for static integration and
module syntax checks. This does not compile a score or require installation.

Browser suites must run sequentially on a separate, disposable loopback origin,
never the contributor's normal origin. Ports 8939, 8945, 8964, 8967 and non-loopback hosts are
refused. The suites create synthetic PDF geometry in memory, with no actual
music, score recognition, downloaded scores or committed PDF/ZIP fixtures.

- `qa/index.html`: brush, color/focus, geometry, undo/redo, persistence and export.
- `qa/desk.html`: repeated completion, paint-first creation/cancellation, undo,
  selection and rotated geometry, keyboard safety, save faults and layout.
- `qa/workflow.html`: package/task/response and returned revision review.
- `qa/completion.html`: completion logging, explicit scope, persistence and export;
  run the workflow suite on the same test origin first.
- `qa/races.html`: two-tab concurrency and fault injection; use its test-tab links.
- `qa/upgrade.html`: fresh-origin historical version-2 client compatibility. It
  creates its completed-review package from synthetic inputs at runtime. Open
  the historical test tab first; do not delete a database to make a used origin
  look fresh.

QA source pages are development-only and should be excluded from the deployable
site. Generated downloads and test browser storage are disposable test evidence,
not project scores or user review records.

After **Finish review**, choose **Prepare GitHub contribution**. Download the completed ZIP and copy the instructions to a coding agent. It validates hashes, resolves the exact repository file and baseline, applies the reviewed candidate and opens a PR. A maintainer reviews/merges before publication. Unknown or ambiguous targets require resolution, never a blind overwrite; a local completion is not human verification.
