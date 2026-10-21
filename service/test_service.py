"""Real HTTP + durable SQLite regression tests. All music/files are simulated."""
import base64
from concurrent.futures import ThreadPoolExecutor
import copy
import io
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import socket
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import uuid
import zipfile

from opus_service import Store, Problem, create_server, digest, package, read_zip, strict_json

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9B0AAAAASUVORK5CYII=")


def simulated_pdf(label, width=400):
    """A valid text-only PDF; never a score or evidence of musical correction."""
    stream = f"BT /F1 12 Tf 20 40 Td ({label}) Tj ET".encode()
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>", f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".encode(), b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", b"<< /Length "+str(len(stream)).encode()+b" >>\nstream\n"+stream+b"\nendstream"]
    output, offsets = bytearray(b"%PDF-1.4\n"), [0]
    for n, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{n} 0 obj\n".encode()+obj+b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    output.extend(b"".join(f"{position:010} 00000 n \n".encode() for position in offsets[1:]))
    output.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(output)


def make_zip(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for path, data in files.items():
            archive.writestr(path, data)
    return output.getvalue()


def json_bytes(value):
    return (json.dumps(value, indent=2)+"\n").encode()


def encoded(data):
    return base64.b64encode(data).decode()


class SharedServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="opus-shared-isolated-")
        self.root = Path(self.temp.name)
        self.repo, self.site = self.root / "repo", self.root / "site"
        self.repo.mkdir()
        self.slug = "simulated-review-only-fixture"
        self.piece = self.repo / "pieces" / self.slug
        self.piece.mkdir(parents=True)
        self.source = simulated_pdf("SIMULATED printed source; not a musical work")
        self.rendered = simulated_pdf("SIMULATED baseline rendering; not a musical work")
        self.code = b'% SIMULATED AI FIXTURE: no musical correction or human verification\n\\version "2.24.3"\n{ R1 }\n'
        self.metadata = {"slug": self.slug, "title": "SIMULATED review fixture", "composer": "Test fixture", "step": 3, "models": ["simulation", "simulation", "simulation"], "verified_by": None, "source_pdf": "https://example.org/simulated.pdf", "source_page": "https://example.org/simulated", "source_sha256": digest(self.source), "source_library": "Simulated fixture", "source_id": "SIMULATED-ONLY"}
        (self.piece / "metadata.json").write_text(json.dumps(self.metadata), encoding="utf-8")
        (self.piece / "score.ly").write_bytes(self.code)
        self.render_path = self.site / "pieces" / self.slug / "score.pdf"
        self.render_path.parent.mkdir(parents=True)
        self.render_path.write_bytes(self.rendered)
        self.git("init", "-b", "main")
        self.commit("SIMULATED baseline")
        self.store = Store(self.root / "private-data", self.repo, self.site)
        self.server = create_server(self.store, port=0, origins=["http://127.0.0.1:9901"], dev_auth=True, maintainer_ids=["dev:david"], verifier_ids=["dev:verifier"])
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.tokens = {}
        for login in ("alice", "bob", "carol", "david", "eve", "verifier"):
            self.tokens[login] = self.request("POST", "/auth/dev", {"login": login})[1]["token"]
        self.request("POST", f"/api/works/{self.slug}/assets/source", self.source, "alice", binary=True)
        self.current = self.request("GET", f"/api/works/{self.slug}")[1]["current"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(["git", "-c", "user.name=SIMULATED test", "-c", "user.email=simulation@example.invalid", *args], cwd=self.repo, stderr=subprocess.DEVNULL).decode().strip()

    def commit(self, title):
        self.git("add", "pieces")
        self.git("commit", "-m", title)

    def request(self, method, path, body=None, user=None, binary=False, token=None):
        headers = {"Origin": "http://127.0.0.1:9901"}
        if token or user:
            headers["Authorization"] = "Bearer "+(token or self.tokens[user])
        data = body if binary else json_bytes(body) if body is not None else None
        if data is not None:
            headers["Content-Type"] = "application/pdf" if binary else "application/json"
        request = urllib.request.Request(self.base+path, data=data, method=method, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            value = json.loads(raw) if raw and response.headers.get("Content-Type", "").startswith("application/json") else raw
            return response.status, value

    def review(self, count=1, current=None, prefix="finding", width=400):
        current = current or self.current
        files = {role: {k: current["files"][role][k] for k in ("name", "size", "sha256")} for role in ("source", "rendered", "ly")}
        findings = []
        for index in range(count):
            stroke = [] if index % 2 == 0 else [{"width": 6, "color": "#ffd34d", "opacity": .35, "points": [[50, 50], [80, 50]]}]
            findings.append({"id": f"{prefix}-{index}", "number": index+1, "page": 1, "comment": f"SIMULATED finding {index}; check printed context", "state": "open", "color": "#ffd34d", "strokes": stroke, "bounds": [47, 47, 83, 53] if stroke else None})
        return {"schema": "score-desk-review", "version": 2, "snapshotId": current["snapshotId"], "files": files, "relationship": "user-supplied; not established by compilation", "coordinates": "pdf-user-space; unrotated; crop-box offsets retained; 1-based pages", "pages": [{"page": 1, "view": [0, 0, width, 500], "rotation": 0, "userUnit": 1}], "createdAt": "2026-10-21T00:00:00Z", "updatedAt": "2026-10-21T00:00:00Z", "findings": findings, "nextNumber": count+1, "preferences": {"color": "#ffd34d", "autoColor": False, "colorCursor": 0}, "coverage": "Not declared; no verification is claimed."}

    def report_body(self, count=1, **kwargs):
        clean = kwargs.pop("clean", False)
        kind = kwargs.pop("kind", "partial" if clean else "report")
        return {"requestId": str(uuid.uuid4()), "review": self.review(count, **kwargs), "scope": {"kind": kind, "description": "SIMULATED page 1 only"}, "clean": clean, "displayName": "Optional typed label, not account identity"}

    def report(self, user="alice", count=1, **kwargs):
        status, record = self.request("POST", f"/api/works/{self.slug}/reports", self.report_body(count, **kwargs), user)
        self.assertEqual(status, 200, record)
        return record

    def task_body(self, snapshot=None):
        snapshot = snapshot or self.request("GET", f"/api/works/{self.slug}/snapshot")[1]
        review = self.review(0, current=snapshot["current"], width=400 if snapshot["current"]["files"]["rendered"]["sha256"] == digest(self.rendered) else 600)
        requests = []
        files = {}
        for role, path in (("source", "source-original.pdf"), ("rendered", "rendered-original.pdf"), ("ly", "lilypond/supplied.ly")):
            files[path] = self.store.blob(snapshot["current"]["files"][role]["sha256"])[0]
        for index, finding in enumerate(snapshot["findings"], 1):
            current = finding["reviewed"]["snapshotId"] == review["snapshotId"]
            annotation = {**finding["annotation"], "id": finding["id"], "number": index, "state": "needs_source_clarification" if finding["kind"] != "transcription" else "open"}
            if current:
                review["findings"].append(annotation)
            context = {"page": finding["annotation"]["page"], "renderSha256": finding["reviewed"]["renderSha256"], "marked": f"context/{finding['id']}-marked.png", "clean": f"context/{finding['id']}-clean.png"}
            files[context["marked"]] = PNG
            files[context["clean"]] = PNG
            if not current:
                context["originalFiles"] = {}
                for role, field in (("source", "sourceSha256"), ("rendered", "renderSha256"), ("ly", "codeSha256")):
                    sha = finding["reviewed"][field]
                    path = "historical/"+sha+(".ly" if role == "ly" else ".pdf")
                    files[path] = self.store.blob(sha)[0]
                    context["originalFiles"][role] = {"path": path, "sha256": sha, "size": len(files[path])}
                report = self.store.get_record("report", finding["reportId"])
                original = package(self.store.blob(report["packageSha256"])[0])[1]
                context["annotations"] = f"historical/{finding['reportId']}.json"
                files[context["annotations"]] = json_bytes(original)
            requests.append({"id": finding["id"], "number": index, "version": finding["version"], "author": finding["author"], "reportId": finding["reportId"], "comment": finding["comment"], "kind": finding["kind"], "page": annotation["page"] if current else None, "origin": {"reviewed": finding["reviewed"]}, "currentAnchor": {"findingId": finding["id"], "page": annotation["page"], "bounds": annotation["bounds"], "comment": annotation["comment"]} if current else None, "historicalContext": context})
        review["nextNumber"] = len(requests)+1
        files["annotations.json"] = json_bytes(review)
        task_id = str(uuid.uuid4())
        baseline = {"snapshotId": review["snapshotId"], "sourceSha256": review["files"]["source"]["sha256"], "codeSha256": review["files"]["ly"]["sha256"], "renderSha256": review["files"]["rendered"]["sha256"], "annotationSha256": digest(files["annotations.json"])}
        task = {"schema": "score-desk-task", "version": 2, "id": task_id, "kind": "correction-existing-transcription", "baseline": baseline, "findings": requests, "shared": {"schema": "score-desk-shared-task", "version": 1, "snapshotId": snapshot["id"], "workId": self.slug, "revision": snapshot["revision"], "findingVersions": [{"id": f["id"], "version": f["version"]} for f in snapshot["findings"]], "snapshotPath": "shared/snapshot.json"}}
        files["task.json"] = json_bytes(task)
        files["shared/snapshot.json"] = json_bytes(snapshot)
        manifest = {"schema": "score-desk-package", "version": 1, "snapshotId": review["snapshotId"], "inputs": review["files"], "relationship": "user-supplied; not established by compilation", "taskId": task_id, "payloads": {p: {"size": len(b), "sha256": digest(b)} for p, b in files.items()}}
        files["manifest.json"] = json_bytes(manifest)
        return {"requestId": task_id, "snapshotId": snapshot["id"], "package": encoded(make_zip(files))}

    def task(self, snapshot=None):
        status, task = self.request("POST", "/api/tasks", self.task_body(snapshot), "bob")
        self.assertEqual(status, 200, task)
        return task

    def response_body(self, task, changed=False, variant="one", pending=False):
        files = {}
        code = {"status": "changed" if changed else "unchanged", "path": "proposed.ly" if changed else None}
        rendering = {"status": "supplied" if changed and not pending else "pending", "path": "proposed.pdf" if changed and not pending else None, "producer": "SIMULATED response; not a compilation", "compiler": None}
        if changed:
            files["proposed.ly"] = self.code+f"% SIMULATED candidate {variant}\n".encode()
            if not pending:
                files["proposed.pdf"] = simulated_pdf("SIMULATED candidate "+variant, 600)
        response = {"schema": "score-desk-response", "version": 1, "taskId": task["id"], "baseline": task["baseline"], "code": code, "rendering": rendering, "files": {p: {"sha256": digest(b), "size": len(b)} for p, b in files.items()}, "results": [{"id": f["id"], "status": "changed" if changed else "unchanged_with_reason", "explanation": "SIMULATED response "+variant+"; not an actual musical correction."} for f in task["task"]["findings"]]}
        files["response.json"] = json_bytes(response)
        return {"requestId": str(uuid.uuid4()), "package": encoded(make_zip(files))}

    def proposal(self, task, **kwargs):
        status, proposal = self.request("POST", "/api/proposals", self.response_body(task, **kwargs), "bob")
        self.assertEqual(status, 200, proposal)
        return proposal

    def decision_body(self, finding, version=0, state="looks_correct"):
        return {"requestId": str(uuid.uuid4()), "findingId": finding, "state": state, "explanation": "SIMULATED review decision; no human verification", "expectedVersion": version}

    def test_cross_person_handoff_and_atomic_snapshot(self):
        alice = self.report(count=2)
        eve = self.report("eve", prefix="eve")
        snapshot = self.request("GET", f"/api/works/{self.slug}/snapshot")[1]
        self.report("carol", prefix="during-task")
        task = self.task(snapshot)
        self.assertEqual(len(task["task"]["findings"]), 3)
        self.assertEqual({f["author"]["login"] for f in task["task"]["findings"]}, {"alice", "eve"})
        proposal = self.proposal(task, changed=True)
        # Carol's fresh API session retrieves original task without Bob's browser.
        self.assertEqual(self.request("GET", task["packageUrl"], user="carol")[0], 200)
        detail = self.request("GET", f"/api/proposals/{proposal['id']}", user="carol")[1]
        self.assertEqual(detail["status"], "awaiting_review")
        first = alice["findings"][0]["id"]
        status, decision = self.request("POST", f"/api/proposals/{proposal['id']}/decisions", self.decision_body(first), "david")
        self.assertEqual(status, 200, decision)
        self.assertEqual(len(self.request("GET", f"/api/works/{self.slug}/snapshot")[1]["findings"]), 4)
        # Review approval alone never changes the published/current finding state.
        candidate_code = self.store.blob(proposal["candidate"]["codeSha256"])[0]
        candidate_render = self.store.blob(proposal["candidate"]["renderSha256"])[0]
        (self.piece / "score.ly").write_bytes(candidate_code)
        self.render_path.write_bytes(candidate_render)
        self.commit("SIMULATED approved candidate application")
        body = {"requestId": str(uuid.uuid4()), "proposalId": proposal["id"], "findingIds": [first], "repositoryRevision": self.git("rev-parse", "HEAD"), "pullRequest": "https://github.com/example/project/pull/1"}
        status, application = self.request("POST", f"/api/works/{self.slug}/applications", body, "david")
        self.assertEqual(status, 200, application)
        later = self.request("GET", f"/api/works/{self.slug}/snapshot")[1]
        self.assertEqual(len(later["findings"]), 3)
        self.assertNotIn(first, {f["id"] for f in later["findings"]})
        self.assertIn(eve["findings"][0]["id"], {f["id"] for f in later["findings"]})
        next_task = self.task(later)
        self.assertTrue(all(f["page"] is None for f in next_task["task"]["findings"]))
        self.assertTrue(all(f["historicalContext"]["originalFiles"] for f in next_task["task"]["findings"]))

    def test_single_text_report_and_durable_receipt(self):
        report = self.report()
        self.assertEqual(report["author"]["id"], "dev:alice")
        self.assertNotEqual(report["displayName"], report["author"]["login"])
        self.assertFalse(report["findings"][0]["annotation"]["strokes"])
        reopened = Store(self.root / "private-data", self.repo, self.site)
        self.assertEqual(reopened.get_record("report", report["id"]), report)
        manifest, review, files = package(reopened.blob(report["packageSha256"])[0])
        self.assertEqual(review["findings"][0]["comment"], report["findings"][0]["comment"])

    def test_explicit_partial_and_whole_clean_reviews_keep_other_findings(self):
        self.report()
        for kind in ("partial", "whole"):
            report = self.report("carol", 0, clean=True, kind=kind)
            self.assertTrue(report["clean"])
            self.assertEqual(report["reviewed"]["files"]["ly"]["sha256"], digest(self.code))
            self.assertEqual(report["verification"], "Not verified")
        invalid = self.report_body(0)
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/reports", invalid, "carol")[0], 400)
        self.assertEqual(len(self.request("GET", f"/api/works/{self.slug}/snapshot")[1]["findings"]), 1)

    def test_idempotency_retry_new_key_and_concurrent_reports(self):
        body = self.report_body()
        results = list(ThreadPoolExecutor(2).map(lambda _: self.request("POST", f"/api/works/{self.slug}/reports", body, "alice"), range(2)))
        self.assertTrue(all(status == 200 for status, _ in results), results)
        self.assertEqual(results[0][1]["id"], results[1][1]["id"])
        body["requestId"] = str(uuid.uuid4())
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/reports", body, "alice")[1]["id"], results[0][1]["id"])
        body["review"]["findings"][0]["comment"] = "Changed immutable report"
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/reports", body, "alice")[0], 409)
        statuses = list(ThreadPoolExecutor(2).map(lambda name: self.request("POST", f"/api/works/{self.slug}/reports", self.report_body(prefix=name), name)[0], ("bob", "carol")))
        self.assertEqual(statuses, [200, 200])
        self.assertEqual(len(self.store.work(self.slug)["findings"]), 3)

    def test_repeated_report_can_add_new_findings_without_duplicate_old_ones(self):
        old = self.report()
        new = self.report(count=2)
        self.assertEqual(len(new["findings"]), 1)
        self.assertNotEqual(new["findings"][0]["id"], old["findings"][0]["id"])
        self.assertEqual(len(self.store.work(self.slug)["findings"]), 2)

    def test_new_coverage_references_prior_findings_without_losing_review(self):
        old = self.report()
        whole = self.report(kind="whole")
        self.assertNotEqual(old["id"], whole["id"])
        self.assertEqual(whole["scope"]["kind"], "whole")
        self.assertFalse(whole["clean"])
        self.assertEqual(whole["findings"], [])
        self.assertEqual(whole["referencedFindingIds"], [old["findings"][0]["id"]])
        self.assertEqual(len(self.store.work(self.slug)["findings"]), 1)
        self.assertEqual(self.report(kind="whole")["id"], whole["id"])

    def test_competing_decisions_proposals_and_self_approval(self):
        report = self.report(count=2)
        task = self.task()
        first = self.proposal(task, changed=True)
        second = self.proposal(task, changed=True, variant="two")
        self.assertNotEqual(first["id"], second["id"])
        ident = report["findings"][0]["id"]
        url = f"/api/proposals/{first['id']}/decisions"
        self.assertEqual(self.request("POST", url, self.decision_body(ident), "bob")[0], 403)
        results = list(ThreadPoolExecutor(2).map(lambda name: self.request("POST", url, self.decision_body(ident), name)[0], ("carol", "david")))
        self.assertEqual(sorted(results), [200, 409])
        detail = self.request("GET", f"/api/proposals/{first['id']}")[1]
        self.assertEqual(detail["findings"][0]["decisionVersion"], 1)
        self.assertEqual(detail["findings"][1]["decisionVersion"], 0)
        self.assertEqual(self.request("GET", f"/api/proposals/{second['id']}")[1]["findings"][0]["decisionVersion"], 0)
        changed = self.decision_body(ident, 1, "needs_clarification")
        self.assertEqual(self.request("POST", url, changed, "david")[0], 200)
        self.assertEqual(self.request("GET", f"/api/proposals/{first['id']}")[1]["findings"][0]["decisionVersion"], 2)

    def test_correction_locations_are_revision_bound_durable_and_not_decisions(self):
        report = self.report(count=2)
        task = self.task()
        first = self.proposal(task, changed=True)
        second = self.proposal(task, changed=True, variant="locations-two")
        ident = report["findings"][0]["id"]
        url = f"/api/proposals/{first['id']}/locations"
        body = {"requestId": str(uuid.uuid4()), "findingId": ident, "position": {"page": 1, "point": [83.25, 140], "zoom": 2}, "expectedVersion": 0, "candidate": {k: first["candidate"][k] for k in ("snapshotId", "codeSha256", "renderSha256")}}
        self.assertEqual(self.request("POST", url, body)[0], 401)
        status, location = self.request("POST", url, body, "carol")
        self.assertEqual(status, 200, location)
        self.assertEqual(self.request("POST", url, body, "carol")[1]["id"], location["id"])
        stale = {**body, "requestId": str(uuid.uuid4())}
        self.assertEqual(self.request("POST", url, stale, "david")[0], 409)
        fresh = self.request("GET", f"/api/proposals/{first['id']}")[1]
        self.assertEqual(fresh["findings"][0]["location"]["position"], body["position"])
        self.assertEqual(fresh["findings"][0]["locationVersion"], 1)
        self.assertTrue(all(not f["decision"] for f in fresh["findings"]))
        self.assertFalse(fresh["applied"])
        other = self.request("GET", f"/api/proposals/{second['id']}")[1]
        self.assertTrue(all(f["location"] is None for f in other["findings"]))
        self.assertEqual(self.request("POST", f"/api/proposals/{second['id']}/locations", stale, "carol")[0], 409)
        reopened = Store(self.root / "private-data", self.repo, self.site)
        self.assertEqual(reopened.get_record("proposal", first["id"])["findings"][0]["location"]["id"], location["id"])
        invalid = {**body, "requestId": str(uuid.uuid4()), "expectedVersion": 1, "position": {"page": 0, "point": [0, 0], "zoom": 1}}
        self.assertEqual(self.request("POST", url, invalid, "carol")[0], 400)
        pending = self.proposal(task, changed=True, pending=True)
        self.assertEqual(self.request("POST", f"/api/proposals/{pending['id']}/locations", stale, "carol")[0], 409)

    def test_response_import_deduplication_and_stale_retention(self):
        self.report()
        task = self.task()
        body = self.response_body(task, changed=True)
        first = self.request("POST", "/api/proposals", body, "bob")[1]
        body["requestId"] = str(uuid.uuid4())
        second = self.request("POST", "/api/proposals", body, "carol")[1]
        self.assertEqual(first["id"], second["id"])
        (self.piece / "score.ly").write_bytes(self.code+b"% SIMULATED newer current revision\n")
        self.commit("SIMULATED newer current")
        self.assertTrue(self.request("GET", f"/api/proposals/{first['id']}")[1]["stale"])
        self.assertEqual((self.piece / "score.ly").read_bytes(), self.code+b"% SIMULATED newer current revision\n")

    def test_auth_authorization_and_identity_cannot_be_spoofed(self):
        body = self.report_body()
        path = f"/api/works/{self.slug}/reports"
        self.assertEqual(self.request("POST", path, body)[0], 401)
        self.assertEqual(self.request("POST", path, body, token="forged-token")[0], 401)
        body["author"] = {"id": "dev:david", "roles": ["maintainer"]}
        self.assertEqual(self.request("POST", path, body, "alice")[0], 403)
        del body["author"]
        body["verified_by"] = "alice"
        self.assertEqual(self.request("POST", path, body, "alice")[0], 403)
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/verification", {}, "alice")[0], 403)
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/verification", {}, "verifier")[0], 409)
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/applications", {}, "alice")[0], 403)
        report = self.report()
        self.assertEqual(self.request("PATCH", report["url"], {"comment": "edit other report"}, "bob")[0], 405)
        self.assertEqual(self.request("POST", "/auth/logout", {}, "alice")[0], 200)
        self.assertEqual(self.request("POST", path, self.report_body(prefix="after-logout"), "alice")[0], 401)

    def test_missing_tampered_task_and_invalid_response_are_rejected(self):
        self.report()
        body = self.task_body()
        payloads = read_zip(base64.b64decode(body["package"]))
        task = strict_json(payloads["task.json"])
        task["baseline"]["codeSha256"] = "0"*64
        payloads["task.json"] = json_bytes(task)
        body["package"] = encoded(make_zip(payloads))
        self.assertEqual(self.request("POST", "/api/tasks", body, "bob")[0], 400)
        task = self.task()
        body = self.response_body(task)
        payloads = read_zip(base64.b64decode(body["package"]))
        response = strict_json(payloads["response.json"])
        response["baseline"]["snapshotId"] = "0"*64
        payloads["response.json"] = json_bytes(response)
        body["package"] = encoded(make_zip(payloads))
        self.assertEqual(self.request("POST", "/api/proposals", body, "bob")[0], 400)
        response["taskId"] = "missing-task"
        payloads["response.json"] = json_bytes(response)
        body["package"] = encoded(make_zip(payloads))
        self.assertEqual(self.request("POST", "/api/proposals", body, "bob")[0], 404)

    def test_snapshot_history_and_finding_authorship_cannot_be_tampered(self):
        self.report()
        body = self.task_body()
        payloads = read_zip(base64.b64decode(body["package"]))
        snapshot = strict_json(payloads["shared/snapshot.json"])
        snapshot["findings"][0]["author"]["login"] = "Forged attribution"
        payloads["shared/snapshot.json"] = json_bytes(snapshot)
        manifest = strict_json(payloads["manifest.json"])
        manifest["payloads"]["shared/snapshot.json"] = {"size": len(payloads["shared/snapshot.json"]), "sha256": digest(payloads["shared/snapshot.json"])}
        payloads["manifest.json"] = json_bytes(manifest)
        body["package"] = encoded(make_zip(payloads))
        self.assertEqual(self.request("POST", "/api/tasks", body, "bob")[0], 400)

    def test_changed_code_without_rendering_cannot_be_approved(self):
        finding = self.report()["findings"][0]["id"]
        proposal = self.proposal(self.task(), changed=True, pending=True)
        self.assertEqual(self.request("POST", f"/api/proposals/{proposal['id']}/decisions", self.decision_body(finding), "david")[0], 409)

    def test_another_person_attaches_pdf_with_durable_idempotent_child_receipt(self):
        finding = self.report()["findings"][0]["id"]
        parent = self.proposal(self.task(), changed=True, pending=True)
        parent_package = self.request("GET", parent["packageUrl"])[1]
        self.assertIsNone(parent["candidateCurrent"])
        self.assertEqual(self.request("POST", f"/api/proposals/{parent['id']}/decisions", self.decision_body(finding, state="needs_correction"), "eve")[0], 200)
        path = f"/api/proposals/{parent['id']}/renderings"
        pdf = simulated_pdf("SIMULATED separately supplied PDF", 600)
        body = {"requestId": str(uuid.uuid4()), "mode": "uploaded", "pdf": encoded(pdf), "name": "Separate révision.PDF", "producer": "Carol supplied this SIMULATED fixture", "compiler": "No compilation: text fixture only"}
        self.assertEqual(self.request("POST", path, body)[0], 401)
        self.assertEqual(self.request("POST", path, {**body, "pdf": "broken upload"}, "carol")[0], 400)
        self.assertEqual(self.request("POST", path, {**body, "pdf": encoded(b"%PDF-1.7\ntruncated")}, "carol")[0], 400)
        self.assertEqual(self.request("POST", path, {**body, "expectedCodeSha256": "0"*64}, "carol")[0], 409)
        self.assertEqual(self.request("POST", path, {**body, "author": {"id": "dev:bob"}}, "carol")[0], 403)
        results = list(ThreadPoolExecutor(2).map(lambda _: self.request("POST", path, body, "carol"), range(2)))
        self.assertEqual([status for status, _ in results], [200, 200], results)
        child = results[0][1]
        self.assertEqual(results[1][1]["id"], child["id"])
        self.assertNotEqual(child["id"], parent["id"])
        self.assertEqual(child["parentProposalId"], parent["id"])
        self.assertEqual(child["rootProposalId"], parent["id"])
        self.assertEqual(child["renderingRevision"], 2)
        self.assertEqual(child["author"]["id"], "dev:carol")
        self.assertEqual(child["codeAuthor"]["id"], "dev:bob")
        self.assertEqual(child["renderingProvenance"]["originalFilename"], body["name"])
        self.assertEqual(child["candidate"]["codeSha256"], parent["candidate"]["codeSha256"])
        self.assertEqual(child["candidate"]["renderSha256"], digest(pdf))
        self.assertFalse(child["candidate"]["compilationVerified"])
        self.assertEqual(self.request("GET", parent["packageUrl"])[1], parent_package)
        detail = self.request("GET", f"/api/proposals/{child['id']}")[1]
        self.assertEqual(detail["findings"][0]["decisionVersion"], 0)
        self.assertEqual(detail["candidateCurrent"]["origin"]["proposalId"], child["id"])
        self.assertEqual(self.request("GET", detail["candidateCurrent"]["files"]["rendered"]["url"])[1], pdf)
        for person in ("bob", "carol"):
            self.assertEqual(self.request("POST", f"/api/proposals/{child['id']}/decisions", self.decision_body(finding), person)[0], 403)
        self.assertEqual(self.request("POST", f"/api/proposals/{child['id']}/decisions", self.decision_body(finding), "eve")[0], 200)
        # A lost acknowledgement, new browser session and new retry ID still
        # find the retained revision rather than creating fresh voting records.
        self.tokens["carol"] = self.request("POST", "/auth/dev", {"login": "carol"})[1]["token"]
        retry = self.request("POST", path, {**body, "requestId": str(uuid.uuid4())}, "carol")[1]
        self.assertEqual(retry["id"], child["id"])
        reopened = Store(self.root / "private-data", self.repo, self.site)
        self.assertEqual(reopened.get_record("proposal", child["id"])["findings"][0]["decisionVersion"], 1)
        returned = read_zip(reopened.blob(child["packageSha256"])[0])
        response = strict_json(returned["response.json"])
        self.assertEqual(response["baseline"], parent["response"]["baseline"])
        self.assertEqual(response["results"], parent["response"]["results"])
        self.assertEqual(digest(returned[response["code"]["path"]]), parent["candidate"]["codeSha256"])
        self.assertEqual(returned[response["rendering"]["path"]], pdf)

    def test_canonical_rebuild_requires_fresh_review_and_reports_partial_application(self):
        report = self.report(count=2)
        ids = [f["id"] for f in report["findings"]]
        parent = self.proposal(self.task(), changed=True)
        for ident in ids:
            self.assertEqual(self.request("POST", f"/api/proposals/{parent['id']}/decisions", self.decision_body(ident), "carol")[0], 200)
        (self.piece / "score.ly").write_bytes(self.store.blob(parent["candidate"]["codeSha256"])[0])
        self.commit("SIMULATED merged exact candidate code")
        rebuilt = simulated_pdf("SIMULATED canonical rebuild with distinct PDF bytes", 600)
        self.render_path.write_bytes(rebuilt)
        commit = self.git("rev-parse", "HEAD")
        application = {"requestId": str(uuid.uuid4()), "proposalId": parent["id"], "findingIds": [ids[0]], "repositoryRevision": commit, "pullRequest": "https://github.com/example/project/pull/9"}
        apply_path = f"/api/works/{self.slug}/applications"
        self.assertEqual(self.request("POST", apply_path, application, "david")[0], 409)
        retain_path = f"/api/proposals/{parent['id']}/renderings"
        capture = {"requestId": str(uuid.uuid4()), "mode": "canonical"}
        self.assertEqual(self.request("POST", retain_path, capture, "carol")[0], 403)
        status, child = self.request("POST", retain_path, capture, "david")
        self.assertEqual(status, 200, child)
        self.assertEqual(child["renderingProvenance"]["repositoryRevision"], commit)
        self.assertEqual(child["candidate"]["canonicalRepositoryRevision"], commit)
        self.assertEqual(child["candidate"]["renderSha256"], digest(rebuilt))
        self.assertIsNone(child["candidateCurrent"]["repositoryRevision"])
        self.assertEqual(child["candidateCurrent"]["origin"]["kind"], "proposal")
        application.update(requestId=str(uuid.uuid4()), proposalId=child["id"])
        self.assertEqual(self.request("POST", apply_path, application, "david")[0], 409)
        self.assertEqual(self.request("POST", f"/api/proposals/{child['id']}/decisions", self.decision_body(ids[0]), "carol")[0], 200)
        status, event = self.request("POST", apply_path, application, "david")
        self.assertEqual(status, 200, event)
        detail = self.request("GET", f"/api/proposals/{child['id']}")[1]
        self.assertEqual((detail["appliedCount"], detail["findingCount"]), (1, 2))
        self.assertEqual(detail["appliedFindingIds"], [ids[0]])
        by_id = {f["id"]: f for f in detail["findings"]}
        self.assertTrue(by_id[ids[0]]["applied"])
        self.assertEqual(by_id[ids[0]]["applications"][0]["id"], event["id"])
        self.assertFalse(by_id[ids[1]]["applied"])
        self.assertIsNone(by_id[ids[1]]["decision"])
        self.assertEqual(self.request("GET", f"/api/proposals/{parent['id']}")[1]["appliedCount"], 0)
        self.assertEqual([f["id"] for f in self.store.snapshot(self.slug)["findings"]], [ids[1]])
        self.assertIsNone(json.loads((self.piece / "metadata.json").read_text())["verified_by"])
        # A later rebuild never borrows this child's approval.
        self.render_path.write_bytes(simulated_pdf("SIMULATED later canonical PDF rebuild", 600))
        application.update(requestId=str(uuid.uuid4()), findingIds=[ids[1]])
        self.assertEqual(self.request("POST", f"/api/proposals/{child['id']}/decisions", self.decision_body(ids[1]), "carol")[0], 200)
        self.assertEqual(self.request("POST", apply_path, application, "david")[0], 409)
        status, later = self.request("POST", f"/api/proposals/{child['id']}/renderings", {"requestId": str(uuid.uuid4()), "mode": "canonical"}, "david")
        self.assertEqual(status, 200, later)
        self.assertEqual(later["renderingRevision"], 3)
        self.assertEqual(self.request("GET", f"/api/proposals/{later['id']}")[1]["findings"][0]["decisionVersion"], 0)
        self.assertEqual(len(self.store.snapshot(self.slug)["findings"]), 1)

    def test_candidate_reports_keep_original_context_in_later_canonical_tasks(self):
        original = self.report()
        proposal = self.proposal(self.task(), changed=True)
        candidate = proposal["candidateCurrent"]
        path = f"/api/works/{self.slug}/reports"
        body = self.report_body(current=candidate, width=600, prefix="candidate-text")
        self.assertEqual(self.request("POST", path, body, "carol")[0], 409)
        body["proposalId"] = proposal["id"]
        status, report = self.request("POST", path, body, "carol")
        self.assertEqual(status, 200, report)
        self.assertEqual(report["reviewed"]["origin"], "candidate")
        self.assertEqual(report["reviewed"]["proposalId"], proposal["id"])
        self.assertIsNone(report["reviewed"]["repositoryRevision"])
        self.assertEqual(report["findings"][0]["reviewed"]["proposalId"], proposal["id"])
        clean_body = self.report_body(0, current=candidate, width=600, clean=True, kind="whole")
        clean_body["proposalId"] = proposal["id"]
        status, clean = self.request("POST", path, clean_body, "eve")
        self.assertEqual(status, 200, clean)
        self.assertTrue(clean["clean"])
        self.assertEqual(clean["scope"]["kind"], "whole")
        self.assertEqual(clean["reviewed"]["origin"], "candidate")
        self.assertEqual(clean["verification"], "Not verified")
        snapshot = self.store.snapshot(self.slug)
        self.assertEqual(snapshot["current"]["snapshotId"], self.current["snapshotId"])
        self.assertEqual({f["id"] for f in snapshot["findings"]}, {original["findings"][0]["id"], report["findings"][0]["id"]})
        task = self.task(snapshot)
        finding = next(f for f in task["task"]["findings"] if f["id"] == report["findings"][0]["id"])
        self.assertIsNone(finding["page"])
        self.assertIsNone(finding["currentAnchor"])
        self.assertEqual(finding["origin"]["reviewed"]["origin"], "candidate")
        self.assertEqual(finding["origin"]["reviewed"]["proposalId"], proposal["id"])
        self.assertEqual(finding["historicalContext"]["originalFiles"]["rendered"]["sha256"], proposal["candidate"]["renderSha256"])
        recovery = package(self.request("GET", f"/api/reports/{report['id']}/package")[1])[1]
        self.assertEqual(recovery["pages"][0]["view"][2], 600)
        self.assertEqual(recovery["files"]["rendered"]["sha256"], proposal["candidate"]["renderSha256"])
        self.assertEqual((self.piece / "score.ly").read_bytes(), self.code)

    def test_existing_proposal_gains_candidate_review_without_rewriting_evidence(self):
        self.report()
        proposal = self.proposal(self.task(), changed=True)
        # Simulate a pre-upgrade persisted proposal in this disposable database.
        original = {k: v for k, v in proposal.items() if k not in ("candidateCurrent", "parentProposalId", "rootProposalId", "renderingRevision", "renderingProvenance", "codeAuthor", "responseAuthor")}
        saved_body = json.dumps(original)
        with self.store.db(write=True) as db:
            db.execute("UPDATE records SET body=? WHERE id=?", (saved_body, proposal["id"]))
        saved_package = self.store.blob(proposal["packageSha256"])[0]
        status, reopened = self.request("GET", f"/api/proposals/{proposal['id']}")
        self.assertEqual(status, 200, reopened)
        self.assertEqual(reopened["candidateCurrent"]["snapshotId"], proposal["candidate"]["snapshotId"])
        body = self.report_body(current=reopened["candidateCurrent"], width=600, prefix="legacy-candidate")
        body["proposalId"] = proposal["id"]
        status, report = self.request("POST", f"/api/works/{self.slug}/reports", body, "eve")
        self.assertEqual(status, 200, report)
        self.assertEqual(report["reviewed"]["origin"], "candidate")
        with self.store.db() as db:
            self.assertEqual(db.execute("SELECT body FROM records WHERE id=?", (proposal["id"],)).fetchone()[0], saved_body)
        self.assertEqual(self.request("GET", proposal["packageUrl"])[1], saved_package)

    def test_canonical_capture_rejects_wrong_dirty_or_uncommitted_candidate(self):
        self.report()
        proposal = self.proposal(self.task(), changed=True)
        path = f"/api/proposals/{proposal['id']}/renderings"
        body = {"requestId": str(uuid.uuid4()), "mode": "canonical"}
        self.assertEqual(self.request("POST", path, body, "david")[0], 409)
        (self.piece / "score.ly").write_bytes(self.store.blob(proposal["candidate"]["codeSha256"])[0])
        self.assertEqual(self.request("POST", path, body, "david")[0], 409)
        self.commit("SIMULATED candidate commit")
        self.git("checkout", "-b", "unmerged-fixture")
        self.assertEqual(self.request("POST", path, body, "david")[0], 409)
        self.git("checkout", "main")
        (self.piece / "metadata.json").write_text(json.dumps({**self.metadata, "title": "Dirty fixture"}))
        self.assertEqual(self.request("POST", path, body, "david")[0], 409)

    def test_reused_rendering_cannot_erase_its_supplier_or_reset_its_decisions(self):
        finding = self.report()["findings"][0]["id"]
        parent = self.proposal(self.task(), changed=True, pending=True)
        first_pdf = simulated_pdf("SIMULATED Carol PDF", 600)
        def upload(proposal, user, pdf):
            body = {"requestId": str(uuid.uuid4()), "mode": "uploaded", "pdf": encoded(pdf), "name": "score.pdf", "producer": "SIMULATED "+user}
            status, record = self.request("POST", f"/api/proposals/{proposal['id']}/renderings", body, user)
            self.assertEqual(status, 200, record)
            return record
        first = upload(parent, "carol", first_pdf)
        self.assertEqual(self.request("POST", f"/api/proposals/{first['id']}/decisions", self.decision_body(finding, state="needs_correction"), "david")[0], 200)
        second = upload(first, "eve", simulated_pdf("SIMULATED Eve different PDF", 600))
        self.assertEqual(upload(second, "eve", first_pdf)["id"], first["id"])
        self.assertEqual(upload(parent, "eve", first_pdf)["id"], first["id"])
        self.assertEqual(self.store.get_record("proposal", first["id"])["findings"][0]["decisionVersion"], 1)
        self.assertEqual(self.request("POST", f"/api/proposals/{first['id']}/decisions", self.decision_body(finding, 1), "carol")[0], 403)
        # Capturing the same PDF on a canonical commit requires a fresh review,
        # but still remembers who supplied those exact bytes earlier.
        (self.piece / "score.ly").write_bytes(self.store.blob(parent["candidate"]["codeSha256"])[0])
        self.commit("SIMULATED committed candidate")
        self.render_path.write_bytes(first_pdf)
        status, canonical = self.request("POST", f"/api/proposals/{second['id']}/renderings", {"requestId": str(uuid.uuid4()), "mode": "canonical"}, "david")
        self.assertEqual(status, 200, canonical)
        self.assertNotEqual(canonical["id"], first["id"])
        self.assertEqual({u["id"] for u in canonical["renderingContributors"]}, {"dev:carol", "dev:david"})
        self.assertEqual(self.request("POST", f"/api/proposals/{canonical['id']}/decisions", self.decision_body(finding), "carol")[0], 403)
        self.assertEqual(self.request("POST", f"/api/proposals/{canonical['id']}/decisions", self.decision_body(finding), "eve")[0], 200)

    def test_canonical_rendering_approval_is_bound_to_its_retained_commit(self):
        ident = self.report()["findings"][0]["id"]
        parent = self.proposal(self.task(), changed=True)
        (self.piece / "score.ly").write_bytes(self.store.blob(parent["candidate"]["codeSha256"])[0])
        self.commit("SIMULATED committed code")
        self.render_path.write_bytes(simulated_pdf("SIMULATED canonical", 600))
        child = self.request("POST", f"/api/proposals/{parent['id']}/renderings", {"requestId": str(uuid.uuid4()), "mode": "canonical"}, "david")[1]
        self.assertEqual(self.request("POST", f"/api/proposals/{child['id']}/decisions", self.decision_body(ident), "carol")[0], 200)
        self.git("commit", "--allow-empty", "-m", "SIMULATED later publication commit")
        body = {"requestId": str(uuid.uuid4()), "proposalId": child["id"], "findingIds": [ident], "repositoryRevision": self.git("rev-parse", "HEAD"), "pullRequest": "https://github.com/example/project/pull/10"}
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/applications", body, "david")[0], 409)
        newer = self.request("POST", f"/api/proposals/{child['id']}/renderings", {"requestId": str(uuid.uuid4()), "mode": "canonical"}, "david")[1]
        self.assertNotEqual(newer["id"], child["id"])
        self.assertEqual(newer["candidate"]["renderSha256"], child["candidate"]["renderSha256"])
        self.assertEqual(self.store.get_record("proposal", newer["id"])["findings"][0]["decisionVersion"], 0)

    def test_dirty_candidate_and_other_branch_cannot_claim_application(self):
        finding = self.report()["findings"][0]["id"]
        proposal = self.proposal(self.task(), changed=True)
        self.request("POST", f"/api/proposals/{proposal['id']}/decisions", self.decision_body(finding), "david")
        (self.piece / "score.ly").write_bytes(self.store.blob(proposal["candidate"]["codeSha256"])[0])
        self.render_path.write_bytes(self.store.blob(proposal["candidate"]["renderSha256"])[0])
        self.git("commit", "--allow-empty", "-m", "Unrelated SIMULATED commit")
        body = {"requestId": str(uuid.uuid4()), "proposalId": proposal["id"], "findingIds": [finding], "repositoryRevision": self.git("rev-parse", "HEAD"), "pullRequest": "https://github.com/example/project/pull/1"}
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/applications", body, "david")[0], 409)

    def test_dirty_metadata_cannot_claim_canonical_application(self):
        finding = self.report()["findings"][0]["id"]
        proposal = self.proposal(self.task(), changed=True)
        self.request("POST", f"/api/proposals/{proposal['id']}/decisions", self.decision_body(finding), "david")
        (self.piece / "score.ly").write_bytes(self.store.blob(proposal["candidate"]["codeSha256"])[0])
        self.render_path.write_bytes(self.store.blob(proposal["candidate"]["renderSha256"])[0])
        self.commit("SIMULATED committed candidate")
        changed = {**self.metadata, "title": "Uncommitted metadata"}
        (self.piece / "metadata.json").write_text(json.dumps(changed), encoding="utf-8")
        self.assertIsNone(self.store.work(self.slug)["current"]["repositoryRevision"])
        body = {"requestId": str(uuid.uuid4()), "proposalId": proposal["id"], "findingIds": [finding], "repositoryRevision": self.git("rev-parse", "HEAD"), "pullRequest": "https://github.com/example/project/pull/1"}
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/applications", body, "david")[0], 409)
        self.git("checkout", "-b", "unmerged-candidate")
        self.commit("SIMULATED unmerged proposal")
        body.update(requestId=str(uuid.uuid4()), repositoryRevision=self.git("rev-parse", "HEAD"))
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/applications", body, "david")[0], 409)

    def test_source_fallback_digest_and_discussion_provenance(self):
        status, error = self.request("POST", f"/api/works/{self.slug}/assets/source", simulated_pdf("Wrong source"), "alice", binary=True)
        self.assertEqual(status, 409)
        self.assertTrue(error["needsSourceUpload"])
        body = self.report_body()
        body["discussion"] = {"url": "https://github.com/example/project/discussions/8#discussioncomment-12", "author": "Original quoted author", "excerpt": "Verbatim historical report context"}
        body["kinds"] = {"finding-0": "source_error"}
        report = self.request("POST", f"/api/works/{self.slug}/reports", body, "alice")[1]
        self.assertEqual(report["author"]["login"], "alice")
        self.assertEqual(report["findings"][0]["kind"], "source_error")
        self.assertIn("not authenticated", report["discussion"]["attribution"])

    def test_all_findings_snapshot_and_work_pagination(self):
        # More than one normal API page; snapshot intentionally includes all.
        self.report(count=57)
        self.assertEqual(len(self.request("GET", f"/api/works/{self.slug}/snapshot")[1]["findings"]), 57)
        second = self.repo / "pieces" / "another-simulated-work"
        second.mkdir()
        (second / "metadata.json").write_text(json.dumps({**self.metadata, "slug": second.name}), encoding="utf-8")
        page = self.request("GET", "/api/works?limit=1")[1]
        self.assertTrue(page["next"].startswith("/api/works?"))
        self.assertEqual(len(self.request("GET", page["next"])[1]["items"]), 1)

    def test_zip_path_duplicate_json_and_development_bind_guards(self):
        for path in ("../escape.txt", "C:/unsafe.txt", "/absolute.txt"):
            with self.assertRaises(Problem):
                read_zip(make_zip({path: b"unsafe"}))
        with self.assertRaises(Problem):
            strict_json(b'{"id":"one","id":"two"}')
        with self.assertRaises(Problem):
            create_server(self.store, host="0.0.0.0", port=0, origins=["http://127.0.0.1:9901"], dev_auth=True)
        with self.assertRaises(Problem):
            create_server(self.store, port=0, origins=["https://public.example"], dev_auth=True)

    def test_pkce_exchange_is_origin_bound_and_single_use(self):
        # Simulate only the server-side result of GitHub's identity lookup.
        # No claim is made that this exercised the live OAuth provider.
        verifier = "v"*64
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        code = "SIMULATED-one-use-exchange-code"
        body = {"origin": "http://127.0.0.1:9901", "challenge": challenge, "user": {"id": "simulated:123", "login": "SIMULATED-OAUTH", "roles": [], "provenance": "simulated-oauth-test"}}
        with self.store.db(write=True) as db:
            db.execute("INSERT INTO oauth VALUES(?,?,?)", ("exchange:"+digest(code.encode()), json.dumps(body), 9999999999))
        self.assertEqual(self.request("POST", "/auth/exchange", {"code": code, "verifier": "x"*64})[0], 401)
        status, session = self.request("POST", "/auth/exchange", {"code": code, "verifier": verifier})
        self.assertEqual(status, 200)
        self.assertEqual(self.request("GET", "/api/session", token=session["token"])[1]["user"]["id"], "simulated:123")
        self.assertEqual(self.request("POST", "/auth/exchange", {"code": code, "verifier": verifier})[0], 401)

    def test_partial_candidate_handoff_is_draft_and_unchanged_is_review_only(self):
        findings = self.report(count=2)["findings"]
        task = self.task()
        proposal = self.proposal(task, changed=True)
        self.request("POST", f"/api/proposals/{proposal['id']}/decisions", self.decision_body(findings[0]["id"]), "david")
        handoff = self.request("GET", f"/api/proposals/{proposal['id']}/handoff")[1]
        self.assertIn("DRAFT", handoff["text"])
        self.assertIn(findings[1]["id"], handoff["text"])
        unchanged = self.proposal(task, changed=False)
        self.request("POST", f"/api/proposals/{unchanged['id']}/decisions", self.decision_body(findings[0]["id"]), "david")
        self.assertIn("review-only", self.request("GET", f"/api/proposals/{unchanged['id']}/handoff")[1]["text"])

    def test_idle_browser_preconnects_do_not_exhaust_active_request_slots(self):
        connections = [socket.create_connection(("127.0.0.1", self.server.server_port), timeout=5) for _ in range(8)]
        try:
            status, health = self.request("GET", "/health")
            self.assertEqual(status, 200, health)
            # Saturating actual work yields a useful HTTP acknowledgement,
            # rather than closing a browser's socket without a response.
            for _ in range(4):
                self.assertTrue(self.server.slots.acquire(timeout=1))
            try:
                status, error = self.request("GET", "/health")
                self.assertEqual(status, 503, error)
                self.assertIn("retry", error["error"])
            finally:
                for _ in range(4):
                    self.server.slots.release()
            self.assertEqual(self.request("GET", "/health")[0], 200)
        finally:
            for connection in connections:
                connection.close()

    def test_response_explicit_null_and_optional_text_match_browser_contract(self):
        self.report()
        task = self.task()
        original = self.response_body(task)
        for mutate in (lambda response: response["code"].pop("path"),
                       lambda response: response["rendering"].pop("path"),
                       lambda response: response["results"][0].update(codeLocation=None)):
            files = read_zip(base64.b64decode(original["package"]))
            response = strict_json(files["response.json"])
            mutate(response)
            files["response.json"] = json_bytes(response)
            body = {"requestId": str(uuid.uuid4()), "package": encoded(make_zip(files))}
            self.assertEqual(self.request("POST", "/api/proposals", body, "bob")[0], 400)
        self.assertEqual(self.request("POST", "/api/proposals", original, "bob")[0], 200)

    def test_invalid_preferences_and_unknown_geometry_cannot_strand_shared_history(self):
        body = self.report_body()
        body["review"]["preferences"]["autoColor"] = "not a boolean"
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/reports", body, "alice")[0], 400)
        body = self.report_body()
        body["review"]["findings"][0]["extraUnsupportedField"] = "would be stripped by the browser"
        self.assertEqual(self.request("POST", f"/api/works/{self.slug}/reports", body, "alice")[0], 400)
        self.assertEqual(self.store.work(self.slug)["findings"], [])

    def test_large_payload_keeps_connection_until_client_reads_all_bytes(self):
        # A real browser exposed resets when successful ZIP responses were
        # forcibly closed immediately after a Windows sendall() returned.
        payload = b"SIMULATED opaque package payload\n" * 40000
        with self.store.db(write=True) as db:
            sha = self.store.put_blob(db, payload, "application/zip")
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=15)
        try:
            for _ in range(3):
                connection.request("GET", "/api/assets/"+sha, headers={"Origin": "http://127.0.0.1:9901"})
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertFalse(response.will_close, "Successful package transfers must allow graceful HTTP reuse")
                self.assertEqual(response.read(), payload)
        finally:
            connection.close()

    def test_read_preflights_do_not_consume_real_write_quota(self):
        with self.server.app.rate_lock:
            self.server.app.rates.clear()
        # Fix the rate-limit minute so a boundary cannot make this flaky.
        with patch("opus_service.time.time", return_value=1800000000):
            for _ in range(150):
                self.assertEqual(self.request("OPTIONS", "/api/tasks/example/package")[0], 204)
            # Actual POST requests still get precisely the configured budget.
            for _ in range(90):
                self.assertEqual(self.request("POST", "/auth/dev", {"login": "quota-test"})[0], 200)
            status, error = self.request("POST", "/auth/dev", {"login": "quota-test"})
            self.assertEqual(status, 429)
            self.assertIn("wait a minute", error["error"])
            self.assertEqual(self.request("GET", "/health")[0], 200)


if __name__ == "__main__":
    unittest.main()
