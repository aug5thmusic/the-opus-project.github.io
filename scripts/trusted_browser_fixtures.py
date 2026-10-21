"""Explicit host compilation of two hardcoded synthetic browser-test fixtures.

This is NOT an isolation test or an imported-score compiler. No arbitrary input
bytes, include paths, command flags or extra environment are accepted.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

FIXTURES = (
    b'% SIMULATED regression fixture; not a transcription\n\\version "2.24.3"\n\\header { title = "SIMULATED baseline" }\n{ c\'1 }\n',
    b'% SIMULATED changed-code fixture; not a correction\n\\version "2.24.3"\n\\header { title = "SIMULATED proposed version" }\n{ c\'4 e\'4 g\'4 c\'\'4 }\n',
)


def compile_trusted_fixture(source: Path, pdf: Path):
    supplied = Path(source).read_bytes()
    if supplied not in FIXTURES:
        raise ValueError('Only the two exact hardcoded synthetic fixture byte strings may use the host compiler.')
    compiler = shutil.which('lilypond')
    if not compiler:
        raise ValueError('The optional trusted synthetic browser fixture requires local LilyPond; imported code is never run here.')
    with tempfile.TemporaryDirectory(prefix='opus-trusted-synthetic-') as temp:
        directory = Path(temp)
        fixed = directory / 'fixture.ly'
        fixed.write_bytes(FIXTURES[FIXTURES.index(supplied)])
        result = subprocess.run([compiler, '-dno-point-and-click', '-o', str(directory / 'fixture'), str(fixed)],
                                cwd=directory, capture_output=True, timeout=120)
        if result.returncode:
            raise ValueError('Trusted synthetic fixture failed to compile.')
        Path(pdf).write_bytes((directory / 'fixture.pdf').read_bytes())
    print('Trusted hardcoded synthetic fixture compiled on host; this is not isolation evidence.')
