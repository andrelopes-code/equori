# Total result of the portfolio

- Status: accepted
- Amendment: A262
- Amends: PC2 and PC7 of `docs/specs/2026-11-07-portfolio-clarity-design.md`

## Problem

The figure "Gain or loss" of the Portfolio screen is the market value minus the cost of the positions held (PC2). The figure "Income in {year}" holds the income of one tax year. No figure of the screen states what a holding or the portfolio returned since the first purchase: the price gain, the result of the sales and the income together. The two figures cover different periods, so their sum is not that result.

Trackers keep the parts apart, since a jurisdiction taxes a sale and an income in different ways, and state their total beside them (Sharesight: capital gain, dividends, currency gain and total return).

## Rules

| ID | Rule |
|---|---|
| TR1 | Each item of `GET /positions` carries `realized` and `income`. `realized` is the sum of the results of the sales of the security account dated up to `date`, every kind. `income` is the sum of gross minus withheld of the income events of the account dated up to `date`. Each one is absent when the account has no such row. Each one is in the currency of its rows, the currency of the brokerage. |
| TR2 | `GET /positions` returns `realized` and `income` beside `items`: one amount per currency, ordered by currency code, over every security account of the book up to `date`. An account whose position is closed counts. An empty list states that there is none. |
| TR3 | The total result of a row is its gain plus `realized` plus `income`. It is stated only when the gain is stated and each part present is in the currency of the cost. A row whose value or part is in another currency states no total and names the reason to assistive technology. |
| TR4 | The summary holds a figure "Total result" between "Gain or loss" and "Income in {year}". Its value is the gain of PC2 plus the amounts of TR2 in the valuation currency. The note writes the sales and the income; the price gain is the figure beside it. An amount of TR2 in another currency stays out of the value, and the note names it. The count of positions without a price stays in the note of "Portfolio value" (PC2), which covers every figure. When the gain holds no number (PC23), the figure holds none either and links to the same currency. |
| TR5 | The list of PC7 shows a column "Total result" after "Gain or loss", visible by default, signed in the tone of its sign, summed on each group row and on the summary row. The summary row covers the positions held; the figure of TR4 also covers the closed ones. |
| TR6 | The view `positions` of `get_portfolio` carries `realized` and `income` on each position, as TR1. |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the parts are stored results and income events; no value differs by region. |
| R2 | A book without a jurisdiction keeps its results and income events, so the total reads the same. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | `holdings.total` (the figure and the column), `holdings.total.note`, `holdings.total.outside` and `portfolio.totalOutside`, in pt-BR and en. |
| R6 | The amounts go through `useMoneyFormat()`; no new date. |
| C1 | `realized` and `income` are integers of minor units with their currency (`Money`). |
| C2 | A sum holds one currency: TR2 sums per currency; TR3 and TR4 add only the parts in the currency of the cost and name the others. No conversion is made. |
| C3 | A brokerage in another currency than the base has its results and income in its own currency: the row states no total (TR3) and the figure names the amount outside (TR4). A model test covers it. |
| C4 | The currency comes from the response; the valuation currency comes from the address or the settings, as PC2. |
| T1 | `date` is the valuation date of the screen; a row dated on it counts. |
| T2 | Does not apply: no business days. |
| B1 | Does not apply: no table. |
| B2 | No new operation; `listPositions` keeps `x-book-role: read`, and the existing test reads another book's positions as empty. |
| B3 | Does not apply: no setting. |
| D1 to D5 | Does not apply: no table, no schema change, no recorded fact, no import, no diagnostic field. |
| S1 | No new operation; the fields extend `listPositions`, whose exposure entry stands. |
| S2 | Does not apply: `/portfolio` is outside the phone routes of ADR 027. |
| S3 | The guide article `investments.md` names the figure and the column. |
| S4 | TR6: the assistant reads the parts of each position in `get_portfolio`. |
| X1 | S674, `TestS674TotalResult` in `internal/portfolio`. |
| X2 | Does not apply to region; the model test of TR3 and TR4 reads a part in USD with the cost in BRL. |
