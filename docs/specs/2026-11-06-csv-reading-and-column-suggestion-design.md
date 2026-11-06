# CSV reading and column suggestion

Status: approved by the owner on 2026-11-06 ("siga"; the owner delegated the architecture to the planning model). Amendments A204 to A207, scenarios S295 to S301.

## 1. Problem

A CSV statement has no standard form: columns, delimiter, encoding, date form, decimal separator, sign convention and rows around the data differ by institution. An OFX file varies in syntax and encoding only, so a parser answers it.

`guessProfile` (`web/src/features/accounts/csv-guess.ts`) starts the CSV profile from the first line and a list of header words in two languages. A file outside those words is mapped by hand.

Reading the code found these defects and gaps:

| # | Place | Observed | Effect |
|---|---|---|---|
| F1 | `read-file.ts`, `readText` | Always decodes UTF-8. The server's `auto` falls back to Windows-1252. | A column named `Histórico` in Windows-1252 reaches the profile with U+FFFD. The server decodes the real name, and the import fails with `is not a column of the header`. |
| F2 | `csv-guess.ts`, `completeProfile` | Returns no `encoding` and no `group_separator`. | A saved profile is rewritten on every import: its encoding returns to `auto` and an empty group separator to the default. |
| F3 | `csv-preview.ts`, `minorUnits` against `domain.MinorUnits` | The preview drops only the literal `R$`. The server ignores any currency affix and reads parentheses and a trailing minus. | The preview marks lines the server reads, and it holds a regional literal. |
| F4 | `domain.MinorUnits` | A trailing letter is ignored as a currency affix. | `100,00 D` imports as +100,00 with no error. |
| F5 | `csvfile.Parse` | One unreadable line aborts the file. | A total row under the data blocks the import. |
| F6 | `domain.DateLayout` | Two digits are mandatory, and a time after the date is an error. | `3/11/2026` and `2026-11-03 14:22:11` fail. |
| F7 | `guessProfile` | One header row, delimiter from the first line, no debit and credit, two date forms, first line only. | A file with rows above the header starts wrong. A first line with a day up to 12 can choose the wrong order. |
| F8 | `previewCsv` | Reads ten lines. | A problem on line 11 appears only as a server refusal. |
| F9 | `ofx.Parse` | Trusts the declared `CHARSET`. | A UTF-8 file that declares 1252, a case reported for Brazilian banks, imports with garbled text. |

Evidence on formats comes from forums, project READMEs and vendor pages (section 9). No file of a real institution was available, and every fixture of this work is synthetic.

## 2. Decisions

