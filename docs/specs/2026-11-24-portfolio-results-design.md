# Portfolio area: tabs and the Results tab

Issue #69. Approved mock: `docs/superpowers/mocks/2026-11-24-portfolio-results-design/` (local, outside Git), approved by the owner on 2026-11-24.

## Intent

`/portfolio` stacks seven sections and answers four questions on one page. The owner asked for an area that separates them and for a view of how the portfolio performed since its first day: against indexes, window by window, month by month, and as money.

## Goals

- One destination, "Carteira", with tabs in its page header. Each tab answers one question.
- A Results tab whose default period is the whole history.
- Every datum of the previous `/portfolio` stays reachable (inventory in `mock.json`, `notes.inventory`).

## Non-goals

- Price benchmarks (Ibovespa, S&P 500, FTSE Global All Cap) as a data source: another session delivers them (owner, 2026-11-24). The series lists them once the catalogue offers them (PS8); the tab draws its series list from the response, so it needs no change.
- A new layout for the Summary tab and the Projection tab. Each gets its own mock.
- A phone form (ADR 027: the portfolio is a desk screen).

## Anti-goals

- A figure on the Results tab that contradicts `GET /reports/return` for the same period.
- A chart that reads a missing value as zero.

## Approaches

| Approach | Trade-off | Choice |
|---|---|---|
| Tabs in the header of one destination | Shared account and currency; one more click to reach positions | Chosen by the owner |
| Separate entries in the main navigation | Three more entries; filters not shared | Rejected |
| An overview of thumbnails that open detail pages | Every chart drawn twice | Rejected |

For the series, a point per day over ten years costs about 3,900 valuations of the tree (17 ms each on the demo data set, measured on 2026-11-24: 62 days of `getNetWorthDays` in 1.05 s). The step of the series therefore follows the length of the period (PR5).

## Rules

### Tabs (PT)

| ID | Rule |
|---|---|
| PT1 | The tabs and their routes: Resumo `/portfolio`, Resultados `/portfolio/results`, Posições `/portfolio/positions`, Proventos e IR `/portfolio/year`, Aportes `/portfolio/contribution-plan`. A tab is a link; the header is the same component on the five routes. |
| PT2 | Resumo holds the quote warnings, the four figures, the return section ("Como rendeu") and "Onde está o dinheiro". Posições holds "Renda fixa" and the positions grid. Resultados holds the blocks of PR and "Rendimento por ativo". The sections move without a change of behavior. |
| PT3 | The header controls: the valuation currency on every tab; the valuation date on Resumo and Posições; the year on Proventos e IR. Then one vertical `Divider` with the same margin on both sides, the help link, and the primary action "Registrar compra ou venda". The links "Proventos e vendas" and "Plano de aporte" leave the header: they are tabs. |
| PT4 | `value_in` travels in the search of every tab link, so the currency holds across tabs. |
| PT5 | The empty portfolio and a failure of the positions read draw their `ResultState` on Resumo and Posições as today. |

### Return series (PS)

| ID | Rule |
|---|---|
| PS1 | `GET /reports/return/series` takes `account_id`, `from`, `to`, `value_in` as `getReturn` does, and `step` (`day`, `week`, `month`). Without `account_id` the tree is every brokerage tree. Without `from`, the period starts on the first posting of the tree; a tree without a posting starts on `to`. |
| PS2 | The step dates are `to` and: every day of the period (`day`); every seventh day counted back from `to` (`week`); the last day of each calendar month inside the period (`month`). At most 400 step dates; more is `400 invalid_request`, as is `from` after `to`. The 3,660-day limit of `getReturn` (HR2) does not apply: the cost follows the step dates and the flow dates, not the days. |
| PS3 | A point holds its date, the value of the tree at the end of that day, the sum of the external flows dated after the previous point (after `from − 1` for the first) up to it, and `return_bp`: the time-weighted return from the end of `from − 1` to the end of the point's day, by the pieces of amendment A208 R1 cut at every flow date and every step date. A cut on a day without a flow leaves the factor unchanged, so the last `return_bp` equals `period_bp` of `getReturn` over the same period. |
| PS4 | `return_bp` is absent on a point whose factor is undefined (a gain without invested base, a piece that loses everything) and on every later point. |
| PS5 | `indexes` holds the default daily index of the book's region and its inflation index, each only when its currency is the currency of the report (A208 R15) and it has a rate in the period. A daily index holds one point per step date: the growth of the rates dated in `[from, date]`. A monthly index holds one point per whole calendar month of the period with a stored rate, dated on the last day of that month: the growth of the rates of the whole months from `from`; it stops at the first month without a rate. |
| PS6 | The index points grow over calendar days, also on the days the tree held nothing. The comparison of `getReturn`, which leaves those days out (R14), stays the figure of record for a period; the series is the drawing. The tab states the difference in the method layer. |
| PS8 | When the market data module offers benchmarks quoted as a level, `indexes` also holds each one enabled for the book in the currency of the report, one point per step date: the level at the date over the level at `from − 1`. The plan that adds them is written after that module's port exists. |
| PS7 | The operation needs the role `read`. The assistant reads the return through `getReturn`; the series is excluded from the tools. |

