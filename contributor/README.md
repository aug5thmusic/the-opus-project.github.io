# Contributor workspace

This integrates the reviewed Score Desk into the existing static site. It includes brush annotations, clean/review/recovery packages, AI task and response handling, returned-revision review, follow-up tasks, and Finish and export with automatic logs and an explicit review scope. Existing Encodings search is intentionally deferred.

## Build and preview

Use the repository's normal build, with Python and LilyPond already available:

```sh
mkdir -p .build
python -B scripts/build_site.py .build/site
python -m http.server 8000 --bind 127.0.0.1 --directory .build/site
```

Choose a fresh output directory; the builder refuses to overwrite one. Open `http://127.0.0.1:8000/contributor/`. The production app is `contributor/score/`. Building renders existing repository scores but does not run any imported package's LilyPond or download its source scans. Generated PDFs stay in the ignored build tree.

The app is static and works on GitHub Pages, including project-path hosting. PDF.js, workers, CMaps, fonts, decoders, pdf-lib and JSZip are local, with their original licenses. QA pages, runtime state, test PDFs, screenshots and ZIPs are excluded from the site build. Imported files are processed in the browser, not uploaded to a server. Opening the older comparison page can still contact its linked source library and GitHub Discussions.

## Regression checks

```sh
python -B scripts/test_build_site.py
node contributor/tests/work-links.test.mjs
node contributor/score/qa/check-integration.cjs
python -B scripts/test_check_pr.py
python -B scripts/check.py
```

The score QA directory also contains browser suites for geometry/colors/focus, persistence and races, package/task/response round trips, returned-revision decisions, completion records, and pre-update version-2 storage. They generate synthetic PDF fixtures in memory; no scans, generated PDFs or notation conversions are committed. See `score/README.md` for suite routes and controls. Run them only on a separate loopback origin/port from your real reviews. They intentionally exercise browser storage. They are never shipped in the production build.

For browser QA, serve the repository on a separate loopback port and visit `contributor/score/qa/`. Use the production build for a separate smoke test of deployed asset paths and `contributor/?piece=...` links. Also serve the build below a directory prefix to catch absolute-path mistakes.

## Package compatibility and review safety

The existing package contracts and IndexedDB version 3 are preserved. ZIP validation, file hashes, immutable issued baselines, stale-tab protections, original/returned rendering separation, and explicit completion scopes remain in force. The AI prompt permits local rendering with an already-installed LilyPond when actually performed; it does not claim compilation or human verification from the presence of a PDF. Imported code is never executed by the browser.

Storage belongs to the browser profile and origin (scheme, host and port). Existing localhost reviews do not appear automatically on a published site or another port. Export review/recovery/completion ZIPs before moving. AI responses require their issued task to be retained on the receiving origin: finish those rounds on the original origin, or open a review package on the new site and issue a new task. Ordinary review packages do not restore all issued-task history.

The repository contains no saved user reviews, source PDFs, PDMX catalog, or private local state. Do not commit exported packages. Exporting or declaring a review scope does not itself update repository verification metadata.
