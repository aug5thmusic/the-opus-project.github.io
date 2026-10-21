"""Static contributor deployment checks; no score compilation or network IO."""
from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path, PureWindowsPath
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_site
import check


class RuntimeHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.urls.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.urls.append(attrs["href"])


class ContributorBuild(unittest.TestCase):
    def setUp(self):
        runtime = build_site.ROOT / ".build/tests/build-site"
        runtime.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        self.output = Path(self.temp.name) / "nested/site"
        self.root.mkdir()
        self.output.mkdir(parents=True)

    def fixture(self):
        """Small explicit fixture, independent of current production file bytes."""
        for relative in [*("contributor/" + n for n in build_site.CONTRIBUTOR_FILES),
                         *("contributor/score/" + n for n in build_site.SCORE_FILES),
                         "AGENTS.md", "HANDBOOK.md"]:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture: " + relative, encoding="utf-8")
        vendors = ["pdf.mjs", "pdf.worker.mjs", "cmaps/Adobe-Japan1-0.bcmap",
                   "standard_fonts/FoxitSerif.pfb", "wasm/openjpeg.wasm", "PDFJS-LICENSE"]
        for relative in vendors:
            path = self.root / "contributor/score/vendor" / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"synthetic runtime fixture")
        (self.root / "scripts").mkdir()
        (self.root / "scripts/contributor_vendor_files.json").write_text(
            json.dumps({"schema": 1, "files": vendors}), encoding="utf-8")
        return vendors

    def test_only_allowlisted_runtime_is_published(self):
        self.fixture()
        forbidden = ["contributor/score/qa/bridge.js", "contributor/tests/private.json",
                     "contributor/score/serve.cjs", "contributor/score/package.json",
                     "contributor/score/runtime/reviewer.json", "contributor/score/local.pdf",
                     "contributor/score/response.zip", "contributor/score/screenshot.png",
                     "contributor/score/server.log", "contributor/score/vendor/debug.js",
                     "contributor/search/index.html", "service/server.py",
                     "service/private.sqlite", "service/.env",
                     "contributor/score/qa/shared-packages.test.mjs"]
        for relative in forbidden:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("PRIVATE TEST SENTINEL", encoding="utf-8")
        build_site.copy_contributor_assets(self.output, self.root)
        for relative in forbidden:
            self.assertFalse((self.output / relative).exists(), relative)
        self.assertEqual((self.output / "contributor/score/app.js").read_text(),
                         "fixture: contributor/score/app.js")
        self.assertTrue((self.output / "contributor/score/vendor/wasm/openjpeg.wasm").is_file())

    def test_deployed_guidance_comes_from_current_checkout(self):
        self.fixture()
        stale = self.root / "contributor/score/project-guidance/AGENTS.md"
        stale.parent.mkdir()
        stale.write_text("stale prototype instructions")
        build_site.copy_contributor_assets(self.output, self.root)
        self.assertEqual((self.output / "contributor/score/project-guidance/AGENTS.md").read_text(),
                         (self.root / "AGENTS.md").read_text())

    def test_missing_runtime_fails_before_any_contributor_output(self):
        self.fixture()
        required = self.root / "contributor/score/vendor/cmaps/Adobe-Japan1-0.bcmap"
        required.rename(required.with_suffix(".unavailable"))
        with self.assertRaisesRegex(ValueError, "missing or linked.*Adobe-Japan1"):
            build_site.copy_contributor_assets(self.output, self.root)
        self.assertFalse((self.output / "contributor").exists())

    def test_invalid_vendor_manifest_cannot_escape_allowlist(self):
        self.fixture()
        manifest = self.root / "scripts/contributor_vendor_files.json"
        for value in ([], {"schema": 1, "files": ["../private.json"]},
                      {"schema": 1, "files": ["/secret"]},
                      {"schema": 1, "files": ["C:/secret"]},
                      {"schema": 1, "files": ["pdf.mjs", "PDF.mjs"]}):
            manifest.write_text(json.dumps(value), encoding="utf-8")
            with self.subTest(value=value), self.assertRaises(ValueError):
                build_site.copy_contributor_assets(self.output, self.root)
            self.assertFalse((self.output / "contributor").exists())

    def test_copy_does_not_overwrite_existing_workspace(self):
        self.fixture()
        sentinel = self.output / "contributor/index.html"
        sentinel.parent.mkdir()
        sentinel.write_text("existing output")
        with self.assertRaisesRegex(ValueError, "already exists"):
            build_site.copy_contributor_assets(self.output, self.root)
        self.assertEqual(sentinel.read_text(), "existing output")

    def test_main_refuses_existing_output_before_compiler_or_writes(self):
        sentinel = self.output / "keep.txt"
        sentinel.write_text("untouched")
        with patch.object(sys, "argv", ["build_site.py", str(self.output)]), \
                patch.object(build_site.shutil, "which") as compiler:
            with self.assertRaisesRegex(ValueError, "output already exists"):
                build_site.main()
            compiler.assert_not_called()
        self.assertEqual(sentinel.read_text(), "untouched")

    def test_catalog_urls_use_forward_slashes_on_windows(self):
        piece = self.root / "pieces/synthetic-work"
        attempts = piece / "attempts"
        attempts.mkdir(parents=True)
        (piece / "metadata.json").write_text("{}")
        (attempts / "01.ly").write_text("% synthetic path fixture; not compiled")
        metadata = {"slug": "synthetic-work", "title": "Synthetic work", "composer": "Test composer",
                    "catalogue": "Test 1", "year": "unknown", "instrumentation": "test",
                    "step": 1, "verified_by": None, "source_page": "https://example.org/work",
                    "source_pdf": "https://example.org/source.pdf", "crosscheck_name": "",
                    "crosscheck_url": ""}
        with patch.object(check, "ROOT", self.root), \
                patch.object(check, "PIECES", self.root / "pieces"), \
                patch.object(check, "load_metadata", return_value=metadata), \
                patch.object(check, "Path", PureWindowsPath):
            catalog, sources = check.expected_catalog()
        self.assertEqual(len(sources), 1)
        score = catalog["scores"][0]
        self.assertEqual(score["lilypond_url"], "pieces/synthetic-work/attempts/01.ly")
        self.assertEqual(score["pdf_url"], "pieces/synthetic-work/attempts/01.pdf")
        self.assertNotIn("\\", json.dumps(catalog))

    def test_review_queue_urls_use_forward_slashes_on_windows(self):
        piece = self.root / "pieces/synthetic-draft"
        piece.mkdir(parents=True)
        (piece / "metadata.json").write_text("{}")
        (piece / "score.ly").write_text("% synthetic path fixture; not compiled")
        metadata = {"slug": "synthetic-draft", "title": "Synthetic draft", "composer": "Test composer",
                    "catalogue": "Test 2", "step": 3, "withdrawn": True,
                    "source_page": "https://example.org/work", "source_pdf": "https://example.org/source.pdf",
                    "crosscheck_name": "", "crosscheck_url": ""}
        with patch.object(build_site, "ROOT", self.root), \
                patch.object(build_site, "PIECES", self.root / "pieces"), \
                patch.object(build_site, "load_metadata", return_value=metadata), \
                patch.object(build_site, "Path", PureWindowsPath):
            reviews = build_site.review_queue()
        score = reviews["scores"][0]
        self.assertEqual(score["lilypond_url"], "pieces/synthetic-draft/score.ly")
        self.assertEqual(score["pdf_url"], "pieces/synthetic-draft/score.pdf")
        self.assertNotIn("\\", json.dumps(reviews))

    def test_real_runtime_dependency_graph_survives_nested_hosting(self):
        build_site.copy_contributor_assets(self.output)
        for relative in build_site.PUBLIC_FILES:
            shutil.copy2(build_site.ROOT / relative, self.output / relative)
        for relative in ("catalog.json", "reviews.json"):
            (self.output / relative).write_text('{"scores": []}', encoding="utf-8")
        assets = list((self.output / "contributor").rglob("*"))
        self.assertFalse(any("qa" in p.relative_to(self.output).parts
                             or "tests" in p.relative_to(self.output).parts for p in assets))
        self.assertFalse(any(p.suffix in (".zip", ".pdf", ".log") for p in assets))
        for page in (self.output / "contributor/index.html", self.output / "contributor/score/index.html"):
            parser = RuntimeHTML()
            parser.feed(page.read_text(encoding="utf-8"))
            self.assertTrue(parser.urls, page)
            for relative in parser.urls:
                self.assertFalse(relative.startswith(("/", "http:", "https:")), relative)
                self.assertTrue((page.parent / relative).is_file(), (page, relative))
        modules = [p for p in assets if p.suffix in (".js", ".mjs") and "vendor" not in p.parts]
        for module in modules:
            text = module.read_text(encoding="utf-8")
            imports = re.findall(r'''(?m)^\s*import\s+(?:[^;\n]*?\s+from\s+)?['"]([^'"]+)['"]''', text)
            imports += re.findall(r'''\bimport\s*\(\s*['"]([^'"]+)['"]''', text)
            for relative in imports:
                self.assertTrue(relative.startswith("."), (module, relative))
                self.assertTrue((module.parent / relative).is_file(), (module, relative))
        score = self.output / "contributor/score"
        for relative in ("vendor/pdf.worker.mjs", "vendor/pdf-lib.min.js", "vendor/jszip.min.js",
                         "HANDOFF_FORMATS.md", "shared-client.js", "shared-ui.js", "shared-packages.js",
                         "shared-config.json", "project-guidance/AGENTS.md", "project-guidance/HANDBOOK.md"):
            self.assertTrue((score / relative).is_file(), relative)
        for folder in ("cmaps", "standard_fonts", "wasm", "iccs"):
            self.assertTrue(any((score / "vendor" / folder).iterdir()), folder)


if __name__ == "__main__":
    unittest.main()
