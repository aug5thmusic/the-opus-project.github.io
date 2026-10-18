#!/usr/bin/env python3
"""Exercise score validation and site rendering with the real LilyPond binary."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from build_site import PUBLIC_FILES
from check import ROOT

VALID_SCORE = r'''\version "2.24.3"
\score { \relative c' { \time 4/4 c4 d e f | g1 | } }
'''
BAD_BAR = r'''\version "2.24.3"
\score { \relative c' { \time 4/4 c4 d e | f1 | } }
'''
BAD_TIE = r'''\version "2.24.3"
\score { \relative c' { \time 4/4 c1~ | d1 | } }
'''
BAD_PROPERTY = r'''\version "2.24.3"
\score { { \time 4/4 \set Timing.measureLength = #"invalid" c'1 | } }
'''


def run(arguments: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        cwd=cwd,
        env={**os.environ, "LC_ALL": "C"},
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


def require(condition: bool, message: str, result: subprocess.CompletedProcess[str]) -> None:
    if not condition:
        raise AssertionError(f"{message}\n{result.stdout}\n{result.stderr}")


def main() -> int:
    lilypond = shutil.which("lilypond")
    if not lilypond:
        raise SystemExit("lilypond is required for score-build integration tests")
    with tempfile.TemporaryDirectory(prefix="opus-project-score-test-") as temporary:
        repo = Path(temporary)
        (repo / "scripts").mkdir()
        for name in ("check.py", "build_site.py"):
            shutil.copy2(ROOT / "scripts" / name, repo / "scripts" / name)
        for name in PUBLIC_FILES:
            shutil.copy2(ROOT / name, repo / name)
        piece = repo / "pieces" / "fixture"
        (piece / "attempts").mkdir(parents=True)
        source = piece / "attempts" / "01.ly"
        metadata = {
            "slug": "fixture", "title": "Build fixture", "composer": "Fixture",
            "catalogue": "Fixture", "year": "2026", "instrumentation": "Piano",
            "license": "CC0 1.0", "source_library": "Fixture", "source_id": "fixture",
            "source_page": "https://example.invalid/fixture",
            "source_pdf": "https://example.invalid/fixture.pdf",
            "source_sha256": "0" * 64,
            "crosscheck_name": "Fixture", "crosscheck_url": "https://example.invalid/fixture",
            "step": 1, "models": ["test/fixture"], "verified_by": None,
        }
        (piece / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        source.write_text(VALID_SCORE, encoding="utf-8")

        # Derive the fixture catalog through the production entry point.
        result = run([sys.executable, "-B", "scripts/check.py", "--write"], repo)
        require(result.returncode == 0 and not result.stderr, "valid score rejected", result)
        require("ok: 1 works, 1 LilyPond files" in result.stdout, "validation did not finish", result)
        catalog = (repo / "catalog.json").read_bytes()

        result = run([sys.executable, "-B", "scripts/build_site.py", "site-valid"], repo)
        require(result.returncode == 0 and not result.stderr, "valid site rejected", result)
        deployed = repo / "site-valid" / source.relative_to(repo)
        require(deployed.read_bytes() == source.read_bytes(), "deployed source changed", result)
        require(deployed.with_suffix(".pdf").read_bytes().startswith(b"%PDF-"), "missing PDF", result)
        require((repo / "site-valid/catalog.json").read_bytes() == catalog, "catalog changed", result)

        for label, music, diagnostic in (
            ("bar", BAD_BAR, r"bar ?check failed"),
            ("tie", BAD_TIE, "unterminated tie"),
            (
                "property", BAD_PROPERTY,
                r"(?:type check for|the property).*measureLength.*(?:failed|must be of type)",
            ),
        ):
            source.write_text(music, encoding="utf-8")

            # Prove that this diagnostic does not fail ordinary LilyPond,
            # rather than a syntax error or an unrelated fixture prerequisite.
            raw = run([lilypond, "-o", f"ordinary-{label}", str(source)], repo)
            require(raw.returncode == 0, f"{label}: fixture already fails ordinary LilyPond", raw)
            require(re.search(diagnostic, raw.stderr) is not None, f"{label}: expected diagnostic was not emitted", raw)

            for script, arguments, success_marker in (
                ("check.py", [], "compiled pieces/fixture/attempts/01.ly"),
                ("build_site.py", [f"site-{label}"], "built 1 catalog works"),
            ):
                result = run([sys.executable, "-B", f"scripts/{script}", *arguments], repo)
                require(result.returncode == 1, f"{script} accepted {label} warning", result)
                require(re.search(diagnostic, result.stderr) is not None, f"{script} failed for another reason", result)
                require(success_marker not in result.stdout, f"{script} claimed success", result)

    print("score-build fixtures: valid=pass bar_warning=rejected tie_warning=rejected property_error=rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