### Results tab (PR)

| ID | Rule |
|---|---|
| PR1 | Period presets: 1, 3 and 6 months, year to date, 12 months, 2 and 5 years, from the start, and a custom range through `PeriodControl`. The default is from the start. The choice lives in the search (`period`, or `from` and `to`). |
| PR2 | The account select ("Toda a carteira", then each brokerage tree) sits in the header of the Results tab and lives in the search (`account`). |
| PR3 | The tab reads the whole history once at `step=month` (the history read) and, when the period is not the whole history, the period at its step (the period read). |
| PR4 | The return block draws the period read: the percent of the period, the difference in percentage points against each index over the same step dates, one row per series with its percent and a switch for each index (the first daily index on, the others off), the annual rate, the real return, the volatility and the largest fall with its dates, marked as a band on the plot. |
| PR5 | The step of the period read: `day` up to 184 days, `week` up to 730 days, `month` beyond. |
| PR6 | The annual rate and the volatility need 12 whole months; with fewer, the row reads "menos de 12 meses". The real return covers the whole months with an inflation rate and states the last month when it is not the last of the period. |
| PR7 | Rolling windows, the month table and their figures read the history read, whatever the period. A window holds 12 whole calendar months of the history and ends on each month end from the twelfth whole month; a partial first or last month enters no window. With fewer than 12 whole months the block states the end of the twelfth. The figure Today is the return of the 12 months to today, from a read of that year at `step=month`, and belongs to no share or extreme. The share above an index counts the windows whose end the index also holds; without one the tile is left out (amended 2026-11-25). |
| PR8 | The month table has one row per calendar year, newest first, a column per month, the year and the accumulated return. A cell takes one of four strengths of the success or danger tone by the size of its return: below 1%, below 3%, below 6%, 6% or more; zero takes none; a month outside the history reads "–". The number is always written. |
| PR9 | The evolution block draws, over the months of the period, the value, the money contributed (opening value plus the running sum of the flows, as steps), the area between them and the flow of each month on its own strip. Its panel lists opening value, net contributions, return in money (closing − opening − flows) and closing value, and the annual money-weighted rate of `getReturn` when the period has at most 3,660 days and at least 365. |
| PR10 | A result carries the success or danger tone with its sign written; a percent of windows below zero uses the danger tone, above an index the success tone. The user setting that turns tones off for money applies. |
| PR11 | Loading keeps every static text (titles, series names, labels, the table header) and draws a placeholder only where a value, a line or a cell comes. Empty and failure are the `ResultState` of the app. |
| PR12 | The charts are the Slotted `Chart`: dashed strokes for references, a `range` series for the area between two lines, `annotations` for the fall band, the legend replaced by the series list, and `extendOption` for the end labels. The family covers what the mock draws (checked against `dist/docs/chart.md` on 2026-11-24), so no chart imports ECharts directly; an element the family cannot express is reported to Slotted and drawn through `extendOption` with the issue cited. |

## Client derivations

Each is a pure function with a test of hand-computed values.

