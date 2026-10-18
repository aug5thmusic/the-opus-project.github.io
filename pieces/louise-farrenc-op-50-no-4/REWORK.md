# Étude No. 4: Step 1 source-rework record

This records the first agent attempt, not the current workflow status. The earlier Step 1 file was musically wrong. This replacement was a complete, compiled LilyPond draft; a second independent attempt and third-agent reconciliation have since followed. See `RECONCILIATION.md` and `score.ly`. The work remains withdrawn until human proofreading is complete.

Source: [IMSLP file 511615](https://imslp.org/tools/getindex/511615), PDF page 6, printed page 5, the complete Étude No. 4. The local source PDF used for this run has SHA-256 `72acbae8f1c9a683036bb77b5a644387a2e1bb2622728b6b4c2884aca836ee66`. This Step 1 replacement was made by `gpt-6-sol` at xhigh reasoning effort on 2026-09-28. A processed scan of the same Leduc edition, IMSLP file 828379, helped clarify a few blurred staff positions; readings were checked against file 511615. No existing digital encoding or score-recognition tool supplied notes.

## Scope and passes

The file covers both staves of all five printed systems: twenty measures and the two-eighth-note pickup between the two repeated sections. Measures 8 and 20 are 4/8 long in print. The pickup is 2/8. The music otherwise has a printed 6/8 meter and one-sharp key signature.

The first encoding pass rebuilt the rapid figures and separate held voices from the scan. The required correction pass compared the compiled PDF with each printed system. It corrected the former draft's invented opening; moved the battery into the bass for measures 5–10 and 13–16 and into the treble for measures 11–12 and 17–20; restored the shortened bars, pickup, grace note, ties, dynamics and text; and corrected specific pitches including the G♯3 at measure 13, the descending E4–D4–C4–D4 high bass notes in measures 13–16, the F♯3 in measure 15, the D4 at the start of measure 16's second battery group, and the D♯5 in measure 19. This draft misread the final bass eighth as D3; reconciliation corrected it to E3. LilyPond 2.26.0 compiles the Step 1 draft without warnings.

## Findings at the end of Step 1

- **Later resolved in reconciliation:** PDF page 6, printed system 5, measure 20, bass staff: the final eighth is E3, and the small rectangular mark is present in the original. `score.ly` encodes it as a separate whole-measure rest; its voice continuity remains for human review.
- **Open:** Not every printed fingering in the repetitive bass figures has been entered or checked at note level. Clear melody and several bass fingerings are present, but the bass fingerings in printed systems 3–4 need a separate mark-by-mark pass.
- **Later advanced:** Independent Step 2 and agent reconciliation are complete. Human comparison of every note and mark remains to be done. Compilation and agent visual passes do not establish verification.

Do not publish this Step 1 draft as a usable or verified score. The reconciled candidate is `score.ly`; it too remains withdrawn pending human review.

## Compiler compatibility, 2026-10-18

Strict compilation exposed a pre-existing type error in the measure-length settings of both attempts and `score.ly`: LilyPond 2.24 requires a Moment, whereas 2.26 requires a rational number. A small inline `opus-measure-length` adapter now queries the property's declared type and supplies the appropriate representation. Keeping the adapter in each file preserves standalone downloads.

All forty settings retain their original lengths of 1/2, 1/4 or 3/4. Reversing only the adapter substitutions and removing its definition recovers the previous notation files byte for byte. All three one-page renders under LilyPond 2.26.0 are pixel-identical to the pre-change renders at 2200 pixels on the long edge. Repository validation, real-compiler integration tests and complete site builds pass with both LilyPond 2.24.4 and 2.26.0.

Model: `openai/gpt-6-astra`; configuration: Codex with xhigh reasoning effort. This is a compiler-compatibility repair, not another independent transcription or reconciliation. The musical readings and metadata are unchanged: Step 3, withdrawn, and awaiting human review.
