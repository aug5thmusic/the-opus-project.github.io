# Isolated LilyPond and PDF runtime

LilyPond can execute Scheme and subprocesses. A temporary directory and a
prompt asking it to behave are not a security boundary. Imported/repository
LilyPond and imported PDFs now run only through `isolated_runner.py` and its
fixed container worker. `check.py` and `build_site.py` fail closed if this
runtime is unavailable. They never invoke an installed host compiler.

## Operator provisioning

The operator must explicitly provision a local Docker Linux engine first.
The runner does not install anything, start Docker, change WSL, pull an image,
or connect to a remote Docker daemon. Docker/WSL installation is a separate
owner decision. A Docker CLI with a missing daemon is **unavailable**, not proof
of a working sandbox.

On an existing local Linux-capable Docker installation, explicitly build this
small project-owned image (this provisioning build downloads its base and
distribution packages; score processing never has network access):

```sh
docker build --pull=false --build-arg OPUS_POLICY_SHA256="$(python3 scripts/isolated_runner.py policy)" -t opus-isolated-runtime:1 scripts/isolated-runtime
python3 scripts/isolated_runner.py status
OPUS_REQUIRE_ISOLATION=1 python3 -B scripts/test_isolated_runner.py
```

PowerShell equivalent for the build and required acceptance:

```powershell
$opusPolicy = python -B scripts/isolated_runner.py policy
docker build --pull=false --build-arg "OPUS_POLICY_SHA256=$opusPolicy" -t opus-isolated-runtime:1 scripts/isolated-runtime
$env:OPUS_REQUIRE_ISOLATION = '1'
python -B scripts/test_isolated_runner.py
```

Review the Dockerfile/worker and image provisioning source as trusted code.
The image uses Debian trixie because its packaged LilyPond 2.24.4 supports the
repository's 2.24.3 declarations; bookworm's 2.24.1 is too old. See the
[Debian trixie LilyPond package](https://packages.debian.org/trixie/lilypond).
The base distribution tag can change when an operator explicitly rebuilds;
each execution resolves the locally built image to its immutable SHA-256 ID
and checks its policy fingerprint, entrypoint, Linux platform and nonroot user.
It never executes an automatically pulled tag. Rebuild explicitly when the
trusted worker changes. Keep the Docker daemon and kernel patched; a container
shares a kernel and does not protect against an unknown kernel/runtime escape.

## Enforced boundary

Every job has `--network none`, a read-only root filesystem, UID/GID 65532,
all Linux capabilities dropped, `no-new-privileges`, a private process namespace,
no IPC share, 64 processes, one CPU, 512 MiB RAM with no extra swap, CPU/file/open
descriptor limits, a wall timeout and a 192 MiB non-executable temporary work
filesystem. Only an explicitly copied input file and fixed job parameters are
mounted, read-only. The repository, home, credentials, environment secrets,
Docker socket and other host paths are not mounted. Compiler includes can read
trusted image resources; arbitrary host includes are unavailable. Scores with
external local includes must be made self-contained within the reviewed input.

The worker runs fixed `/usr/bin/lilypond`, `pdfinfo` and `pdftoppm` commands.
There is no model-selected executable, shell command, network destination or
output path. Scheme/subprocesses remain possible *inside* the same restricted
container; their children inherit the boundary and resource limits.

Outputs travel in a size-bounded archive through stdout. The broker waits for
the container to stop successfully, then independently validates each member
before writing any output. It never calls `tar.extract`. Only the expected
regular PDF/MIDI or numbered PNG files are allowed. Links, devices, directories,
duplicate names, traversal, hidden files, scripts and extra files are rejected.
There is no writable host output mount or unbounded Docker output volume.
The exact randomly named job container is removed after success or failure.
If the daemon fails during a job and removal cannot be confirmed, the runner
returns an error identifying that disposable job; the operator must inspect it.
No runtime can promise cleanup while its controlling daemon is unavailable.
Docker's [resource controls](https://docs.docker.com/engine/containers/resource_constraints/)
and [container execution documentation](https://docs.docker.com/engine/containers/run/)
describe the underlying mechanisms.

## Use

```sh
python3 scripts/isolated_runner.py compile candidate.ly candidate.pdf
mkdir source-pages
python3 scripts/isolated_runner.py render source.pdf source-pages
python3 scripts/check.py
python3 scripts/build_site.py .build/new-site
```

Python APIs are `ensure_available()`, `compile_lilypond(source, destination_pdf)`
and `render_pdf_pages(source_pdf, existing_empty_output_directory, max_pages=40,
dpi=100)`. Rendering returns every page or fails; the page limit never silently
drops review coverage. Compiler receipts include the actual image ID, compiler
version and source/output hashes. A successful compile proves execution, not
musical fidelity or human verification.

The restricted model broker uses these APIs with its own fixed bounds. The
model has no Docker, shell or runner API tool. Fixed private canary operations
exist solely for runtime tests and are not exposed by the CLI/model interface.

## Acceptance and limitations

`test_isolated_runner.py` always tests fail-closed behavior, output validation
and required command policy. Actual container tests exercise host read/write
canaries, absent credentials/socket, network denial, nonroot/capabilities,
Scheme/subprocess/includes, PDF rendering, time/CPU/memory/process/output limits,
and script/link export rejection. Without Docker they explicitly report
**NOT RUN**. Both CI workflows set `OPUS_REQUIRE_ISOLATION=1`, turning runtime
unavailability into failure rather than a skip.
The network test creates a disposable **internal** Docker bridge and a fixed
challenge-response listener in the trusted image, without publishing a host
port or contacting the internet. A comparable control container must reach
that listener immediately before and after the production `--network none`
container fails to connect to the exact same address. An unreachable listener,
incorrect challenge response or failed control makes acceptance unavailable
and fails the test; being offline can never count as isolation evidence.
Only the test module changes the control container's network attachment, and
it supplies only the fixed harmless canary operations. Production has no
network-enabled option or fallback. All fixture containers and their dedicated
network are removed after the test.
Linux host-file canaries use their exact unmounted absolute host path. Windows
host paths have no corresponding Linux pathname or mount; the probe uses an
absolute unmounted Linux location and separately checks the Windows host file
remains unchanged. It never mistakes a `C:\...` string for a relative work file.

`trusted_browser_fixtures.py` is the sole host-compiler exception. It accepts
exactly two hardcoded synthetic byte strings used by the existing rendering
revision UI regression, rejects every other input, and compiles a trusted copy.
It cannot compile imported scores or adversarial tests. Its results are UI
regression evidence only, never isolation evidence. Production builds and the
restricted agent do not import this helper.
