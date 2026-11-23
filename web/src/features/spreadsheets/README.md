# spreadsheets

Routes: `/spreadsheets` renders `SpreadsheetsPage`; `/spreadsheets/$id` renders `SpreadsheetPage` (`web/src/app/router.tsx`). Both are desktop only.

Guide topic: `getting_started` (`web/src/navigation/navigation-map.json`).

Public exports (`index.ts`): `SpreadsheetsPage`, `SpreadsheetPage`.

Design: `docs/specs/2026-11-23-spreadsheets-design.md`. Engine: Univer (ADR 038).

Folders:

- `pages/`: the two route components, their header and their tests.
- `document-list/`: the grid of the documents, the menu of one document and the dialogs of its commands (rename, copy, delete).
- `editor/`: the workspace of an open document. `create-editor.ts` is the only file that imports Univer, and it is loaded as a chunk of its own; `spreadsheet-editor.tsx` mounts it. `use-stored-document.ts` reads the document, `use-document-save.ts` saves it, `adopt-styles.ts` applies the style elements the content security policy refuses (ADR 038, E6).
- `model/`: pure functions: the autosaver, the search of the list and the content of a new document.

A test never loads Univer: the page tests replace `editor/create-editor` with a fake that records what the page asks of it.
