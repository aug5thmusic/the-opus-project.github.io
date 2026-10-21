# Score Encoding Project Handbook

Version 1.0 · 27 September 2026

The OPUS Project records public-domain printed music as editable LilyPond. Its long-term aim is to cover every eligible public-domain score on IMSLP. Each new transcription follows a specific printed edition, not an existing digital encoding.

## Ground rules

- **Public domain:** Original project files are dedicated to the public domain under [CC0 1.0](LICENSE). A linked scan is not relicensed by this project; its edition and eligibility must be checked separately, including the relevant jurisdiction.
- **Faithful preservation:** Encode what the chosen source prints, even when it appears mistaken. Record suspected source errors separately. Do not silently substitute a musically preferable reading.
- **One canonical source:** LilyPond is the editable source. PDF, SVG, MIDI, and MusicXML, when offered, are derived outputs tied to a particular LilyPond revision.
- **No score recognition:** For new transcriptions, inspect the printed source visually and enter LilyPond directly. Do not use Audiveris, other OMR/OCR-to-score systems, audio-to-score, MusicXML-to-LilyPond, MIDI-to-LilyPond, or an existing digital transcription as the source of notes.

## People and responsibilities

| Role | Responsibility |
| --- | --- |
| Transcribers | Use AI to encode the agreed printed source in LilyPond and compare the render with it. |
| Proofreaders | Compare the source and rendered PDFs, then report precise findings and coverage. No clone or notation software is needed. |
| Correctors | Fix confirmed encoding errors in LilyPond and return affected material to review. |
| Verifiers | Confirm complete coverage and approve a specific corrected revision. |
| Technical maintainers | Maintain the repository, builds, website, and release records. |
| Converters | Generate and validate optional formats from verified LilyPond. |
| Project stewards | Set policy, grant permissions, appoint trusted verifiers and moderators, and resolve unusual cases. |
| Curators and campaign organizers | Prioritize works, define achievable campaigns, divide work into units, and prevent duplicate claims. |
| Scouts | Check archives such as Mutopia and OpenScore for existing encodings; record edition, format, license, and review state before recommending new work. |
| Librarians | Record the exact edition, scan, scope, instrumentation, identifiers, and eligibility basis. |
| Community moderators | Organize discussions and handle spam or abuse; moderation alone does not confer verification authority. |
| Documentation contributors | Maintain practical guides, examples, and prompts for new contributors. |

These are responsibilities, not claims that the roles are currently staffed.

## Transcribing and self-review

The current pilot uses two independent agent transcriptions followed by an agent reconciliation against the same printed source. A human verifies only after that. Independence does not make a raw first pass trustworthy: **each transcription run needs at least two substantive prompting passes; three are preferred.** A contributor may make one broad “help out” request and have the agent conduct these passes autonomously.

1. **Initial encoding:** Define the edition, pages, movements or parts, and enter LilyPond. Compile and note missing material or visible discrepancies.
2. **Targeted correction (required):** Prompt for or make specific corrections based on comparison with the printed page. Recompile and check the actual changes.
3. **Further validation (preferred):** Recheck difficult passages and regressions. Repeat targeted correction as needed.

Before requesting review, compare every page in scope: notes and rests, rhythm, accidentals, voices, clefs, key and time signatures, repeats, ties, slurs, articulations, dynamics, pedal marks, text, and lyrics where present. Submit the LilyPond, rendered PDF, exact scan reference, scope, LilyPond version, model identifier, unresolved passages, suspected source errors, and limitations. Compiling proves syntax, not fidelity.

## Work states

| State | Exit condition |
| --- | --- |
| Identified | A work record and candidate source exist. |
| Source Check | Existing encodings, edition identity, completeness, legibility, and eligibility have been checked. |
| Ready | A bounded unit and source metadata are recorded. |
| Claimed | A contributor has visibly reserved the unit. |
| Transcribing | LilyPond is being encoded, compiled, and compared. |
| Self Reviewed | The required targeted correction pass is complete; uncertainties are listed. |
| Review Needed | Source, code, render, and review scope are available for independent comparison. |
| Corrections Needed | Findings are being corrected in LilyPond. The affected material then returns to Review Needed. |
| Verified | A verifier has confirmed full coverage and approved an exact revision. |
| Conversion and Build | Intended outputs have been generated and independently validated against that revision. |
| Published | An authorized maintainer has released the files with provenance, revision, review state, and format limitations. |

**Blocked** may be used at any stage. Record the reason, last completed state, and condition for resuming. “Reviewed” is not “Verified.” The current pilot metadata tracks agent step and human verification; the finer states above are policy for work records and Discussions until they are represented in the catalog.

## Reporting and correcting

On a work’s **Compare PDFs** page, compare the printed and rendered scores and report on that page. Give the source PDF page, movement, measure, part or staff, and beat or note position; say what each score shows and identify the transcription revision. If the source lacks measure numbers, use page, system, staff, and position. Attach a crop only when the location is otherwise hard to identify.

Example: “Source PDF page 8, movement II, measure 37, violin II, beat 2: the source prints C-sharp; revision abc123 renders C-natural.”

Each finding should have a visible state: **Open**, **Corrected pending review**, **Resolved**, or **Needs source clarification**. A reviewer confirms the result before closing it. An encoding error must be fixed; an apparent source error is reproduced and documented; an ambiguous passage remains unresolved until evidence supports a reading.

If an error is found after publication, link the report to the affected revision, correct LilyPond, review the correction, and release a new current version. Keep earlier release history.

## Archive record and derived formats

Retain the composer, title, catalogue number, instrumentation, movements and version, transcription boundaries, edition/editor/arranger/publisher/date where known, exact scan URL or identifier and page range, and a documented eligibility basis with jurisdiction. Record contributors, canonical revision, LilyPond version, review coverage, verifier/date, open findings, source notes, output filenames, build or conversion versions, validation results, and limitations. Unknown fields remain unknown; do not invent them.

The verified LilyPond revision is canonical. PDF is the reference render; SVG, MIDI, and MusicXML are optional derived formats. Test conversion methods—including non-AI tools—and check whether they preserve the music. Correct source mistakes in LilyPond and rebuild. Fix conversion-only errors in the conversion process or record a reproducible exception. Track LilyPond verification and each format’s validation separately: a verified LilyPond score may be released while MusicXML remains pending.

## Start small

The first campaign should take a small, clearly printed unit through source check, two independent transcriptions, reconciliation, human review, correction, verification, build, and publication. Record effort and failures, then improve the practical guides. Do not label a draft or an invalid attempt as verified merely because it compiles.

The contributor documentation should grow from that pilot: Quick Start, Transcription Guide, LilyPond Style Guide, Proofreading Guide, Metadata and Provenance Guide, and AI Prompt Library, each with worked examples and common errors. The README and contribution page provide the current quick start; the other guides are not yet complete.
