# Scottish Legend: replacement first transcription

Status: **Self Reviewed; independent Step 2 still needed.** This replaces the withdrawn first attempt with a new visual transcription of the complete printed work. The metadata remains at Step 1/3 and `verified_by` remains `null`. Removing `withdrawn` makes this an explicitly unverified first draft in the catalog; it does not constitute human approval.

## Edition and scope

- Amy Beach, *Scottish Legend*, Op. 54, No. 1; Boston: Arthur P. Schmidt, 1903, plate A. P. S. 6151.
- [IMSLP edition record](https://imslp.org/wiki/2_Piano_Pieces,_Op.54_(Beach,_Amy_Marcy)), file **867556**, scanned from the University of Oregon copy.
- [Exact printed PDF](https://imslp.org/imglnks/usimg/4/4c/IMSLP867556-PMLP20615-73666450z_content.pdf#page=2).
- Whole downloaded PDF SHA-256: `0ab6ba017412949ef3e629e2514095f4908304e63f89a9d7ef87b5cf726784fe`.
- Music: PDF pages 2–3, also printed pages 2–3. The cover and final advertisement page are outside the transcription.
- Scope: an eighth-note pickup and 36 numbered measures, with a seven-eighth closing measure. Both pages have five systems; the replacement retains that system sequence and page turn.
- Eligibility: the edition record labels this 1903 print public domain. Its 1903 publication also places it outside the U.S. publication copyright term. The project transcription is CC0; the scan is not relicensed.

## Run and revision

- Model: `openai/gpt-6-astra`.
- Configuration: Codex; reasoning effort `xhigh`. Exact client version, temperature, top-p and seed: not exposed in the run record used for provenance.
- Run date: 2026-10-18.
- LilyPond: 2.26.0 locally; source declares 2.24.3 for the repository CI.
- Reviewed notation SHA-256: `f730330ad4dbb07a4ebe09efde59160c1e16d96861b285cfd021802f73ada9c7`.

Only the named printed PDF supplied musical content. Poppler rendered it, and Pillow cropped and enlarged it for visual reading. No OMR, OCR, audio recognition, notation import or existing digital transcription supplied notes. The withdrawn attempt's musical contents were not used to construct the replacement. This is a single agent's replacement Step 1; it supplies neither an independent second attempt nor a reconciliation.

## Review coverage and corrections

The initial encoding was followed by two source/render comparison passes and further recompilation of the corrections. Both staves were compared throughout, including pitches, accidentals, durations, independent voices, grace groups, ties, slurs, dynamics, accents, staccato marks, pedal changes, tempo text, clefs, key changes and fermatas.

| Printed page | Systems and numbered measures compared |
| --- | --- |
| 2 | System 1: pickup, 1–3; system 2: 4–7; system 3: 8–11; system 4: 12–14; system 5: 15–18 |
| 3 | System 1: 19–22; system 2: 23–26; system 3: 27–29; system 4: 30–32; system 5: 33–36 |

Corrections during self-review included the D-flat/F inner voice in measure 2; explicit B-flat spellings in the one-flat sections; accidental carry in measures 4, 10, 14, 18, 20, 26, 30 and 34; bass pitches and held-note durations; the grace-note ties in measures 8, 16 and 36; the triplet and tie in measure 6; the upper ledger notes and bass return in measures 26–28; pedal attacks before grace groups; and the closing partial bar. The printed words “ritenuto,” “molto ritenuto,” “marcato,” “lunga” and “m.s.” are retained. The cross-staff grace passages remain small notes, rather than counted beats.

The three earlier withdrawal findings are **Corrected pending independent review**:

- The whole score now uses common time, with the printed pickup and partial ending, replacing the failed 6/8 structure.
- Both printed piano staves and their changing voices replace the simplified chord sequence.
- The varying pedal, expression and articulation marks replace the repeated generic pedal pattern.

Review priority: the small dot over the E-octave in measure 35 is interpreted as staccato; confirm its placement in the print. The cross-staff grace groups in measures 12, 28 and 32 and the dense upper-register chords in measures 26–28 also deserve a fresh independent reading. This record does not claim that self-review has eliminated every transcription error. No suspected compositional error has been silently corrected.

Engraving differs from the print in font, spacing, some stem/slur directions, and the placement of tempo text. Measure numbers and the draft subtitle are editorial aids. “Ritenuto” is written as a word rather than distributed as syllables. These changes are not claims about an alternative musical edition.

## Validation

- The replacement compiles with LilyPond 2.26.0 without warnings or errors, and its two rendered pages were inspected visually.
- `python3 -B scripts/check.py --write`: all seven LilyPond files compile; metadata and the generated catalog pass.
- `python3 -B scripts/test_check_pr.py`: agent, human, negative and non-score fixtures pass.
- `python3 -B scripts/build_site.py OUTPUT`: one catalog work and two existing review drafts build successfully.
- A temporary HTTP preview serves the Step 1 catalog entry, the exact committed LilyPond bytes and the generated PDF. A fresh download of the linked printed PDF matches the recorded digest.

The local Nix font configuration required an isolated Liberation-font configuration to avoid a system CFF2 font unsupported by the PostScript backend. No system font settings or fonts are committed with this score.

## Previous withdrawn run

The old Step 1 was attributed to `gpt-6-sol xhigh`. Its invalid notation and the original withdrawal findings remain in Git history, including base revision `8be2a0c`. The replacement changes the current Step 1 model entry, rather than counting the failed draft as another completed agent step.
