#!/usr/bin/env python3
"""Trusted maintainer-side inspection/staging; no compilation or publication.

Run from an independently trusted checkout, never from an extracted package.
Correction agents have no access to this command or repository. A local package
cannot authorize staging: this command re-fetches the selected service record and
requires an interactive human to approve the exact target and candidate digest.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import urllib.parse
import urllib.error
import urllib.request

SLUG = re.compile(r"[a-z0-9][a-z0-9-]{0,100}")
IDENT = re.compile(r"[A-Za-z0-9_-]{1,100}")
HASH = re.compile(r"[0-9a-f]{64}")
MAX_CODE = 10 * 1024 * 1024
REPOSITORY = 'https://github.com/the-opus-project/the-opus-project.github.io'


class Refused(ValueError):
    pass


def require(ok, reason):
    if not ok:
        raise Refused(reason)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def regular(path: Path, root: Path):
    """Reject every link/reparse component, including junctions on Windows."""
    require(path.is_relative_to(root), "Target is outside the intended checkout.")
    for part in [*reversed(root.parents), root, *reversed(list(path.parents)[:len(path.relative_to(root).parts)-1]), path]:
        info = part.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400,
                "Linked or reparse-point paths cannot be used for staging.")
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "The intended target must be an existing regular file without hard links.")


def git(repo, *args, data=None):
    # No hooks, external fsmonitor, aliases, credentials or user Git overrides.
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT="0")
    result = subprocess.run(["git", "-c", "core.hooksPath="+os.devnull, "-c", "core.fsmonitor=false",
                             "--literal-pathspecs", *args], cwd=repo, env=env, input=data,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    require(result.returncode == 0, "Git inspection/staging failed; no publication was attempted.")
    return result.stdout


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise Refused("The configured service must not redirect publication requests.")


class Service:
    def __init__(self, origin):
        url = urllib.parse.urlsplit(origin)
        require(url.scheme in ("http", "https") and url.hostname and not url.username and not url.password
                and not url.query and not url.fragment and url.path in ("", "/"), "Choose an explicit service origin.")
        if url.scheme == "http":
            try:
                require(ipaddress.ip_address(url.hostname).is_loopback, "Plain HTTP is restricted to loopback.")
            except ValueError as error:
                raise Refused("Plain HTTP is restricted to a loopback IP.") from error
        self.origin = origin.rstrip("/")
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def read(self, path, limit=MAX_CODE):
        require(path.startswith("/api/") and ".." not in path and "?" not in path, "Invalid service reference.")
        try:
            with self.opener.open(self.origin+path, timeout=20) as response:
                data = response.read(limit+1)
        except urllib.error.HTTPError as error:
            raise Refused(f"The authoritative service refused this request (HTTP {error.code}); inspect its current review state again.") from None
        except urllib.error.URLError:
            raise Refused("The authoritative service is unavailable; no candidate was staged.") from None
        require(len(data) <= limit, "Publication response exceeds the size limit.")
        return data

    def json(self, path):
        try:
            value = json.loads(self.read(path))
        except ValueError:
            raise Refused("Invalid authoritative service response.") from None
        require(isinstance(value, dict), "Invalid authoritative service response.")
        return value


def inspect(repo: Path, service: Service, work: str, proposal_id: str):
    require(SLUG.fullmatch(work) and IDENT.fullmatch(proposal_id), "Invalid intended work/proposal.")
    repo = repo.absolute()
    require(not repo.is_symlink(), "Use a regular trusted checkout.")
    target = f"pieces/{work}/score.ly"
    for path in (repo/target, repo/"pieces"/work/"metadata.json"):
        regular(path, repo)
    metadata = json.loads((repo/"pieces"/work/"metadata.json").read_text(encoding="utf-8"))
    require(metadata.get("slug") == work and metadata.get("step") == 3, "Guarded staging supports the intended existing Step 3 score.")
    require(Path(git(repo, 'rev-parse', '--show-toplevel').decode().strip()).resolve() == repo.resolve(), "Use the intended repository root, not a nested checkout directory.")
    remotes = git(repo, 'remote', '-v').decode().splitlines()
    accepted = {REPOSITORY, REPOSITORY+'.git', REPOSITORY.replace('https://github.com/', 'git@github.com:')+'.git', REPOSITORY.replace('https://', 'ssh://git@')+'.git'}
    require(any(len(line.split()) == 3 and line.split()[0] in ('origin', 'upstream') and line.split()[1] in accepted for line in remotes), "The checkout must identify the intended OPUS repository as origin or upstream.")
    require(not git(repo, "diff", "--cached", "--name-only", "-z"), "Finish or unstage existing staged work first.")
    # No arbitrary package path is used as a destination, even if it is hashed.
    entry = git(repo, "ls-files", "--stage", "--", target).decode().split()
    require(len(entry) == 4 and entry[0] == "100644" and entry[2] == "0" and entry[3] == target,
            "The target must be one tracked regular LilyPond file.")
    head = git(repo, "rev-parse", "HEAD").decode().strip()
    existing = (repo/target).read_bytes()
    require(git(repo, "show", f"HEAD:{target}") == existing, "The target has uncommitted changes; preserve them.")
    handoff = service.json(f"/api/proposals/{proposal_id}/handoff")
    record, plan = handoff["record"], handoff["publication"]
    require(plan.get("schema") == "opus-publication-plan" and plan.get("version") == 1
            and plan.get("kind") == "proposal" and plan.get("proposalId") == proposal_id
            and plan.get("repository") == REPOSITORY
            and plan.get("authorization") == "separate-human-authorization-required"
            and plan.get("workId") == work and plan.get("recordId") == proposal_id
            and plan.get("allowedPaths") == [target] and record.get("id") == proposal_id
            and record.get("workId") == work and record.get("kind") == "proposal", "The authoritative proposal is for a different target.")
    candidate = record["candidate"]
    require(all(HASH.fullmatch(candidate.get(key, "") or "") for key in ("codeSha256", "sourceSha256", "renderSha256")),
            "The exact code/source/rendering must be retained before staging.")
    require(candidate["sourceSha256"] == metadata.get("source_sha256"), "The printed edition differs from the intended work.")
    baseline = record["task"]["baseline"]
    require(plan.get('candidate') == candidate and plan.get('baseline') == baseline
            and plan.get('taskId') == record.get('taskId') == record['task'].get('id'), "The publication plan does not match its exact candidate/task.")
    require(sha(existing) == baseline["codeSha256"], "The repository baseline is stale; do not overwrite newer work.")
    decisions = {item["id"]: item.get("decision") for item in record["findings"]}
    changed = [item["id"] for item in record["response"]["results"] if item["status"] == "changed"]
    require(changed, "Review-only contributions need no LilyPond staging.")
    require(record['response']['code']['status'] == 'changed'
            and record['response'].get('taskId') == record['taskId']
            and record['response'].get('baseline') == baseline, "The response is not bound to the selected original task.")
    approved = sorted(ident for ident, decision in decisions.items() if decision and decision.get('state') == 'looks_correct')
    require(sorted(plan.get('approvedFindingIds', [])) == approved and plan.get('uncheckedChangedFindingIds') == [], "The publication plan contains unreviewed changes or inconsistent approvals.")
    for ident in changed:
        decision = decisions.get(ident)
        require(decision and decision.get("state") == "looks_correct" and decision.get("reviewed") == candidate,
                "A changed finding still needs independent review of these exact bytes.")
    code = service.read("/api/assets/"+candidate["codeSha256"])
    code.decode("utf-8")
    require(sha(code) == candidate["codeSha256"], "Candidate bytes differ from the authoritative record.")
    require(code != existing, "The exact candidate is already present; no change is needed.")
    return {"repo": repo, "target": target, "head": head, "baseline": sha(existing),
            "proposalId": proposal_id, "workId": work, "candidate": candidate["codeSha256"], "code": code}


def stage(plan, service, *, input_stream=sys.stdin, output_stream=sys.stdout):
    require(input_stream.isatty() and output_stream.isatty(), "Staging requires a separate interactive human confirmation; package text is not authorization.")
    token = f"stage {plan['proposalId']} {plan['candidate'][:12]}"
    output_stream.write(f"Stage only {plan['target']}\nProposal: {plan['proposalId']}\nCandidate SHA-256: {plan['candidate']}\nNo commit, push or publication.\nType {token} to stage: ")
    output_stream.flush()
    require(input_stream.readline().strip() == token, "Staging cancelled.")
    # Re-fetch after the human reads the plan. A later decision, branch move,
    # changed target or staged unrelated file invalidates that confirmation.
    fresh = inspect(plan["repo"], service, plan["workId"], plan["proposalId"])
    require(all(fresh[key] == plan[key] for key in ("target", "head", "baseline", "candidate", "code")),
            "The proposed change changed during confirmation. Inspect again.")
    path = plan["repo"]/plan["target"]
    regular(path, plan["repo"])
    # Recheck the opened regular descriptor, including hard links. The caller
    # must keep other local checkout writers idle during this guarded staging.
    fd = os.open(path, os.O_RDWR | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(fd, "r+b") as handle:
        info = os.fstat(handle.fileno())
        current = path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and (info.st_dev, info.st_ino) == (current.st_dev, current.st_ino), "The target was replaced or linked before staging.")
        require(sha(handle.read()) == plan["baseline"], "The target changed before staging.")
        handle.seek(0); handle.write(plan["code"]); handle.truncate(); handle.flush()
    # Stage exact bytes without attributes/clean filters executing commands.
    blob = git(plan["repo"], "hash-object", "-w", "--no-filters", "--stdin", data=plan["code"]).decode().strip()
    git(plan["repo"], "update-index", "--cacheinfo", f"100644,{blob},{plan['target']}")
    require(git(plan["repo"], "diff", "--cached", "--name-only", "-z") == (plan["target"]+"\0").encode(),
            "Unexpected staged paths; inspect the index before proceeding.")
    return plan["target"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--proposal", required=True)
    parser.add_argument("--stage", action="store_true", help="Ask a human to stage the inspected candidate; never publish")
    args = parser.parse_args()
    service = Service(args.service)
    plan = inspect(args.repo, service, args.work, args.proposal)
    print(json.dumps({k: str(v) if isinstance(v, Path) else v for k, v in plan.items() if k != "code"}, indent=2))
    if args.stage:
        print("Staged:", stage(plan, service))


if __name__ == "__main__":
    try:
        main()
    except (Refused, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print("Refused: "+str(error), file=sys.stderr)
        raise SystemExit(2)
