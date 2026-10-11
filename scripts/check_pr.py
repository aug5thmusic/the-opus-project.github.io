#!/usr/bin/env python3
"""Require provenance annotations on pull requests that change scores."""

from __future__ import annotations

import os
import re
import subprocess
import sys


def changed_paths(base: str, head: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACMRT", base, head, "--", "pieces"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode:
        print("error: could not determine changed score files", file=sys.stderr)
        raise SystemExit(1)
    return [line for line in result.stdout.splitlines() if line]


def main() -> int:
    base = os.environ.get("PR_BASE_SHA", "")
    head = os.environ.get("PR_HEAD_SHA", "")
    body = os.environ.get("PR_BODY", "")
    if not re.fullmatch(r"[0-9a-f]{40}", base) or not re.fullmatch(r"[0-9a-f]{40}", head):
        print("error: invalid pull-request commit binding", file=sys.stderr)
        return 1
    if not changed_paths(base, head):
        print("no score files changed")
        return 0

    source = re.search(r"(?m)^Source: https://\S+\s*$", body)
    agent = (
        re.search(r"(?m)^Step: [1-3]/3\s*$", body)
        and re.search(r"(?m)^Model: (?!provider/exact-model-id\s*$).+\S\s*$", body)
    )
    human = (
        re.search(r"(?m)^Review: human\s*$", body)
        and re.search(r"(?m)^Proofreader: @(?!github-username\s*$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\s*$", body)
    )
    if not source or not (agent or human):
        print("error: score pull request needs Source and either Step/Model or Review/Proofreader annotations", file=sys.stderr)
        return 1
    print("pull-request score provenance is present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
