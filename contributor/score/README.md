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

## Regression checks

Run `node contributor/score/qa/check-integration.cjs` for static integration and
module syntax checks. This does not compile a score or require installation.

Browser suites must run sequentially on a separate, disposable loopback origin,
never the contributor's normal origin. Ports 8939 and non-loopback hosts are
refused. The suites create synthetic PDF geometry in memory, with no actual
music, score recognition, downloaded scores or committed PDF/ZIP fixtures.

- `qa/index.html`: brush, color/focus, geometry, undo/redo, persistence and export.
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