| # | Question | Choice | Reason |
|---|---|---|---|
| D1 | What the language model produces | The meaning of columns only. It never produces a record, an amount or a date. | A wrong mapping shows in the preview before the import. A wrong transcribed amount shows nowhere. |
| D2 | What code decides | Delimiter, header rows, footer rows, date layout, decimal and group separators are derived from the file, in the browser. | Each has an exact answer in the file's shape. A call would cost money and be less exact. |
| D3 | When the model is called | Only when the person presses the action, and the action appears only when the draft is incomplete or the preview reports a problem. | One call per new format. A saved profile that reads the file makes no call. |
| D4 | What the request holds | The header row and the first 12 data rows. Rows above the header and footer rows are never sent. | Rows above the header hold the name and the account number. |
| D5 | Where the mask runs | On the server, in `domain.MaskCell`, before the port call. The adapter never receives a raw cell. | A client cannot bypass it, and a test through the API observes the outgoing request. |
| D6 | Mask | A digit becomes `9`, a letter becomes `A`, a combining mark is removed, other characters stay. A token of at most two letters stays as written. A header cell with a digit is masked; other header cells are sent as written. | Separators and shape identify the role of a column. `D` and `C` identify a sign column. A name or a document never leaves. |
| D7 | Day and month order | Decided on all rows, in the browser. Masked digits cannot answer it. When two orders read every row, the field stays empty and the person chooses. | No guess on the ambiguous case: a wrong order imports wrong dates with no error. |
| D8 | Debit marker | Never answered by the model. The person chooses from the values found in the file. The draft stays incomplete until then. | Inverting every sign is the costliest error of this flow, and a masked sample cannot prove the convention. |
| D9 | Answer form | Integer positions from 1, 0 for none, under a JSON schema. The server turns positions into header names. | No invented column name can reach a profile. |
| D10 | Validation of the answer | `domain.NewColumnSuggestion`: date and description required; an amount column or both debit and credit; a sign column only with an amount column; each position inside the width and used once; a chosen header name unique in the header. | A failed answer is a 422 and the draft stays as it was. |
| D11 | Retry | None. | An unusable answer falls back to the fields the person fills. A retry doubles the cost for one action. |
| D12 | Model call settings | Default target `gemini-3.5-flash-lite`, the same as `capture.suggest`. `Temperature` 0, `MaxOutputTokens` 128. The chain is replaceable per book (ADR 019). | The answer is eight small integers. |
| D13 | `SendsFinancialData` | `true`. | Header text and the shape of amounts still leave the instance. The settings screen shows its notice from this flag (ADR 019). |
| D14 | Availability | The action appears when `GET /assistant/uses` lists targets for `ingestion.csv_columns`. | With no provider, no action is offered and the fields stay manual. |
| D15 | Disclosure | A sentence beside the action states what is sent. | The person decides with the fact in view (ADR 009). |
| D16 | Footer rows | An explicit profile field `footer_rows`, 0 to 10, suggested by the browser. A line outside it that does not read still aborts the file. | Skipping any unreadable line would drop a real line silently. |
| D17 | Sign field | Two profile fields, `sign_column` and `debit_marker`, valid only with `amount_column`. With a marker set, a matching line is `-abs`, and any other line keeps the sign as written. The marker is compared with case folding. With no `sign_column`, the marker is read from the letters after the number in the amount cell. | Covers a D/C column, `100,00 D` and a credit with no mark. The marker is profile data, so no regional word enters the code. |
| D18 | Marker detection | The browser collects the trailing letter tokens of at most two letters in the amount column. When any exists, the draft needs a marker. | Closes F4 for new profiles. `domain.MinorUnits` stays as it is, since a currency code after a number is a valid form. |
| D19 | Dates | One-digit day and month are accepted. A time after the date, separated by a space or `T`, is ignored when the layout's separator is not a space. | Both forms carry an exact date. The time is not part of a booking date. |
| D20 | Month names | Out of scope. | They need a regional extension point of their own (`CONTRIBUTING.md`, Regions). |
| D21 | OFX | No language model. `ofx.Parse` treats data that is valid UTF-8 as UTF-8, whatever it declares. | Valid multi-byte UTF-8 is not produced by a Windows-1252 text in practice. |
| D22 | Archive | `archive_version` 10, with a step: `footer_rows` 0, `sign_column` and `debit_marker` null. | ADR 021, V2. |
| D23 | Catalog of institutions | Not built. | The suggestion serves the same need, and the roadmap item "import profiles per bank" stays open only for institutions that a saved profile does not answer. |
| D24 | Whole-file preview | `previewCsv` keeps ten rows on screen and counts unreadable rows, money-in rows and money-out rows over the whole file. The action stays enabled. | The counts catch an inverted sign and a late problem. The client is not the authority on what the server reads. |

## 3. Amendments

- **A204.** `ingestion_csv_profile` gains `footer_rows`, `sign_column` and `debit_marker` under D16 and D17.
- **A205.** A date cell follows D19.
- **A206.** `POST /accounts/{id}/csv-profile/suggestion` answers under D1, D4 to D6, D9 and D10. It returns 503 `csv_suggestion_unavailable` when no target answers and 422 `csv_suggestion_unusable` when the answer fails `domain.NewColumnSuggestion`. It stores nothing.
- **A207.** `ofx.Parse` follows D21.

## 4. Browser derivation

Pure functions, each with its own test.

`csv-structure.ts`, `detectStructure(text)` returns `{delimiter, headerRows, footerRows, rows}`:

1. For each delimiter, in the order `;`, `,`, tab, `|`, split the file and take the most frequent field count above 1 among the first 50 non-blank rows. The delimiter with the most rows at its count wins; a tie goes to the earlier one.
2. The first row with that count is the first table row. When it holds no cell shaped as a date or an amount, it is the header and `headerRows` is its index plus 1. When it holds such a cell and its index is 0, `headerRows` is 0. When it holds such a cell at a later index, the structure is unknown and `headerRows` is left undefined.
3. When the first data row holds a date-shaped cell, walk up from the last non-blank row: a row with another field count, or with no date-shaped cell, counts as a footer row. The walk stops at the first row that fails this test, at 10 rows, or at the first data row. A file whose first data row holds no date-shaped cell has `footerRows` 0.