| Value | Rule |
|---|---|
| Month return | `(1 + c[m]) / (1 + c[m−1]) − 1` over the cumulative `return_bp` of consecutive month points |
| Rolling window | The product of 12 consecutive month factors, minus 1 |
| Largest fall | The lowest `(1 + c[i]) / max(1 + c[j], j ≤ i) − 1` with the dates of the peak and of the trough |
| Volatility | The sample standard deviation of the month returns times √12 |
| Annual rate | `(1 + c)^(365 / days) − 1` |
| Difference in points | `c` of the portfolio minus `c` of the index at the last date both hold |
| Money contributed | Opening value plus the running sum of `flows` |
| Heat strength | PR8 |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The indexes of the series vary by country: `BenchmarkIndex` and `InflationIndex` of `internal/marketdata/region_defaults.go`, read through the existing ports. |
| R2 | A region without an index returns `indexes: []`; the tab draws the portfolio alone and no difference against an index. |
| R3 | Index ids keep the pattern `^[a-z0-9_]{2,40}$`. `step` is not regional: an enum. |
| R4 | No new extension point. |
| R5 | Catalog keys `portfolio.tabs.*` and `portfolio.results.*`, pt-BR and en, listed in the plan. |
| R6 | Percents, money, month names and dates through `src/i18n/format.ts` and `useMoneyFormat()`. |
| C1 | Point value and flows: integers of minor units in the report currency. |
| C2 | One currency per series: `value_in`. A flow is valued at its date and a balance at the point's date, as `getReturn` does; a missing rate is the existing `422`. |
| C3 | An index in another currency than `value_in` is left out (A208 R15) and the series list states nothing for it. |
| C4 | The currency comes from the response. |
| T1 | Calendar dates of the book; "today" from `useToday()` and `platform/clock`. |
| T2 | Does not apply: no business-day count; an index day without a rate keeps the previous growth. |
| B1 | Does not apply: no table. |
| B2 | `read`; an HTTP test covers a member without the book. |
| B3 | Does not apply: no setting. The collapsed state of a section stays in the browser as today. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: reads only. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | `getReturnSeries`, excluded from the tools (PS7). No new `Problem.code`: `invalid_request` exists. |
| S2 | No (ADR 027). |
| S3 | The article of the topic `investments` describes the tabs and the Results tab in the commit that ships each. |
| S4 | No: `getReturn` serves the assistant. |
| X1 | S393: the month series of a brokerage with a contribution equals `period_bp`. S394: the daily index points of a stock brokerage end at `index_bp` of the comparison. |
| X2 | A series valued in USD carries no index (C3); a book in a region without an index carries `indexes: []` (R2). |

## Left to the builder

File names inside `web/src/features/portfolio/results/`, the ECharts option objects, and the split of components under the size limits.

## Amendment 1: one page for the summary and the results (owner review of 2026-11-25)

The tab "Resumo" repeated the tab "Resultados": its section "Como rendeu" stated the return against the indexes and the walk from the opening value to the closing value, which the return block and the wealth block of PR state. The owner asked for one page.

| ID | Rule |
|---|---|
| PT1 | Replaced. The tabs and their routes: Resultados `/portfolio`, Posições `/portfolio/positions`, Proventos e IR `/portfolio/year`, Aportes `/portfolio/contribution-plan`. `/portfolio/results` redirects to `/portfolio` and keeps its search. There is no tab "Resumo". |
| PT2 | Replaced. Resultados holds, in order: the quote warnings, the four figures (value, gain, total result, income of the year) at today's date, the period bar, the blocks of PR and "Rendimento por ativo". Posições holds "Onde está o dinheiro", "Renda fixa" and the positions grid. The section "Como rendeu" is removed with the components only it used; "Detalhes e método" of the return block stays. |
| PT3 | Replaced. The header controls: the account and the valuation currency on Resultados; the valuation currency and the valuation date on Posições; the year on Proventos e IR. Then the help link and the primary action, at one gap, with no `Divider`. |
| PT5 | Replaced. The empty portfolio and a failure of the positions read draw their `ResultState` on Resultados, in place of the figures and of every block, and on Posições. |
| PT6 | New. The three views of Proventos e IR (sales, income, monthly tax) are chosen by a `SegmentedControl` at the top of the page body, not by a second row of tabs; the choice stays in the search (`tab`). |

The search of `/portfolio` is the search of PR1 and PR2 (`value_in`, `account`, `period`, `from`, `to`); `date` and `by` live on `/portfolio/positions` only. A link that carried `date` to `/portfolio` (the gain in the currency of the cost) goes to `/portfolio/positions`.

Cross-cutting questions: no answer of the spec changes; S3: the article of the topic `investments` and the help page `portfolio` follow the new tabs.
