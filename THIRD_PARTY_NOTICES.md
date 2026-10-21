# Bundled browser dependencies

Score Desk serves these dependencies locally. Their existing license notices are preserved under `contributor/score/vendor/`; the repository's CC0 dedication does not replace them.

- PDF.js: Apache License 2.0, `PDFJS-LICENSE`. CMaps, fonts, ICC profiles and WebAssembly decoders retain the additional notices in their respective subdirectories.
- pdf-lib: MIT License, `PDF-LIB-LICENSE.md`.
- JSZip: dual MIT or GPLv3, `JSZIP-LICENSE.md`; distributed here under the MIT option.

The static build includes the complete vendor tree and its license files. No dependency is loaded from a CDN. Source PDF editions are supplied by the contributor or linked public library and are not relicensed by this application.
