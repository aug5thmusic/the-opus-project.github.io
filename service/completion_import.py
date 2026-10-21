"""Import local completion evidence into fresh, independently reviewed records.

No imported operation, identity or decision is trusted. Nothing is extracted or
executed. The original ZIP is retained separately from generated shared packages.
"""
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
import base64
import io
import json
import re
import uuid
import zipfile

ROLES = {"source": "source-original.pdf", "rendered": "rendered-original.pdf", "ly": "lilypond/supplied.ly"}
STATES = {"open", "corrected_pending_review", "resolved", "needs_source_clarification"}


def js_json(value, *, sorted_keys=False, pretty=False, level=0):
    """JSON.stringify-compatible serialization for bounded review JSON numbers."""
    if isinstance(value, dict):
        keys = sorted(value) if sorted_keys else list(value)
        parts = [(json.dumps(k, ensure_ascii=False), js_json(value[k], sorted_keys=sorted_keys, pretty=pretty, level=level+1)) for k in keys]
        if not parts:
            return "{}"
        if pretty:
            return "{\n"+",\n".join("  "*(level+1)+k+": "+v for k, v in parts)+"\n"+"  "*level+"}"
        return "{"+",".join(k+":"+v for k, v in parts)+"}"
    if isinstance(value, list):
        parts = [js_json(v, sorted_keys=sorted_keys, pretty=pretty, level=level+1) for v in value]
        if not parts:
            return "[]"
        if pretty:
            return "[\n"+",\n".join("  "*(level+1)+v for v in parts)+"\n"+"  "*level+"]"
        return "["+",".join(parts)+"]"
    if isinstance(value, float):
        if value == 0:
            return "0"
        if value.is_integer() and abs(value) < 1e21:
            return str(int(value))
        number = repr(value).lower()
        if 1e-6 <= abs(value) < 1e21:
            return format(Decimal(number), 'f')
        return re.sub(r'e([+-])0+(\d+)', r'e\1\2', number)
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def encoded(value):
    return (js_json(value, pretty=True)+"\n").encode("utf-8")


