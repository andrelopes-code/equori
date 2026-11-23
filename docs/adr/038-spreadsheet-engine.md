# ADR 038: Spreadsheets on Univer

- Status: accepted
- Date: 2026-11-23
- Amends: ADR 028 (W12), ADR 012 (T14, exclusion `-editor`)

## Context

A book holds figures that fit no screen of the application: a comparison of two offers, the plan of a trip, a list kept by hand. The owner asked for spreadsheets inside the application, with the functions of a desktop spreadsheet, stored with the book.

A spreadsheet needs a formula engine, a grid that draws 10,000 cells, a cell editor, number formats, conditional formatting, data validation, filters and sorting. Each of these is a project of its own. The criteria for an engine were: a licence that allows distribution inside an MIT application, all of the functions above, active maintenance, and no request to a third party.

| Option | Licence | Result |
|---|---|---|
| Univer 1.6.0 (`@univerjs/presets` and the `preset-sheets-*` packages) | Apache-2.0 | Chosen. It ships every function above, the texts in pt-BR and en-US, a light and a dark scheme, and a JSON snapshot of the workbook. |
| Handsontable | Proprietary; free only for non-commercial use | Rejected by the licence. |
| HyperFormula with a grid of the application's own | GPL-3.0 | Rejected: the binary embeds the web code, and GPL-3.0 is not compatible with distributing it under MIT. It is also a formula engine alone. |
| FortuneSheet, Jspreadsheet CE, x-spreadsheet | MIT | Rejected: no conditional formatting, data validation or tables of the same reach, and releases more than a year apart. |
| A grid and a formula engine written for the application | none | Rejected: about 400 functions and a canvas renderer to write and to maintain. |
| No spreadsheets | none | Rejected: the owner asked for the function. |

## Decision

| ID | Decision |
|---|---|
| E1 | `web/` depends on `@univerjs/presets` and on the presets `sheets-core`, `sheets-conditional-formatting`, `sheets-data-validation`, `sheets-drawing`, `sheets-filter`, `sheets-find-replace`, `sheets-hyper-link`, `sheets-note`, `sheets-sort` and `sheets-table`, all at one exact version. Every package is Apache-2.0. |
| E2 | No package of the scope `@univerjs-pro` is installed. Charts, pivot tables, printing and the XLSX exchange of Univer carry the "Univer Office SDK" licence, which is not a free software licence. |
| E3 | The editor is a chunk of its own (`features/spreadsheets/editor/create-editor.ts`), loaded when a spreadsheet opens. The texts of each language are chunks of their own. No other screen loads them. |
| E4 | The server stores the snapshot of the workbook as one JSON object and never reads it (`spreadsheet_document.content`). A change of the snapshot format between Univer versions is handled by Univer when it opens an older snapshot. |
| E5 | Amendment to ADR 028, W12. Responses outside `/api/` carry `Content-Security-Policy: default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`. Reason: the renderer of Univer draws cell patterns, icon sets of conditional formatting and images placed on a sheet from `data:` URLs. An image is not executed, and `img-src` admits no other origin. |
| E6 | The policy still refuses style elements. Univer writes three of them to the document head (its theme variables, a cursor rule and the styles of its notices). `editor/adopt-styles.ts` applies the text of each refused element as a constructed style sheet. Only a script of the application's origin can construct one, so injected markup stays refused. |
| E7 | Amendment to ADR 012, T14. The spreadsheet operations take the exclusion `-editor`: a spreadsheet is a snapshot of its editor, read and written by the editor alone. The assistant has no tool for them and says so (`privacy_and_the_assistant`). |
| E8 | pnpm does not run the install script of `protobufjs`, a dependency of Univer (`allowBuilds` in `web/pnpm-workspace.yaml`). The script only prints a version notice. |
| E9 | The exchange of XLSX files is the application's own (`features/spreadsheets/files/`), over `fflate` 0.8.3 (MIT) for the ZIP container. ExcelJS (MIT) was rejected: its last release is of 2023 and it brings nine dependencies written for Node.js. SheetJS (Apache-2.0) was rejected: the version on the npm registry carries two published vulnerabilities, and the corrected versions are distributed outside the registry. The reader and the writer are chunks of their own, 27 kB together before compression. |

## Consequences

- The editor chunk holds about 7.1 MB of JavaScript before compression and 139 kB of CSS. The entry chunk of the application does not grow.
- The browser reports three refused style elements in its console each time the editor opens (E6). They are the elements `adopt-styles.ts` applies.
- A Univer upgrade is checked by opening a stored spreadsheet on the production build, under the policy of E5: a new style element or a new kind of resource appears there first.
- Charts and the exchange of XLSX files are not part of Univer as installed (E2). The application reads and writes XLSX files itself (E9), with the reach the spec states.
- The toolbar, the menus and the dialogs inside the editor are drawn by Univer, not by Slotted. Their accent comes from the application's accent token (`editor/univer-theme.ts`).
- A typed number or date is read by the locale of the member (`editor/numfmt-locale.ts`): "1,5" is a number under pt-BR. Function names are the English ones and arguments are separated by a comma in every language; a cell in the General format writes its decimal point as a dot. These are limits of Univer 1.6.0.