`csv-shape.ts`:

- `dateLayouts(cells)` returns every layout (`DD`, `MM` and `YYYY` or `YY`, in the orders day-month-year, month-day-year and year-month-day, with the separator seen in the cells) that reads every non-blank cell.
- `numberForm(cells)` returns `{decimal, group}`. A separator followed by one or two digits at the end of a cell is the decimal separator. A separator repeated in one cell, or a different one before the decimal, is the group separator. A single separator followed by exactly three digits decides nothing. A column with no deciding cell returns undefined.
- `markerTokens(cells)` returns the distinct letter tokens of at most two letters after the number, at most 8.
- `distinctValues(cells)` returns the distinct trimmed non-blank values, or an empty list above 8.

`guessProfile` takes roles from the word list first, then from shape: the date column is the first whose cells read under one layout at least; the amount column is the only numeric column left; the description is the text column with the most distinct values. Two numeric columns with no word are left empty, so the person or the model answers. Debit and credit come from the word list only, since the order of the pair has no shape.

## 5. Interface

The action sits at the end of the profile section of `import-page`. A failure is a `FormNotice` in that section, and the draft stays as it was. An answer writes only column fields, then derives the date layout and the number form from the chosen columns with the functions of section 4.

Below the preview: `{in} lines in, {out} lines out`, and, when any exists, `{count} lines cannot be read`. Counts are not masked by privacy mode (ADR 018).

The header rows field offers 0 to 10. The date layout field offers the layouts that read the file, the three that exist today and the current value, without repeats. The footer rows field offers 0 to 10. The marker field appears when a sign column is set or marker tokens exist, and it offers the values found.

`ImportPage` (215 lines) and `CsvProfileSection` (186 lines) exceed the 150-line limit of a component, so both are split before new code enters them.

## 6. Regional values

| Value | Extension point |
|---|---|
| `date_layout`, `group_separator`, `decimal_separator`, `footer_rows`, `sign_column`, `debit_marker` | Profile data, row "CSV number and date reading" of `docs/contributing/regions.md` |
| Header words of `guessProfile` | Existing list, two languages. It only suggests; any other language goes to shape or to the model. Unchanged in kind, extended with debit and credit words of the same two languages |

## 7. Out of scope

- A language model for OFX, CAMT.053, MT940 or PDF.
- Skipping balance lines inside the data, which need a sample of a real institution.
- Month names (D20), a catalog of institutions (D23), a retry (D11).
- The same pattern in other areas. Import from other applications (roadmap, 1.1), rule suggestions and source category mapping reuse it in their own specs.

## 8. Verification

- Each scenario S295 to S301 has a test through the HTTP API.
- A test asserts that no digit and no name of the sample appears in the outgoing request.
- `internal/ingestion/columns_eval_test.go`, build tag `eval`, measures the rate at which a suggested profile equals a written one over synthetic fixtures. Only the owner runs it, with a model and a budget named.

## 9. Sources

- [QuickBooks, CSV bank layouts](https://quickbooks.intuit.com/learn-support/en-us/banking/import-bank-transactions-using-excel-csv-files/00/261910)
- [Manager.io forum, no standard for bank CSV](https://forum.manager.io/t/csv-file-is-missing-date-column/4012?page=2)
- [Swedish bank CSV formats](https://bsc-converter.vercel.app/blog/swedish-bank-csv-formats)
- [csv-guillotine, detection of metadata rows by field count](https://github.com/forbesmyester/csv-guillotine)
- [FinzyTrack, rows before and after the data](https://finzytrack-docs.pages.dev/reference/file-import-rules)
- [ofx-br, syntax and declared encoding of Brazilian OFX](https://pypi.org/project/ofx-br/)
- [ofxparse2](https://pypi.org/project/ofxparse2/)
- [financas-casal, separate credit and debit in Bradesco](https://github.com/guilhermemorais23/financas-casal/pull/38)
- [tabularmapper, deterministic matching before an optional model](https://pypi.org/project/tabularmapper/1.0.0/)
- [Odoo module, column roles from a sample with saved templates](https://apps.odoo.com/apps/modules/19.0/bank_csv_ai_column_detect)
- [SenticMoney, headers and sample rows to the model](https://sentic-web-demo.onrender.com/help/topic/import_guide)