def archive(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as zipped:
        for path, content in files.items():
            zipped.writestr(path, content)
    return output.getvalue()


def seal(files, review):
    files = dict(files)
    from hashlib import sha256
    files["annotations.json"] = encoded(review)
    manifest = {"schema": "score-desk-package", "version": 1, "snapshotId": review["snapshotId"],
                "inputs": review["files"], "relationship": review["relationship"],
                "payloads": {p: {"size": len(b), "sha256": sha256(b).hexdigest()} for p, b in files.items() if p != "manifest.json"}}
    files["manifest.json"] = encoded(manifest)
    return archive(files), manifest, files


def state_hash(review, round_, api):
    annotations = deepcopy(review)
    for key in ("createdAt", "updatedAt"):
        annotations.pop(key, None)
    round_ = deepcopy(round_)
    if round_:
        for key in ("id", "recoveredFrom"):
            round_.pop(key, None)
    return api.digest(js_json({"annotations": annotations, "returned": round_}, sorted_keys=True).encode())


def inspect_completion(raw, api):
    # The shared package validator predates these nested recovery records. Keep
    # malformed JSON shapes a rejected upload, including failures in that model,
    # rather than letting an attribute/type error become a server failure.
    try:
        return _inspect_completion(raw, api)
    except (AttributeError, TypeError, KeyError, IndexError, OverflowError):
        raise api.Problem("Malformed completed-review evidence.") from None


def _inspect_completion(raw, api):
    require = api.require
    local_id = lambda value: isinstance(value, str) and 0 < len(value) <= 200
    manifest, review, files = api.package(raw)
    require(manifest.get("kind") == "completed-review-handoff", "Choose a completed-review ZIP exported by Finish review.")
    bundle = api.strict_json(files.get("completion-history.json", b""))
    require(isinstance(bundle, dict) and bundle.get("schema") == "score-desk-completions" and type(bundle.get("version")) is int and bundle["version"] == 1 and isinstance(bundle.get("records"), list) and 0 < len(bundle["records"]) <= 500, "Unsupported completion history.")
    records = bundle["records"]
    require(all(isinstance(r, dict) and local_id(r.get("id")) for r in records) and len({r["id"] for r in records}) == len(records), "Duplicate or invalid completion identity.")
    matches = [r for r in records if r["id"] == manifest.get("completionId")]
    require(len(matches) == 1, "This package does not identify one completed review.")
    record = matches[0]
    require(record.get("schema") == "score-desk-completion" and type(record.get("version")) is int and record["version"] == 1 and record.get("scope") in ("corrections", "entire", "partial"), "Unsupported completion declaration.")
    api.text(record.get("createdAt"), "completion date", 100)
    try:
        datetime.fromisoformat(record["createdAt"].replace("Z", "+00:00"))
    except ValueError:
        raise api.Problem("Invalid completion date.") from None
    api.text(record.get("scopeNote"), "review scope", 4000, True)
    if record.get("reviewer") is not None:
        api.text(record["reviewer"], "imported reviewer label", 200, True)
    revision = record.get("revision", {})
    require(isinstance(revision, dict) and local_id(revision.get("id")) and local_id(revision.get("workspaceId")), "Invalid completion revision.")
    require(revision.get("id") == bundle.get("revisionId") and revision.get("snapshotId") == review["snapshotId"], "The completion is for another revision. Export its original completed review; your local work is unchanged.", 409)
    evidence = record.get("evidence", {})
    require(isinstance(evidence, dict) and evidence.get("annotations") == review, "Completion annotations differ from the exact candidate.")
    round_ = evidence.get("returned")
    require(round_ is None or isinstance(round_, dict), "Invalid returned-review evidence.")
    hashes = record.get("hashes", {})
    expected = {role: review["files"][role]["sha256"] for role in ROLES}
    expected.update(annotations=api.digest(files["annotations.json"]), state=state_hash(review, round_, api))
    require(hashes == expected and bundle.get("stateSha256") == expected["state"], "Completion hashes differ from its exact evidence.")
    for role in ("source", "rendered"):
        require(api.supported_pdf(files[ROLES[role]]), "Completion contains an invalid or incomplete PDF.")
    reported = round_.get("reported") if isinstance(round_, dict) else []
    require(isinstance(reported, list) and len(reported) <= 2000 and all(isinstance(f, dict) and local_id(f.get("id")) and (f.get("associationId") is None or local_id(f["associationId"])) for f in reported), "Invalid returned findings.")
    associated = {f.get("associationId") for f in reported if f.get("associationId")}
    require(associated <= {f["id"] for f in review["findings"]}, "A returned finding refers to a missing current annotation.")
    findings = [{**deepcopy(f), "kind": "reported", "region": next((deepcopy(a) for a in review["findings"] if a["id"] == f.get("associationId")), None)} for f in reported]
    findings += [{**deepcopy(f), "kind": "annotation", "region": deepcopy(f)} for f in review["findings"] if f["id"] not in associated]
    require(record.get("findings") == findings and all(isinstance(f.get("state"), str) and f["state"] in STATES for f in findings), "Completion findings differ from their original evidence.")
    totals = {"all": len(findings), "resolved": sum(f["state"] == "resolved" for f in findings), "unresolved": sum(f["state"] != "resolved" for f in findings), "unlocated": sum(not f["region"] for f in findings), "missingDecisions": sum(f["kind"] == "reported" and not f.get("decision") for f in findings)}
    require(record.get("totals") == totals, "Completion totals differ from the findings.")
    result = {"manifest": manifest, "review": review, "files": files, "record": record, "round": round_, "associated": associated}
    if round_ is None:
        require(not revision.get("taskId") and not revision.get("responseId") and "returned-workspace.json" not in files, "Missing original correction history.")
        return result
    require(round_.get("schema") == "score-desk-returned-workspace" and type(round_.get("version")) is int and round_["version"] == 1, "Unsupported returned-review evidence.")
    meta = api.strict_json(files.get("returned-workspace.json", b""))
    require(isinstance(meta, dict) and meta.get("schema") == "score-desk-returned-workspace-backup" and meta.get("version") == 1 and meta.get("returned") == round_, "Returned history differs from the completion.")
    def nested(key, prefix):
        paths = meta.get(key)
        require(isinstance(paths, list) and 0 < len(paths) <= 5000 and all(api.safe_path(p) and prefix+p in files for p in paths) and len(set(paths)) == len(paths), "Missing or invalid nested history paths.")
        return {p: files[prefix+p] for p in paths}
    task_files = nested("taskPaths", "history/task/")
    if meta.get("originalTaskData"):
        require(meta["originalTaskData"] == "history/original-task-data.json", "Unsupported original task recovery path.")
        delta = api.strict_json(files.get(meta["originalTaskData"], b""))
        require(isinstance(delta, dict) and delta.get("schema") == "score-desk-inert-original-task" and delta.get("version") == 1 and isinstance(delta.get("remove"), list) and len(delta["remove"]) <= 5000 and isinstance(delta.get("entries"), list) and len(delta["entries"]) <= 5000, "Invalid original task recovery data.")
        for path in delta["remove"]:
            require(api.safe_path(path), "Invalid original task path.")
            task_files.pop(path, None)
        seen = set()
        for item in delta["entries"]:
            require(isinstance(item, dict), "Invalid recovered task entry.")
            path = item.get("path")
            require(api.safe_path(path) and path not in seen and type(item.get("size")) is int and 0 <= item["size"] <= api.MAX_FILE, "Invalid recovered task entry.")
            seen.add(path)
            try:
                data = base64.b64decode(item.get("base64", ""), validate=True)
            except (ValueError, TypeError):
                raise api.Problem("Invalid recovered task bytes.") from None
            require(len(data) == item["size"] and api.digest(data) == item.get("sha256"), "Recovered task hash differs.")
            task_files[path] = data
    task_manifest, task_review, task_files = api.package(archive(task_files))
    require(all(api.supported_pdf(task_files[ROLES[role]]) for role in ("source", "rendered")), "Original task contains an invalid or incomplete PDF.")
    task = api.strict_json(task_files.get("task.json", b""))
    baseline = {"snapshotId": task_review["snapshotId"], "annotationSha256": api.digest(task_files["annotations.json"]), **{field: task_review["files"][role]["sha256"] for role, field in (("source", "sourceSha256"), ("ly", "codeSha256"), ("rendered", "renderSha256"))}}
    require(isinstance(task, dict) and task.get("schema") == "score-desk-task" and type(task.get("version")) is int and task["version"] in (1, 2) and task.get("kind") == "correction-existing-transcription" and isinstance(task.get("id"), str) and api.ID.fullmatch(task["id"]) and task.get("baseline") == baseline and task.get("id") == task_manifest.get("taskId") == round_.get("taskId") == revision.get("taskId"), "Original task identity or baseline differs.")
    if task.get("shared") is not None:
        shared = task["shared"]
        require(isinstance(shared, dict) and shared.get("schema") == "score-desk-shared-task" and shared.get("version") == 1 and isinstance(shared.get("workId"), str) and api.ID.fullmatch(shared["workId"]) and shared.get("snapshotPath") == "shared/snapshot.json", "Invalid original shared task identity.")
        snapshot = api.strict_json(task_files.get(shared["snapshotPath"], b""))
        require(isinstance(snapshot, dict) and snapshot.get("workId") == shared["workId"] and snapshot.get("id") == shared.get("snapshotId") and isinstance(snapshot.get("current"), dict) and snapshot["current"].get("snapshotId") == baseline["snapshotId"], "Original shared snapshot differs from its task baseline.")
    require(isinstance(meta.get("issued"), dict) and meta["issued"].get("task") == task and meta["issued"].get("id") == task["id"], "Original issued task metadata differs.")
    requests = task.get("findings")
    require(isinstance(requests, list) and 0 < len(requests) <= 2000 and all(isinstance(f, dict) and isinstance(f.get("id"), str) and api.ID.fullmatch(f["id"]) for f in requests) and len({f["id"] for f in requests}) == len(requests), "Invalid original task findings.")
    numbers = set()
    for finding in requests:
        number = finding.get("number")
        require(type(number) is int and 0 < number <= 99999 and number not in numbers, "Invalid original finding number.")
        numbers.add(number)
        api.text(finding.get("comment"), "original finding comment", 4000, True)
        annotation = next((a for a in task_review["findings"] if a["id"] == finding["id"]), None)
        if task["version"] == 1:
            require(annotation is not None and all(finding.get(key) == annotation[key] for key in ("number", "page", "comment")), "Original task differs from its annotation baseline.")
        else:
            anchor = finding.get("currentAnchor")
            if anchor is not None:
                require(isinstance(anchor, dict) and annotation is not None and anchor.get("findingId") == finding["id"] and anchor.get("page") == annotation["page"] == finding.get("page") and anchor.get("bounds") == annotation["bounds"] and anchor.get("comment") == annotation["comment"], "Original task anchor differs from its annotation baseline.")
            else:
                require(finding.get("page") is None, "Unlocated historical finding claims a current page.")
            context = finding.get("historicalContext")
            require(isinstance(context, dict) and all(api.safe_path(context.get(key)) and context[key] in task_files for key in ("marked", "clean")), "Original historical finding context is missing.")
    if task["version"] == 1:
        require(len(requests) == len(task_review["findings"]), "Original task omits annotation findings.")
    else:
        require(all(any(f["id"] == a["id"] and f.get("currentAnchor") for f in requests) for a in task_review["findings"]), "Original task contains unrelated current annotations.")
    response_files = nested("responsePaths", "history/response/")
    response = api.strict_json(response_files.get("response.json", b""))
    require(isinstance(response, dict), "Invalid original response.")
    api.check_payloads(response_files, response.get("files"), "response.json")
    require(response.get("schema") == "score-desk-response" and type(response.get("version")) is int and response["version"] == 1 and response.get("taskId") == task["id"] and response.get("baseline") == baseline and set(response) <= {"schema", "version", "taskId", "baseline", "code", "rendering", "files", "results"}, "Original response identity or authority fields are invalid.")
    require(isinstance(meta.get("entry"), dict) and meta["entry"].get("kind") == "response" and meta["entry"].get("taskId") == task["id"] and isinstance(meta["entry"].get("id"), str) and api.ID.fullmatch(meta["entry"]["id"]) and meta["entry"].get("response") == response and meta["entry"].get("id") == round_.get("responseId") == revision.get("responseId"), "Original response record differs.")
    code, rendering = response.get("code", {}), response.get("rendering", {})
    require(isinstance(code, dict) and isinstance(rendering, dict) and code.get("status") in ("changed", "unchanged") and set(code) <= {"status", "path"} and rendering.get("status") in ("pending", "supplied") and set(rendering) <= {"status", "path", "producer", "compiler"}, "Unsupported response declarations.")
    if rendering.get("compiler") is not None:
        api.text(rendering["compiler"], "rendering compiler declaration", 500, True)
    attachment_id = round_.get("attachmentId")
    require(attachment_id is None or isinstance(attachment_id, str) and api.ID.fullmatch(attachment_id), "Invalid local rendering attachment identity.")
    require(revision.get("attachmentId") == attachment_id, "Completion attachment identity differs from its returned revision.")
    if attachment_id:
        provenance = round_.get("provenance")
        require(isinstance(provenance, dict) and provenance.get("relationship") == "supplier-declared; not established by compilation" and provenance.get("compilationPerformedByScoreDesk") is False, "Missing local rendering attachment declaration.")
        api.text(provenance.get("supplier"), "rendering attachment supplier declaration", 500)
    used = []
    if code["status"] == "changed":
        path = code.get("path")
        require(api.safe_path(path) and path.endswith('.ly') and path in response_files, "Missing proposed LilyPond.")
        used.append(path)
        require(response_files[path] == files[ROLES["ly"]] and api.digest(response_files[path]) != baseline["codeSha256"], "Proposed code differs from the completed candidate.")
    else:
        require(code.get("path") is None and task_files[ROLES["ly"]] == files[ROLES["ly"]], "Unchanged response differs from the original code.")
    if rendering["status"] == "supplied":
        api.text(rendering.get("producer"), "rendering producer declaration", 500)
        path = rendering.get("path")
        require(api.safe_path(path) and path.endswith('.pdf') and path in response_files and api.supported_pdf(response_files[path]), "Missing proposed rendering.")
        used.append(path)
        require(attachment_id or response_files[path] == files[ROLES["rendered"]], "Proposed rendering differs without an attachment record.")
    else:
        require(rendering.get("path") is None and (code["status"] == "unchanged" or attachment_id), "The completed candidate lacks its rendering provenance.")
        if not attachment_id:
            require(task_files[ROLES["rendered"]] == files[ROLES["rendered"]], "Pending response differs from the original rendering without an attachment record.")
    require(set(used) == set(response_files)-{"response.json"}, "Response contains unrelated files.")
    results = response.get("results")
    ids = {f["id"] for f in requests}
    require(isinstance(results, list) and len(results) == len(ids) and all(isinstance(r, dict) and isinstance(r.get("id"), str) for r in results) and {r.get("id") for r in results} == ids, "Response findings differ from the original task.")
    for item in results:
        require(set(item) <= {"id", "status", "explanation", "codeLocation"} and item.get("status") in ("changed", "unchanged_with_reason", "needs_clarification") and (item["status"] != "changed" or code["status"] == "changed"), "An imported response cannot grant approval.")
        api.text(item.get("explanation"), "response explanation", 8000)
        if "codeLocation" in item:
            api.text(item["codeLocation"], "response code location", 1000, True)
    require({f.get("id") for f in reported} == ids and len(reported) == len(ids), "Returned review lost original findings.")
    for finding in reported:
        original = next(f for f in requests if f["id"] == finding["id"])
        require(type(finding.get("number")) is int and finding["number"] == original.get("number") and finding.get("agent") == next(r for r in results if r["id"] == finding["id"]), "Returned finding differs from its original response.")
        api.text(finding.get("comment"), "returned finding comment", 4000, True)
        api.text(finding.get("explanation"), "returned finding explanation", 4000, True)
        origin = original.get("origin") or {"taskId": task["id"], "findingId": original["id"], "page": original.get("page"), "renderSha256": baseline["renderSha256"]}
        context = ([original["historicalContext"][key] for key in ("marked", "clean")] if task["version"] == 2 else [f"findings/{original['number']:03d}-{original['id']}-{key}.png" for key in ("marked", "clean")])
        require(isinstance(origin, dict) and finding.get("origin") == origin and finding["comment"] == origin.get("comment", original["comment"]) and finding.get("context") == context and all(path in task_files for path in context), "Returned finding lost its original comment or visual context.")
        decision = finding.get("decision")
        require(finding["state"] != "resolved" or isinstance(decision, dict), "A historical resolved state lacks its recorded local decision.")
        if decision is not None:
            require(isinstance(decision, dict) and decision.get("state") == finding["state"] and decision.get("reviewed") == {"snapshotId": review["snapshotId"], "codeSha256": hashes["ly"], "renderSha256": hashes["rendered"]}, "Historical local decision refers to different candidate bytes.")
    require(round_.get("contentSnapshotId") == review["snapshotId"] and round_.get("codeSha256") == hashes["ly"] and round_.get("renderSha256") == hashes["rendered"] and baseline["sourceSha256"] == hashes["source"], "Completed candidate identity differs from its correction history.")
    result.update(task=task, task_review=task_review, task_files=task_files, baseline=baseline, response=response)
    return result


def migrate(store, slug, body, user, api):
    """Atomically retain evidence and create an unapproved shared contribution."""
    require = api.require
    require(isinstance(body, dict) and set(body) <= {"requestId", "package"}, "Import accepts only the original ZIP and a retry ID. Identity and approval are assigned by the service.", 403)
    raw = api.zip_bytes(body.get("package"))
    try:
        evidence = inspect_completion(raw, api)
    except (KeyError, TypeError, AttributeError, ValueError, OverflowError, RecursionError):
        raise api.Problem("This completed review has missing or unsupported evidence. Keep the original ZIP; your local work is unchanged.") from None
    sha = api.digest(raw)
    completion = evidence["record"]
    with store.db(write=True) as db:
        def operation():
            # A successful import remains reopenable even after the project advances.
            for prior in store.records(db, slug, "completion-import"):
                if prior["originalPackageSha256"] == sha:
                    return prior
                require(prior["completionId"] != completion["id"], "This completed review was already imported with different bytes. Use its original receipt or export a new completed review.", 409)
            current = store.current(db, slug)
            original_review = evidence.get("task_review", evidence["review"])
            baseline = evidence.get("baseline", {"snapshotId": original_review["snapshotId"], "annotationSha256": api.digest(evidence["files"]["annotations.json"]),
                **{field: original_review["files"][role]["sha256"] for role, field in (("source", "sourceSha256"), ("ly", "codeSha256"), ("rendered", "renderSha256"))}})
            require(current["files"]["source"]["sha256"] == baseline["sourceSha256"], "This review uses a different printed source. Choose its matching project work; your local work is unchanged.", 409)
            require(current["files"]["ly"]["sha256"] == baseline["codeSha256"], "The project's score has changed since this review began, or a different work was selected. Keep the original ZIP and proofread the current score before submitting corrections.", 409)
            original_task = evidence.get("task")
            if original_task and original_task.get("shared"):
                require(original_task["shared"].get("workId") == slug, "The original task belongs to a different project work.", 409)
            ident, stamp = str(uuid.uuid4()), api.now()
            link = {"id": ident, "packageUrl": f"/api/completion-imports/{ident}/package", "completionId": completion["id"],
                    "originalPackageSha256": sha, "originalBaseline": baseline, "originalTaskId": original_task["id"] if original_task else None,
                    "originalResponseId": completion["revision"].get("responseId"), "scope": completion["scope"], "scopeNote": completion["scopeNote"],
                    "importedReviewerLabel": completion.get("reviewer"), "originalCreatedAt": completion.get("createdAt"),
                    "authority": "Historical evidence only; imported names and decisions grant no approval or verification."}
            generated_bytes = 0

            def retain_package(data):
                nonlocal generated_bytes
                generated_bytes += len(data)
                require(generated_bytes <= 2 * api.MAX_ZIP, "This review's retained context exceeds the import size limit. Keep the original ZIP and submit smaller reviews.", 413)
                return store.put_blob(db, data, "application/zip")

            def local_id(kind, original):
                return str(uuid.uuid5(uuid.NAMESPACE_URL, f"opus-completion:{ident}:{kind}:{original}"))

            def retain_assets(review, files):
                assets = {}
                for role, path in ROLES.items():
                    asset_sha = store.put_blob(db, files[path], "text/plain; charset=utf-8" if role == "ly" else "application/pdf")
                    require(asset_sha == review["files"][role]["sha256"], "Imported asset identity differs.")
                    assets[role] = {**review["files"][role], "available": True, "url": "/api/assets/"+asset_sha}
                return assets

            def report(review, files, scope, annotations, *, proposal_id=None, references=(), kinds=None, report_id=None):
                report_id = report_id or str(uuid.uuid4())
                review = deepcopy(review)
                review["findings"] = deepcopy(annotations)
                review["nextNumber"] = max([a["number"] for a in annotations] or [0])+1
                for a in review["findings"]:
                    a["state"] = "needs_source_clarification" if (kinds or {}).get(a["id"]) in ("source_error", "clarification") else "open"
                api.validate_review(review, review["files"], review["snapshotId"])
                retain_assets(review, files)
                provenance = {"origin": "candidate", "proposalId": proposal_id, "rootProposalId": proposal_id, "renderingRevision": 1} if proposal_id else {"origin": "local-completion"}
                findings = []
                for a in review["findings"]:
                    kind = (kinds or {}).get(a["id"], "transcription")
                    findings.append({"id": local_id("finding", a["id"]), "version": 1, "originalId": a["id"], "reportId": report_id,
                        "author": user, "displayName": "", "comment": a["comment"], "kind": kind,
                        "reviewed": {"snapshotId": review["snapshotId"], **{field: review["files"][role]["sha256"] for role, field in (("source", "sourceSha256"), ("ly", "codeSha256"), ("rendered", "renderSha256"))}, **provenance},
                        "annotation": a, "pages": review["pages"], "state": a["state"], "reportPackage": f"/api/reports/{report_id}/package", "discussion": None})
                safe_raw, _, _ = seal({path: files[path] for path in ROLES.values()}, review)
                api.package(safe_raw)
                value = {"id": report_id, "workId": slug, "createdAt": stamp, "author": user, "displayName": "", "scope": scope,
                    "clean": not findings and not references and scope["kind"] != "report", "reviewed": {"snapshotId": review["snapshotId"], "files": review["files"], "repositoryRevision": None, **provenance},
                    "findings": findings, "findingIds": [f["id"] for f in findings]+list(references), "referencedFindingIds": list(references),
                    "discussion": None, "status": "submitted", "verification": "Not verified", "localCompletionImport": link,
                    "packageSha256": retain_package(safe_raw), "url": f"/api/reports/{report_id}"}
                store.insert(db, "report", slug, value)
                return value

            proposal_id, task_id, task_reports, mapping = None, None, [], {}
            if original_task:
                task_id, proposal_id = str(uuid.uuid4()), str(uuid.uuid4())
                task_review = deepcopy(original_review)
                task_review["findings"] = []
                task_payloads = dict(evidence["task_files"])
                requests, all_findings, groups, specs = [], [], {}, []
                for request in original_task["findings"]:
                    old_id = request["id"]
                    context = deepcopy(request.get("historicalContext", {}))
                    if original_task["version"] == 1:
                        context = {key: f"findings/{request['number']:03d}-{old_id}-{key}.png" for key in ("marked", "clean")}
                    original_annotation = next((a for a in original_review["findings"] if a["id"] == old_id), None)
                    finding_review, finding_files = original_review, evidence["task_files"]
                    if original_annotation is None:
                        # An older location must have its own exact geometry and bytes.
                        path = context.get("annotations")
                        require(api.safe_path(path) and path in task_payloads and isinstance(context.get("originalFiles"), dict), "This older task is missing the original location of a finding. Keep its ZIP and locate the finding on the current score before submitting.", 409)
                        finding_review = api.strict_json(task_payloads[path])
                        finding_files = {}
                        for role, target in ROLES.items():
                            info = context["originalFiles"].get(role, {})
                            require(api.safe_path(info.get("path")) and info["path"] in task_payloads, "Original finding files are missing.")
                            data = task_payloads[info["path"]]
                            require(api.digest(data) == info.get("sha256") and len(data) == info.get("size"), "Original finding files differ.")
                            finding_files[target] = data
                        recovered, _, _ = seal(finding_files, finding_review)
                        api.package(recovered)
                        original_annotation = next((a for a in finding_review["findings"] if a["id"] in (old_id, request.get("origin", {}).get("originalId"))), None)
                    require(original_annotation, "The original task finding is missing its retained annotation.")
                    kind = request.get("kind", "clarification" if original_annotation["state"] == "needs_source_clarification" or (request.get("reviewer") or {}).get("state") == "needs_source_clarification" else "transcription")
                    require(kind in ("transcription", "source_error", "clarification"), "Unsupported original finding kind.")
                    projected_annotation = deepcopy(original_annotation)
                    if projected_annotation["comment"] != request["comment"]:
                        require(original_task["version"] == 2 and request.get("currentAnchor") and finding_review is original_review,
                                "This older finding has conflicting historical comments. Keep its ZIP and locate the finding on the current score before submitting.", 409)
                        # The new request keeps the original observation; the later
                        # region note remains exact, explicitly untrusted history.
                        if request["comment"].strip() or projected_annotation["strokes"]:
                            projected_annotation["comment"] = request["comment"]
                    require(type(request.get("number")) is int and 0 < request["number"] <= 99999, "Invalid original finding number.")
                    key = api.digest(api.canonical(finding_review).encode())
                    group = groups.setdefault(key, {"review": finding_review, "files": finding_files, "annotations": [], "kinds": {}, "requested": {}, "history": {}})
                    require(original_annotation["id"] not in group["requested"], "The original task requests the same annotation more than once.", 409)
                    group["annotations"].append(projected_annotation)
                    group["kinds"][original_annotation["id"]] = kind
                    group["requested"][original_annotation["id"]] = old_id
                    group["history"][original_annotation["id"]] = [{"kind": "imported-local-review", "trust": "untrusted historical observations; no approval or authority",
                        "originalTaskId": original_task["id"], "request": deepcopy(request), "originalAnnotation": deepcopy(original_annotation),
                        "returnedFinding": deepcopy(next(f for f in evidence["round"]["reported"] if f["id"] == old_id))}]
                    specs.append((request, context, key, original_annotation["id"]))
                by_original = {}
                for key, group in groups.items():
                    baseline_report = report(group["review"], group["files"], {"kind": "report", "description": "Original findings in an imported correction task."}, group["annotations"], kinds=group["kinds"])
                    task_reports.append(baseline_report)
                    for finding in baseline_report["findings"]:
                        old_id = group["requested"][finding["originalId"]]
                        finding["id"] = local_id("requested", old_id)
                        finding["history"] = group["history"][finding["originalId"]]
                        mapping[old_id] = finding["id"]
                        by_original[(key, finding["originalId"])] = finding
                    baseline_report["findingIds"] = [f["id"] for f in baseline_report["findings"]]
                    db.execute("UPDATE records SET body=? WHERE id=?", (api.canonical(baseline_report), baseline_report["id"]))
                for request, context, key, annotation_id in specs:
                    finding = by_original[(key, annotation_id)]
                    mapped = mapping[request["id"]]
                    finding_review = groups[key]["review"]
                    all_findings.append(finding)
                    if finding_review["snapshotId"] == original_review["snapshotId"] and finding_review["pages"] == original_review["pages"]:
                        task_review["findings"].append({**finding["annotation"], "id": mapped, "number": request["number"], "state": finding["state"]})
                    requests.append({"id": mapped, "number": request["number"], "historicalContext": context})
                require(len({r["number"] for r in requests}) == len(requests), "Duplicate original finding numbers.")
                task_review["nextNumber"] = max(r["number"] for r in requests)+1
                task_payloads["annotations.json"] = encoded(task_review)
                new_baseline = {**baseline, "annotationSha256": api.digest(task_payloads["annotations.json"])}
                safe_task = {"id": task_id, "baseline": new_baseline, "findings": requests}
                sequence = db.execute("SELECT COALESCE(MAX(seq),0) FROM events WHERE work=?", (slug,)).fetchone()[0]
                snapshot = {"id": str(uuid.uuid4()), "workId": slug, "work": store.metadata(slug), "createdAt": stamp, "revision": sequence,
                    "current": {**current, "snapshotId": original_review["snapshotId"], "files": retain_assets(original_review, evidence["task_files"]), "repositoryRevision": None, "origin": {"kind": "local-completion", "importId": ident}},
                    "findings": all_findings, "reports": task_reports, "proposals": [], "applications": [], "localCompletionImport": link}
                snapshot["assets"] = snapshot["current"]["files"]
                value = {"id": task_id, "kind": "task", "workId": slug, "snapshotId": snapshot["id"], "createdAt": stamp, "author": user,
                    "task": safe_task, "baseline": new_baseline, "repositoryRevision": current["repositoryRevision"], "packageUrl": f"/api/tasks/{task_id}/package", "localCompletionImport": link}
                safe_raw, delivered_task, instructions = api.build_delivery(value, snapshot, task_payloads, evidence["manifest"], task_review)
                api.package(safe_raw)
                value.update(task=delivered_task, instructions=instructions, packageSha256=retain_package(safe_raw))
                store.insert(db, "snapshot", slug, snapshot)
                store.insert(db, "task", slug, value)
                candidate_review, candidate_files = evidence["review"], evidence["files"]
                retain_assets(candidate_review, candidate_files)
                changed = candidate_review["files"]["ly"]["sha256"] != baseline["codeSha256"]
                response_files = {"proposed.pdf": candidate_files[ROLES["rendered"]]}
                if changed:
                    response_files["proposed.ly"] = candidate_files[ROLES["ly"]]
                response = {"schema": "score-desk-response", "version": 1, "taskId": task_id, "baseline": new_baseline,
                    "code": {"status": "changed" if changed else "unchanged", "path": "proposed.ly" if changed else None},
                    "rendering": {"status": "supplied", "path": "proposed.pdf", "producer": "Imported completed review", "compiler": None},
                    "results": [{**r, "id": mapping[r["id"]]} for r in evidence["response"]["results"]],
                    "files": {path: {"size": len(data), "sha256": api.digest(data)} for path, data in response_files.items()}}
                require(not changed or any(r["status"] == "changed" for r in response["results"]), "Changed code needs an identified changed finding in its original response.", 409)
                response_files["response.json"] = encoded(response)
                candidate = {"sourceSha256": candidate_review["files"]["source"]["sha256"], "codeSha256": candidate_review["files"]["ly"]["sha256"], "renderSha256": candidate_review["files"]["rendered"]["sha256"],
                    "snapshotId": candidate_review["snapshotId"], "renderingStatus": "supplied", "relationship": "supplier-declared; not established by compilation", "compilationVerified": False}
                proposal = {"id": proposal_id, "kind": "proposal", "workId": slug, "taskId": task_id, "createdAt": stamp, "author": user, "responseAuthor": user, "codeAuthor": user,
                    "parentProposalId": None, "rootProposalId": proposal_id, "renderingRevision": 1, "renderingContributors": [user],
                    "renderingProvenance": {"mode": "local-completion", "author": user, "producer": "Imported completed review", "compiler": None, "compilationVerified": False},
                    "response": response, "candidate": candidate, "status": "awaiting_review", "localCompletionImport": link,
                    "packageSha256": retain_package(archive(response_files)), "packageUrl": f"/api/proposals/{proposal_id}/package"}
                proposal["candidateCurrent"] = store.candidate_revision(db, proposal)
                store.insert(db, "proposal", slug, proposal)

            scope = {"kind": "whole" if completion["scope"] == "entire" else "partial", "description": completion["scopeNote"] or ("Entire score" if completion["scope"] == "entire" else "Reported corrections" if completion["scope"] == "corrections" else "Partial score review")}
            new_annotations = [a for a in evidence["review"]["findings"] if a["id"] not in evidence["associated"]]
            require(original_task or completion["scope"] != "corrections", "A corrections-only completion must retain its original task.", 409)
            coverage = report(evidence["review"], evidence["files"], scope, new_annotations, proposal_id=proposal_id, references=list(mapping.values()),
                kinds={a["id"]: "clarification" for a in new_annotations if a["state"] == "needs_source_clarification"})
            receipt = {"id": ident, "kind": "completion-import", "workId": slug, "createdAt": stamp, "author": user, **link,
                "proposalId": proposal_id, "reportId": coverage["id"], "baselineReportIds": [r["id"] for r in task_reports], "taskId": task_id,
                "findingIdMap": mapping, "status": "awaiting_review" if proposal_id else "submitted", "originalCompletion": completion,
                "packageSha256": store.put_blob(db, raw, "application/zip")}
            store.insert(db, "completion-import", slug, receipt)
            return receipt
        try:
            return store.idempotent(db, user, body.get("requestId"), {"requestId": body.get("requestId"), "packageSha256": sha}, operation, f"completion-imports:{slug}")
        except (KeyError, TypeError, AttributeError, ValueError, OverflowError):
            raise api.Problem("This completed review cannot be imported with its original context. Keep its ZIP; no shared records were added and your local work is unchanged.", 409) from None
