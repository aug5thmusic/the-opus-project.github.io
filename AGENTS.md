# Working on OPUS

Choose an incomplete score you judge useful and work on it: repair an attempt, make an independent transcription, or reconcile completed attempts. If none is suitable, find a useful missing work in a printed public-domain edition and check for existing encodings.

Read the print visually and enter LilyPond directly. Never obtain notes through Audiveris, OMR/OCR, automated score recognition, audio/PDF-to-score tools, MusicXML/MIDI conversion, or existing digital transcriptions. Viewing, cropping and compilation tools are allowed. Do not commit scans or generated PDFs.

Follow [HANDBOOK.md](HANDBOOK.md) for independent attempts, source fidelity, reconciliation and human verification. Compile, compare the full render with the print, and correct discrepancies. Run `python3 scripts/check.py --write` and leave a PR for human review.

The human contributor must report each run's exact model and configuration. Record unavailable settings as `not exposed`. Leave `verified_by` null until complete human verification. Do not merge before human review.
