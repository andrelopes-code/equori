# Instrument page redesign

Redesign of `/instruments/$code` (`InstrumentPage`, PC19, A222 MQ35/MQ36) for every instrument type: currency, stock, ETF, REIT, depositary receipt, fund, crypto and fixed income. Scope is the page body, its placeholder and the price chart. The header actions, the dialogs and the API contract do not change.

## 1. Diagnosis

Facts read from the code and from the running screen with the demo book (`make demo`).

| ID | Fact |
|---|---|
| F1 | The page opens with the positions table. The latest price, its date and its change are written nowhere; the user reads them from the last point of a chart. |
| F2 | `PriceChart` draws one unlabelled line. The segmented control stretches over the full width. |
| F3 | `listPrices` returns `interval` (`day`, `week`, `month`, MQ30). `fetchPrices` drops it, so a 5Y chart of weekly points and a Max chart of monthly points read as if they held every day. |
| F4 | The time axis places ticks by the chart engine: a 3M chart prints `29 ago`, `1 set`, `5 set`, `8 set` with uneven gaps and without the year. |
| F5 | A manual price outranks every feed price of its date (MQ1). Demo book: a manual PETR4 price of 38.37 on 2026-08-31 against feed prices near 43. The chart draws it as a spike with no mark that it is manual. |
| F6 | Markers stop at 60 points, so the same instrument shows dots at 1M and none at 1Y. |
| F7 | No statistic of the range is shown: change, high, low, number of points. |
| F8 | The positions table shows quantity, average cost, cost and market value. The result (market value minus cost) is derivable and not shown. The average cost is not drawn on the chart. |
| F9 | `Instrument.coverage.sources` holds first date, last date, `enabled`, `official` and the history load of each source. The page shows one sentence with the latest source only. |
| F10 | Fixed-income terms are one stacked column of seven rows, with the index as raw `cdi`. Days to maturity, the elapsed share of the term and the accrued price over face are absent. |
| F11 | The facts block shows the raw exchange code and the quantity scale as a row of its own, below the fold. |
| F12 | The price table sits behind a collapsed trigger and shows no change between rows. |

## 2. User questions

| ID | Question | Decision it supports | Answered by |
|---|---|---|---|
| Q1 | What is the price now and where is it going? | Hold, buy, sell, or doubt a stale quote. | Quote section: latest price, change against the previous quote, range control, chart, range figures. |
| Q2 | What do I hold of it and am I ahead? | Size or close a position. | Position section: figures of the book and the table by account. |
| Q3 | Is the data complete and where does it come from? (fixed income: when does it mature?) | Trust the figures, load history, record a price. | Terms section (fixed income), Data section. |

Vertical order follows Q1, Q2, Q3. The price table, the audit detail, stays collapsed at the end.

## 3. Concepts and choice

| Concept | Organizes by | Cost | Verdict |
|---|---|---|---|
| A. Question order on Slotted families | Question. `StatCard` for the latest price, `Chart` with annotations and an active-point readout, `FigureCard` grids, `ProgressBar` for the term. | Low: no new element. | Chosen. Every question has a family that answers it. |
| B. Own price canvas | Time. An own SVG chart with a brush and a comparison against an index. | High: crosshair, keyboard, table view, forced colors and zoom rebuilt. The API has no index series per instrument. | Rejected. The cost buys no answer that A lacks. |
| C. Position first | Ownership. The page leads with the position and the quote is a detail. | Low. | Rejected. The Portfolio destination already leads with the position; this page is the quote of an instrument and exists for instruments the book does not hold. |

Originality test: every element answers a question of section 2. No own element is built; the gap record of `build-own-element` does not apply and no Slotted issue is opened for an element.

## 4. Decisions

