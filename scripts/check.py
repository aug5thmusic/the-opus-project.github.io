#!/usr/bin/env python3
"""Validate metadata, derive the catalog, and compile every LilyPond source."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIECES = ROOT / "pieces"
CATALOG = ROOT / "catalog.json"
SHA256 = re.compile(r"[0-9a-f]{64}")
STRING_FIELDS = {
    "slug", "title", "composer", "catalogue", "year", "instrumentation",
    "license", "source_library", "source_id", "source_page", "source_pdf",
    "source_sha256", "crosscheck_name", "crosscheck_url",
}
REQUIRED = STRING_FIELDS | {"step", "models", "verified_by"}


def fail(message: str) -> None:
    raise ValueError(message)


def load_metadata(path: Path) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"{path.relative_to(ROOT)}: invalid JSON: {error}")
    if not isinstance(data, dict):
        fail(f"{path.relative_to(ROOT)}: root must be an object")
    missing = REQUIRED - data.keys()
    extra = data.keys() - (REQUIRED | {"withdrawn"})
    if missing or extra:
        fail(
            f"{path.relative_to(ROOT)}: schema mismatch; "
            f"missing={sorted(missing)}, extra={sorted(extra)}"
        )
    for key in STRING_FIELDS:
        value = data[key]
        if not isinstance(value, str) or not value.strip():
            fail(f"{path.relative_to(ROOT)}: {key} must be a non-empty string")
    if data["license"] != "CC0 1.0":
        fail(f"{path.relative_to(ROOT)}: project transcriptions must be CC0 1.0")
    if data["slug"] != path.parent.name:
        fail(f"{path.relative_to(ROOT)}: slug must match its directory")
    if "withdrawn" in data and not isinstance(data["withdrawn"], bool):
        fail(f"{path.relative_to(ROOT)}: withdrawn must be a boolean")
    step = data["step"]
    if not isinstance(step, int) or isinstance(step, bool) or not 1 <= step <= 3:
        fail(f"{path.relative_to(ROOT)}: step must be an integer from 1 to 3")
    models = data["models"]
    if (
        not isinstance(models, list)
        or len(models) != step
        or any(not isinstance(model, str) or not model.strip() for model in models)
    ):
        fail(
            f"{path.relative_to(ROOT)}: models must contain one exact model "
            "identifier for every completed step"
        )
    verified_by = data["verified_by"]
    if verified_by is not None:
        username = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?"
        if step != 3 or not isinstance(verified_by, str) or not re.fullmatch(username, verified_by):
            fail(
                f"{path.relative_to(ROOT)}: verified_by must be a GitHub "
                "username after Step 3/3, or null"
            )
    if not SHA256.fullmatch(str(data["source_sha256"])):
        fail(
            f"{path.relative_to(ROOT)}: source_sha256 must be "
            "64 lowercase hex characters"
        )
    for key in ("source_page", "source_pdf", "crosscheck_url"):
        if not str(data[key]).startswith("https://"):
            fail(f"{path.relative_to(ROOT)}: {key} must use HTTPS")
    return data


def expected_catalog() -> tuple[dict[str, object], list[Path]]:
    entries: list[dict[str, object]] = []
    sources: list[Path] = []
    for metadata_path in sorted(PIECES.glob("*/metadata.json")):
        data = load_metadata(metadata_path)
        piece_dir = metadata_path.parent
        step = int(data["step"])
        attempts_dir = piece_dir / "attempts"
        attempts = sorted(attempts_dir.glob("*.ly")) if attempts_dir.is_dir() else []
        expected_names = [f"{number:02}.ly" for number in range(1, min(step, 2) + 1)]
        if [path.name for path in attempts] != expected_names:
            fail(
                f"{piece_dir.relative_to(ROOT)}: Step {step}/3 requires "
                f"attempts {expected_names}"
            )
        final_score = piece_dir / "score.ly"
        if step == 3 and not final_score.is_file():
            fail(f"{piece_dir.relative_to(ROOT)}: Step 3/3 requires score.ly")
        if step < 3 and final_score.exists():
            fail(
                f"{piece_dir.relative_to(ROOT)}: score.ly is reserved for "
                "the Step 3/3 reconciliation"
            )
        sources.extend(attempts)
        if step == 3:
            sources.append(final_score)
            current_source = final_score
        else:
            current_source = attempts[-1]
        if data.get("withdrawn", False):
            continue
        current_relative = current_source.relative_to(ROOT).as_posix()
        entries.append(
            {
                "slug": data["slug"],
                "title": data["title"],
                "composer": data["composer"],
                "catalogue": data["catalogue"],
                "year": data["year"],
                "instrumentation": data["instrumentation"],
                "step": step,
                "verified_by": data["verified_by"],
                "lilypond_url": current_relative,
                "pdf_url": str(Path(current_relative).with_suffix(".pdf")),
                "source_page": data["source_page"],
                "source_pdf": data["source_pdf"],
                "crosscheck_name": data["crosscheck_name"],
                "crosscheck_url": data["crosscheck_url"],
            }
        )
    entries.sort(
        key=lambda entry: (
            -int(entry["step"]),
            str(entry["composer"]).casefold(),
            str(entry["title"]).casefold(),
        )
    )
    return {"schema": 3, "scores": entries}, sources


def render_catalog(catalog: dict[str, object]) -> str:
    return json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"


def check_catalog(expected: dict[str, object]) -> None:
    rendered = render_catalog(expected)
    actual = CATALOG.read_text(encoding="utf-8") if CATALOG.exists() else ""
    if actual != rendered:
        fail(
            "catalog.json is stale; regenerate it with: "
            "python3 scripts/check.py --write"
        )


def compile_sources(sources: list[Path]) -> None:
    lilypond = shutil.which("lilypond")
    if not lilypond:
        fail("lilypond is not installed")
    with tempfile.TemporaryDirectory(prefix="opus-project-check-") as temp_dir:
        output_root = Path(temp_dir)
        for source in sources:
            source_text = source.read_text(encoding="utf-8")
            version = re.search(
                r'^\\version "2\.(?:2[4-9]|[3-9][0-9])', source_text, re.MULTILINE
            )
            if not version:
                fail(
                    f"{source.relative_to(ROOT)}: "
                    "declare LilyPond version 2.24 or newer"
                )
            digest = hashlib.sha256(
                str(source.relative_to(ROOT)).encode()
            ).hexdigest()[:12]
            result = subprocess.run(
                [lilypond, "-dno-point-and-click", "-o", str(output_root / digest), str(source)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            if result.returncode:
                detail = (result.stdout + result.stderr)[-4000:]
                fail(f"{source.relative_to(ROOT)}: LilyPond failed\n{detail}")
            print(f"compiled {source.relative_to(ROOT)}")


def main() -> int:
    write = sys.argv[1:] == ["--write"]
    if sys.argv[1:] not in ([], ["--write"]):
        print("usage: python3 scripts/check.py [--write]", file=sys.stderr)
        return 2
    forbidden = list(PIECES.rglob("*.pdf"))
    if forbidden:
        fail(
            "generated PDFs belong in the deployed site, not the repository: "
            f"{forbidden[0].relative_to(ROOT)}"
        )
    catalog, sources = expected_catalog()
    if write:
        CATALOG.write_text(render_catalog(catalog), encoding="utf-8")
        print("wrote catalog.json")
    else:
        check_catalog(catalog)
    compile_sources(sources)
    print(f"ok: {len(catalog['scores'])} works, {len(sources)} LilyPond files")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
