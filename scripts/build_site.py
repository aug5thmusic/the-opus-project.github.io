#!/usr/bin/env python3
"""Build the deployable static site, including generated score PDFs."""

from __future__ import annotations

import argparse
import re
import shutil
import hashlib
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
    "favicon.svg",
    "LICENSE",
)


def fail(message: str) -> None:
    raise ValueError(message)


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
            "pdf_url": str(Path(source_relative).with_suffix(".pdf")),
            "source_page": data["source_page"],
            "source_pdf": data["source_pdf"],
            "source_scope": str(data["source_id"]).partition("| scope:")[2].strip(),
            "review_notes_url": ((metadata_path.parent / "RECONCILIATION.md").relative_to(ROOT).as_posix()
                                 if (metadata_path.parent / "RECONCILIATION.md").is_file() else ""),
            "crosscheck_name": data["crosscheck_name"],
            "crosscheck_url": data["crosscheck_url"],
            "draft": True,
            "withdrawn": True,
            "source_sha256": data["source_sha256"],
            "lilypond_sha256": hashlib.sha256((ROOT / source_relative).read_bytes()).hexdigest(),
        })
    return {"schema": 1, "scores": entries}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output")
    parser.add_argument("--review-pr", type=int)
    parser.add_argument("--review-revision")
    parser.add_argument("--score-revision")
    args = parser.parse_args()
    if args.review_pr is not None:
        if args.review_pr < 1 or not re.fullmatch(r"[0-9a-f]{40}", args.review_revision or ""):
            fail("a review build needs a positive PR number and its full commit SHA")
    elif args.review_revision is not None:
        fail("--review-revision requires --review-pr")
    if args.score_revision is not None:
        if args.review_pr is None or not re.fullmatch(r"[0-9a-f]{40}", args.score_revision):
            fail("--score-revision requires a review PR and a full commit SHA")
    output = Path(args.output).resolve()
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
    review_url = f"https://github.com/the-opus-project/the-opus-project.github.io/pull/{args.review_pr}"
    if args.review_pr is not None:
        for entry in catalog["scores"]:
            if not entry["verified_by"]:
                entry.update(draft=True, withdrawn=False, review_pr=args.review_pr,
                             review_revision=args.score_revision or args.review_revision,
                             viewer_revision=args.review_revision, review_url=review_url)

    output.mkdir(mode=0o755)
    for relative in PUBLIC_FILES:
        shutil.copy2(ROOT / relative, output / relative)
        if args.review_pr is not None and relative.endswith(".html"):
            page = output / relative
            banner = (f'<p class="review-banner">Unmerged review drafts — awaiting human approval. '
                      f'<a href="{review_url}">Review PR #{args.review_pr}</a></p>')
            html = page.read_text(encoding="utf-8").replace("<main>", "<main>\n    " + banner, 1)
            html = html.replace("https://github.com/the-opus-project/the-opus-project.github.io/blob/main/",
                                f"https://github.com/the-opus-project/the-opus-project.github.io/blob/{args.review_revision}/")
            page.write_text(html, encoding="utf-8")
    (output / "catalog.json").write_text(render_catalog(catalog), encoding="utf-8")
    (output / "reviews.json").write_text(render_catalog(reviews), encoding="utf-8")

    for entry in [*catalog["scores"], *reviews["scores"]]:
        source_relative = Path(str(entry["lilypond_url"]))
        source = ROOT / source_relative
        deployed_source = output / source_relative
        deployed_source.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        shutil.copy2(source, deployed_source)
        for record in ("metadata.json", "SOURCE_CHECK.md", "REVIEW-01.md", "REVIEW-02.md", "RECONCILIATION.md"):
            piece_dir = source.parent.parent if source.parent.name == "attempts" else source.parent
            archived_record = ROOT / "review-notes" / str(entry["slug"]) / record
            record_source = archived_record if archived_record.is_file() else piece_dir / record
            if record_source.is_file():
                destination = output / record_source.relative_to(ROOT)
                destination.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                shutil.copy2(record_source, destination)
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
