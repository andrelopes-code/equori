# Indicators tab

Redesign of the tab "Indicators" of `/reports`. Amends `docs/specs/2026-10-26-analytics-design.md` section 6 only. Its anti-goals (section 2: no judgment, no threshold, no figure that differs between the overview and `/reports`) and the indicator rules of section 4 stay as they are. No API operation changes.

## Intent

Measured on the demo book, month 2026-11, with `GET /reports/indicators`:

- The tab draws five line charts of equal weight, each on its own auto-scaled axis. No chart writes the value of the asked month.
- The asked month is the current one by default, so its figures run to today (analytics design 4.1). The savings rate of 2026-11 is -17241 bp (income 167990, expense 457628 minor units). That point moves the axis of its chart to -200% and flattens the other eleven months.
- The liquidity axis spans 3.3 to 3.9 months. A 0.3 month swing reads as a peak.
- `debt_service_share` is 0 in all 12 months. Its axis reads "0,01% 0,01% 0,01% 0,00% 0,00%".
- `committed_share` is 0 in 11 months and 1744 bp in the current one. The payload does not tell "no commitment" from "no record".
- `income`, `expense`, `liquid_balance`, `mean_income` and `mean_expense` come in every month and the screen shows none of them.
- The x labels collide with the lowest y label, and the chart notes are cut with an ellipsis.

A reader asks, in this order: is this month inside my usual range; how much reserve stands against what is owed; where did the savings come from. The tab answers in that order and keeps every datum of the payload one action away.

## Decisions

| ID | Decision | Source |
|---|---|---|
| D1 | Order of the tab: month control, verdict (IT1), position in the last 12 months (IT2), reserve against debts (IT3), income and expense with the savings rate (IT4), audit details (IT5). | Owner review of 2026-11-09 ("tab Indicadores", concept B) |
| D2 | The tab opens on the last complete month. The current month stays selectable and is carried in the address. The overview's indicator links carry the overview's month, so a figure is the same on both screens. | Planning session recommendation; owner answered "ok" to concept B on 2026-11-09. Reversible in one constant. |
| D3 | The savings rate of an incomplete month (the month of `today`) is not drawn in any series, strip or comparison. It is written, tagged "partial". Every other ratio and amount is drawn as the API returns it. | Analytics design 4.1: the current month runs to today. Only the savings rate divides a partial flow by a partial flow. |
| D4 | A leading month with `income`, `expense`, `liquid_balance` and `liabilities` all zero is a gap, not a zero, in every chart and strip. The rule is derived on the client and named here. | The payload carries zeros before the first posting (`docs/specs/2026-10-26-analytics-design.md` 4.1, "First posting month"). |
| D5 | The money result of the month is derived on the client: `result = income - expense`. | The payload holds both amounts. |
| D6 | No tone, color or word judges a value. The asked month takes the accent; the other months take neutrals. Comparisons are against the reader's own history. | Analytics design section 2, anti-goals. |
| D7 | Two measures never share a chart. Reserve and debts share one (both are amounts of the base currency). Flows and the savings rate are two charts. | `visual-forms.md` data honesty: one unit per axis. |
| D8 | The only element of the tab's own is the position strip (IT2). Everything else is a Slotted family. | build-own-element: no family draws the position of one value among twelve on one axis. |
| D9 | No phone layout. `/reports` is desktop-only below 600 px. | ADR 027, S3; `docs/contributing/web.md` S7 |

## Rules

**IT1 Verdict.** One card holds, at the start, a block of three fixed slots and, at the end, the month ledger. A sentence of free length stretched the card and repeated the month's amounts when the month was incomplete (owner review of 2026-11-09), so every case fills the same slots: a label "Savings rate in {month}", the savings rate as the figure (`--slotted-font-size-4xl`), and one line of at most 36 characters per row that compares it or says why it cannot. The ledger is three figures side by side (income, expense, result, `result` signed), each a label over an amount. From 60 rem of the card's width the ledger stands beside the block; below it, under it.

| Case | Figure | Line |
|---|---|---|
| complete month, rate and 12-month mean present, delta not zero | rate | "{delta} pp above or below the 12-month mean ({mean})" |
| same, delta zero | rate | "In line with the 12-month mean ({mean})" |
| complete month, mean has a reason | rate | "The 12-month mean needs 3 complete months of records." |
| rate has `no_income` | "—" | "No income was recorded in {month}." |
| incomplete month | the written rate, muted | "In progress: it only compares with a closed month." |

`{delta}` is the absolute difference of `bp` values in percentage points with two decimals, bound to "pp" by a no-break space. An incomplete month carries a `Tag` "In progress until {date}" beside the label. Numbers go through `formatBasisPoints`, `numberFormatter` or `useMoneyFormat()`. The tag holds words and no icon: the application has no generic icon set and the tag uses no state color.

**IT2 Position.** A card titled "Where the month stands in the last 12 months" holds one row per ratio: savings rate, liquidity, committed income, debt to income. A row is the name with its unit line, the position strip, and the value end-aligned. The savings row adds its 12-month mean as a tick on the strip and as a line under the value.

