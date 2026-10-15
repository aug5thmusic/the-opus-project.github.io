# Source check: Mel Bonis — Mélisande

Checked 15 October 2026. Op. 109. First publication: 1925. Piano.

Printed edition: IMSLP30424 / PMLP68553; Paris: Alphonse Leduc, 1925, plate A.L.16,935. [Work record](https://imslp.org/wiki/M%C3%A9lisande,_Op.109_(Bonis,_Mel)); [direct printed PDF](https://s9.imslp.org/files/imglnks/usimg/3/39/IMSLP30424-PMLP68553-Bonis_Melisande_piano_2_hands.pdf#page=2); [Bru Zane: printed Leduc edition and numbering discrepancy](https://www.bruzanemediabase.com/en/exploration/documents/melisande-mel-bonis). Whole-file SHA-256: `2ce22cd38a5e936bdaed69723e5ae5400e1432dfac90a77b07df515563beed06`.

Scope: PDF pages 2–4, printed pages 1–3; complete Mélisande, 60 written measures in 17 systems, both staves; cover No. 5, music header No. 4 retained. The named print is the sole source of musical text. No OMR, OCR, recognition system, audio-to-score tool, imported notation, or earlier digital encoding supplies notes. Rasterized pages and crops are used for visual reading; LilyPond compiles the manually entered notation. Downloaded scans and generated renders remain outside the repository.

## Agents and configuration

Each work has two blind transcription runs and a third distinct agent’s reconciliation. Model for all three: `openai/gpt-6.1-sol`; reasoning effort: `xhigh`. Temperature, top-p, seed, and other generation settings are not exposed by this client. These are separate runs of the same model. Human verification is pending.

| Step | Agent run |
| --- | --- |
| 1 | `scout_french` |
| 2 | `bonis_independent` |
| 3 | `scout_american` |

The coordinating run, also `openai/gpt-6.1-sol` with `xhigh` reasoning, made additional source checks. This is an agent review record; no human approval is claimed.

## Edition and eligibility

This is the Leduc 1925 print, plate A.L.16,935, scanned by Morel. Its cover labels Mélisande No. 5; its first music page prints No. 4. The transcription retains No. 4 in the music header. The [Bru Zane archive](https://www.bruzanemediabase.com/en/exploration/documents/melisande-mel-bonis) independently documents this discrepancy. No manuscript or modern editorial edition supplies notes. IMSLP marks the print Public Domain; the 1925 edition exceeds the maximum 95-year U.S. publication term in [Copyright Office Circular 15A](https://www.copyright.gov/circs/circ15a.pdf). OPUS does not relicense the scan.

## Selection and earlier encodings

Mélisande belongs to the pieces gathered posthumously as Femmes de légende, rather than a cycle assembled by Bonis. [Bru Zane's work catalogue](https://www.bruzanemediabase.com/en/exploration/works/femmes-legende-seven-pieces-piano-mel-bonis) places this group among her leading piano works. The [Royal Conservatory’s 2022 Piano Syllabus](https://teacherportal.rcmusic.com/getattachment/57f3734d-97e5-4777-b67e-4b1111ee31a3/piano-syllabus-2022-edition.pdf) lists Mélisande at Level 10, List D (printed page 95).

On 15 October 2026, web metadata searches combined Mélisande/Melisande, Bonis, LilyPond, GitHub and Mutopia. GitHub Bonis.ly hits included existing Salomé, Phoebé and Desdémona encodings; those works were excluded. The complete filename tree of `lara-lhh/lilypond-scores` at `16b7138e5fdd98d8b36fdbc1331ada0511105065` contains those three works and no Mélisande/Op.109. Mutopia's untruncated tree `2144afd6f52d56c5b6995b8b589ef1268b3139f0` has no Bonis path. OpenScore's public Lieder and StringQuartets repositories contain no matching piano work; Lieder has two unrelated Bonis songs.

Successful supplementary GitHub queries: `Melisande extension:ly` and `Melisande extension:ily` returned zero; accented `Mélisande extension:ly` returned four unrelated Purcell/Mendelssohn paths; `Bonis extension:ily` returned four unrelated paths including Scenes de la forêt, Op.123. All reported complete results. Some earlier queries hit a per-minute quota and are not counted as successful searches. Only metadata was inspected, never encoded notes. No matching LilyPond edition was located; this does not exclude private, unindexed or differently titled work.

An earlier second-run attempt was stopped as incomplete and excluded from the repository and the three completed steps. `bonis_independent` made its replacement without reading the earlier musical attempts.

A fourth, source-only audit by `scout_european` checked the Lento and ending (bars 50–60) without reading either attempt or the canonical score. It independently counted five ascending 32nds in the final bar and identified unequal literal duration totals between voices in the Lento bar. The reconciler checked the tied chord against the clearer filled noteheads; the final readings and internal alignment choices are in `RECONCILIATION.md`. This additional audit used the same model and reasoning setting listed above.
