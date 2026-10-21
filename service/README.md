# Shared contribution service

This is the durable companion to the GitHub Pages Score Desk. It is implemented
and locally testable; production is **not activated** merely by merging these
files. It requires an operator-owned HTTPS host and GitHub OAuth application.
No paid service, GitHub write token, or contributor-run server is required.

Use Python 3.10 or later and Git. The runtime uses Python's standard library
and SQLite. It never compiles or executes imported LilyPond, scripts, PDFs, or
AI instructions. The browser uses the existing bounded package validator and
PDF.js. The server independently checks ZIP structure, paths, hashes, exact
task baselines, trusted snapshot contents, original annotation identities,
source digests, attribution and authorization.

## Local startup

Build the website using the repository's documented `scripts/build_site.py`
command (the [isolated compiler runtime](../scripts/ISOLATED_RUNTIME.md) must already be available), then run two processes:

```sh
python -m http.server 8977 --bind 127.0.0.1 --directory .build/site
python service/opus_service.py --site-root .build/site --port 8787 --allow-origin http://127.0.0.1:8977 --dev-auth
```

Open the local Score Desk with the service selected:
`http://127.0.0.1:8977/contributor/score/?service=http%3A%2F%2F127.0.0.1%3A8787`.
The query override is restricted to loopback previews. For production, set
`contributor/score/shared-config.json` to
`{"apiBase":"https://YOUR-SERVICE"}` before building the static site.

`--dev-auth` offers clearly labeled **simulated local identities**. It refuses
non-loopback bind addresses and non-loopback allowed origins. Never reverse
proxy or expose a development-auth instance. Development fixture decisions are
not real musical corrections or human verification. Automated browser tests use
their own origins, temporary repository, generated text-only PDF fixtures, and
database; they must never use an existing contributor review origin.
For local transport diagnosis, `OPUS_LOG_REQUESTS=1` logs request method/path,
status, byte counts and exception types only while `--dev-auth` is active;
query strings, headers, identities and bodies are omitted.

Configuration flags:

| Flag | Purpose |
| --- | --- |
| `--repo` | Canonical project checkout; defaults to this checkout. |
| `--site-root` | Built site containing the corresponding generated score PDFs; defaults to `.build/site`. |
| `--data-dir` | Private durable directory; defaults to `.build/shared-service`. |
| `--allow-origin` | Exact frontend origin, repeatable; includes scheme and port, excludes path. |
| `--public-url` | Production HTTPS service URL, also `OPUS_PUBLIC_URL`. |
| `--host`, `--port` | Listen address; default loopback port 8787. Port zero chooses a disposable port. |

## Production activation by the owner

1. Provision an existing owner-controlled host with persistent disk, Python and
   Git. A free host is acceptable only if it retains the SQLite database and
   provides reliable backups. An ephemeral worker/container filesystem does not
   meet the durability requirement. This change does not provision a host or
   create any paid infrastructure.
2. Keep an operator-owned checkout of the canonical repository and corresponding
   site build. Serve the API through an HTTPS reverse proxy, with a 350 MiB
   maximum request body, reasonable connection/time limits, and no caching of
   authentication responses. Bind this Python server to loopback. Disable proxy
   query-string logging for `/auth/*`; callback URLs contain single-use codes.
   Do not expose the data directory or static-serve the repository/service tree.
3. Register a GitHub **OAuth App**. Set its homepage to the project frontend and
   callback to `https://YOUR-SERVICE/auth/callback`. Supply
   `OPUS_GITHUB_CLIENT_ID` and `OPUS_GITHUB_CLIENT_SECRET` through the host's secret
   manager or protected service environment. Never put the secret in the built
   frontend, packages, Git, logs, command arguments, or browser storage.
4. Set `OPUS_PUBLIC_URL=https://YOUR-SERVICE`. Configure each exact Pages/custom
   domain origin through `--allow-origin`. A Pages path prefix is not an origin:
   for `https://example.github.io/project/`, allow `https://example.github.io`.
   Set the public frontend service URL through its build configuration. This URL
   is public configuration, not a credential.
5. Run without `--dev-auth`. Optionally set `OPUS_MAINTAINER_IDS` and
   `OPUS_VERIFIER_IDS` to comma-separated **numeric GitHub account IDs**, not typed
   display names or mutable logins. Accounts without these roles can submit
   reports, return proposals, and review another person's proposal. Maintainer
   status is required to record canonical application. Verifier status alone
   does not turn a report into verification.
