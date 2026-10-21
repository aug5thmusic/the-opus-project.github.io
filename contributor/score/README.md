# OPUS proofreading and package workspace

This is the integrated, browser-only version of the reviewed Score Desk. Open
`contributor/score/` through the project's local preview or deployed static site.
No account, notation installation, or backend is needed for these features.

Open one package, or select the printed PDF, rendered PDF and LilyPond file once.
Paint errors and add comments. **Export AI task** supplies the exact files,
marked context, stable finding IDs, and a ready-to-copy prompt. **Import AI
response** retains a proposal; **Review this returned revision** opens it for
human comparison. **Finish and export** records an explicit review scope and
packages the findings, revision hashes and available history automatically.

Files are processed in this browser. The app does not execute LilyPond, imported
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

The package contracts and limits are documented in [HANDOFF_FORMATS.md](HANDOFF_FORMATS.md).
PDF.js, pdf-lib and JSZip are vendored with their licenses so the app does not
fetch dependencies at runtime. Guidance snapshots are refreshed by the site
build from the repository's current `AGENTS.md` and `HANDBOOK.md`.

## Repeated proofreading

The source and rendered scores are side by side by default, including in a
724 × 420 panel. Each has independent page, zoom and scroll controls. On narrow
screens, **Both**, **Source** and **Rendered** let you enlarge either score.
The comment editor appears automatically in a compact dock below both scores
after painting; additional strokes can still join the group without closing it.
**Findings** opens a drawer for older comments and returned-review decisions.
On desktop the editor and findings list stay beside both scores. **Workspace &
files** holds file setup, saved reviews, packages, mark visibility
and histories. **Cycle colors** stays beside the color picker in the review toolbar. **Open package** and **Finish and export** stay at the top.

Choose **Draw** and paint to create a finding, or choose **New finding** first.
Preparing alone saves nothing and consumes no number or color. Completed strokes
and typing autosave; further strokes join the same finding. **Done** ends editing.
**Done & next** saves the current group and prepares drawing another, without
creating an empty finding. Neither action changes a review decision or coverage.
A comment without a stroke is retained and must be marked before Done completes.
A failed or conflicted save keeps editing open and offers the existing recovery
ZIP. Undo reverses an automatic finding and its first stroke together.

**Editing finding #N** identifies the stroke destination. **Only showing finding
#N** is a separate visibility filter beside the rendered score. **Show all ×**
clears that filter without changing the editor. In Pan mode, click a visible
stroke or number to edit its comment; dragging pans without selecting. For
overlapping marks the last painted finding wins; the findings list lets you
select any underlying finding.

The **?** button documents shortcuts: **N** prepares a finding, **D** draws,
**V** pans, and **Ctrl+Enter** in the comment invokes Done & next. Letter
shortcuts ignore text fields, selects, contenteditable, composition and modifiers.
Text fields keep native undo. Review mutations are blocked during busy operations,
dialogs and previous-render comparison. Escape precedence is: native dialog
behavior; composition/busy protection; cancel an unfinished gesture; otherwise
leave drawing, editing and isolation. Saved marks, comments and decisions remain.

## Regression checks

Run `node contributor/score/qa/check-integration.cjs` for static integration and
module syntax checks. This does not compile a score or require installation.

Browser suites must run sequentially on a separate, disposable loopback origin,
never the contributor's normal origin. Ports 8939, 8945 and non-loopback hosts are
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
