# Spreadsheets

A book holds spreadsheets of its members' own: tables with formulas, formatting, filters and validation, edited in the web interface and stored with the book. The engine is Univer (ADR 038). A spreadsheet reads no figure of the ledger and writes none.

A document is one spreadsheet as the server stores it: a name and a content. A content is the snapshot of the workbook the editor writes, one JSON object.

## Rules

| ID | Rule |
|---|---|
| SS1 | The destination "Spreadsheets" (`/spreadsheets`) lists the documents of the active book, the last saved first, with their name and the instant of their last save. A search filters the list by name, ignoring case and accents. |
| SS2 | "New spreadsheet" creates a document named "Untitled spreadsheet" with one empty sheet and opens it. The name of the first sheet is in the language of the member. |
| SS3 | The table `spreadsheet_document` holds `books_id`, `name` (1 to 120 characters, trimmed, no control character), `content` (a JSON object), `version` (from 1) and the instants of creation and of the last save of the content. The server stores the content without reading it. |
| SS4 | A book holds at most 40 documents; one more is 409 `spreadsheet_limit_reached`. The body of a write holds at most 4 MiB of content plus 4 KiB; a larger one is 413 `request_too_large`. 40 documents of 4 MiB stay under the 256 MiB of the largest export archive. |
| SS5 | A save sends the content with the version the editor read. The server stores it and adds 1 to the version only when the stored version is the one sent; any other version is 409 `version_conflict` and stores nothing. A rename changes neither the content nor the version. |
| SS6 | A copy creates a document with the stored content of another and a name the member gives; the suggested name is "Copy of" and the name. A delete removes the document; it is not undone. |
| SS7 | The editor saves by itself: 1.5 s after the last change, on Ctrl+S or Cmd+S, and when the editor leaves the screen. One save runs at a time; a change made during a save starts another after it. Opening a document, selecting and scrolling save nothing. |
| SS8 | The header of an open document states one of: "Saved", "Unsaved changes", "Saving", "Not saved", and "View only" for a member who cannot write. The browser asks before it closes a tab that holds an unsaved change. |
| SS9 | A save refused for another reason than SS5 shows "Not saved" and a notice with "Save again"; the next change also tries again. |
| SS10 | After a 409 `version_conflict` the editor saves nothing more. A notice offers "Open the saved version", which reads the document again and replaces the screen, and "Keep this screen as a copy", which creates a document with the content on screen and opens it. |
| SS11 | A member with the role `read` lists and opens documents. The editor opens without edits, and the screens draw no command that writes. |
| SS12 | The editor follows the scheme and the language of the application: dark or light, Portuguese for `pt`, English for any other language. Its accent is the accent token of the theme. |
| SS13 | The spreadsheet operations have no assistant tool (ADR 038, E7). |
| SS14 | The archive of an export carries the documents; `archive_version` 33 adds the table. |
| SS15 | The editor reads a typed number or date, and writes a formatted one, by the locale of the member: the tag of the application when Univer knows it, else its language, else `en`. |

## Client derivations

| Value | Rule | Test |
|---|---|---|
| Save status | SS7 to SS10 | `model/autosaver.test.ts` |
| Whether a command of the editor changed the content | SS7 | `editor/changes-workbook.test.ts` |
| Rows of the list under a search | SS1 | `model/filter-documents.test.ts` |
| Locale of the number formats | SS15 | `editor/numfmt-locale.test.ts` |

## Cross-cutting questions

- R1: Does not apply: the feature stores no regional value. The functions, number formats and date formats inside a sheet are chosen by the member in the editor, per cell.
- R2: Does not apply: no region has an implementation of its own; every region gets the same editor.
- R3: Does not apply: the feature adds no value set.
- R4: Does not apply: the feature adds no extension point.
- R5: The keys `nav.spreadsheets`, `spreadsheets.*` and `problem.spreadsheet_limit_reached` of `catalog-spreadsheets.en.ts` and `catalog-spreadsheets.pt-BR.ts`. The texts inside the editor come from the pt-BR and en-US files of Univer (SS12).
- R6: The instant of the last save, through `formatDate` and `formatTime` of `i18n/format.ts` with the active tag. Numbers and dates inside a sheet are read and written by the active tag (SS15).
- C1: Does not apply: the feature stores and computes no amount of the ledger. A number in a cell is a value of the member's sheet, computed by the formula engine as a spreadsheet computes it.
- C2: Does not apply: the application adds or compares no amount of a sheet.
- C3: Does not apply: a sheet reads no account, instrument or index.
- C4: Does not apply: the screens draw no amount of the application. Privacy mode does not mask the cells of a sheet: they are not amounts the application knows.
- T1: Does not apply: the feature uses no calendar date. `created_at` and `updated_at` are instants written by the database.
- T2: Does not apply.
- B1: `spreadsheet_document` holds `books_id` with a foreign key to `identity_books`; every query filters by it; `TestSchemaInvariants` rejects a row without a book and a row of an unknown book.
- B2: `listSpreadsheets` and `getSpreadsheet` need `read`; `createSpreadsheet`, `saveSpreadsheet`, `renameSpreadsheet`, `copySpreadsheet` and `deleteSpreadsheet` need `write`. `TestS685DocumentAccess` covers each role and a member of another book.
- B3: Does not apply: the feature adds no setting.
- D1: `spreadsheet_document` is a fact table (it holds `books_id`). `archive_version` rises to 33 with the step `addSpreadsheets`; the fixtures `archive-v33.zip` and `archive-v33.txt` pin the import and the fingerprint.
- D2: Migration `00142_spreadsheet_document.sql`.
- D3: Does not apply: a document is no recorded fact of the ledger. A save replaces the content; the editor keeps the undo of the session.
- D4: Does not apply: no bank, file or model writes a document.
- D5: Does not apply: the diagnostic file gains no field.
- S1: The seven operations of the tag `spreadsheet`, each with the exclusion `-editor` in `tool_exposure_test.go` (ADR 038, E7). `spreadsheet_limit_reached` is covered by `TestS684DocumentLimit`; `version_conflict`, `validation_failed`, `not_found` and `request_too_large` by `TestS682DocumentLifecycle` and `TestS683DocumentProblems`.
- S2: Desktop only: `/spreadsheets` and `/spreadsheets/$id` are not phone routes (ADR 027, S3). A grid of cells with a toolbar does not fit 390 px.
- S3: The section "Spreadsheets" of the guide article `getting_started` and the screens "Spreadsheets" and "Spreadsheet" of the navigation map.
- S4: No. The article `privacy_and_the_assistant` states the limit under `editor`.
- X1: S682 to S685 of `docs/domain/06-scenarios.md`.
- X2: Does not apply: R1, R2, C2 and C3 do not apply. The web tests run with region DE and base currency EUR.
