# OPUS handbook

## Transcribe

Choose a useful incomplete score or a bounded missing work from a printed public-domain edition. Check its edition, eligibility and existing encodings. Record the library ID, direct PDF URL, pages, review scope and whole-file SHA-256 in `metadata.json`.

Read the print visually and enter LilyPond directly. Audiveris, OMR/OCR, automated score recognition, audio/PDF-to-score, MusicXML/MIDI conversion and borrowed digital transcriptions must never supply notes. Viewing, cropping and compilation tools are allowed. Commit LilyPond, metadata and review records; keep scans and generated PDFs outside Git.

Use three distinct agents:

1. Agent A writes `attempts/01.ly`, compiles it, compares the whole render with the print, and makes a targeted correction pass.
2. Agent B independently writes `attempts/02.ly` without reading A's notation, then performs the same checks.
3. Agent C reconciles both attempts against the print to produce `score.ly` and a reconciliation record.

Keep score PRs focused on notation and metadata. Website changes and review records belong in a separate PR; records live under `review-notes/<slug>/`.

Preserve every printed note, rhythm, voice, accidental, clef, repeat, tie, slur, expression, fingering, text and pedal mark. Reproduce suspected source errors and document them. Record unreadable or ambiguous passages without guessing.

## Report the run

The human running an agent reports its exact provider/model ID, agent/client version, reasoning effort, other exposed settings and relevant overrides for each run. Write `not exposed` for unavailable settings. Transcription PRs require `Step: N/3`, `Model:`, `Configuration:` and `Source:`. Metadata records the exact model for each completed step.

## Human check

Open [Compare PDFs](https://the-opus-project.github.io/proofread.html), zoom, and compare the entire work bar by bar and staff by staff. Report the source page/system/bar/staff/beat, each discrepancy, full or partial coverage, and the displayed score SHA-256. The GitHub form fills in the source and hash. No clone or notation software is needed.

Correct errors in LilyPond, rebuild, and have the human recheck them. Typography and spacing may differ. `verified_by` stays null until a human approves every staff and mark at an exact canonical score digest. Compilation alone does not verify music. A human verification PR uses `Review: human`, `Proofreader: @github-name`, `Source:`, full coverage and the exact revision. Do not merge before human review.

## Build

```sh
python3 scripts/check.py --write
mkdir -p .build
python3 scripts/build_site.py .build/site
```

Use a new output path. Builds render PDFs and derive the catalog. The Pages workflow reads a selected score PR without merging it and labels its drafts. It follows open seed PR #3 by default; select `0` for main only. Original project files are CC0-1.0; linked scans retain their own rights.
