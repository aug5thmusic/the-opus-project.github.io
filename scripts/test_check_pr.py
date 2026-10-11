#!/usr/bin/env python3
"""Exercise positive, negative, and non-score PR provenance cases."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

CHECKER = Path(__file__).with_name("check_pr.py")


def run(*arguments: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(arguments), cwd=cwd, capture_output=True, text=True, timeout=30, check=False
    )


def commit(repo: Path, relative: str, content: str, message: str) -> str:
    target = repo / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    assert run("git", "add", relative, cwd=repo).returncode == 0
    assert run("git", "commit", "-m", message, cwd=repo).returncode == 0
    result = run("git", "rev-parse", "HEAD", cwd=repo)
    assert result.returncode == 0
    return result.stdout.strip()


def check(repo: Path, base: str, head: str, body: str) -> int:
    environment = os.environ.copy()
    environment.update(PR_BASE_SHA=base, PR_HEAD_SHA=head, PR_BODY=body)
    result = subprocess.run(
        [sys.executable, "-B", str(CHECKER)],
        cwd=repo,
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    return result.returncode


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="opus-project-pr-test-") as temporary:
        repo = Path(temporary)
        assert run("git", "init", "--quiet", cwd=repo).returncode == 0
        assert run("git", "config", "user.name", "Fixture", cwd=repo).returncode == 0
        assert run("git", "config", "user.email", "fixture@example.invalid", cwd=repo).returncode == 0
        base = commit(repo, "README.md", "fixture\n", "base")
        score_head = commit(repo, "pieces/work/attempts/01.ly", "\\version \"2.26.0\"\n", "score")
        valid = "Step: 1/3\nModel: openai/gpt-5\nSource: https://example.invalid/source.pdf\n"
        assert check(repo, base, score_head, valid) == 0
        assert check(repo, base, score_head, "Step: 1/5\nModel: openai/gpt-5\nSource: https://example.invalid\n") == 1
        assert check(repo, base, score_head, "Step: 1/3\nSource: https://example.invalid\n") == 1
        human = "Review: human\nProofreader: @fixture\nSource: https://example.invalid/source.pdf\n"
        assert check(repo, base, score_head, human) == 0
        assert check(repo, base, score_head, "Review: human\nProofreader: @github-username\nSource: https://example.invalid/source.pdf\n") == 1
        docs_head = commit(repo, "README.md", "fixture updated\n", "docs")
        assert check(repo, score_head, docs_head, "") == 0
    print("check_pr fixtures: agent=pass human=pass negative=pass non_score=pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
