# Yearly price change

A table of the price change of one instrument per calendar year, on `/instruments/$code`. The range control (1W to max) covers windows that end today; this table answers "how much did the price move in 2024".

## 1. Scope

- Client only. The table reads the series `listPrices` already returns; no operation, table or setting is added.
- The figure is the change of the price. Income paid by the instrument (dividends, coupons) is not included, and the table says so.
- Out of scope: total return with income (the ledger holds income as `IncomeOrder` facts; joining them needs an API), a comparison against an index, rolling windows, a custom date range.

## 2. Decisions

| ID | Decision |
|---|---|
| YP1 | The table is one section of the Quote section, below the price table. It draws only when the series spans two or more calendar years. |
| YP2 | One row per calendar year that holds at least one price, newest first. A year without a price has no row. |
| YP3 | Columns: year, start price, end price, change. The change is `changeBp(start, end)` of `model/price-stats.ts`, written through `formatSignedBasisPoints` in the tone of its direction, as `RangeChange` does. |
| YP4 | The start price of a year is the last price on or before 31 December of the previous year. When none exists (the first year of the series), it is the first price of the series, and the row notes the date it starts. |
| YP5 | The end price of a year is the last price on or before 31 December of that year. For the current year it is the last price of the series, and the row notes the date it ends. |
| YP6 | The section is named "Price change by year" and carries one muted sentence: income paid by the instrument is not included. |
| YP7 | The series is read with `rangeWindow(today, "max", first)`. It shares the query key of the range `max`, so selecting `max` and drawing the table issue one request. |
| YP8 | A change is `null` (drawn as "—") when the start price is zero or when start and end are the same price (a first year with one price). |

## 3. Derivation

`model/yearly-changes.ts` exports `yearlyChanges(prices, today)`. It returns rows `{ year, start, end, changeBp, partialFrom, partialTo }` and has its own test.

- Dates are `YYYY-MM-DD` strings compared lexically; no `Date` object is built (ADR 005, section 3).
- The year of `today` comes from `useToday`.
- Prices are exact decimals; the change uses the scaled-integer division of `changeBp`.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the Gregorian calendar year is the only period. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set grows with regions. |
| R4 | Does not apply: no extension point is added. |
| R5 | Texts added in `catalog-instruments.pt-BR.ts` and `catalog-instruments.en.ts`: section name, column names, the income sentence, the two partial-year notes. |
| R6 | Dates through `formatDate`; the change through `formatSignedBasisPoints`; prices through `usePriceFormat`; the minus sign is U+2212. |
| C1 | No amount is stored. Prices stay exact decimals; the change is an integer of basis points. |
| C2 | Does not apply: no amounts are added or compared across currencies. |
| C3 | Prices are written in the quote instrument of the record. A USD quote with a BRL base shows USD prices and a percentage that carries no currency. Tested. |
| C4 | The quote instrument comes from the record (`quote`). No literal fallback. |
| T1 | Dates are calendar dates; "today" comes from `useToday`. |
| T2 | Does not apply: the table counts calendar years. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply. |
| S1 | Does not apply: no operation is added. |
| S2 | The page stays desktop-only (IP14 of `2026-11-11-instrument-page-design.md`). |
| S3 | `investments.md` of the guide gains one sentence for the table. |
| S4 | Does not apply: the assistant reads the same operations. |
| X1 | Does not apply: no scenario of `06-scenarios.md` is added. |
| X2 | The C3 test runs with a USD quote and a BRL base. |

## 5. Tests

- `model/yearly-changes.test.ts`: first year starts at the first price; a middle year starts at the last price of the previous year; the current year ends at the last price; a year without a price has no row; a zero start price gives `null`; a series inside one year gives no rows to draw.
- `quote/quote-section.test.tsx`: the table draws for a series over two years, is absent for a series inside one year, and shows the income sentence.
