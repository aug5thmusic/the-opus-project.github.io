"""Trusted fixed operations inside the disposable container, never on the host."""
import io
import json
import os
from pathlib import Path
import re
import resource
import socket
import stat
import subprocess
import sys
import tarfile
import time

WORK = Path('/work')
OUT = WORK / 'output'
FILE_LIMIT = 64 * 1024 * 1024
OUTPUT_LIMIT = 64 * 1024 * 1024
LOG_LIMIT = 1024 * 1024


def command(argv, timeout):
    """No shell; compiler/PDF subprocesses inherit the kernel/container limits."""
    with (WORK / 'operation.log').open('wb') as log:
        try:
            result = subprocess.run(argv, cwd=WORK, stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT, timeout=timeout,
                                    env={'PATH': '/usr/bin:/bin', 'HOME': '/work/home',
                                         'TMPDIR': '/work/tmp', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'})
        except subprocess.TimeoutExpired:
            raise ValueError('Operation exceeded its time limit.') from None
    if result.returncode:
        raise ValueError('Operation failed; inspect the bounded diagnostic output.')


def canary(name, job):
    """Fixed test operations only. No arbitrary command or script interface."""
    if name == 'probe':
        outside = Path(job['outside'])
        read = outside.exists()
        wrote = False
        try:
            outside.write_text('ISOLATION FAILURE')
            wrote = True
        except OSError:
            pass
        connected = False
        try:
            with socket.create_connection(('1.1.1.1', 443), timeout=1):
                connected = True
        except OSError:
            pass
        status = Path('/proc/self/status').read_text()
        return {'outsideReadable': read, 'outsideWritable': wrote, 'network': connected,
                'uid': os.getuid(), 'credential': os.environ.get('OPUS_CANARY_SECRET'),
                'socket': Path('/var/run/docker.sock').exists(),
                'noNewPrivs': bool(re.search(r'NoNewPrivs:\s+1', status)),
                'capsZero': bool(re.search(r'CapEff:\s+0+\s', status))}
    if name == 'timeout':
        while True:
            time.sleep(.1)
    if name == 'cpu':
        while True:
            pass
    if name == 'memory':
        blocks = []
        while True:
            blocks.append(bytearray(16 * 1024 * 1024))
    if name == 'pids':
        children = []
        try:
            for _ in range(200):
                children.append(subprocess.Popen(['/bin/sleep', '30']))
        except OSError:
            return {'bounded': len(children) < 100, 'children': len(children)}
        finally:
            for child in children:
                child.kill()
                child.wait()
        raise ValueError('Process limit did not hold.')
    if name == 'output':
        with (OUT / 'score.pdf').open('wb') as target:
            for _ in range(512):
                target.write(b'x' * 1024 * 1024)
        raise ValueError('Output limit did not hold.')
    if name == 'symlink':
        (OUT / 'score.pdf').symlink_to('/etc/passwd')
        return {'attempted': True}
    raise ValueError('Unknown fixed canary.')


def main():
    job = json.loads(Path('/input/job.json').read_text())
    operation = sys.argv[1] if len(sys.argv) == 2 else ''
    if operation not in ('compile', 'render', 'canary'):
        raise ValueError('Unsupported fixed operation.')
    timeout = int(job['timeout'])
    if not 1 <= timeout <= 120:
        raise ValueError('Invalid time limit.')
    resource.setrlimit(resource.RLIMIT_CPU, (timeout, timeout + 1))
    resource.setrlimit(resource.RLIMIT_FSIZE, (FILE_LIMIT, FILE_LIMIT))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    for directory in (OUT, WORK / 'home', WORK / 'tmp'):
        directory.mkdir()
    metadata = {'operation': operation, 'schema': 1}
    if operation == 'compile':
        command(['/usr/bin/lilypond', '-dno-point-and-click', '-o', '/work/output/score', '/input/source.ly'], timeout)
        metadata['compiler'] = subprocess.check_output(['/usr/bin/lilypond', '--version'], timeout=5).decode('utf-8', 'replace').splitlines()[0]
    elif operation == 'render':
        pages, dpi = int(job['max_pages']), int(job['dpi'])
        if not 1 <= pages <= 80 or not 50 <= dpi <= 150:
            raise ValueError('Invalid rendering limits.')
        info = subprocess.check_output(['/usr/bin/pdfinfo', '/input/source.pdf'], timeout=min(timeout, 15), stderr=subprocess.DEVNULL)
        match = re.search(rb'^Pages:\s+([0-9]+)', info, re.M)
        if not match or not 1 <= int(match[1]) <= pages:
            raise ValueError('PDF page count exceeds the supported complete-review limit.')
        metadata['pageCount'] = int(match[1])
        command(['/usr/bin/pdftoppm', '-png', '-r', str(dpi), '-scale-to', '2400',
                 '/input/source.pdf', '/work/output/page'], timeout)
    else:
        metadata['canary'] = canary(job['name'], job)
    files = {}
    total = 0
    for path in OUT.iterdir():
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError('Non-regular or linked output refused.')
        if not (path.name in ('score.pdf', 'score.midi') or re.fullmatch(r'page-[0-9]{1,3}\.png', path.name)):
            raise ValueError('Unexpected output refused.')
        total += info.st_size
        if total > OUTPUT_LIMIT or info.st_size > FILE_LIMIT:
            raise ValueError('Output exceeds its byte limit.')
        files[path.name] = path
    if operation == 'compile' and 'score.pdf' not in files:
        raise ValueError('Compiler produced no PDF.')
    if operation == 'render' and len(files) != metadata['pageCount']:
        raise ValueError('PDF renderer did not produce every page.')
    # The host does not interpret this archive until the container has stopped.
    # It independently bounds and checks every member instead of tar.extract().
    with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as archive:
        for name, path in files.items():
            data = path.read_bytes()
            member = tarfile.TarInfo(name)
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        data = json.dumps(metadata).encode()
        member = tarfile.TarInfo('result.json')
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Compiler text is untrusted diagnostic data; keep it bounded and out of
        # the archive channel. The host never interprets it as instructions.
        print(str(error), file=sys.stderr)
        log = WORK / 'operation.log'
        if log.is_file():
            with log.open('rb') as stream:
                stream.seek(max(0, log.stat().st_size - 4000))
                print(stream.read(4000).decode('utf-8', 'replace'), file=sys.stderr)
        raise SystemExit(1)
