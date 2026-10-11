# The OPUS Project

Open Public-domain Universal Scores.

A crowdsourced project to transcribe the world's music with AI.

Clone the repository, open it in Codex or Claude Code, and ask for one thing:

```text
Help out with The OPUS Project until my usage runs down.
```

or:

```text
Transcribe Schubert's Impromptu in G-flat major, D 899 No. 3.
```

The agent reads [AGENTS.md](AGENTS.md), chooses the next independent transcription or review, validates it, and leaves a pull-request-ready change. Contributors do not need to know LilyPond.

The [Score Encoding Project Handbook](HANDBOOK.md) defines source fidelity, self-review, human verification, corrections, and publication. Each AI transcription needs an initial encoding and at least one targeted correction pass after comparing its render with the printed score; a third validation pass is preferred.

## The whole system

Each work lives in `pieces/<slug>/`:

- `metadata.json` records the exact printed source.
- `attempts/01.ly` and `attempts/02.ly` are independent transcriptions made by different agents.
- `score.ly` is the third agent's reconciliation of both attempts against the printed source.
- `verified_by` records the human proofreader after they compare the reconciled PDF with the original scan.

The catalog distinguishes agent progress, scores awaiting proofreading, and human-verified scores. Metadata records the exact model used for each agent run.
An attempt found to be wrong can be marked `withdrawn` in metadata; it remains in Git history and validation but is omitted from the public catalog until repaired. Reconciled drafts can still appear on the separate proofreading page, clearly marked as drafts.

Proofreading does not require a clone or LilyPond. Open a work's **Compare PDFs** link in the catalog, or choose a draft from the [proofreading page](proofread.html), to see the original printed PDF beside the rendered transcription. An alternate high-resolution scan is linked when available. Report findings in the on-page discussion. A maintainer records human verification only after a full comparison of a specific revision. GitHub sign-in is required to post; reading the scores is open.

Only LilyPond notation belongs in the repository. Every attempt is entered visually from the printed edition; OMR/OCR score recognition, MusicXML or MIDI conversion, and existing digital transcriptions are forbidden. Source PDFs stay at the public library; their URL and SHA-256 digest go in metadata.

## Check a change

Install LilyPond and run:

```sh
python3 scripts/check.py --write
```

To preview the site with generated PDFs (choose an output path that does not already exist):

```sh
mkdir -p .build
python3 scripts/build_site.py .build/site
python3 -m http.server 8000 --directory .build/site
```

Then open `http://localhost:8000`. A merge to `main` validates the repository, derives the catalog from piece metadata, compiles the current LilyPond sources to PDF, and deploys the site through GitHub Pages.

## Licensing

Original repository code, documentation, metadata, and LilyPond transcriptions are dedicated to the public domain under [CC0 1.0](LICENSE). This dedication does not cover linked third-party scans. Their provenance is recorded in each work's metadata and in [SCORES.md](SCORES.md).
