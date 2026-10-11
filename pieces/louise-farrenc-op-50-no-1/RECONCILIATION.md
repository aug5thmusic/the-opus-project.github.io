# Étude No. 1: reconciliation notes

Status: **draft; not human verified; withdrawn from the catalog.** `score.ly`
is the current third-agent candidate. The two files in `attempts/` are
independent drafts, not approved scores.

The chosen source is IMSLP file 511615, PDF page 3 (printed page 2), Leduc
plate 5854. Its downloaded PDF has SHA-256
`72acbae8f1c9a683036bb77b5a644387a2e1bb2622728b6b4c2884aca836ee66`.
A higher-resolution photograph of another copy of the same plate, [BnF
A-38757, page 6](https://commons.wikimedia.org/wiki/File:25_Etudes_progressives_pour_le_piano_compos%C3%A9es_par_L._Farrenc..._Op._50_-_btv1b10075962b_(06_of_36).jpg),
was used to check details obscured in the IMSLP scan. The downloaded image
has SHA-256
`9858b9808b3406aece5bcc4cf560b6d826117ee332efb8873c612fa6621ad02d`.
No score-recognition tool or existing digital transcription supplied notes.

The high-resolution print resolves the earlier rhythm question. The
three-note arpeggios in both staves have a single beam and no printed tuplet
number. In the printed common-time bars, each group occupies one quarter;
the candidate now encodes them as eighth-note triplets with hidden tuplet
numbers and brackets. The former 8+16+16 and 16+16+8 readings were wrong.
All affected groups were corrected, then the one-page render was inspected.
The LilyPond source declares 2.24.3 and compiles with 2.26.0.

The earlier pitch reconciliation remains in place: bar 3's lower D–F–A
figure, bar 4's sustained upper G, and the later lower figures in bars
20–22. The printed heading, dedication, dynamics and visible fingerings are
represented. These observations do not amount to independent human review.
A proofreader still needs to compare all 27 measures, both staves and every
mark against the printed page, and report any remaining discrepancies before
the candidate can enter the catalog or be marked verified.