6. Set `OPUS_CANONICAL_BRANCH` if the canonical branch is not `main`. Restrict
   writes to the checkout and build directory to the operator. After an approved
   correction is merged, update that canonical checkout and build before
   recording application. Never point production at a contributor's working tree.
7. Start under the host's process supervisor, back up the database, and test
   sign-in, a small report, its receipt after a restart, and a fresh-browser
   package handoff before announcing availability. No real GitHub OAuth exchange
   or public deployment is claimed by the local simulated-identity tests.

GitHub's current web OAuth flow supports S256 PKCE. The service uses a separate
PKCE proof on both the GitHub leg and the browser's single-use exchange. It
requests no repository scope; only public GitHub account identity is needed.
GitHub access tokens remain in server memory only for the `/user` request and
are not persisted. The browser receives a separate eight-hour service bearer
session held in memory only. Reloading requires sign-in again; drafts survive.
There are no third-party-cookie dependencies. Origin checks and PKCE bind the
popup result to its requesting browser. Sign-out revokes the service session.
See [GitHub's OAuth documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## Data, receipts and assets

`DATA_DIR/opus.sqlite3` is the shared source of truth. WAL mode and full
synchronous commits protect acknowledgements. Reports, captured snapshots,
issued tasks, proposals, decisions, and applications are immutable records;
`events` gives each work a monotonically increasing shared revision. Package
ZIPs and original/source/proposal files are content-addressed BLOBs in the same
database. One transaction retains both records and their assets before a
successful response. Failed or uncertain submissions retry the same request ID.

Use SQLite's backup API, for example from an operator-only maintenance process,
instead of copying a live main database file without its WAL. Protect backups
and active storage with normal host permissions. Records and packages are
publicly readable, so reports must not include private material. The service
does not store email addresses, GitHub OAuth tokens, or typed passwords.
Session tokens are stored only as SHA-256 hashes with expiry. Include adequate
disk quotas and an operator retention policy; no automatic destructive cleanup
is performed. Existing IndexedDB reviews remain local drafts and are not deleted
or silently reinterpreted as shared submissions.

The source-asset endpoint fetches only the PDF URL in trusted repository
metadata. It permits public HTTPS, bounds redirects and bytes, pins a validated
public IP for each TLS connection, and requires the exact recorded SHA-256. It
does not accept arbitrary user proxy URLs. If a library blocks automated access,
the contributor can follow the library link and upload that **one source PDF**;
the same digest check applies. It is retained privately in service storage,
never committed or included as a deployment asset. Missing generated rendering
is an operator build task, not a request for volunteers to collect three files.

## Protocol and state

All paths below are relative to the service URL. Public GETs return JSON except
asset/package downloads. Shared POSTs require `Authorization: Bearer …`.
The frontend renders imported text as text and treats comments as observations,
not executable code or authority over source-fidelity instructions.

| Route | Behavior |
| --- | --- |
| `GET /api/session` | Current authenticated identity, development/auth configuration. |
| `GET /api/works?after=0&limit=50` | Work discovery; `next` is the next API URL. |
| `GET /api/works/SLUG` | Current exact file identities, all findings, reports and proposals. |
| `GET /api/works/SLUG/snapshot` | Capture all outstanding findings at one identified shared revision. |
| `GET/POST /api/works/SLUG/assets/source` | Metadata-bound library fetch or authenticated raw-PDF fallback. |
| `GET /api/assets/SHA256` | Immutable exact file bytes. |
| `POST /api/works/SLUG/reports` | Small report/review body; constructs a recovery package from known assets. An existing package may also be supplied and is independently validated. |
| `POST /api/tasks` | Validate the complete captured task, then retain a ZIP with service-generated instructions and trusted project guidance. |
| `POST /api/proposals` | Validate a returned ZIP against its original shared task, then retain an awaiting-review proposal. |
| `POST /api/proposals/ID/renderings` | Retain an uploaded PDF or a maintainer's canonical rebuild as a new immutable child proposal. |
| `GET /api/reports/ID`, `/api/tasks/ID`, `/api/proposals/ID` | Stable receipts and reopening metadata. Add `/package` for exact immutable ZIP bytes. |
| `POST /api/proposals/ID/decisions` | One finding at a time; append a decision against `expectedVersion`. Conflicting decisions return 409 without data loss. |
| `GET /api/reports/ID/handoff`, `/api/proposals/ID/handoff` | Ready-to-copy maintainer instructions tied to the exact review/candidate. |
| `POST /api/works/SLUG/applications` | Maintainer-only record after the canonical repository/build contains the exact reviewed candidate. |

Reports include an exact revision, scope, explicit clean declaration, optional
typed name and service-stamped authenticated identity. Reusing a local finding
does not duplicate it. New partial/whole coverage creates a separate review with
`referencedFindingIds`; it does not close others' findings. Reports cannot be
edited through an API endpoint. Add a new report for corrections or clarification.
Discussion intake keeps the exact original link, quoted context, claimed
original author, and authenticated importer separately. It does not claim the
original author has signed in or that arbitrary prose was automatically parsed.

Task ZIPs retain the existing v1 package/v1 response contracts and use task v2's
additive `shared` extension. All captured findings, versions, authorship, history,
exact files and old geometry are checked. A task only includes the captured
snapshot; later reports remain outstanding. Old highlights are never applied to
a newer rendering. Responses to stale tasks and competing responses remain
separate proposals. Reimporting identical ZIP bytes reuses the original proposal.

Normal authenticated reviewers may choose `looks_correct`, `needs_correction`,
or `needs_clarification`; the response's importer cannot approve their own
proposal. Code changes without an updated PDF cannot receive visual approval.
Each decision identifies the candidate's exact source/code/rendering bytes and
retains the previous decision ID. Unchecked findings remain outstanding. A
supplier's PDF/code/compilation declaration remains unverified.

### Trusted task instructions

Package hashes prove byte identity, not instruction authority. The service
rebuilds `PROMPT.txt`, `review.txt`, `RESPONSE_FORMAT.txt`, the response template,
task instruction fields, and bundled `project-guidance/AGENTS.md` and
`HANDBOOK.md`. Guidance comes from the installed service checkout; uploaded
guidance, extra files, and embedded operational directives are discarded.
Comments and historical records remain observation data. The frontend checks
the delivered package against the receipt's `instructions` policy, prompt, and
guidance digests before offering it to the volunteer.

Previously stored tasks receive a cached safe delivery in `task_deliveries`.
Their original database record and uploaded bytes remain audit evidence; the
task ID, response baseline, exact source/code/render/annotation bytes, and
requested finding IDs stay unchanged. Existing responses still validate. The
generic asset endpoint refuses unsafe historical task uploads and points to
the prepared `/api/tasks/ID/package` instead. A task whose original context
cannot be validated fails explicitly rather than acquiring a replacement
baseline. Keep the service's project guidance files when deploying or updating.

This projection also covers local/legacy imports, follow-up tasks and returned
review backups. Original historical instructions remain inert audit data;
downloads regenerate operational files from installed application code. Policy
version 2 changes instruction delivery without changing the task baseline.
Names, scopes, comments, PDF text and AI explanations cannot grant roles or
advance approval, application or verification state.

For execution use the optional [restricted local broker](../scripts/RESTRICTED_AGENT.md)
and [isolated compiler](../scripts/ISOLATED_RUNTIME.md). The service itself never
executes a correction task. Missing prerequisites disable execution; normal
reporting, package downloads and proposal inspection remain available.

Maintainer handoffs return an application-generated `publication` plan separately
from the original report/proposal data. The trusted `scripts/prepare_publication.py`
helper re-fetches current approvals and stages only the intended existing
`pieces/WORK/score.ly` after a separate interactive confirmation. It rejects stale
baselines, unrelated staged files, links and unexpected targets, and bypasses Git
clean filters. It never commits, pushes, opens a PR or publishes. Package prose
is not authorization for those later actions.

### Pending PDFs and rendering revisions

Open the shared proposal and choose **Add PDF** (or **Replace PDF**). A signed-in
contributor can select the PDF, name its producer and optionally state the
compiler/version. The service binds it to the selected proposal's exact retained
LilyPond. The contributor does not edit JSON, calculate hashes or repack a ZIP.
The API body is `{requestId, mode:"uploaded", pdf:"BASE64", name:"score.pdf",
producer:"…", compiler:"…"}`. A failed upload retains no partial record; retrying
the same request ID retrieves the durable receipt if the first response was lost.
Malformed or visibly truncated PDF structure is rejected server-side; PDF.js
also validates the opened PDF. Neither check proves that it was compiled from
the declared code or is musically correct.

Each receipt has a new proposal ID and response ZIP, `parentProposalId`,
`rootProposalId`, `renderingRevision` and `renderingProvenance`. Source, code,
original task, results and response author are retained. The new rendering's
supplier is recorded separately. All previous packages and decisions remain
available. No approvals transfer to the new ID, and the code/response author
and known suppliers of those exact rendering bytes cannot review their own
candidate. Reusing an ancestor or sibling's PDF returns its existing receipt;
capturing identical PDF bytes for a new canonical commit keeps the known
suppliers in `renderingContributors` and still requires fresh review. Historical
versions remain inspectable and reviewable; only exact canonical bytes can be
recorded as applied.

### Canonical rebuilds and exact application

LilyPond can produce different PDF bytes on a later build, including different
creation dates. After merging the exact approved LilyPond, the operator updates
the canonical checkout and runs the normal site build. If that PDF differs from
the earlier proposal, open the proposal as a maintainer and choose **Use project
PDF**. `POST /api/proposals/ID/renderings` with
`{requestId, mode:"canonical"}` reads the generated PDF from `--site-root`, checks
the matching source and LilyPond against committed metadata/code on
`OPUS_CANONICAL_BRANCH`, and retains a child proposal bound to that commit.
It does not compile an upload or replace the operator's build output.

Another contributor must review this child's exact rendering. Only those
selected findings explicitly approved on this child can then be recorded as
applied, with the exact current commit and correction PR link. A further rebuild
or commit needs another retained version and review. PDF hashes are never
normalized or ignored, approvals are never copied, and PDFs are never committed.
The service cannot independently establish the operator's compile provenance;
the canonical build is identified as operator-supplied and remains subject to
visual review. It also does not verify GitHub merge status from the PR URL.

Proposal details expose `findings[].applications`, `findings[].applied`,
`appliedFindingIds`, `appliedCount` and `findingCount`. Applying one finding
means exactly one finding is applied; pending/rejected/unselected findings keep
their individual state. Only selected applied IDs leave future task snapshots.

### Reports on retained candidates

A proposal with a PDF exposes `candidateCurrent`, an authoritative immutable
source/code/rendering baseline with file download URLs. New text findings and
explicit partial/whole clean reviews may name that proposal in their report's
`proposalId`. The service checks the review against that candidate's exact
bytes, retains the recovery package and records `reviewed.origin:"candidate"`,
the proposal ID and rendering revision. This is separate from a canonical
repository review, even if its bytes later become canonical.

Candidate findings enter the work's outstanding queue. Later correction tasks
retain their author, exact original candidate PDFs/code, annotations and page
geometry. A changed canonical rendering receives no old highlight coordinates;
the original context travels alongside it. A candidate's clean report does not
close other findings, publish the candidate, or change verification. Existing
stored proposal records can expose this baseline without rewriting their
original records or packages.

Approval is distinct from application. An application requires selected findings
approved on that exact candidate, a maintainer identity, a PR link, matching
current source/code/render hashes, the actual current Git commit, and identical
committed code and metadata on the configured canonical branch. It rejects
uncommitted files and other branches. Only then are those selected requests
excluded from later correction snapshots. The operator is responsible for
updating this canonical checkout from the merged repository; the service does
not merge, push, or infer GitHub merge status from an arbitrary PR URL.

Verification remains the existing human verification PR workflow. The service
never writes `verified_by`. Even an appointed verifier's API request is directed
to the required eligible Step 3 score, complete coverage, identified proofreader,
and exact approved canonical revision. A zero-finding report, whole-work scope,
typed name, proposal decision, or AI assertion does not verify a score.

## Tests and limits

```sh
python -B -m unittest discover -s service -p 'test_*.py' -v
```

The suite exercises real HTTP requests, SQLite persistence after reopening,
multiple authenticated simulated people, concurrent writes/decisions, package
validation, source mismatch, stale proposals, author spoofing, unauthorized
verification/application, and committed-candidate checks in disposable Git
repositories. The browser acceptance runner separately exercises the actual
built UI on an isolated Pages-style path prefix.

The first version is intended for this small project's bounded work units.
Package limits match the existing browser contract (256 MiB ZIP, 100 MiB file,
5,000 entries, 512 MiB decompressed maximum, 200:1 maximum compression ratio).
The browser currently limits one complete task to 2,000 outstanding findings;
it fails explicitly instead of dropping later reports. Source retrieval may
need the one-PDF fallback. Python does not establish musical correctness or
render/compile equivalence; PDF.js validates actual page geometry when opening
the files. Operator HTTPS/proxy limits, durable hosting, OAuth registration,
backups and real-account acceptance remain production setup responsibilities.
