#!/usr/bin/env python3
"""Build the deployable static site, including generated score PDFs."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from check import PIECES, ROOT, expected_catalog, load_metadata, render_catalog

PUBLIC_FILES = (
    "index.html",
    "about.html",
    "contribute.html",
    "proofread.html",
    "styles.css",
    "app.js",
    "proofread.js",
    "LICENSE",
)

CONTRIBUTOR_FILES = ("index.html", "style.css", "app.js", "work-links.mjs")
SCORE_FILES = (
    "index.html", "style.css", "app.js", "model.js", "storage.js", "export.js",
    "workflow.js", "handoff-store.js", "handoff-ui.js", "returned.js",
    "returned-ui.js", "completion-model.js", "completion.js", "completion-ui.js",
    "HANDOFF_FORMATS.md", "github-handoff.js", "shared-client.js", "shared-ui.js",
    "shared-packages.js", "shared-config.json",
)


def fail(message: str) -> None:
    raise ValueError(message)


def contributor_assets(root: Path | None = None) -> dict[Path, Path]:
    """Validate the complete public runtime before copying any contributor files.

    Do not recursively publish the source tree: it contains QA harnesses and may
    acquire local review data. The vendor manifest also makes a missing decoder,
    font or CMap fail the build instead of breaking selected PDFs after release.
    """
    root = ROOT if root is None else root
    assets = {Path("contributor") / name: root / "contributor" / name
              for name in CONTRIBUTOR_FILES}
    assets.update({Path("contributor/score") / name: root / "contributor/score" / name
                   for name in SCORE_FILES})
    # Exported packages should carry the instructions of this exact checkout.
    for name in ("AGENTS.md", "HANDBOOK.md"):
        assets[Path("contributor/score/project-guidance") / name] = root / name
    manifest = json.loads((root / "scripts/contributor_vendor_files.json").read_text(encoding="utf-8"))
    names = manifest.get("files") if isinstance(manifest, dict) else None
    if not isinstance(manifest, dict) or manifest.get("schema") != 1 or not isinstance(names, list) or not names:
        fail("invalid contributor vendor manifest")
    seen: set[str] = set()
    for name in names:
        if (not isinstance(name, str) or not name or "\\" in name
                or ":" in name or name.startswith("/")
                or any(part in ("", ".", "..") for part in name.split("/"))):
            fail("unsafe contributor vendor path")
        if name.casefold() in seen:
            fail("duplicate contributor vendor path")
        seen.add(name.casefold())
        relative = Path("contributor/score/vendor") / name
        assets[relative] = root / relative
    for relative, source in assets.items():
        parents = source.relative_to(root).parts
        if (not source.is_file() or any((root.joinpath(*parents[:i])).is_symlink()
                                      for i in range(1, len(parents) + 1))):
            fail(f"missing or linked contributor runtime asset: {relative.as_posix()}")
    return assets


def copy_contributor_assets(output: Path, root: Path | None = None) -> None:
    """Copy only the validated production workspace; never overwrite a tree."""
    assets = contributor_assets(root)
    destination = output / "contributor"
    if destination.exists() or destination.is_symlink():
        fail(f"contributor output already exists: {destination}")
    if not output.is_dir() or output.is_symlink():
        fail("contributor output parent must be an existing, non-symlink directory")
    for relative, source in assets.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def review_queue() -> dict[str, object]:
    entries: list[dict[str, object]] = []
    for metadata_path in sorted(PIECES.glob("*/metadata.json")):
        data = load_metadata(metadata_path)
        if data["step"] != 3 or not data.get("withdrawn", False):
            continue
        source_relative = (metadata_path.parent / "score.ly").relative_to(ROOT).as_posix()
        entries.append({
            "slug": data["slug"],
            "title": data["title"],
            "composer": data["composer"],
            "catalogue": data["catalogue"],
            "step": data["step"],
            "verified_by": None,
            "lilypond_url": source_relative,
            "pdf_url": Path(source_relative).with_suffix(".pdf").as_posix(),
            "source_page": data["source_page"],
            "source_pdf": data["source_pdf"],
            "crosscheck_name": data["crosscheck_name"],
            "crosscheck_url": data["crosscheck_url"],
            "draft": True,
        })
    return {"schema": 1, "scores": entries}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python3 scripts/build_site.py OUTPUT", file=sys.stderr)
        return 2
    output = Path(sys.argv[1]).resolve()
    if output.exists():
        fail(f"output already exists: {output}")
    parent = output.parent
    if not parent.is_dir() or parent.is_symlink():
        fail(f"output parent must be an existing, non-symlink directory: {parent}")

    lilypond = shutil.which("lilypond")
    if not lilypond:
        fail("lilypond is not installed")
    catalog, _ = expected_catalog()
    reviews = review_queue()
    contributor_assets()

    output.mkdir(mode=0o755)
    for relative in PUBLIC_FILES:
        shutil.copy2(ROOT / relative, output / relative)
    copy_contributor_assets(output)
    (output / "catalog.json").write_text(render_catalog(catalog), encoding="utf-8")
    (output / "reviews.json").write_text(render_catalog(reviews), encoding="utf-8")

    for entry in [*catalog["scores"], *reviews["scores"]]:
        source_relative = Path(str(entry["lilypond_url"]))
        source = ROOT / source_relative
        deployed_source = output / source_relative
        deployed_source.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        shutil.copy2(source, deployed_source)
        output_base = (output / Path(str(entry["pdf_url"]))).with_suffix("")
        result = subprocess.run(
            [
                lilypond,
                "-dno-point-and-click",
                "-o",
                str(output_base),
                str(deployed_source),
            ],
            cwd=output,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode:
            detail = (result.stdout + result.stderr)[-4000:]
            fail(f"{source_relative}: LilyPond failed\n{detail}")
        pdf = output / Path(str(entry["pdf_url"]))
        if not pdf.is_file() or pdf.stat().st_size == 0:
            fail(f"{source_relative}: LilyPond did not produce {pdf}")

    print(f"built {len(catalog['scores'])} catalog works and {len(reviews['scores'])} review drafts in {output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
