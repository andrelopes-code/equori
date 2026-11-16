# Instrument hiding

- Date: 2026-11-16
- Status: requested by the owner on 2026-11-16, decisions delegated ("sem perguntas idiotas").
- Amendment: A238. Scenarios: S489 and S490.
- Complements: `docs/specs/2026-11-11-instrument-removal-design.md` (A223).

## 1. Context

| # | Place | Observed | Effect |
|---|---|---|---|
| R1 | `deleteInstrument` (A223 RM3) | A foreign key of any table (a transaction, a position, an account) refuses the removal with 409 `instrument_in_use`. A voided or reverted transaction keeps its row and its reference. | A security referenced only by voided records, such as `CRA024002S2`, can be neither removed nor kept out of sight. |
| R2 | `listInstruments`, `instruments-page.tsx` | Every instrument of the instance appears in the list. No state removes one from the list. | Mistaken fixed income securities accumulate in the list. |
| R3 | `marketdata_instrument` | Securities defined from the catalog belong to the instance; a fixed income contract belongs to one book (`books_id`, A236 FC1). | A flag on the instrument row would hide a catalog security from every book of the instance. |

## 2. Decisions

| # | Rule |
|---|---|
| HD1 | Table `marketdata_instrument_hidden (books_id, instrument, hidden_at)`. Primary key `(books_id, instrument)`. `books_id` references `identity_books` and `instrument` references `marketdata_instrument`, both `ON DELETE CASCADE`. A row means the book hides the instrument. |
| HD2 | `PUT /instruments/{code}/hidden` (`hideInstrument`) and `DELETE /instruments/{code}/hidden` (`showInstrument`), both `x-book-role: write`, both 204. Each is idempotent. An unknown code is 404 `not_found`. A currency is 422 `validation_failed`, field `code`, message `is a currency`. |
| HD3 | `Instrument` gains `hidden`, a boolean computed for the book of the request. `GET /instruments` and `GET /instruments/{code}` return it. |
| HD4 | `GET /instruments` omits hidden instruments. The query `include_hidden=true` returns them with `hidden: true`. |
| HD5 | Hiding changes nothing else: positions, transactions, prices, quotes, history requests and the portfolio keep reading the instrument. The instrument page opens by its code and shows the state "Hidden". |
| HD6 | Removing a hidden instrument that nothing references works as in A223 RM1. The cascade of HD1 deletes its rows of `marketdata_instrument_hidden`. |
| HD7 | The instrument page shows the header action "Hide instrument" when `hidden` is false and "Show instrument" when it is true. Neither asks for confirmation; both are reversible. A currency has neither action. |
| HD8 | The text of `problem.instrument_in_use` names the way out: a record references the instrument and the instrument can be hidden. The removal dialog shows it unchanged. |
| HD9 | The instrument list shows a toggle "Hidden (n)" after the groups when n is above zero. On, the list requests `include_hidden=true` and draws hidden rows with the state label "Hidden". Off, they do not appear. |
| HD10 | The tool `manage_instrument` gains the actions `hide` and `show`, with the errors of HD2. |
| HD11 | The export carries `marketdata_instrument_hidden` as a fact table (it holds `books_id`). `ArchiveVersion` becomes 22 with the step `addInstrumentHidden`, which adds the empty table to an older archive. |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no value varies by country. |
| R2 | Does not apply. |
| R3 | Does not apply: no new value set. |
| R4 | Does not apply: no extension point. |
| R5 | Texts: `instrument.hide`, `instrument.show`, `instrument.hidden`, `instruments.hidden.toggle` and the changed `problem.instrument_in_use`, each with pt-BR and en text. |
| R6 | Does not apply: the feature writes no number or date. |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply: no amounts are added or compared. |
| C3 | Does not apply. |
| C4 | Does not apply: no currency is displayed. |
| T1 | `hidden_at` is `now()` of the database; no screen shows it. |
| T2 | Does not apply. |
| B1 | The table holds `books_id`, the queries filter by `books_id` and a schema test rejects a row without a book. |
| B2 | `hideInstrument` and `showInstrument` need `write`. The HTTP test covers `read` (403) and a member without access. |
| B3 | Does not apply: no setting. |
| D1 | `marketdata_instrument_hidden` is a fact table (HD11). `TestEveryTableIsClassified` passes with it in `FactTables`. |
| D2 | One new goose migration. |
| D3 | Does not apply: no recorded fact changes; the choice is a view preference of the book. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | `hideInstrument` and `showInstrument` are covered by the actions `hide` and `show` of `manage_instrument` (HD10). No new `Problem.code`. |
| S2 | The header action and the toggle keep the phone scope of the screens; the toggle fits 360 px (ADR 027). |
| S3 | The guide article of the instrument screen gains hiding and showing. |
| S4 | Does not apply: the assistant lists instruments through a tool that stays unchanged. |
| X1 | S489: hiding `CRA024002S2` removes it from the list, `include_hidden=true` returns it with `hidden: true`, another book still lists it, and showing returns it to the list. S490: a security referenced by a voided transaction is refused on removal with 409 and can be hidden. |
| X2 | Does not apply: no region or currency rule. |
