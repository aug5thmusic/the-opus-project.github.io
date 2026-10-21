#!/usr/bin/env python3
"""Fail-closed Docker boundary for untrusted LilyPond and PDF processing.

Only fixed project-owned operations exist. No shell/command, model-selected
paths, remote daemon, image pull, daemon startup, install, or host fallback.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / 'isolated-runtime'
IMAGE = 'opus-isolated-runtime:1'
MAX_INPUT = 100 * 1024 * 1024
MAX_OUTPUT = 64 * 1024 * 1024
MAX_ARCHIVE = MAX_OUTPUT + 1024 * 1024
MAX_LOG = 64 * 1024


class IsolatedRunError(ValueError):
    pass


class IsolationUnavailable(IsolatedRunError):
    pass


def policy_sha256():
    return hashlib.sha256(b''.join((RUNTIME / p).read_bytes() for p in ('Dockerfile', 'worker.py'))).hexdigest()


def _bounded(command, *, timeout=15, output_limit=MAX_LOG, env=None):
    """Bound subprocess pipes while reading, not after communicate allocates."""
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, env=env)
    stdout, stderr = bytearray(), bytearray()
    exceeded = threading.Event()

    def read(stream, target, limit):
        try:
            while True:
                chunk = stream.read(65536)
                if not chunk:
                    break
                if len(target) + len(chunk) > limit:
                    exceeded.set()
                    process.kill()
                    break
                target.extend(chunk)
        finally:
            stream.close()

    readers = [threading.Thread(target=read, args=(process.stdout, stdout, output_limit), daemon=True),
               threading.Thread(target=read, args=(process.stderr, stderr, MAX_LOG), daemon=True)]
    for reader in readers:
        reader.start()
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
        raise IsolatedRunError('Isolated operation exceeded its time limit.') from None
    finally:
        for reader in readers:
            reader.join(timeout=5)
    if exceeded.is_set():
        raise IsolatedRunError('Isolated output exceeded its byte limit.')
    return process.returncode, bytes(stdout), bytes(stderr)


def _docker():
    executable = shutil.which('docker')
    if not executable:
        raise IsolationUnavailable('Docker is unavailable. No compiler or PDF processor was run. See scripts/ISOLATED_RUNTIME.md.')
    # The CLI may read its local context, but none of this environment or its
    # configuration directory is passed/mounted into the container.
    env = {key: value for key, value in os.environ.items() if key in (
        'PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME',
        'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'DOCKER_CONFIG')}
    endpoint = os.environ.get('DOCKER_HOST')
    if not endpoint:
        try:
            context = os.environ.get('DOCKER_CONTEXT')
            if not context:
                code, selected, _ = _bounded([executable, 'context', 'show'], env=env)
                if code:
                    raise ValueError('Context selection unavailable')
                context = selected.decode('utf-8').strip()
            code, out, _ = _bounded([executable, 'context', 'inspect', context], env=env)
            if code:
                raise ValueError('Context unavailable')
            endpoint = json.loads(out)[0]['Endpoints']['docker']['Host']
        except (KeyError, IndexError, ValueError, OSError):
            raise IsolationUnavailable('The local Docker context is unavailable; no host fallback is permitted.') from None
    if not (re.fullmatch(r'unix:///[^\x00\r\n]+', endpoint)
            or re.fullmatch(r'npipe:////\./pipe/[A-Za-z0-9_.-]+', endpoint)):
        raise IsolationUnavailable('Only a local Unix socket or Windows named-pipe Docker daemon is permitted.')
    return [executable, '--host', endpoint], env


def _available_runtime():
    """Require an already-running local Linux daemon and trusted local image."""
    docker, env = _docker()
    try:
        code, out, _ = _bounded([*docker, 'info', '--format', '{{json .}}'], env=env, output_limit=2*1024*1024)
        if code:
            raise ValueError('Daemon not running')
        info = json.loads(out)
        if info.get('OSType') != 'linux' or not all(info.get(k) for k in ('MemoryLimit', 'SwapLimit', 'PidsLimit', 'CpuCfsQuota')):
            raise ValueError('Required Linux resource limits unavailable')
        code, out, _ = _bounded([*docker, 'image', 'inspect', IMAGE], env=env, output_limit=2*1024*1024)
        if code:
            raise ValueError('Trusted image missing')
        image = json.loads(out)[0]
        config = image['Config']
        labels = config.get('Labels') or {}
        if (not re.fullmatch(r'sha256:[a-f0-9]{64}', image['Id']) or image.get('Os') != 'linux'
                or labels.get('org.opus.isolated-runtime') != '1'
                or labels.get('org.opus.policy-sha256') != policy_sha256()
                or config.get('Entrypoint') != ['/usr/bin/python3', '-I', '/opt/opus/worker.py']
                or config.get('User') != '65532:65532' or config.get('Volumes')):
            raise ValueError('Image does not match the installed project runtime policy')
    except (ValueError, KeyError, IndexError, OSError) as error:
        raise IsolationUnavailable('The isolated Linux runtime is unavailable or does not match this checkout. No tool was run; explicitly provision the local image using scripts/ISOLATED_RUNTIME.md. '+str(error)) from None
    return {'imageId': image['Id'], 'policySha256': policy_sha256(), 'runtime': 'Docker Linux; no network; bounded resources', '_docker': docker, '_env': env}


def ensure_available():
    """Public capability receipt; no host paths or CLI environment are exposed."""
    return {key: value for key, value in _available_runtime().items() if not key.startswith('_')}


def _regular_path(path):
    path = Path(path).absolute()
    for part in (path, *path.parents):
        if not part.exists():
            continue
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise IsolatedRunError('Linked/reparse-point input or output paths are refused.')
    return path


def _read_input(path, extension):
    path = _regular_path(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or path.suffix.lower() != extension or info.st_size > MAX_INPUT:
        raise IsolatedRunError('Input must be a bounded regular, unlinked '+extension+' file.')
    with path.open('rb') as stream:
        data = stream.read(MAX_INPUT + 1)
    if len(data) != info.st_size or len(data) > MAX_INPUT:
        raise IsolatedRunError('Input changed while being copied or exceeds its limit.')
    return data


def _outputs(raw, operation, *, max_pages=40):
    """Never extract an archive supplied by a compiler into a host directory."""
    if len(raw) > MAX_ARCHIVE:
        raise IsolatedRunError('Output archive exceeds its byte limit.')
    files, total = {}, 0
    try:
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
            for member in archive:
                name = member.name
                if (not member.isreg() or member.islnk() or member.issym() or member.pax_headers
                        or name in files or len(files) >= 82 or member.size < 0
                        or '/' in name or '\\' in name or name.startswith('.')
                        or not (name == 'result.json' or operation == 'compile' and name in ('score.pdf', 'score.midi')
                                or operation == 'render' and re.fullmatch(r'page-[0-9]{1,3}\.png', name))):
                    raise IsolatedRunError('Unexpected, linked, duplicate or unsafe output was refused.')
                total += member.size
                if total > MAX_OUTPUT or member.size > MAX_OUTPUT or name == 'result.json' and member.size > 16384:
                    raise IsolatedRunError('Output exceeds its byte limit.')
                stream = archive.extractfile(member)
                data = stream.read(member.size + 1)
                if len(data) != member.size:
                    raise IsolatedRunError('Truncated output was refused.')
                files[name] = data
    except (tarfile.TarError, OSError) as error:
        raise IsolatedRunError('Invalid output archive was refused.') from error
    try:
        metadata = json.loads(files.pop('result.json'))
    except (KeyError, ValueError):
        raise IsolatedRunError('Missing output receipt.') from None
    if not isinstance(metadata, dict) or metadata.get('schema') != 1 or metadata.get('operation') != operation:
        raise IsolatedRunError('Invalid output receipt.')
    if operation == 'compile':
        pdf = files.get('score.pdf', b'')
        if not pdf.startswith(b'%PDF-') or b'%%EOF' not in pdf[-1024:]:
            raise IsolatedRunError('Compiler did not return a complete PDF.')
        if 'score.midi' in files and not files['score.midi'].startswith(b'MThd'):
            raise IsolatedRunError('Invalid generated MIDI.')
    elif operation == 'render':
        count = metadata.get('pageCount')
        numbers = sorted(int(name[5:-4]) for name in files)
        if type(count) is not int or not 1 <= count <= max_pages or numbers != list(range(1, count + 1)):
            raise IsolatedRunError('Rendering omitted or duplicated PDF pages.')
        if any(not data.startswith(b'\x89PNG\r\n\x1a\n') for data in files.values()):
            raise IsolatedRunError('Renderer returned an invalid page image.')
    return files, metadata


def _run(operation, inputs, job, *, timeout_seconds=120):
    if operation not in ('compile', 'render', 'canary') or type(timeout_seconds) is not int or not 1 <= timeout_seconds <= 120:
        raise IsolatedRunError('Unsupported operation or time limit.')
    runtime = _available_runtime()
    docker, env = runtime.pop('_docker'), runtime.pop('_env')
    with tempfile.TemporaryDirectory(prefix='opus-isolated-input-') as directory:
        input_root = Path(directory)
        input_root.chmod(0o755)
        for name, data in inputs.items():
            if name not in ('source.ly', 'source.pdf') or not isinstance(data, bytes) or len(data) > MAX_INPUT:
                raise IsolatedRunError('Unsupported isolated input.')
            (input_root / name).write_bytes(data)
        (input_root / 'job.json').write_text(json.dumps({**job, 'timeout': timeout_seconds}), encoding='utf-8')
        for path in input_root.iterdir():
            path.chmod(0o444)
        if ',' in directory or '\n' in directory:
            raise IsolatedRunError('Unsupported temporary input path.')
        container = 'opus-isolated-'+uuid.uuid4().hex
        create = [*docker, 'create', '--pull=never', '--name', container,
                  '--network', 'none', '--read-only', '--user', '65532:65532',
                  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                  '--pids-limit', '64', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1',
                  '--ulimit', 'nofile=128:128', '--ulimit', 'core=0:0',
                  '--ipc', 'none', '--log-driver', 'none', '--stop-timeout', '1',
                  '--tmpfs', '/work:rw,noexec,nosuid,nodev,size=201326592,mode=0700,uid=65532,gid=65532',
                  '--mount', f'type=bind,source={directory},target=/input,readonly',
                  '--workdir', '/work', '--env', 'HOME=/work/home', '--env', 'TMPDIR=/work/tmp',
                  runtime['imageId'], operation]
        created = False
        try:
            code, _, err = _bounded(create, env=env)
            if code:
                raise IsolationUnavailable('Docker refused the required isolation policy. '+err.decode('utf-8', 'replace')[-1000:])
            created = True
            code, raw, err = _bounded([*docker, 'start', '--attach', container], env=env,
                                      timeout=timeout_seconds + 10, output_limit=MAX_ARCHIVE)
            # Docker start -a exit status alone is not a trustworthy job receipt.
            status, state, _ = _bounded([*docker, 'inspect', '--format', '{{json .State}}', container], env=env)
            state = json.loads(state) if not status else {}
            if state.get('Running') is not False or state.get('ExitCode') != 0 or state.get('OOMKilled') or code:
                raise IsolatedRunError('Isolated operation failed or reached a resource limit. Untrusted diagnostic: '+err.decode('utf-8', 'replace')[-4000:])
            files, metadata = _outputs(raw, operation, max_pages=job.get('max_pages', 40))
            return files, {**metadata, **runtime, 'network': 'none'}
        finally:
            if created:
                # Only this exact randomly named disposable job is removed.
                removed, _, _ = _bounded([*docker, 'rm', '--force', container], env=env, timeout=15)
                if removed:
                    raise IsolatedRunError('Docker could not confirm removal of disposable job '+container+'. No output is authorized; the operator must inspect that job before further runs.')


def _write_outputs(destination, files):
    destination = _regular_path(destination)
    if not destination.is_dir():
        raise IsolatedRunError('Output directory must already exist.')
    for name in files:
        path = _regular_path(destination / name)
        if path.exists() and (not path.is_file() or path.stat().st_nlink != 1):
            raise IsolatedRunError('Output must be a regular, unlinked file.')
    for name, data in files.items():
        with tempfile.NamedTemporaryFile(dir=destination, prefix='.opus-output-', delete=False) as stream:
            staging = Path(stream.name)
            stream.write(data)
        try:
            os.replace(staging, destination / name)
        finally:
            staging.unlink(missing_ok=True)


def compile_lilypond(source: Path, destination: Path, *, timeout_seconds=120):
    """Compile one untrusted .ly; only image built-ins are available for includes."""
    destination = _regular_path(destination)
    if destination.suffix.lower() != '.pdf' or destination.resolve() == Path(source).resolve():
        raise IsolatedRunError('Choose a separate PDF destination.')
    data = _read_input(source, '.ly')
    try:
        data.decode('utf-8')
    except UnicodeError:
        raise IsolatedRunError('LilyPond must be UTF-8.') from None
    files, metadata = _run('compile', {'source.ly': data}, {}, timeout_seconds=timeout_seconds)
    mapped = {destination.name: files['score.pdf']}
    if 'score.midi' in files:
        mapped[destination.with_suffix('.midi').name] = files['score.midi']
    _write_outputs(destination.parent, mapped)
    return {**metadata, 'files': [str(destination.parent / p) for p in mapped], 'sourceSha256': hashlib.sha256(data).hexdigest(),
            'outputSha256': {name: hashlib.sha256(value).hexdigest() for name, value in mapped.items()}}


def render_pdf_pages(source_pdf: Path, output_dir: Path, *, max_pages=40, dpi=100, timeout_seconds=120):
    """Render every page or fail. No parsing of an imported PDF on the host."""
    if type(max_pages) is not int or not 1 <= max_pages <= 80 or type(dpi) is not int or not 50 <= dpi <= 150:
        raise IsolatedRunError('Invalid complete-document rendering bounds.')
    output_dir = _regular_path(output_dir)
    if not output_dir.is_dir() or any(output_dir.iterdir()):
        raise IsolatedRunError('Page output must be an existing empty directory.')
    data = _read_input(source_pdf, '.pdf')
    files, metadata = _run('render', {'source.pdf': data}, {'max_pages': max_pages, 'dpi': dpi}, timeout_seconds=timeout_seconds)
    _write_outputs(output_dir, files)
    return {**metadata, 'files': [str(output_dir / p) for p in sorted(files, key=lambda p: int(p[5:-4]))]}


def _canary_for_tests(name, *, outside='/unmounted-host-canary', timeout_seconds=5):
    if name not in ('probe', 'timeout', 'cpu', 'memory', 'pids', 'output', 'symlink'):
        raise IsolatedRunError('Unknown fixed canary.')
    # A Windows host path is not an absolute Linux path. Do not accidentally
    # probe a writable relative filename beneath /work inside the container.
    # No host path is mounted: Linux tests can probe their exact host pathname;
    # Windows tests use an explicitly unmounted absolute Linux location.
    if re.match(r'^(?:[A-Za-z]:|\\\\)', outside):
        outside = '/unmounted-host-canary'
    if not outside.startswith('/'):
        raise IsolatedRunError('Canary reference must be an absolute unmounted path.')
    return _run('canary', {}, {'name': name, 'outside': outside}, timeout_seconds=timeout_seconds)[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('status', 'policy', 'compile', 'render'))
    parser.add_argument('source', nargs='?')
    parser.add_argument('destination', nargs='?')
    args = parser.parse_args()
    if args.operation == 'policy':
        print(policy_sha256())
        return
    if args.operation == 'status':
        result = {k: v for k, v in ensure_available().items() if not k.startswith('_')}
    else:
        if not args.source or not args.destination:
            parser.error('source and destination are required')
        result = (compile_lilypond if args.operation == 'compile' else render_pdf_pages)(Path(args.source), Path(args.destination))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, IsolatedRunError) as error:
        raise SystemExit(str(error)) from None