| ID | Decision |
|---|---|
| IP1 | The page order is: Quote, Position (only when an account holds the instrument), Terms (fixed income with terms), Data. The price table, collapsed, stands inside the Quote section under the range figures, because its rows are the points of the chart. The positions table moves from the top to the Position section. |
| IP2 | The latest price is the price of the greatest date of `latestPriceQuery` (366 days). The hero shows it with the quote currency symbol, its date, its source label and, when the previous quote exists, the change against it: `(latest - previous) / previous` in basis points from the two exact decimals. A stale instrument (`coverage.stale`) adds a warning tag with the date. An instrument with no price shows the empty state of the section. |
| IP3 | While the pointer or the keyboard reads a point of the chart, the hero shows that point's price and date and the change against the first point of the range. When the reading ends, the hero returns to IP2. |
| IP4 | `fetchPrices` returns `{ items, interval }`. The range control states the interval in words when it is not `day`: "One point per week: the last price of each week". |
| IP5 | The chart draws the line with a wash, a marker on the last point and a second series of markers for the points whose source is `manual`, named in the legend only when one exists. The axis keeps the time scale; the tick format writes the year from 100 days of span (A223 RM6, unchanged) and the number of ticks is bounded so that labels do not touch. |
| IP6 | A reference line "Average cost" is drawn when the book holds the instrument, the value lies between the lowest and the highest plotted price (an outside value would stretch the axis away from the line), every position has an `average_cost` and the cost basis currency is the quote currency. The value is the quantity-weighted mean of the positions' `average_cost`. |
| IP7 | The range figures are four `FigureCard`s: change over the range (first against last point, basis points from the exact decimals), highest price with its date, lowest price with its date, number of points with the interval. The change card has `goodWhen="none"`. |
| IP8 | Position figures: market value, cost, unrealized result with its share of cost, quantity with the average cost. Market value, cost and result are sums over the positions of the instrument. The result exists only when every position has a market value and the cost basis currency equals the market value currency; otherwise the card says why in its note. A sum holds one currency (C2). |
| IP9 | The positions table gains a column "Result" per account under the same rule as IP8. |
| IP10 | Terms section: a `ProgressBar` of the elapsed share of the term (issue to maturity at `today`) with its value text "N of M days", the sentence "Matures in N days" or "Matured N days ago", one sentence "Accrued price of P: +X% over the face value" (latest price against face value, from exact decimals), then the description list of the terms with the index code in capitals. Dates, index, percent, spread, day count and face value stay one row each. |
| IP11 | Data section: the coverage sentence, the stale alert, the history notice and the actions, unchanged, then one row per source of `coverage.sources` in a framed table with source, state (active or disabled, official), first date and last date. The facts (subtype, quote currency, exchange, quantity decimal places) stay a section of their own, `Cadastro`. |
| IP12 | The price table gains a column "Change" against the older row of the answer. Its header names the basis: the previous point of the interval. |
| IP13 | The placeholder reserves the new anatomy: hero, range control, chart, four figure tiles and one section. |
| IP14 | The page is a desktop route (ADR 027, S3). No phone code is added. At 390 px the grids of `FigureGrid` stack by their own measure and the chart keeps its width; the page is checked for horizontal scroll only. |
| IP15 | Unit prices stay masked in privacy mode as `latest-price-cell.tsx` does: the hero, the figures, the chart axis, the tooltip and the table write `MASK`. Sums of money use `useMoneyFormat`. |

## 5. Derivations on the client

| Value | Rule | Test |
|---|---|---|
| Change in basis points | `round((last - first) * 10000 / first)` over exact decimals parsed to `bigint` with 12 places. First equal to zero gives no change. | `price-stats.test.ts` |
| Highest, lowest | Compare as scaled `bigint`; the first date wins a tie. | `price-stats.test.ts` |
| Position totals and result | Section IP8. Integers of minor units; the share is `round(result * 10000 / cost)`. | `position-totals.test.ts` |
| Weighted average cost | `sum(average_cost * quantity) / sum(quantity)` in `Number`, drawn as one chart line, never written as an amount. | `position-totals.test.ts` |
| Term progress | Calendar days between dates in `today`'s calendar; clamped to 0 to 100. | `maturity.test.ts` |

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no value varies by country. The currency symbol and every number come from `Intl` through the active tag. The remuneration sentence names the index code the book holds. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set grows with regions. |
| R4 | Does not apply: no extension point is added. |
| R5 | Texts added in `catalog-instruments.pt-BR.ts` and `catalog-instruments.en.ts`, listed in the plan. |
| R6 | Dates through `formatDate`, `formatDayMonth` and `formatReferenceMonth`; numbers through `numberFormatter` and `useMoneyFormat`; the minus sign is U+2212. |
| C1 | No amount is stored or computed beyond display sums of integers of minor units. |
| C2 | Sums hold one currency. A result across the cost currency and the base currency is not computed; the card states "cost in USD, value in BRL". |
| C3 | An instrument quoted in a currency other than the base currency (NVDA in USD) shows prices in USD and the market value in the base currency; the result card states the mismatch. Tested with a USD quote and a BRL base. |
| C4 | The symbol comes from the quote currency of the record (`quoteOf`). No literal fallback. |
| T1 | The "today" of the term and of the range comes from `useToday`. |
| T2 | Does not apply: the term counts calendar days. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. Write actions keep their gates. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply. |
| S1 | Does not apply: no operation is added. |
| S2 | The page stays desktop-only (IP14). |
| S3 | `investments.md` of the guide gains one paragraph for the instrument page. |
| S4 | Does not apply: the assistant reads the same operations. |
| X1 | Does not apply: no scenario of `06-scenarios.md` is added. |
| X2 | The C3 test runs with a USD quote and a BRL base. |

## 7. Out of scope

The API contract, the dialogs, the instruments list, the portfolio page, a comparison against an index, an intraday series, a candlestick chart (the API holds one price per date) and the demo seed (its manual prices on fixed-income instruments are data, shown by IP5).