- The strip draws one dot per month with a value, on one axis from the smallest to the largest of the 12 values, zero included when it lies inside. The asked month is the large accent dot. The other months are small neutral dots. A band between the smallest and largest of the other months is the usual range.
- The row writes its two extremes at the strip's ends. When all other months hold the same value the strip writes that value once, with "in every other month".
- An incomplete month leaves the savings marker out (D3). The value is written and the line under it reads "partial, no comparison".
- A ratio with a reason shows the reason in words in place of the strip and "—" for the value. Fewer than 3 months with a value shows "Not enough history for the 12-month range" in place of the strip.
- `debt_service_share` equal to 0 in all 12 months shows "No loan or financing in your records" (`overview.indicators.noDebt`) in place of the strip, and keeps the value.
- The strip's accessible name carries the value, the extremes and the mean. The dots are hidden from assistive technology.

**IT3 Reserve and debts.** One `Chart variant="card"` with the area of `liquid_balance` and, over it, the area of `liabilities` (a thin line over the large area was lost, owner review of 2026-11-09), the axis ticks in whole amounts, one axis in the report currency from zero, `legendValues` so the legend writes each last value. The description reads "Balance at the end of each month. Liquid accounts against what is owed." The ratio `liquidity` is not repeated here (IT2).

**IT4 Flows.** Two charts side by side in a grid from two columns. The first is `Chart variant="card"`, bars of `income` and `expense` per month, `texture` on, and a line annotation labelled "In progress" on the incomplete month (a band annotation was a pale block that clipped its label). The second is a line chart of `savings_rate` with `trailing_savings_rate` dashed, both in percent, axis holding zero, the incomplete month a gap (D3).

**IT5 Details.** A collapsed `Collapsible` titled "Month by month and definitions" holds a `Table`: month, income, expense, savings rate, 12-month mean, liquidity, committed income, debt to income, liquid balance, liabilities. A ratio with a reason writes the reason in a word: "No income", "No expense", "Short history". Under the table stand the five definitions that the five chart notes held, and the sentence "Cash basis." The table writes every month, gaps of D4 included as "—".

**IT6 States.** Loading: a skeleton card for the verdict, four skeleton rows for the position card, the charts with `loading`. Error: the existing `QueryError` with retry. Empty: the sentence of the case "no income" and the strips with their reasons.

**IT7 Element of its own.** The strip meets OE-01 to OE-10 of `guidelines/own-elements.md`. It is not interactive, so OE-02 to OE-05 hold nothing to check. Under forced colors the asked dot keeps a border and a larger size, the mean tick keeps a border. The gap is recorded in a comment above the component and, after the check of `web/CLAUDE.md` rule 5, as a finding in `andrelopes-code/slotted`.

## Cross-cutting questions

- R1: Does not apply: no value varies by country. The numbers and months take the active tag through `Intl` (R6).
- R2: Does not apply: same reason as R1.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: Every text is a catalog key with pt-BR and en text, listed in the plan's Contract.
- R6: Months, percentages, point differences and amounts use `formatReferenceMonth`, `formatBasisPoints`, `numberFormatter` and `useMoneyFormat()`. The Intl minus sign is never used.
- C1: Does not apply: no amount is stored. `result = income - expense` is computed in integer minor units of `report.currency`.
- C2: Every amount is in `report.currency`; a sum holds one currency; the API values foreign balances in the base currency (analytics design 4.1).
- C3: The report currency is the book's base currency and no account currency enters the screen. A test renders the tab with `currency: "USD"` and expects no literal `R$`.
- C4: The currency comes from `report.currency`. Amounts go through `useMoneyFormat()`, so privacy mode masks them. Percentages and months stay unmasked (analytics design section 3).
- T1: The incomplete month is `today.slice(0, 7)` with `today` from `useToday()`. The default month is the month before it.
- T2: Does not apply: no business-day or due-date logic.
- B1: Does not apply: no table.
- B2: Does not apply: the read keeps its operation and `x-book-role`.
- B3: Does not apply: no setting. The month lives in the address.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: the tab reads only.
- D4: Does not apply: no external data written.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation added.
- S2: Does not appear on a phone (D9, ADR 027).
- S3: The guide article `internal/assistant/guide/articles/reports.md` gains the indicators tab in the same commit as the screen.
- S4: Does not apply: the assistant already reads `getIndicators`.
- X1: Does not apply: no scenario of `docs/domain/06-scenarios.md`.
- X2: C3 applies: the USD test above. R1 and R2 do not apply.

## Tests

- Pure functions of the view model, with values derived by hand from fixtures: leading gap (D4), partial month (D3), position rows (IT2), verdict case and parameters (IT1), month ledger (D5), default month and its address round trip (D2).
- Component tests per file: strip name and states, verdict card per case, board rows per reason, audit table.
- `reports-indicators.test.tsx` changes where the behavior changes: the default month is the last complete month (D2) and the five chart notes become the definitions of IT5. The commit body names this spec.
- The overview indicator link carries its month: `indicator-figure.test.tsx`.

## Out of scope

Thresholds, targets, benchmarks, a phone layout, a new API field, a period control for this tab, drill-down from a bar into transactions.
