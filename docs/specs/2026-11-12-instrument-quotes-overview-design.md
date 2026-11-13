# Instrument quotes overview

The catalog on `/instruments` gains the price change over a week, a month, a quarter, the year to date and 12 months, and sorts by the date of the last price. One new operation serves every row in one request.

## 1. Scope

- The list reads one operation, `listInstrumentQuotes`, instead of one `listPrices` read per visible row (`latestPriceQuery`). The 150 requests of a full catalog become one.
- The figure is the change of the price. Income paid by the instrument is not included, as in `2026-11-12-yearly-price-change-design.md`. The prices are the closes not adjusted for splits (MQ18 of `2026-11-09-market-quotes-design.md`), so a split reads as a fall. The page subtitle states both.
- Out of scope: total return with income, a comparison against an index, a position column, a high and low of the year, a "best and worst of the week" strip.

## 2. Decisions

| ID | Decision |
|---|---|
| IQ1 | `GET /instrument-quotes?base={currency}` (`listInstrumentQuotes`, `x-book-role: read`) returns `{items}`, one item per instrument that has a quote instrument, in code order. `base` is required: a currency instrument is quoted in it, and the instrument `base` itself has no item. |
| IQ2 | An item holds `instrument`, `quote_instrument`, `last` and `references`. `last` is `{date, value}` or null when the instrument has no price. `references` holds `week`, `month`, `quarter`, `year` and `year_to_date`, each `{date, value}` or null. |
| IQ3 | The price of a date is the chosen price of the latest date on or before it: the same order as `PriceOnOrBefore` (date, then source priority, then latest record). |
| IQ4 | The reference dates count back from the date of the last price of the instrument, so a change always spans the window its column names and ends at the date the price column shows. `week` = that date minus 7 days; `month` = minus 1 month; `quarter` = minus 3 months; `year` = minus 12 months; `year_to_date` = 31 December of the previous year, asked only when the last price lies in the year of `today` (from `platform/clock`). A month shift that lands past the end of the target month clamps to its last day (31 March minus 1 month is 28 February). Amendment of the first version, which counted back from `today`: a stale instrument then read a window shorter than its column name. |
| IQ5 | `last` is the chosen price on or before today. A reference is null when no price exists on or before its date, or when `last.date` is not after the reference date: a price that predates the window is not a change inside it. |
| IQ6 | The client computes each change as `changeBp(reference.value, last.value)` of `model/price-stats.ts`: exact decimals, basis points. The server returns prices, never a ratio. |
| IQ7 | The grid columns are: code, name, price, price date, five change columns, then quote, subtype and exchange. The figures come first so that a narrow screen scrolls the static columns out, not the changes. Each header fits its column without an ellipsis. In English they are named "1W", "1M", "3M", "12M" and "YTD"; in pt-BR "7D", "1M", "3M", "12M" and "No ano". Each change column is numeric and sortable. A change of null reads "—". |
| IQ8 | The price date column is sortable. An instrument without a price sorts after every dated instrument in both directions. |
| IQ9 | A change is written with `formatSignedBasisPoints` in the tone of its direction (`useAmountTone("result", ...)`). A change is a percentage and is not masked by privacy mode. The price stays masked (`MASK`), as in the current cell. |
| IQ10 | The price column is not sortable: prices of different quote currencies do not compare. |
| IQ11 | While the operation loads, the grid shows its loading state. A failed read shows the existing "failed to load" text in the price cell of every row, leaves the date and change cells empty, and the grid stays usable. |
| IQ12 | `LatestPriceCell` is replaced by cells that read the row. `latestPriceQuery` stays: the terms section uses it. |
| IQ13 | Amendment of 2026-11-13 (owner): each item draws the line of its price over 3 months, as the lists of Google Finance do. The line comes from the same operation, so the list keeps its one request and reads no price series. An item holds `trend`: the chosen price (IQ3) on or before each of 31 dates, every 3 days from 90 days before `last.date` to `last.date`, oldest first, the `Rate` of the price or null for a date before the first price. It is an empty array when `last` is null. The grid column `trend` comes after the price, is not sortable and draws nothing for fewer than 3 prices. The tone follows the direction of the last price against the first price of the series. |

