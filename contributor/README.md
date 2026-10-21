# Contributor workspace

Score Desk offers three choices: **Proofread**, **Send corrections to AI**, and **Check AI corrections**. Proofread lets you mark or describe errors. You can also record which pages you checked, including when you found no errors. Send a correction package to your AI and return its response, or check the AI’s changes against the original score.

The brush editor, local reviews, recovery packages and completed-review exports remain available. Existing Encodings search is outside this change.

## Build and preview

Use the repository's normal build, with Python and LilyPond already available:

```sh
mkdir -p .build
python -B scripts/build_site.py .build/site
python -m http.server 8000 --bind 127.0.0.1 --directory .build/site
```

Choose a fresh output directory; the builder refuses to overwrite one. Open `http://127.0.0.1:8000/contributor/`. The production app is `contributor/score/`. Building renders existing repository scores but does not run any imported package's LilyPond or download its source scans. Generated PDFs stay in the ignored build tree.

The frontend is static and works on GitHub Pages, including directory-prefix hosting. PDF.js, workers, CMaps, fonts, decoders, pdf-lib and JSZip are local, with their original licenses. QA pages, service code, runtime state, test records, screenshots and ZIPs are excluded from the site build. Explicit shared submissions upload their exact review/package context to the project service. Local drafts and recovery exports remain local.

Shared persistence uses the small Python/SQLite service in [service/](../service/README.md). It does not require a paid vendor or any contributor setup. The owner must configure hosting, a persistent volume and GitHub OAuth before enabling the production URL in `score/shared-config.json`. The checked-in configuration is inactive. Local test authentication is confined to loopback and clearly labeled simulated; it must never be enabled on a public service. See the service guide for startup, environment settings, backup and activation instructions.

## Regression checks

```sh
python -B scripts/test_build_site.py
node contributor/tests/work-links.test.mjs
node contributor/score/qa/check-integration.cjs
node contributor/score/qa/shared-packages.test.mjs
node contributor/score/qa/shared-client.test.mjs
node contributor/score/qa/shared-ui.test.mjs
node contributor/score/qa/github-handoff.test.mjs
python -B -m unittest discover -s service -p 'test_*.py' -v
python -B scripts/test_check_pr.py
python -B scripts/check.py
```

The score QA directory also contains browser suites for geometry/colors/focus, persistence and races, package/task/response round trips, returned-revision decisions, completion records, and pre-update version-2 storage. They generate synthetic PDF fixtures in memory; no scans, generated PDFs or notation conversions are committed. See `score/README.md` for suite routes and controls. Run them only on a separate loopback origin/port from your real reviews. They intentionally exercise browser storage. They are never shipped in the production build.

For browser QA, serve the repository on a separate loopback port and visit `contributor/score/qa/`. Use the production build for a separate smoke test of deployed asset paths and `contributor/?piece=...` links. Also serve the build below a directory prefix to catch absolute-path mistakes.

The automated driver `node scripts/browser-tests.mjs` runs the existing suites sequentially on a fresh loopback port with a disposable browser context. Install Playwright in a development-only directory (for example `npm install --prefix .build/browser-tools playwright@1.62.1`, then install its Chromium browser), and set `OPUS_PLAYWRIGHT` to the absolute path of its `playwright/index.mjs`. An existing installed Edge can be selected with `OPUS_BROWSER_CHANNEL=msedge`. `--shared` adds the real shared-service acceptance scenario; `--shared-only` runs just that scenario. The driver uses simulated PDF/AI fixtures, fresh SQLite storage and different browser contexts for contributors. Evidence is written under ignored `.build/browser-tests/`; it never resets or accesses a contributor's browser profile.

## Package compatibility and review safety

The existing package contracts and IndexedDB version 3 are preserved. ZIP validation, file hashes, immutable issued baselines, stale-tab protections, original/returned rendering separation, and explicit completion scopes remain in force. The AI prompt permits local rendering with an already-installed LilyPond when actually performed; it does not claim compilation or human verification from the presence of a PDF. Imported code is never executed by the browser.

Local drafts still belong to their browser profile and origin (scheme, host and port). Export review/recovery/completion ZIPs before moving local-only work. Submitted reports, tasks and proposals instead belong to the shared project service and can be reopened by receipt. A fresh browser retrieves and validates the original shared task before importing its response; it never invents a replacement baseline. Local-only tasks still need their original retained task or an existing supported recovery package. They are not silently promoted into authenticated shared reports.

Reports are immutable, attributed observations with exact source/code/render identities. A shared snapshot captures the full outstanding list in one transaction; pagination in a discovery list cannot truncate a task. Concurrent decisions use a per-finding version and append history. Approval is candidate-specific and does not resolve published findings until a maintainer records an application against matching canonical bytes. Source questions remain distinct from instructions to change the transcription. GitHub contribution handoffs retain report/task/proposal references and exact candidate hashes; review-only handoffs do not manufacture a musical edit.

The repository contains no saved user reviews, source PDFs, PDMX catalog, or private local state. Do not commit exported packages. Exporting or declaring a review scope does not itself update repository verification metadata.
