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

Checking corrections opens **Before correction** beside **AI revision**, using
the exact baseline supplied with this task and the exact returned rendering.
The problem card displays the original comment, direct **Previous** and **Next**
navigation, and three decisions. **Problems** opens a searchable list of report
text, reported page and review status, with an **Unchecked only** filter.
**Looks correct & next** advances
only after storage acknowledges the decision; failed or uncertain saves keep the
finding and draft selected. **Skip** makes no decision. This counts selected
corrections, never full-score verification, application or publication.

**Still wrong…** opens **What is still wrong?**, with Send and Cancel. Select
**The printed source is unclear** to request source clarification instead.
Explanation drafts and that choice survive Cancel, Escape, navigation, reloads
and failed submissions. **What the AI changed** opens the AI's explanation;
long original comments have an explicit **Read full report** control.
**Report another error** reveals the annotation tools on the AI revision.
Downloads, progress, files and revision history are available through **More**.

**Check printed source** restores the previous Before position when switched
back. On narrow screens, a two-way score switch replaces the side-by-side view.
Each score keeps its own page arrows, page number and zoom visible below it.
Only marks belonging to the displayed PDF appear;
the selected historical finding has an outline, and other marks are optional.
An older report opens its original PDF with a **Reported on an earlier version**
label. Legacy packages with only crops show those crops explicitly. New local
follow-ups retain original PDFs and annotations as well as their crops.

The AI revision starts at an explicitly approximate page unless a corresponding
location was saved. **View options** says to find the passage in the AI revision,
then choose **Remember this passage**. This optional action saves a PDF viewing position, without drawing or creating a
finding, and does not approve anything. Locations bind the finding to the exact
candidate code, PDF and snapshot. Shared locations use authenticated service
storage and version checks; local locations travel in returned-review backups.
**Download review package** also carries shared locations into a fresh local
workspace, without importing service approval authority. Older packages without
locations continue to work. AI location claims are not confirmed bookmarks.
The existing new-finding tools remain attached to After, and comment drafts stay
open while navigating findings or switching the left display.

If the AI response has no PDF, open it and choose **Add PDF**. Select the PDF
made from its LilyPond and enter who or what rendered it. **Replace PDF** saves
another version. Each version has its own receipt and starts a new review.
You can also submit new findings or a scoped clean report on that AI version.

After merging and rebuilding, a maintainer can choose **Use project PDF** to
retain the canonical build for proofreading. Another contributor checks that
exact version before the maintainer records application. PDF timestamps or a
different compiler can change the bytes; earlier approvals remain attached to
the rendering that was checked. **More** shows the selected finding's state;
**Files and review history** shows the number applied to the project.

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
The browser does not execute LilyPond, imported scripts, or an AI model.
Correction rendering requires the project's isolated compiler. The optional
[restricted local runner](../../scripts/RESTRICTED_AGENT.md) gives a local vision
model no tools and runs fixed rendering operations in a container. Without that
runtime, rendering stays pending. A downloaded package cannot restrict an
arbitrary external agent. Existing encodings are never a source of musical notes.

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
Text fields keep native undo. Review mutations are blocked during busy operations and dialogs. Escape precedence is: native dialog
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

`node scripts/browser-tests.mjs --suites=comparison` runs self-contained real
browser comparison regressions with synthetic geometry and fresh storage. It
does not depend on the workflow suite. The shared revision suite additionally
checks cross-browser location persistence, portable comparison packages, lost
acknowledgments and concurrent reviewers against the HTTP/SQLite service.

QA source pages are development-only and should be excluded from the deployable
site. Generated downloads and test browser storage are disposable test evidence,
not project scores or user review records.

`node scripts/browser-tests.mjs --shared` also runs real HTTP/SQLite browser
workflows and actual compilations of two exact hardcoded synthetic fixtures through
`trusted_browser_fixtures.py`. That narrowly limited host helper cannot compile
imported code and provides no isolation evidence. It requires an installed LilyPond
and browser. Production compilation uses `isolated_runner.py` exclusively.
`--shared-only` runs both shared suites; `--revisions-only` runs the PDF revision,
candidate-report and canonical application scenarios. The tests use isolated
origins, test accounts, generated fixtures and temporary repositories.

After **Finish review**, choose **Prepare GitHub contribution**. The handoff identifies the proposed contribution for inspection. It grants no Git or publication permission. Shared candidates use the trusted `scripts/prepare_publication.py` helper: it checks current service approvals, the exact repository baseline and one allowed LilyPond path, then asks for separate interactive confirmation before staging. It never commits, pushes, opens a PR or publishes. Publication requires separate human authorization of the concrete change. Legacy local completions first need a shared proposal and independent review for guarded staging.
