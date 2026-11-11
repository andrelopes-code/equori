# Instrument removal and price chart axis

- Date: 2026-11-11
- Status: delegated by the owner on 2026-11-11 ("veja o que é o melhor. E faça os ajustes").
- Amendment: A223. Scenarios: S385 and S386.
- Complements: `docs/specs/2026-11-09-market-quotes-design.md` (A222). The search, the probe and the coverage of the define dialog (MQ27, MQ29, MQ37) stay in the plan `docs/superpowers/plans/2026-11-10-market-quotes-catalog.md`.

## 1. Context

| # | Place | Observed | Effect |
|---|---|---|---|
| R1 | `api/openapi.yaml`, `/instruments/{code}` | `get` and `patch` only. | A security defined with a wrong code, type or exchange cannot be removed. |
| R2 | `web/src/features/instruments/price-chart.tsx` | The time axis formats each tick with `formatDayMonth`. | A chart of one year or more shows `12 Mar` without the year. |
| R3 | `web/src/features/instruments/price-chart.tsx` | The line joins prices of dates that are days apart, and every price carries a marker. | A weekend or a holiday reads as a jump. |

## 2. Decisions

| # | Rule |
|---|---|
| RM1 | `DELETE /instruments/{code}` (`deleteInstrument`, `x-book-role: write`, the role of `defineInstrument`) removes the security, its prices, its terms, its history requests and its symbols in one transaction. The answer is 204. |
| RM2 | An unknown code is 404 `not_found`. A currency is 422 `validation_failed`, field `code`, message `is a currency` (the rule of `editInstrument`). |
| RM3 | A row of another table that references the code (a position, a transaction, an account, a price quoted in it) blocks the removal. The answer is 409 `instrument_in_use` and nothing is deleted. The module does not read the tables of other modules; the foreign key of each table is the check (ADR 002). |
| RM4 | The tool `manage_instrument` gains the action `delete`, with the preview of RM1 and the same errors. |
| RM5 | The instrument page shows the action "Remove instrument". A dialog asks for confirmation and states what goes: the prices and the history of the code. A 409 shows the text of `problem.instrument_in_use` in the dialog and keeps it open. After a removal the screen returns to the instrument list. |
| RM6 | The time axis of the price chart writes the day and the month when the prices span 100 days or fewer, and the month and the year above 100 days (`formatReferenceMonth`). The span is the days between the first and the last price shown. The format comes from the active locale through `Intl`. |
| RM7 | The chart draws a marker on every price when the range holds 60 prices or fewer. Above that, a marker on the last price only. |

## 2.1 Amendment: currency of a Yahoo listing

| # | Observed | Effect |
|---|---|---|
| R4 | The Yahoo search answer carries no currency (checked on 2026-11-11 for `NVDA`: `exchange`, `quoteType`, `longname`, no `currency`). Plan 3 D7 left the listing's quote currency empty. | The define dialog kept the book's base currency for NVDA. The chart answered USD, and the history failed with `quoted in USD, want BRL`. |

| # | Rule |
|---|---|
| RM8 | `yahoo_chart` `Search` fills `quote_currency` of a listing from the table `micCurrencies` of its package: the whole-unit currency its MIC quotes in. A MIC that quotes in a subunit (`XLON` pence, `XJSE` cents) and a MIC outside the table leave it empty. This amends plan 3 D7 and MQ28. |
| RM9 | The define dialog fills the scale from the type until the owner types one: `stock`, `etf`, `reit`, `depositary_receipt` and `fixed_income` 0; `fund` 6; `crypto` 8. The hint states what the number means in plain words. |
| RM10 | The coverage section groups its failure in one `Alert` with the retry in `AlertActions`, and its other actions in one `Toolbar`. |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no value varies by country. |
| R2 | Does not apply. |
| R3 | Does not apply: no new value set. |
| R4 | Does not apply: no extension point. |
| R5 | Texts: `instrument.remove`, `instrument.remove.title`, `instrument.remove.body`, `instrument.remove.confirm` and `problem.instrument_in_use`, each with pt-BR and en text. |
| R6 | The axis dates take their format from the active tag through `Intl` (RM6). |
| C1 | Does not apply: no amount is stored or computed. |
| C2 | Does not apply: no amounts are added or compared. |
| C3 | Does not apply. |
| C4 | Does not apply: the chart keeps `useMoneyFormat()` for its values. |
| T1 | Does not apply: the operation reads no date. |
| T2 | Does not apply. |
| B1 | Does not apply: market data belongs to the instance and adds no table. |
| B2 | `deleteInstrument` needs `write`. The HTTP test covers `read` (403) and a member without access. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change; the foreign keys already exist. |
| D3 | Does not apply: no recorded fact changes. A removal that a fact references is refused (RM3). |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | `deleteInstrument` is covered by the action `delete` of `manage_instrument` (RM4). New `Problem.code`: `instrument_in_use`, triggered through the HTTP API by S386. |
| S2 | The instrument page keeps its phone scope; the dialog fits 360 px (ADR 027). |
| S3 | The guide article of the instrument screen gains the removal and the axis. |
| S4 | Does not apply: no new data in the assistant context. |
| X1 | S385: removing a security deletes its prices and leaves the others. S386: a security held in a position cannot be removed. |
| X2 | Does not apply: no region or currency rule. |
