#!/usr/bin/env python3
"""OPUS shared contribution service. Python 3.10+, SQLite; no score execution.

The static application is a client. This database, including immutable package
bytes, is the shared authority. Deploy behind HTTPS; never publish the data dir.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import http.client
import io
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import ssl
import struct
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid
import zipfile
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
MAX_FILE = 100 * 1024 * 1024
MAX_ZIP = 256 * 1024 * 1024
MAX_JSON = 350 * 1024 * 1024  # base64 envelope for an existing bounded ZIP
HASH = re.compile(r"^[a-f0-9]{64}$")
ID = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,100}$")
COLORS = {"#ffd34d", "#65d6a3", "#74b9ff", "#f49ac2", "#b7a2ff"}


class Problem(Exception):
    def __init__(self, message, status=400, **details):
        super().__init__(message)
        self.status, self.details = status, details


def require(condition, message, status=400, **details):
    if not condition:
        raise Problem(message, status, **details)


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def strict_json(data, limit=25 * 1024 * 1024):
    require(len(data) <= limit, "JSON is too large.", 413)

    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result and key != "__proto__", "Duplicate or unsafe JSON key.")
            result[key] = value
        return result

    try:
        if isinstance(data, bytes):
            data = data.decode("utf-8")
        result = json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        def depth(value, level=0):
            require(level <= 60, "JSON nesting is excessive.")
            if isinstance(value, dict):
                for child in value.values():
                    depth(child, level + 1)
            elif isinstance(value, list):
                for child in value:
                    depth(child, level + 1)
        depth(result)
        return result
    except (ValueError, UnicodeError, RecursionError):
        raise Problem("Invalid JSON.") from None


def text(value, label, limit=8000, optional=False):
    require(isinstance(value, str) and len(value) <= limit and (optional or value.strip()), f"Invalid {label}.")
    return value.strip()


def safe_path(value):
    return isinstance(value, str) and len(value) <= 240 and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", value) and not any(p in ("", ".", "..") for p in value.split("/"))


def zip_bytes(encoded):
    require(isinstance(encoded, str) and len(encoded) <= (MAX_ZIP * 4 // 3 + 8), "Missing or oversized ZIP.", 413)
    try:
        data = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise Problem("Invalid package encoding.") from None
    require(22 <= len(data) <= MAX_ZIP, "ZIP exceeds the 256 MiB limit.", 413)
    return data


def read_zip(data):
    """Bounded, in-memory ZIP validation. Nothing imported is extracted/executed."""
    require(22 <= len(data) <= MAX_ZIP, "Invalid or oversized ZIP.", 413)
    # Check EOCD before Python's decoder: prohibit ZIP64, multidisk, overlays.
    end = data.rfind(b"PK\x05\x06", max(0, len(data) - 65557))
    require(end >= 0 and end + 22 <= len(data), "Incomplete ZIP directory.")
    disk, startdisk, count_disk, count, size, offset, comment = struct.unpack_from("<HHHHIIH", data, end + 4)
    require(not disk and not startdisk and count_disk == count and 0 < count <= 5000 and offset + size == end and end + 22 + comment == len(data), "Unsupported ZIP directory.")
    result, seen, ranges, total = {}, set(), [], 0
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            require(len(archive.infolist()) == count, "ZIP directory count differs.")
            for info in archive.infolist():
                path = info.filename[:-1] if info.is_dir() else info.filename
                require(safe_path(path) and path.casefold() not in seen, "Unsafe or duplicate ZIP path.")
                seen.add(path.casefold())
                require(not info.flag_bits & 1 and info.compress_type in (0, 8) and (info.external_attr >> 16) & 0xF000 != 0xA000, "Unsupported ZIP entry.")
                require(info.file_size <= MAX_FILE and info.file_size / max(1, info.compress_size) <= 200, "ZIP entry exceeds size/compression limits.", 413)
                extra_position = 0
                while extra_position < len(info.extra):
                    require(extra_position + 4 <= len(info.extra), "Malformed ZIP extra data.")
                    extra_kind, extra_length = struct.unpack_from("<HH", info.extra, extra_position)
                    require(extra_kind != 1 and extra_position + 4 + extra_length <= len(info.extra), "ZIP64 or malformed ZIP extra data is unsupported.")
                    extra_position += 4 + extra_length
                total += info.file_size
                require(total <= 512 * 1024 * 1024, "ZIP expands beyond 512 MiB.", 413)
                local = info.header_offset
                require(local >= 0 and local + 30 < offset and data[local:local+4] == b"PK\x03\x04", "Invalid local ZIP header.")
                flags, method = struct.unpack_from("<HH", data, local + 6)
                namelen, extra = struct.unpack_from("<HH", data, local + 26)
                start = local + 30 + namelen + extra
                namebytes = data[local+30:local+30+namelen]
                require(namebytes == info.filename.encode("ascii") and flags == info.flag_bits and method == info.compress_type and start + info.compress_size <= offset, "ZIP headers disagree.")
                ranges.append((local, start + info.compress_size))
                if not info.is_dir():
                    with archive.open(info) as stream:
                        payload = stream.read(min(MAX_FILE, info.file_size) + 1)
                    require(len(payload) == info.file_size, "ZIP payload length differs.")
                    result[path] = payload  # zipfile also checks CRC32
            ranges.sort()
            require(all(ranges[i][0] >= ranges[i-1][1] for i in range(1, len(ranges))), "Overlapping ZIP entries.")
    except (zipfile.BadZipFile, EOFError, UnicodeError, RuntimeError, OSError, struct.error, NotImplementedError):
        raise Problem("Damaged or unsupported ZIP.") from None
    return result


def check_payloads(payloads, declarations, root):
    require(isinstance(declarations, dict) and set(declarations) == set(payloads) - {root}, "Missing, undeclared, or unrelated package files.")
    for path, info in declarations.items():
        require(safe_path(path) and isinstance(info, dict) and info.get("size") == len(payloads[path]) and info.get("sha256") == digest(payloads[path]), "Package file hash or size differs: " + str(path))


def package(data):
    payloads = read_zip(data)
    require("manifest.json" in payloads, "Package manifest is missing.")
    manifest = strict_json(payloads["manifest.json"], 2 * 1024 * 1024)
    require(isinstance(manifest, dict) and manifest.get("schema") == "score-desk-package" and manifest.get("version") == 1, "A supported review package is required.")
    require(manifest.get("relationship") == "user-supplied; not established by compilation", "The package PDF/code pairing must remain unverified.")
    require(isinstance(manifest.get("inputs"), dict) and set(manifest["inputs"]) == {"source", "rendered", "ly"}, "Package must identify exactly the three input roles.")
    check_payloads(payloads, manifest.get("payloads"), "manifest.json")
    for role, path in (("source", "source-original.pdf"), ("rendered", "rendered-original.pdf"), ("ly", "lilypond/supplied.ly")):
        info = manifest.get("inputs", {}).get(role, {})
        require(isinstance(info, dict), "Invalid input identity.")
        name = text(info.get("name"), "input filename", 250)
        require(role != "ly" or name.lower().endswith(".ly"), "The source filename must be LilyPond (.ly).")
        require(path in payloads and info.get("sha256") == digest(payloads[path]) and info.get("size") == len(payloads[path]), "Input identity differs: " + role)
        if role != "ly":
            require(payloads[path].startswith(b"%PDF-"), "Input is not a PDF: " + role)
        else:
            try:
                payloads[path].decode("utf-8")
            except UnicodeError:
                raise Problem("LilyPond must be UTF-8.") from None
    expected = digest("\n".join(f"{role}:{manifest['inputs'][role]['sha256']}" for role in ("source", "rendered", "ly")).encode())
    require(manifest.get("snapshotId") == expected, "Package snapshot identity differs.")
    require("annotations.json" in payloads, "Review annotations are missing.")
    review = strict_json(payloads["annotations.json"])
    validate_review(review, manifest["inputs"], expected)
    return manifest, review, payloads


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and abs(value) < 1e15


def validate_review(review, files, snapshot_id):
    require(isinstance(review, dict) and review.get("schema") == "score-desk-review" and review.get("version") in (1, 2), "Unsupported review format.")
    require(review.get("snapshotId") == snapshot_id, "Review snapshot differs.")
    require(review.get("coordinates") == "pdf-user-space; unrotated; crop-box offsets retained; 1-based pages", "Unsupported coordinates.")
    require(review.get("relationship") == "user-supplied; not established by compilation", "PDF/code pairing must remain unverified.")
    require(len(canonical(review).encode()) <= 25 * 1024 * 1024, "Review exceeds the 25 MiB annotation limit.", 413)
    require(set(review).issubset({"schema", "version", "snapshotId", "files", "relationship", "coordinates", "pages", "createdAt", "updatedAt", "nextNumber", "findings", "preferences", "coverage"}), "Unsupported review properties; reopen the package in Score Desk before submitting.")
    preferences = review.get("preferences")
    if preferences is not None:
        require(isinstance(preferences, dict) and preferences.get("color") in COLORS and type(preferences.get("autoColor")) is bool and type(preferences.get("colorCursor")) is int and 0 <= preferences["colorCursor"] < len(COLORS), "Invalid highlight preferences.")
    for role in ("source", "rendered", "ly"):
        info = review.get("files", {}).get(role, {})
        require(info.get("sha256") == files[role]["sha256"] and info.get("size") == files[role]["size"], "Review file identity differs.")
    pages = review.get("pages")
    require(isinstance(pages, list) and 0 < len(pages) <= 5000, "Missing or excessive review geometry.")
    for index, page in enumerate(pages):
        require(isinstance(page, dict) and set(page) == {"page", "view", "rotation", "userUnit"}, "Invalid page geometry properties.")
        view = page.get("view", [])
        require(page.get("page") == index + 1 and len(view) == 4 and all(finite(v) for v in view) and view[2] > view[0] and view[3] > view[1], "Invalid page geometry.")
        require(page["rotation"] in (0, 90, 180, 270) and finite(page["userUnit"]) and 0 < page["userUnit"] <= 75000, "Invalid page rotation or scale.")
    findings = review.get("findings")
    require(isinstance(findings, list) and len(findings) <= 2000, "Invalid findings list.")
    seen, numbers, points = set(), set(), 0
    for finding in findings:
        require(isinstance(finding, dict) and isinstance(finding.get("id"), str) and ID.fullmatch(finding["id"]) and finding["id"] not in seen, "Invalid or duplicate finding identity.")
        require(set(finding).issubset({"id", "number", "page", "comment", "state", "color", "strokes", "bounds"}) and finding.get("state") in ("open", "corrected_pending_review", "resolved", "needs_source_clarification"), "Invalid finding properties or state.")
        seen.add(finding["id"])
        number, page = finding.get("number"), finding.get("page")
        require(type(number) is int and 0 < number <= 99999 and number not in numbers and type(page) is int and 0 < page <= len(pages), "Invalid finding number/page.")
        numbers.add(number)
        text(finding.get("comment"), "finding comment", 4000, True)
        strokes = finding.get("strokes")
        require(isinstance(strokes, list) and len(strokes) <= 5000 and (finding["comment"].strip() or strokes), "A finding needs a comment or highlight.")
        color = finding.get("color", strokes[0].get("color") if strokes else "#ffd34d")
        require(color in COLORS, "Invalid finding color.")
        x0, y0, x1, y1 = pages[page-1]["view"]
        actual = None
        for stroke in strokes:
            require(isinstance(stroke, dict) and set(stroke) == {"width", "color", "opacity", "points"}, "Invalid stroke properties.")
            width = stroke.get("width")
            require(finite(width) and 2 <= width <= 36 and stroke.get("color") == color and stroke.get("opacity") == .35, "Invalid brush.")
            coords = stroke.get("points")
            require(isinstance(coords, list) and coords, "Invalid stroke points.")
            points += len(coords)
            require(points <= 200000, "Too many stroke points.")
            for p in coords:
                require(isinstance(p, list) and len(p) == 2 and all(finite(v) for v in p) and x0 <= p[0] <= x1 and y0 <= p[1] <= y1, "Stroke lies outside its original page.")
                box = [p[0]-width/2, p[1]-width/2, p[0]+width/2, p[1]+width/2]
                actual = box if actual is None else [min(actual[0], box[0]), min(actual[1], box[1]), max(actual[2], box[2]), max(actual[3], box[3])]
        require(finding.get("bounds") == actual, "Finding bounds differ from strokes.")
    require(type(review.get("nextNumber")) is int and max(numbers or {0}) < review["nextNumber"] <= 100000, "Invalid next finding number.")


class Store:
    def __init__(self, data_dir, repo=ROOT, site_root=None):
        self.directory = Path(data_dir).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "opus.sqlite3"
        self.repo, self.site_root = Path(repo).resolve(), Path(site_root or repo).resolve()
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, work TEXT NOT NULL, author TEXT, created TEXT NOT NULL, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS record_work ON records(work,kind,created);
                CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, work TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS blobs(sha TEXT PRIMARY KEY, data BLOB NOT NULL, mime TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS requests(author TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(author,key));
                CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS revisions(work TEXT NOT NULL, snapshot TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(work,snapshot));
                CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY, body TEXT NOT NULL, expires REAL NOT NULL);
            """)

    @contextmanager
    def db(self, write=False):
        conn = sqlite3.connect(self.path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=FULL")
        if write:
            conn.execute("BEGIN IMMEDIATE")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def record(self, db, ident, kind=None):
        row = db.execute("SELECT * FROM records WHERE id=?", (ident,)).fetchone()
        require(row and (kind is None or row["kind"] == kind), "Shared record not found.", 404)
        return json.loads(row["body"])

    def records(self, db, work, kind):
        return [json.loads(row[0]) for row in db.execute("SELECT body FROM records WHERE work=? AND kind=? ORDER BY created,id", (work, kind))]

    def insert(self, db, kind, work, value):
        db.execute("INSERT INTO records VALUES(?,?,?,?,?,?)", (value["id"], kind, work, value.get("author", {}).get("id"), value["createdAt"], canonical(value)))
        db.execute("INSERT INTO events(work,kind,record_id) VALUES(?,?,?)", (work, kind, value["id"]))

    def put_blob(self, db, data, mime="application/octet-stream"):
        sha = digest(data)
        db.execute("INSERT OR IGNORE INTO blobs VALUES(?,?,?)", (sha, data, mime))
        return sha

    def blob(self, sha):
        require(HASH.fullmatch(sha), "Invalid asset identity.")
        with self.db() as db:
            row = db.execute("SELECT data,mime FROM blobs WHERE sha=?", (sha,)).fetchone()
        require(row is not None, "Asset is not available yet.", 404)
        return row[0], row[1]

    def metadata(self, slug):
        require(SLUG.fullmatch(slug), "Invalid work.")
        path = self.repo / "pieces" / slug / "metadata.json"
        require(path.is_file() and not path.is_symlink(), "Work not found.", 404)
        value = json.loads(path.read_text(encoding="utf-8"))
        require(value.get("slug") == slug and HASH.fullmatch(value.get("source_sha256", "")), "Work metadata is incomplete.", 409)
        return value

    def current(self, db, slug):
        metadata = self.metadata(slug)
        step = metadata.get("step", 1)
        path = f"pieces/{slug}/" + ("score.ly" if step >= 3 else f"attempts/{step:02d}.ly")
        files = {}
        for role, source in (("ly", self.repo / path), ("rendered", self.site_root / Path(path).with_suffix(".pdf"))):
            if source.is_file() and not source.is_symlink():
                data = source.read_bytes()
                sha = self.put_blob(db, data, "application/pdf" if role == "rendered" else "text/plain; charset=utf-8")
                files[role] = {"name": source.name, "size": len(data), "sha256": sha, "url": "/api/assets/"+sha, "available": True}
            else:
                files[role] = {"name": source.name, "size": None, "sha256": None, "available": False, "url": None}
        sha = metadata["source_sha256"]
        row = db.execute("SELECT length(data) FROM blobs WHERE sha=?", (sha,)).fetchone()
        files["source"] = {"name": "source-original.pdf", "sha256": sha, "size": row[0] if row else None, "url": "/api/assets/"+sha if row else f"/api/works/{slug}/assets/source", "available": bool(row)}
        snapshot = digest("\n".join(f"{r}:{files[r]['sha256']}" for r in ("source", "rendered", "ly")).encode()) if all(files[r]["sha256"] for r in files) else None
        try:
            revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=self.repo, stderr=subprocess.DEVNULL, text=True, timeout=5).strip()
        except (OSError, subprocess.SubprocessError):
            revision = None
        checkout_revision = revision
        if revision:
            try:
                committed_code = subprocess.check_output(["git", "show", f"HEAD:{path}"], cwd=self.repo, stderr=subprocess.DEVNULL, timeout=10)
                committed_metadata = json.loads(subprocess.check_output(["git", "show", f"HEAD:pieces/{slug}/metadata.json"], cwd=self.repo, stderr=subprocess.DEVNULL, timeout=10))
                if digest(committed_code) != files["ly"]["sha256"] or committed_metadata != metadata:
                    revision = None
            except (OSError, ValueError, subprocess.SubprocessError):
                revision = None
        current = {"snapshotId": snapshot, "files": files, "repositoryRevision": revision, "checkoutRevision": checkout_revision, "step": step, "path": path, "source": {k: metadata.get(k) for k in ("source_pdf", "source_page", "source_library", "source_id", "source_sha256")}, "relationship": "supplier-declared; not established by compilation"}
        if snapshot and all(v["available"] for v in files.values()):
            db.execute("INSERT OR IGNORE INTO revisions VALUES(?,?,?)", (slug, snapshot, canonical(current)))
        return current

    def state(self, db, slug, current=None):
        current = current or self.current(db, slug)
        reports = self.records(db, slug, "report")
        applications = self.records(db, slug, "application")
        resolved = {ident for event in applications for ident in event["findingIds"]}
        findings = [dict(f, state="resolved" if f["id"] in resolved else f["state"]) for report in reports for f in report["findings"]]
        proposals = [self.proposal_view(db, p, current) for p in self.records(db, slug, "proposal")]
        seq = db.execute("SELECT COALESCE(MAX(seq),0) FROM events WHERE work=?", (slug,)).fetchone()[0]
        return {"work": self.metadata(slug), "workId": slug, "current": current, "revision": seq, "reports": reports, "findings": findings, "proposals": proposals, "applications": applications}

    def work(self, slug):
        with self.db(write=True) as db:
            return self.state(db, slug)

    def works(self, after=0, limit=50):
        require(type(after) is int and after >= 0 and 1 <= limit <= 200, "Invalid pagination.")
        paths = sorted((self.repo / "pieces").glob("*/metadata.json"))
        items = []
        with self.db() as db:
            for path in paths[after:after+limit]:
                metadata = self.metadata(path.parent.name)
                reports = self.records(db, metadata["slug"], "report")
                applications = self.records(db, metadata["slug"], "application")
                resolved = {i for a in applications for i in a["findingIds"]}
                items.append({**metadata, "outstanding": sum(f["id"] not in resolved for r in reports for f in r["findings"]), "proposalCount": len(self.records(db, metadata["slug"], "proposal"))})
        return {"items": items, "next": f"/api/works?after={after+limit}&limit={limit}" if after+limit < len(paths) else None}

    def snapshot(self, slug):
        with self.db(write=True) as db:
            state = self.state(db, slug)
            require(all(v["available"] for v in state["current"]["files"].values()), "The exact source, code, and rendering are needed before preparing a correction package. Load the source or upload its library PDF; ask the project operator to build any missing rendering.", 409, needsSourceUpload=not state["current"]["files"]["source"]["available"])
            value = {**state, "id": str(uuid.uuid4()), "createdAt": now(), "assets": state["current"]["files"], "findings": [f for f in state["findings"] if f["state"] != "resolved"]}
            # Capturing a snapshot is not a change to the work revision.
            db.execute("INSERT INTO records VALUES(?,?,?,?,?,?)", (value["id"], "snapshot", slug, None, value["createdAt"], canonical(value)))
            return value

    def idempotent(self, db, user, request, body, operation, namespace):
        key = text(request, "request ID", 100)
        fingerprint = digest(canonical({"operation": namespace, "body": body}).encode())
        row = db.execute("SELECT fingerprint,response FROM requests WHERE author=? AND key=?", (user["id"], key)).fetchone()
        if row:
            require(row[0] == fingerprint, "This retry ID was already used for different content. Keep the existing receipt and submit changed work separately.", 409)
            return json.loads(row[1])
        result = operation()
        db.execute("INSERT INTO requests VALUES(?,?,?,?)", (user["id"], key, fingerprint, canonical(result)))
        return result

    def submit_report(self, slug, body, user):
        require(isinstance(body, dict), "Invalid report.")
        require(not any(key in body for key in ("verified_by", "verifiedBy", "author", "applied", "status")), "Identity, verification, and application are assigned by the service.", 403)
        raw = zip_bytes(body["package"]) if body.get("package") else None
        parsed = package(raw) if raw else None
        review = body.get("review")
        require(isinstance(review, dict), "Missing review.")
        if parsed:
            require(canonical(review) == canonical(parsed[1]), "Report and packaged annotations differ.")
        scope = body.get("scope")
        require(isinstance(scope, dict) and scope.get("kind") in ("report", "partial", "whole"), "Choose report-only, partial, or whole-work coverage.")
        description = text(scope.get("description"), "reviewed scope", 4000)
        clean = body.get("clean")
        require(type(clean) is bool and (bool(review.get("findings")) != clean), "Submit findings, or explicitly declare no errors in the reviewed scope. An empty list is not a clean review.")
        require(not clean or scope["kind"] != "report", "A clean declaration needs a partial or whole-work review scope.")
        label = text(body.get("displayName", ""), "optional name", 200, True)
        discussion = body.get("discussion")
        if discussion is not None:
            require(isinstance(discussion, dict) and re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/discussions/[0-9]+(?:#discussioncomment-[0-9]+)?", discussion.get("url", "")), "Use the original GitHub Discussion or comment link.")
            discussion = {"url": discussion["url"], "author": text(discussion.get("author"), "Discussion author", 200), "summary": text(discussion.get("summary", discussion.get("excerpt")), "quoted Discussion context", 8000), "attribution": "Imported attribution; not authenticated as the original author"}
        kinds = body.get("kinds", body.get("findingKinds", {}))
        require(isinstance(kinds, dict), "Invalid finding kinds.")
        with self.db(write=True) as db:
            def operation():
                self.current(db, slug)
                original = db.execute("SELECT body FROM revisions WHERE work=? AND snapshot=?", (slug, review.get("snapshotId"))).fetchone()
                require(original, "This review does not match a known exact project revision. Open the shared work before reporting; preserve this local review as a recovery package.", 409)
                original = json.loads(original[0])
                validate_review(review, original["files"], original["snapshotId"])
                for f in review["findings"]:
                    require(f.get("state") in ("open", "needs_source_clarification"), "A submitted report cannot mark another person's work resolved.")
                ident, stamp = str(uuid.uuid4()), now()
                values, existing_reports, existing_ids = [], [], []
                prior_reports = self.records(db, slug, "report")
                for annotation in review["findings"]:
                    annotation = {**annotation, "color": annotation.get("color", annotation["strokes"][0]["color"] if annotation["strokes"] else "#ffd34d")}
                    kind = kinds.get(annotation["id"], "clarification" if annotation["state"] == "needs_source_clarification" else "transcription")
                    require(kind in ("transcription", "source_error", "clarification"), "Unknown finding kind.")
                    finding_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"opus:{user['id']}:{slug}:{review['snapshotId']}:{annotation['id']}"))
                    # Stable local identity prevents duplicates after a lost acknowledgement,
                    # even if a client accidentally generates a fresh request ID.
                    existing = None
                    for prior in prior_reports:
                        existing = next((f for f in prior["findings"] if f["id"] == finding_id), None)
                        if existing:
                            require(canonical(existing["annotation"]) == canonical(annotation) and existing["kind"] == kind, "This finding was already submitted with different content. Shared reports are immutable; make a new finding to add a correction or clarification.", 409, reportId=prior["id"])
                            existing_reports.append(prior)
                            existing_ids.append(existing["id"])
                            break
                    if existing:
                        continue
                    values.append({"id": finding_id, "version": 1, "originalId": annotation["id"], "reportId": ident, "author": user, "displayName": label, "comment": annotation["comment"], "kind": kind, "reviewed": {"snapshotId": review["snapshotId"], "sourceSha256": review["files"]["source"]["sha256"], "codeSha256": review["files"]["ly"]["sha256"], "renderSha256": review["files"]["rendered"]["sha256"]}, "annotation": annotation, "pages": review["pages"], "state": "needs_source_clarification" if kind != "transcription" else "open", "reportPackage": f"/api/reports/{ident}/package" if raw else None, "discussion": discussion})
                finding_ids = existing_ids + [f["id"] for f in values]
                for prior in prior_reports:
                    if (prior["author"]["id"] == user["id"] and prior["reviewed"]["snapshotId"] == review["snapshotId"]
                            and sorted(prior.get("findingIds", [f["id"] for f in prior["findings"]])) == sorted(finding_ids)
                            and prior["scope"] == {"kind": scope["kind"], "description": description} and prior["clean"] == clean
                            and prior.get("displayName") == label and prior.get("discussion") == discussion):
                        return prior
                # Recovery ZIPs can be rebuilt from already registered immutable
                # assets, avoiding a large upload for a ten-second text report.
                report_raw = raw
                if report_raw is None:
                    files = {}
                    for role, path in (("source", "source-original.pdf"), ("rendered", "rendered-original.pdf"), ("ly", "lilypond/supplied.ly")):
                        files[path] = db.execute("SELECT data FROM blobs WHERE sha=?", (review["files"][role]["sha256"],)).fetchone()[0]
                    files["annotations.json"] = (json.dumps(review, indent=2, ensure_ascii=False)+"\n").encode()
                    manifest = {"schema": "score-desk-package", "version": 1, "snapshotId": review["snapshotId"], "inputs": review["files"], "relationship": review["relationship"], "kind": "recovery; no derived PDF or crops", "payloads": {p: {"sha256": digest(b), "size": len(b)} for p, b in files.items()}}
                    files["manifest.json"] = (json.dumps(manifest, indent=2)+"\n").encode()
                    output = io.BytesIO()
                    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
                        for path, data in files.items():
                            archive.writestr(path, data)
                    report_raw = output.getvalue()
                for finding in values:
                    finding["reportPackage"] = f"/api/reports/{ident}/package"
                report = {"id": ident, "workId": slug, "createdAt": stamp, "author": user, "displayName": label, "scope": {"kind": scope["kind"], "description": description}, "clean": clean, "reviewed": {"snapshotId": review["snapshotId"], "files": review["files"], "repositoryRevision": original["repositoryRevision"]}, "findings": values, "findingIds": finding_ids, "referencedFindingIds": existing_ids, "discussion": discussion, "status": "submitted", "verification": "Not verified", "packageSha256": self.put_blob(db, report_raw, "application/zip"), "url": f"/api/reports/{ident}"}
                self.insert(db, "report", slug, report)
                return report
            return self.idempotent(db, user, body.get("requestId"), {k: v for k, v in body.items() if k != "package"}, operation, f"reports:{slug}")

    def submit_task(self, body, user):
        raw = zip_bytes(body.get("package"))
        manifest, review, payloads = package(raw)
        require("task.json" in payloads, "Task identity is missing.")
        task = strict_json(payloads["task.json"])
        require(isinstance(task, dict) and task.get("schema") == "score-desk-task" and task.get("version") == 2 and task.get("kind") == "correction-existing-transcription" and isinstance(task.get("id"), str) and ID.fullmatch(task["id"]), "Shared correction tasks require the supported v2 shared extension.")
        require(manifest.get("taskId") == task["id"], "Task manifest identity differs.")
        baseline = {"snapshotId": manifest["snapshotId"], "sourceSha256": manifest["inputs"]["source"]["sha256"], "codeSha256": manifest["inputs"]["ly"]["sha256"], "renderSha256": manifest["inputs"]["rendered"]["sha256"], "annotationSha256": digest(payloads["annotations.json"])}
        require(task.get("baseline") == baseline, "Task baseline is missing or tampered.")
        with self.db(write=True) as db:
            def operation():
                snapshot = self.record(db, body.get("snapshotId"), "snapshot")
                current = snapshot["current"]
                require(current["snapshotId"] == baseline["snapshotId"], "Task baseline differs from captured shared revision.")
                expected = {f["id"]: f for f in snapshot["findings"]}
                supplied = task.get("findings")
                require(isinstance(supplied, list) and len(supplied) == len(expected) and {f.get("id") for f in supplied} == set(expected), "Task must contain every outstanding finding in the captured shared snapshot, once.")
                numbers = [f.get("number") for f in supplied]
                require(all(type(n) is int and 0 < n <= 99999 for n in numbers) and len(set(numbers)) == len(numbers), "Invalid task finding numbers.")
                require(expected, "There are no outstanding findings in this snapshot.", 409)
                shared = task.get("shared", {})
                require(shared.get("schema") == "score-desk-shared-task" and shared.get("version") == 1 and shared.get("snapshotId") == snapshot["id"] and shared.get("workId") == snapshot["workId"] and shared.get("revision") == snapshot["revision"], "Task shared provenance differs.")
                require(shared.get("snapshotPath") == "shared/snapshot.json" and "shared/snapshot.json" in payloads and canonical(strict_json(payloads["shared/snapshot.json"])) == canonical(snapshot), "Task snapshot sidecar differs from the immutable shared record.")
                require(sorted(shared.get("findingVersions", []), key=lambda f: f.get("id", "")) == sorted([{"id": f["id"], "version": f["version"]} for f in expected.values()], key=lambda f: f["id"]), "Task finding versions differ.")
                for finding in supplied:
                    original = expected[finding["id"]]
                    require(finding.get("comment") == original["comment"] and finding.get("author") == original["author"] and finding.get("version") == original["version"] and finding.get("reportId") == original["reportId"] and finding.get("origin", {}).get("reviewed") == original["reviewed"], "Task lost a finding's text, attribution, version, or original identity.")
                    require(finding.get("kind") == original["kind"], "Task changed a source-fidelity finding kind.")
                    is_current = original["reviewed"]["snapshotId"] == baseline["snapshotId"] and canonical(original["pages"]) == canonical(review["pages"])
                    annotation = next((f for f in review["findings"] if f["id"] == finding["id"]), None)
                    context = finding.get("historicalContext", {})
                    for context_kind in ("marked", "clean"):
                        path = context.get(context_kind)
                        require(safe_path(path) and path in payloads and payloads[path].startswith(b"\x89PNG\r\n\x1a\n"), "Missing original clean/marked visual context.")
                    if not is_current:
                        require(finding.get("page") is None and not finding.get("currentAnchor") and annotation is None, "Historical highlight geometry cannot be placed on the current PDF.")
                        for role, field in (("source", "sourceSha256"), ("rendered", "renderSha256"), ("ly", "codeSha256")):
                            info = context.get("originalFiles", {}).get(role, {})
                            path = info.get("path")
                            require(safe_path(path) and path in payloads and info.get("sha256") == original["reviewed"][field] and digest(payloads[path]) == original["reviewed"][field] and info.get("size") == len(payloads[path]), "Historical file bytes differ from the original report.")
                        annotation_path = context.get("annotations")
                        require(safe_path(annotation_path) and annotation_path in payloads, "Original historical annotations are missing.")
                        old_review = strict_json(payloads[annotation_path])
                        require(old_review.get("snapshotId") == original["reviewed"]["snapshotId"] and canonical(old_review.get("pages")) == canonical(original["pages"]) and any(canonical(f) == canonical(original["annotation"]) for f in old_review.get("findings", [])), "Historical annotations differ from the original report.")
                    else:
                        expected_annotation = {**original["annotation"], "id": original["id"], "number": finding.get("number"), "comment": original["comment"], "state": "needs_source_clarification" if original["kind"] != "transcription" else "open"}
                        require(annotation == expected_annotation, "Current task annotation differs from the original report geometry.")
                        require(finding.get("page") == annotation["page"] and finding.get("currentAnchor") == {"findingId": finding["id"], "page": annotation["page"], "bounds": annotation["bounds"], "comment": annotation["comment"]}, "Current task anchor differs from its exact annotation.")
                require({f["id"] for f in review["findings"]}.issubset(expected), "Task contains unrelated current annotations.")
                require(not db.execute("SELECT 1 FROM records WHERE id=?", (task["id"],)).fetchone(), "This immutable task ID already exists.", 409)
                value = {"id": task["id"], "kind": "task", "workId": snapshot["workId"], "snapshotId": snapshot["id"], "createdAt": now(), "author": user, "task": task, "baseline": baseline, "packageSha256": self.put_blob(db, raw, "application/zip"), "packageUrl": f"/api/tasks/{task['id']}/package", "repositoryRevision": current["repositoryRevision"]}
                self.insert(db, "task", snapshot["workId"], value)
                return value
            return self.idempotent(db, user, body.get("requestId"), body, operation, "tasks")

    def submit_proposal(self, body, user):
        raw = zip_bytes(body.get("package"))
        payloads = read_zip(raw)
        require("response.json" in payloads, "AI response manifest is missing.")
        response = strict_json(payloads["response.json"], 2 * 1024 * 1024)
        require(isinstance(response, dict) and response.get("schema") == "score-desk-response" and response.get("version") == 1, "Unsupported AI response format.")
        check_payloads(payloads, response.get("files"), "response.json")
        with self.db(write=True) as db:
            def operation():
                task = self.record(db, response.get("taskId"), "task")
                baseline = task["baseline"]
                require(response.get("baseline") == baseline, "Response baseline differs from the immutable original task.")
                code, rendering = response.get("code"), response.get("rendering")
                require(isinstance(code, dict) and code.get("status") in ("changed", "unchanged"), "Invalid code declaration.")
                require(isinstance(rendering, dict) and rendering.get("status") in ("pending", "supplied"), "Invalid rendering declaration.")
                paths = []
                code_sha, render_sha = baseline["codeSha256"], baseline["renderSha256"]
                if code["status"] == "changed":
                    path = code.get("path")
                    require(safe_path(path) and path.endswith(".ly") and path in payloads, "Missing returned LilyPond.")
                    try:
                        payloads[path].decode("utf-8")
                    except UnicodeError:
                        raise Problem("Returned LilyPond must be UTF-8.") from None
                    code_sha = digest(payloads[path])
                    require(code_sha != baseline["codeSha256"], "Changed code declaration has unchanged bytes.")
                    self.put_blob(db, payloads[path], "text/plain; charset=utf-8")
                    paths.append(path)
                else:
                    require("path" in code and code["path"] is None, "Unchanged code must explicitly declare path: null.")
                if rendering["status"] == "supplied":
                    path = rendering.get("path")
                    require(safe_path(path) and path.endswith(".pdf") and path in payloads and payloads[path].startswith(b"%PDF-"), "Missing returned PDF.")
                    text(rendering.get("producer"), "rendering producer", 500)
                    if rendering.get("compiler") is not None:
                        text(rendering["compiler"], "compiler declaration", 500, True)
                    render_sha = self.put_blob(db, payloads[path], "application/pdf")
                    paths.append(path)
                else:
                    require("path" in rendering and rendering["path"] is None, "Pending rendering must explicitly declare path: null.")
                    if code["status"] == "changed":
                        render_sha = None
                require(set(paths) == set(payloads) - {"response.json"} and len(paths) == len(set(paths)), "Response contains unrelated returned files.")
                ids = {f["id"] for f in task["task"]["findings"]}
                results = response.get("results")
                require(isinstance(results, list) and len(results) == len(ids) and {r.get("id") for r in results} == ids, "Response must include every issued finding once.")
                for result in results:
                    require(result.get("status") in ("changed", "unchanged_with_reason", "needs_clarification"), "Invalid finding response.")
                    text(result.get("explanation"), "finding explanation", 8000)
                    if "codeLocation" in result:
                        text(result["codeLocation"], "code location", 1000, True)
                    require(result["status"] != "changed" or code["status"] == "changed", "Finding claims a change without changed code.")
                # The same exact ZIP is one proposal even if imported on another device.
                for prior in self.records(db, task["workId"], "proposal"):
                    if prior["packageSha256"] == digest(raw):
                        return prior
                ident = str(uuid.uuid4())
                candidate = {"sourceSha256": baseline["sourceSha256"], "codeSha256": code_sha, "renderSha256": render_sha, "snapshotId": digest(f"source:{baseline['sourceSha256']}\nrendered:{render_sha}\nly:{code_sha}".encode()) if render_sha else None, "renderingStatus": rendering["status"], "relationship": "supplier-declared; not established by compilation", "compilationVerified": False}
                value = {"id": ident, "kind": "proposal", "workId": task["workId"], "taskId": task["id"], "createdAt": now(), "author": user, "response": response, "candidate": candidate, "status": "awaiting_review", "packageSha256": self.put_blob(db, raw, "application/zip"), "packageUrl": f"/api/proposals/{ident}/package"}
                self.insert(db, "proposal", task["workId"], value)
                return value
            return self.idempotent(db, user, body.get("requestId"), body, operation, "proposals")

    def proposal_view(self, db, proposal, current=None):
        task = self.record(db, proposal["taskId"], "task")
        events = self.records(db, proposal["workId"], "decision")
        events = [e for e in events if e["proposalId"] == proposal["id"]]
        findings = []
        for finding in task["task"]["findings"]:
            history = [e for e in events if e["findingId"] == finding["id"]]
            findings.append({**finding, "decisionVersion": len(history), "decisions": history, "decision": history[-1] if history else None})
        current = current or self.current(db, proposal["workId"])
        applications = [a for a in self.records(db, proposal["workId"], "application") if a["proposalId"] == proposal["id"]]
        return {**proposal, "findings": findings, "stale": current["snapshotId"] != task["baseline"]["snapshotId"], "applied": applications, "task": task["task"], "current": current}

    def decide(self, ident, body, user):
        require(body.get("state") in ("looks_correct", "needs_correction", "needs_clarification"), "Choose a supported decision.")
        explanation = text(body.get("explanation", ""), "decision explanation", 8000, body["state"] == "looks_correct")
        require(type(body.get("expectedVersion")) is int and body["expectedVersion"] >= 0, "The displayed decision version is required.")
        with self.db(write=True) as db:
            def operation():
                proposal = self.record(db, ident, "proposal")
                require(proposal["author"]["id"] != user["id"], "Ask another contributor to review the response you returned.", 403)
                view = self.proposal_view(db, proposal)
                finding = next((f for f in view["findings"] if f["id"] == body.get("findingId")), None)
                require(finding, "This finding is not in the proposal.", 404)
                require(finding["decisionVersion"] == body["expectedVersion"], "Another reviewer recorded a decision. Reload its history and retry; your draft has not been applied.", 409, actualVersion=finding["decisionVersion"])
                if body["state"] == "looks_correct":
                    require(proposal["candidate"]["renderSha256"], "An updated rendering is required before visual approval.", 409)
                    require(finding.get("kind", "transcription") == "transcription" or explanation, "Explain how the suspected source error or clarification is preserved; do not silently correct the printed edition.")
                event = {"id": str(uuid.uuid4()), "createdAt": now(), "author": user, "workId": proposal["workId"], "proposalId": ident, "findingId": finding["id"], "version": finding["decisionVersion"] + 1, "state": body["state"], "explanation": explanation, "reviewed": proposal["candidate"], "parentDecisionId": finding["decision"]["id"] if finding["decision"] else None}
                self.insert(db, "decision", proposal["workId"], event)
                return event
            return self.idempotent(db, user, body.get("requestId"), body, operation, f"decisions:{ident}")

    def apply(self, slug, body, user):
        require("maintainer" in user.get("roles", []), "Only a configured project maintainer can record repository application.", 403)
        with self.db(write=True) as db:
            def operation():
                proposal = self.record(db, body.get("proposalId"), "proposal")
                require(proposal["workId"] == slug, "Proposal belongs to another work.")
                view = self.proposal_view(db, proposal)
                ids = body.get("findingIds")
                require(isinstance(ids, list) and ids and len(set(ids)) == len(ids), "Select approved findings to record as applied.")
                for ident in ids:
                    finding = next((f for f in view["findings"] if f["id"] == ident), None)
                    require(finding and finding["decision"] and finding["decision"]["state"] == "looks_correct", "Every applied finding needs an explicit review of this candidate.", 409)
                current = view["current"]
                require(current["snapshotId"] and current["snapshotId"] == proposal["candidate"]["snapshotId"], "The operator's current repository/build must contain the exact approved candidate code, source, and rendering before application can be recorded.", 409)
                require(body.get("repositoryRevision") == current["repositoryRevision"] and re.fullmatch(r"[a-f0-9]{40}", current["repositoryRevision"] or ""), "Application needs the actual current repository commit.", 409)
                try:
                    committed_code = subprocess.check_output(["git", "show", f"HEAD:{current['path']}"], cwd=self.repo, stderr=subprocess.DEVNULL, timeout=10)
                    committed_metadata = json.loads(subprocess.check_output(["git", "show", f"HEAD:pieces/{slug}/metadata.json"], cwd=self.repo, stderr=subprocess.DEVNULL, timeout=10))
                    branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=self.repo, stderr=subprocess.DEVNULL, text=True, timeout=5).strip()
                except (OSError, subprocess.SubprocessError):
                    raise Problem("Cannot verify the canonical committed LilyPond revision.", 409) from None
                canonical_branch = os.environ.get("OPUS_CANONICAL_BRANCH", "main")
                require(branch == canonical_branch and digest(committed_code) == proposal["candidate"]["codeSha256"] and committed_metadata == self.metadata(slug) and committed_metadata.get("source_sha256") == proposal["candidate"]["sourceSha256"], "Application requires the exact committed candidate and source metadata on the operator's configured canonical branch; uncommitted files and other branches are not publication.", 409)
                if proposal["response"]["code"]["status"] == "changed":
                    task = self.record(db, proposal["taskId"], "task")
                    require(current["repositoryRevision"] != task["repositoryRevision"], "A changed correction must first be committed in the canonical checkout.", 409)
                link = body.get("pullRequest")
                require(isinstance(link, str) and re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+", link), "Record the correction or provenance pull request link.")
                event = {"id": str(uuid.uuid4()), "createdAt": now(), "author": user, "workId": slug, "proposalId": proposal["id"], "findingIds": ids, "repositoryRevision": current["repositoryRevision"], "candidate": proposal["candidate"], "pullRequest": link, "status": "applied_to_project"}
                self.insert(db, "application", slug, event)
                return event
            return self.idempotent(db, user, body.get("requestId"), body, operation, f"applications:{slug}")

    def get_record(self, kind, ident):
        with self.db(write=True) as db:
            record = self.record(db, ident, kind)
            return self.proposal_view(db, record) if kind == "proposal" else record

    def handoff(self, kind, ident):
        record = self.get_record(kind, ident)
        if kind == "proposal":
            approved = [f["id"] for f in record["findings"] if f["decision"] and f["decision"]["state"] == "looks_correct"]
            require(approved, "Review at least one finding before preparing the maintainer handoff.", 409)
            pending = [f["id"] for f in record["findings"] if f["id"] not in approved]
            changes = {r["id"] for r in record["response"]["results"] if r["status"] == "changed"}
            unchecked_changes = sorted(changes - set(approved))
            if record["response"]["code"]["status"] == "unchanged":
                start = "Prepare a review-only metadata/provenance PR with unchanged LilyPond; do not manufacture a musical edit"
            elif unchecked_changes:
                start = "Prepare only a DRAFT correction PR; the complete candidate contains changes still awaiting review and is not ready to merge"
            else:
                start = "Prepare one correction PR for maintainer assessment of the reviewed candidate"
            instruction = f"{start} for {record['workId']}. Shared proposal: {ident}. Immutable task: {record['taskId']}. Approved finding IDs: {', '.join(approved)}. Unchecked/rejected/clarification finding IDs: {', '.join(pending) or 'none'}. Proposed changed IDs without approval: {', '.join(unchecked_changes) or 'none'}. Candidate identity: {canonical(record['candidate'])}. Preserve unreviewed findings, original model attribution and transcription step. This is not human verification. Bind the PR to these exact bytes; changing code or rendering requires new review. Compare the printed source and follow AGENTS.md/HANDBOOK.md. Do not commit PDFs, ZIPs, runtime records or scans. Only after merge, update the service operator's canonical checkout/build and record the application with the exact merged commit and PR link. Never mark pending proposals globally fixed."
        else:
            instruction = f"Prepare a review-only metadata/provenance contribution for {record['workId']}; do not manufacture a musical edit. Shared report: {ident}. Authenticated reviewer: {record['author']['login']} ({record['author']['id']}). Reviewed revision: {canonical(record['reviewed'])}. Coverage: {canonical(record['scope'])}. Explicit clean declaration: {record['clean']}. Keep findings and their authorship. Preserve models, step and verified_by. This record is not verification; an eligible Step 3 score, full source/render coverage, appointed verifier and explicit approval of the exact canonical revision are required in a separate human verification PR."
        return {"text": instruction, "record": record, "files": {"package": f"/api/{'proposals' if kind == 'proposal' else 'reports'}/{ident}/package"}}


def fetch_public_pdf(url, limit=MAX_FILE, redirects=5):
    """Fetch only a configured library URL; pin resolved public IP per request.

    HTTPS redirects remain public HTTPS. Using the checked IP for the socket
    avoids DNS rebinding between validation and connect; TLS checks hostname.
    """
    for _ in range(redirects + 1):
        parsed = urllib.parse.urlsplit(url)
        require(parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password and parsed.port in (None, 443), "Library source must use public HTTPS.", 502)
        try:
            addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
            ips = [entry[4][0] for entry in addresses]
            require(ips and all(ipaddress.ip_address(ip).is_global for ip in ips), "Library URL resolves to a non-public address.", 502)
            sock = socket.create_connection((ips[0], 443), timeout=20)
            tls = ssl.create_default_context().wrap_socket(sock, server_hostname=parsed.hostname)
            connection = http.client.HTTPSConnection(parsed.hostname, timeout=20)
            connection.sock = tls
            target = urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
            connection.request("GET", target, headers={"User-Agent": "OPUS-Score-Desk/1.0", "Accept": "application/pdf"})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                connection.close()
                require(location, "Library redirect has no location.", 502)
                url = urllib.parse.urljoin(url, location)
                continue
            require(response.status == 200, f"Library returned HTTP {response.status}.", 502)
            length = response.getheader("Content-Length")
            require(not length or int(length) <= limit, "Library PDF exceeds the supported size.", 413)
            data = response.read(limit + 1)
            connection.close()
            require(len(data) <= limit and data.startswith(b"%PDF-"), "The library returned a page or unsupported file instead of its PDF.", 502)
            return data
        except (OSError, ValueError, http.client.HTTPException):
            raise Problem("The source library could not be reached. Download the exact PDF from its library page and upload it once; your draft is preserved.", 502, needsSourceUpload=True) from None
    raise Problem("Too many library redirects. Download the exact source PDF and upload it once.", 502, needsSourceUpload=True)


class Service:
    def __init__(self, store, origins, public_url, dev_auth=False, maintainer_ids=(), verifier_ids=()):
        self.store, self.origins, self.public_url = store, set(origins), public_url.rstrip("/")
        self.dev_auth = dev_auth
        self.maintainer_ids, self.verifier_ids = set(maintainer_ids), set(verifier_ids)
        self.oauth_client = os.environ.get("OPUS_GITHUB_CLIENT_ID", "")
        self.oauth_secret = os.environ.get("OPUS_GITHUB_CLIENT_SECRET", "")
        self.rate_lock, self.rates = threading.Lock(), {}

    def rate_limit(self, address, writes=False):
        minute = int(time.time() // 60)
        with self.rate_lock:
            self.rates = {k: v for k, v in self.rates.items() if k[1] >= minute-1}
            key = (address, minute, writes)
            count = self.rates.get(key, 0) + 1
            self.rates[key] = count
        require(count <= (90 if writes else 600), "Please wait a minute before retrying.", 429)

    def user(self, headers, required=False):
        bearer = headers.get("Authorization", "")
        require(not bearer or bearer.startswith("Bearer "), "Use a supported session.", 401)
        token = bearer[7:] if bearer else ""
        with self.store.db() as db:
            row = db.execute("SELECT user,expires FROM sessions WHERE hash=?", (digest(token.encode()),)).fetchone() if token else None
        if row and row[1] > time.time():
            saved = json.loads(row[0])
            # Role configuration is authoritative after a restart; an old
            # session must not retain a revoked maintainer/verifier grant.
            return self.identity(saved["id"], saved["login"], saved["provenance"])
        require(not required, "Sign in to submit shared work. Your local draft is still saved.", 401)
        return None

    def new_session(self, user):
        token = secrets.token_urlsafe(32)
        with self.store.db(write=True) as db:
            db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            db.execute("INSERT INTO sessions VALUES(?,?,?)", (digest(token.encode()), canonical(user), time.time()+8*3600))
        return {"token": token, "user": user, "expiresIn": 8*3600}

    def identity(self, ident, login, provenance="github-oauth"):
        ident = str(ident)
        roles = (["maintainer"] if ident in self.maintainer_ids else []) + (["verifier"] if ident in self.verifier_ids else [])
        return {"id": ident, "login": login, "provenance": provenance, "roles": roles}

    def auth_start(self, query):
        origin, challenge = query.get("origin", [""])[0], query.get("challenge", [""])[0]
        require(origin in self.origins and re.fullmatch(r"[A-Za-z0-9_-]{43}", challenge), "Invalid sign-in origin or PKCE challenge.")
        require(self.oauth_client and self.oauth_secret, "GitHub sign-in has not been activated by the project owner yet.", 503)
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
        body = {"origin": origin, "challenge": challenge, "upstreamVerifier": verifier}
        with self.store.db(write=True) as db:
            db.execute("DELETE FROM oauth WHERE expires<?", (time.time(),))
            db.execute("INSERT INTO oauth VALUES(?,?,?)", (state, canonical(body), time.time()+600))
        args = {"client_id": self.oauth_client, "redirect_uri": self.public_url+"/auth/callback", "state": state, "code_challenge": base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("="), "code_challenge_method": "S256"}
        return "https://github.com/login/oauth/authorize?"+urllib.parse.urlencode(args)

    def auth_callback(self, query):
        state, code = query.get("state", [""])[0], query.get("code", [""])[0]
        with self.store.db(write=True) as db:
            row = db.execute("SELECT body,expires FROM oauth WHERE state=?", (state,)).fetchone()
            require(row and row[1] > time.time(), "Sign-in expired. Please try again.", 401)
            body = json.loads(row[0])
            db.execute("DELETE FROM oauth WHERE state=?", (state,))
        require(code and not query.get("error"), "GitHub sign-in was cancelled or denied.", 401)
        # Token stays in server memory only; never log response bodies or URLs.
        token_request = urllib.request.Request("https://github.com/login/oauth/access_token", data=urllib.parse.urlencode({"client_id": self.oauth_client, "client_secret": self.oauth_secret, "code": code, "redirect_uri": self.public_url+"/auth/callback", "code_verifier": body["upstreamVerifier"]}).encode(), headers={"Accept": "application/json", "User-Agent": "OPUS-Score-Desk/1.0"})
        try:
            with urllib.request.urlopen(token_request, timeout=20) as response:
                result = json.load(response)
            require(result.get("access_token"), "GitHub did not authorize sign-in.", 401)
            user_request = urllib.request.Request("https://api.github.com/user", headers={"Authorization": "Bearer "+result["access_token"], "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "OPUS-Score-Desk/1.0"})
            with urllib.request.urlopen(user_request, timeout=20) as response:
                profile = json.load(response)
        except (OSError, ValueError):
            raise Problem("GitHub sign-in could not finish. Try again; no draft was discarded.", 502) from None
        require(isinstance(profile.get("id"), int) and isinstance(profile.get("login"), str), "GitHub returned no verified account identity.", 502)
        user = self.identity(profile["id"], profile["login"])
        exchange = secrets.token_urlsafe(32)
        with self.store.db(write=True) as db:
            db.execute("INSERT INTO oauth VALUES(?,?,?)", ("exchange:"+digest(exchange.encode()), canonical({"origin": body["origin"], "challenge": body["challenge"], "user": user}), time.time()+90))
        message = json.dumps({"type": "opus-auth", "code": exchange}).replace("<", "\\u003c")
        target = json.dumps(body["origin"]).replace("<", "\\u003c")
        nonce = secrets.token_urlsafe(24)
        html = f'<!doctype html><meta charset="utf-8"><title>OPUS sign-in</title><p>Sign-in complete. You can close this window.</p><script nonce="{nonce}">if(window.opener){{window.opener.postMessage({message},{target});window.close();}}</script>'
        return html.encode(), nonce

    def exchange(self, body, origin):
        code, verifier = body.get("code"), body.get("verifier")
        require(isinstance(code, str) and isinstance(verifier, str) and 43 <= len(verifier) <= 128, "Invalid sign-in exchange.", 401)
        key = "exchange:"+digest(code.encode())
        with self.store.db(write=True) as db:
            row = db.execute("SELECT body,expires FROM oauth WHERE state=?", (key,)).fetchone()
            require(row and row[1] > time.time(), "Sign-in exchange expired or was already used.", 401)
            data = json.loads(row[0])
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
            require(data["origin"] == origin and secrets.compare_digest(data["challenge"], challenge), "Sign-in proof or origin differs.", 401)
            db.execute("DELETE FROM oauth WHERE state=?", (key,))
        return self.new_session(data["user"])


class Handler(BaseHTTPRequestHandler):
    server_version = "OPUSShared/1"
    protocol_version = "HTTP/1.1"

    @property
    def app(self):
        return self.server.app

    def log_message(self, format, *args):
        # Query strings may contain a single-use OAuth code. Never log them.
        pass

    def diagnostic(self, event):
        # Opt-in development diagnostics omit query strings, headers, request
        # bodies, identities, credentials and exception messages.
        if self.app.dev_auth and os.environ.get("OPUS_LOG_REQUESTS") == "1":
            print(f"HTTP {self.command} {urllib.parse.urlsplit(self.path).path} {event}", flush=True)

    def send(self, status, payload, mime="application/json; charset=utf-8", headers=None):
        if not isinstance(payload, bytes):
            payload = json.dumps(payload, ensure_ascii=False).encode()
        self.diagnostic(f"send {status} bytes={len(payload)}")
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(payload)))
        if self.close_connection:
            self.send_header("Connection", "close")
        else:
            self.send_header("Keep-Alive", "timeout=5")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        origin = self.headers.get("Origin")
        if origin in self.app.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(payload)
        self.diagnostic(f"complete {status}")

    def read_body(self, binary=False, limit=None):
        require(not self.headers.get("Transfer-Encoding"), "Chunked uploads are unsupported.", 400)
        length = self.headers.get("Content-Length")
        require(length and length.isdigit(), "Content-Length is required.", 411)
        length = int(length)
        require(0 < length <= (limit or (MAX_FILE if binary else MAX_JSON)), "Request body is too large.", 413)
        self.connection.settimeout(60)
        data = self.rfile.read(length)
        self.body_consumed = True
        require(len(data) == length, "Incomplete request body.")
        if binary:
            return data
        body = strict_json(data, MAX_JSON)
        require(isinstance(body, dict), "Request must be a JSON object.")
        return body

    def do_OPTIONS(self):
        self.run()

    def do_GET(self):
        self.run()

    def do_POST(self):
        self.run()

    def do_PUT(self):
        self.run()

    def do_PATCH(self):
        self.run()

    def do_DELETE(self):
        self.run()

    def run(self):
        self.body_consumed = False
        acquired = False
        try:
            # Browsers pre-open idle TCP sockets. Bound actual parsed requests,
            # not accepted sockets, or fresh browser contexts can starve each
            # other before sending any HTTP request at all.
            acquired = self.server.slots.acquire(timeout=1)
            require(acquired, "The shared service is handling several large requests. Your draft is kept; retry the same action shortly.", 503)
            origin = self.headers.get("Origin")
            require(not origin or origin in self.app.origins, "This browser origin is not configured for the shared service.", 403)
            # OPTIONS authorizes a browser's cross-origin request; it performs
            # no shared write and must not consume the submission quota.
            self.app.rate_limit(self.client_address[0], self.command == "POST")
            if self.command == "OPTIONS":
                return self.send(204, b"")
            require(self.command in ("GET", "POST"), "Shared records are immutable; this operation is not supported.", 405)
            parsed = urllib.parse.urlsplit(self.path)
            path, query = parsed.path.rstrip("/"), urllib.parse.parse_qs(parsed.query)
            store = self.app.store
            if path == "/health" and self.command == "GET":
                return self.send(200, {"status": "ok", "durable": "sqlite", "schema": 1})
            if path == "/api/session" and self.command == "GET":
                return self.send(200, {"user": self.app.user(self.headers), "devAuth": self.app.dev_auth, "authStart": "/auth/start", "productionAuthConfigured": bool(self.app.oauth_client and self.app.oauth_secret)})
            if path == "/auth/start" and self.command == "GET":
                return self.send(302, b"", headers={"Location": self.app.auth_start(query)})
            if path == "/auth/callback" and self.command == "GET":
                html, nonce = self.app.auth_callback(query)
                return self.send(200, html, "text/html; charset=utf-8", {"Content-Security-Policy": f"default-src 'none'; script-src 'nonce-{nonce}'; frame-ancestors 'none'; base-uri 'none'"})
            if path == "/auth/exchange" and self.command == "POST":
                return self.send(200, self.app.exchange(self.read_body(limit=8192), origin))
            if path == "/auth/dev" and self.command == "POST":
                require(self.app.dev_auth and ipaddress.ip_address(self.client_address[0]).is_loopback, "Development sign-in is disabled.", 403)
                body = self.read_body(limit=8192)
                login = text(body.get("login"), "development account", 40)
                require(re.fullmatch(r"[A-Za-z0-9_-]+", login), "Invalid development account.")
                user = self.app.identity("dev:"+login.lower(), login, "simulated-development-identity")
                return self.send(200, self.app.new_session(user))
            if path == "/auth/logout" and self.command == "POST":
                self.app.user(self.headers, True)
                if int(self.headers.get("Content-Length", "0")):
                    self.read_body(limit=8192)
                with store.db(write=True) as db:
                    db.execute("DELETE FROM sessions WHERE hash=?", (digest(self.headers.get("Authorization")[7:].encode()),))
                return self.send(200, {"signedOut": True})
            match = re.fullmatch(r"/api/assets/([a-f0-9]{64})", path)
            if match and self.command == "GET":
                data, mime = store.blob(match[1])
                return self.send(200, data, mime)
            if path == "/api/works" and self.command == "GET":
                try:
                    after, limit = int(query.get("after", [0])[0]), int(query.get("limit", [50])[0])
                except ValueError:
                    raise Problem("Invalid pagination.") from None
                return self.send(200, store.works(after, limit))
            match = re.fullmatch(r"/api/works/([a-z0-9-]+)(?:/(snapshot|reports|applications|verification|assets/source))?", path)
            if match:
                slug, action = match.groups()
                if action == "assets/source":
                    metadata = store.metadata(slug)
                    if self.command == "POST":
                        self.app.user(self.headers, True)
                        data = self.read_body(True)
                    else:
                        try:
                            data, mime = store.blob(metadata["source_sha256"])
                            return self.send(200, data, mime)
                        except Problem as error:
                            if error.status != 404:
                                raise
                        try:
                            data = fetch_public_pdf(metadata["source_pdf"])
                        except Problem as error:
                            error.details["needsSourceUpload"] = True
                            error.details["sourcePage"] = metadata.get("source_page")
                            raise
                    require(data.startswith(b"%PDF-") and digest(data) == metadata["source_sha256"], "This PDF differs from the exact printed edition recorded by the project. Keep your draft and choose the recorded library PDF.", 409, needsSourceUpload=True, sourcePage=metadata.get("source_page"))
                    with store.db(write=True) as db:
                        sha = store.put_blob(db, data, "application/pdf")
                        store.current(db, slug)
                    return self.send(200, {"sha256": sha, "size": len(data), "url": "/api/assets/"+sha}) if self.command == "POST" else self.send(200, data, "application/pdf")
                if self.command == "GET" and action in (None, "snapshot"):
                    return self.send(200, store.snapshot(slug) if action else store.work(slug))
                if self.command == "POST" and action in ("reports", "applications", "verification"):
                    user = self.app.user(self.headers, True)
                    if action == "verification":
                        require("verifier" in user.get("roles", []), "Only an appointed verifier may request verification.", 403)
                        raise Problem("Verification is recorded through the project's human verification PR: eligible Step 3, complete source/render coverage, appointed verifier, and explicit approval of the exact canonical revision. This service never changes verified_by from report submissions.", 409)
                    body = self.read_body()
                    return self.send(200, store.submit_report(slug, body, user) if action == "reports" else store.apply(slug, body, user))
            if path in ("/api/tasks", "/api/proposals") and self.command == "POST":
                user = self.app.user(self.headers, True)
                body = self.read_body()
                require(isinstance(body, dict), "Invalid submission.")
                return self.send(200, store.submit_task(body, user) if path.endswith("tasks") else store.submit_proposal(body, user))
            match = re.fullmatch(r"/api/(reports|tasks|proposals)/([A-Za-z0-9_-]+)(?:/(package|handoff|decisions))?", path)
            if match:
                plural, ident, action = match.groups()
                kind = {"reports": "report", "tasks": "task", "proposals": "proposal"}[plural]
                if self.command == "GET" and action in (None, "package", "handoff"):
                    if action == "handoff":
                        require(kind in ("report", "proposal"), "No handoff for this record.", 404)
                        return self.send(200, store.handoff(kind, ident))
                    record = store.get_record(kind, ident)
                    if action == "package":
                        require(record.get("packageSha256"), "No package was retained with this report.", 404)
                        data, mime = store.blob(record["packageSha256"])
                        return self.send(200, data, mime, {"Content-Disposition": f'attachment; filename="opus-{kind}-{ident}.zip"'})
                    return self.send(200, record)
                if self.command == "POST" and kind == "proposal" and action == "decisions":
                    user = self.app.user(self.headers, True)
                    return self.send(200, store.decide(ident, self.read_body(), user))
            raise Problem("Shared endpoint not found.", 404)
        except Problem as error:
            # Drain a small rejected JSON body before close so Windows sockets
            # deliver the useful 401/409 response instead of resetting it.
            length = self.headers.get("Content-Length", "0")
            if not self.body_consumed and length.isdigit() and int(length) <= 65536:
                try:
                    self.connection.settimeout(1)
                    self.rfile.read(int(length))
                except (OSError, TimeoutError):
                    pass
            self.close_connection = True  # discard unread failed request bytes
            self.send(error.status, {"error": str(error), **error.details})
        except (BrokenPipeError, ConnectionResetError) as error:
            self.diagnostic("transport-error "+type(error).__name__)
        except Exception as error:
            self.diagnostic("internal-error "+type(error).__name__)
            self.close_connection = True
            # Never return exception text that can include credentials or data paths.
            self.send(500, {"error": "The shared service could not complete this request. Your draft remains local; retry with the same request ID."})
        finally:
            if acquired:
                self.server.slots.release()


class BoundedServer(ThreadingHTTPServer):
    """Bound active operation memory; idle browser preconnects own no slot."""
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self.slots = threading.BoundedSemaphore(4)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        request.settimeout(10)
        super().process_request(request, client_address)


def create_server(store, host="127.0.0.1", port=8787, origins=(), public_url=None, dev_auth=False, maintainer_ids=(), verifier_ids=()):
    if dev_auth:
        require(host in ("127.0.0.1", "::1", "localhost"), "Development authentication requires a loopback bind address.")
        require(all(urllib.parse.urlsplit(origin).hostname in ("127.0.0.1", "localhost", "::1") for origin in origins), "Development authentication accepts loopback origins only.")
    server = BoundedServer((host, port), Handler)
    server.daemon_threads = True
    server.app = Service(store, origins, public_url or f"http://{host}:{server.server_port}", dev_auth, maintainer_ids, verifier_ids)
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--data-dir", type=Path, default=ROOT / ".build/shared-service")
    parser.add_argument("--repo", type=Path, default=ROOT)
    parser.add_argument("--site-root", type=Path, default=ROOT / ".build/site")
    parser.add_argument("--allow-origin", action="append", default=[])
    parser.add_argument("--public-url", default=os.environ.get("OPUS_PUBLIC_URL"))
    parser.add_argument("--dev-auth", action="store_true")
    args = parser.parse_args()
    if not args.dev_auth:
        require(args.public_url and args.public_url.startswith("https://"), "Production requires --public-url https://… behind an HTTPS reverse proxy.")
    require(args.allow_origin, "Configure at least one exact --allow-origin.")
    store = Store(args.data_dir, args.repo, args.site_root)
    server = create_server(store, args.host, args.port, args.allow_origin, args.public_url, args.dev_auth, filter(None, os.environ.get("OPUS_MAINTAINER_IDS", "").split(",")), filter(None, os.environ.get("OPUS_VERIFIER_IDS", "").split(",")))
    print(f"OPUS shared service: http://{args.host}:{server.server_port} (durable SQLite; {'SIMULATED LOCAL IDENTITIES' if args.dev_auth else 'GitHub sign-in'})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
