# spreadsheets

Routes: `/spreadsheets` renders `SpreadsheetsPage`; `/spreadsheets/$id` renders `SpreadsheetPage` (`web/src/app/router.tsx`). Both are desktop only.

Guide topic: `getting_started` (`web/src/navigation/navigation-map.json`).

Public exports (`routes.ts`): `SpreadsheetsPage`, `SpreadsheetPage`.

Design: `docs/specs/2026-11-23-spreadsheets-design.md`. Engine: Univer (ADR 038).

Folders:

- `pages/`: the two route components, their header and their tests.
- `document-list/`: the grid of the documents, the menu of one document and the dialogs of its commands (rename, copy, delete).
- `editor/`: the workspace of an open document. `create-editor.ts` is the only file that imports Univer, and it is loaded as a chunk of its own; `spreadsheet-editor.tsx` mounts it. `use-stored-document.ts` reads the document, `use-document-save.ts` saves it, `adopt-styles.ts` applies the style elements the content security policy refuses (ADR 038, E6).
- `charts/`: the charts placed on a sheet. `chart-table.ts` reads cells into categories and series; `sheet-chart.tsx` draws them with the Slotted `Chart`; `bound-chart.tsx` binds one to the workbook; `register-charts.ts` registers the element and the toolbar entry with Univer (ADR 038, E10).
- `files/`: the exchange of files. `xlsx-read.ts` and `xlsx-write.ts` read and write XLSX over `fflate` (ADR 038, E9) and load as chunks of their own; `csv.ts` reads and writes CSV; `content-from-file.ts` turns a chosen file into the content of a new document; `download-document.ts` hands the open document as a file.
- `model/`: pure functions: the autosaver, the search of the list and the content of a new document.

A test never loads Univer: the page tests replace `editor/create-editor` with a fake that records what the page asks of it.