## 3. Derivation

- `internal/marketdata/domain/quote.go`: `QuoteReferences(anchor time.Time)` returns the five reference dates of IQ4. It has its own test, including the month-end clamp and a leap year.
- `internal/marketdata/quotes.go`: `Module.ListInstrumentQuotes(ctx, base)` lists the instruments, resolves each quote instrument (`quote_currency`, or `base` for a currency), reads the last price of each pair (`ListQuotePrices`), then the prices on the reference dates counted back from each last date (`ListQuoteReferences`, one `LATERAL` join over the flattened rows), and applies IQ5.
- `web/src/features/instruments/model/catalog-rows.ts`: `catalogRows(items, base, quotes)` joins the quote of each row and exposes `lastDate` and the five `bp` figures as plain fields, so the grid sorts on them.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the periods are calendar spans in the Gregorian calendar. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set grows with regions. |
| R4 | Does not apply: no extension point is added. |
| R5 | Texts added in `catalog-instruments.pt-BR.ts` and `catalog-instruments.en.ts`: the five column names (`instruments.col.week`, `month`, `quarter`, `year`, `yearToDate`). The failed-read and no-price texts keep their keys. |
| R6 | Dates through `formatDate`; changes through `formatSignedBasisPoints`; prices through `formatPrice`. |
| C1 | No amount is stored. Prices stay exact decimals; the change is an integer of basis points. |
| C2 | Does not apply: no amounts are added or compared across currencies. A change carries no currency. |
| C3 | The price column writes the price in the quote instrument of the row. A USD quote with a BRL base shows a USD price and a percentage. Tested. |
| C4 | The quote instrument comes from the record (`quote_currency`) or from `base`, which the client reads from settings. No literal fallback. |
| T1 | Dates are calendar dates; `today` comes from `platform/clock` on the server. |
| T2 | Does not apply: the periods count calendar days and months, not business days. A reference falls on the latest price on or before its date. |
| B1 | Does not apply: no table. |
| B2 | `read`. An HTTP test covers the `read` role and an access without membership. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply. |
| S1 | One operation: `listInstrumentQuotes`. Its entry in `tool_exposure_test.go` is `get_market_data`, since the tool answers prices of an instrument; the tool gains no new field. No new `Problem.code`: a missing or malformed `base` is the existing `validation_failed`. |
| S2 | The list stays desktop-only; the change columns hide first by `priority` on a narrow width. |
| S3 | `investments.md` of the guide gains one sentence for the price date and the change columns. The article sat at 2999 of its 3000 bytes, so the commit shortens other sentences and drops three details: "One sentence states the result first", "(when there were flows)" and "on one axis". |
| S4 | Does not apply: the assistant reads prices through `get_market_data`. |
| X1 | Does not apply: no scenario of `06-scenarios.md` is added. |
| X2 | The C3 test runs with a USD quote and a BRL base. |

## 5. Tests

- `domain/quote_test.go`: the five dates for a plain date, for 31 March (month clamp), for 29 February, for 1 January.
- `marketdata/quotes_test.go` through `internal/apitest`: an instrument with prices on all six dates; an instrument whose history starts 10 days ago (week set, month, quarter, year and year-to-date null); an instrument whose last price is 40 days old reads full windows that end at that price; a last price on 31 March reads 28 February for the month; a last price of the previous year has no year to date; an instrument without a price (`last` null); a currency quoted in `base`; two sources on one date choose the lower priority; the base currency has no item; a missing `base` is 422 `validation_failed`; the `read` role passes and no membership is 401 or 403 as the harness defines.
- `catalog-rows.test.ts`: the join, the null fields for a row without a quote.
- `instruments-page.test.tsx`: the five columns draw the signed changes in order; a null change draws "—"; sorting by price date ascending and descending puts undated rows last; a failed read keeps the grid; one `GET /instrument-quotes` request is issued for the whole catalog and no `GET /prices`.
