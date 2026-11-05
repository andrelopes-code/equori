# Net worth by day: a forecast to the end of the month

- Status: delivered
- Date: 2026-11-05
- Scenarios: S286 to S288 of `docs/domain/06-scenarios.md`
- Extends: `docs/specs/2026-11-04-net-worth-days-design.md` (D3, D4)

## 1. Intent

The card "Net worth by day · {month}" of `/reports` ends on today in the current month. The forecast continues the line to the last day of the month from what the application holds: the expected occurrences of the schedules, the payments that repeat every month without a schedule, and the routine income and expenses of the previous months. A purchase that the history does not show repeating stays out of the line. The tooltip of a forecast day states what moves the forecast on that day and the likely range.

The model separates three kinds of history entry, the practice of recurring-transaction detection: a pattern counts only when it repeats with a similar amount, and what a recurring item or a schedule covers leaves the average of the day-to-day spending, so nothing counts twice. Spending amounts are close to log-normal, so the fence that marks an atypical amount is Tukey's rule on the logarithm of the amount.

## 2. Definitions

| Term | Definition |
|---|---|
| Today `t`, day `dom` | `useToday()` and its day of the month. |
| `L`, remaining days | `L` is the length of the current month; the remaining days are its days after `t`, and `n` is their count. |
| Entry | An entry of D5: a posting in the base currency on an `income` or `expense` account, not voided, dated by its transaction, signed by its effect on net worth. |
| Variable entry | An entry whose transaction no occurrence realized. |
| Series | The variable entries that share a category and a payee; an entry without a payee joins by its category and its description with digits and punctuation removed, in lower case. |
| History months | The complete months before the current one, at most six, after the month of the earliest variable entry: the first month of the data can start on any day, so it is not complete. `h` is their count. |
| Median, quartiles | Linear interpolation between the sorted values (`q(0.5)`, `q(0.25)`, `q(0.75)`). |

## 3. Rules

| ID | Rule |
|---|---|
| F1 | The forecast is drawn only for the current month, with the valuation currency equal to the base currency and today before the last day of the month. A past month, another valuation currency and the last day of the month draw no forecast. |
| F2 | The forecast is a dashed line "Forecast" / "Previsão" from today to the last day. On today it equals the net worth of today. On a remaining day `d` it equals the net worth of today plus the scheduled, recurring and routine amounts of every day from the day after today to `d`. Prices and exchange rates stay at today's values. |
| F3 | The scheduled amount of a day is the sum of the points of `getProjection`, to the last day of the month, of every open balance account (`asset`, `liability`) in the base currency, merged by occurrence: a transfer between two such accounts nets to zero and is dropped. An occurrence the projection dates today (due today or overdue) counts on the day after today. Each scheduled day draws an upright line labelled by the schedule's description, with the absolute amount as its priority (balance forecast design, B5). |
| F4 | A series recurs when it repeats monthly with a similar amount. Its typical amount `M` is the median of the amounts of its entries in the history months. In each history month, the entry closest to `M` matches when it lies within 25 % of `M`. The series recurs when its entries number fewer than three a month in median over the months that hold one, it matches in the last history month, and it matches in at least `max(2, ⌈0.75 × h⌉)` history months. Its matched entries leave the routine of F6. |
| F5 | A recurring series enters the current month once, with the median of its matched amounts, on the median day of its matched entries (a day past `L` counts on `L`). It does not enter when an entry of the series within 25 % of `M` is dated in the current month. A day after today stands; a day up to seven days before today moves to the day after today; an earlier day drops out. Each one draws an upright line labelled "{category} (estimated)" / "{category} (estimado)". |
| F6 | The entries of no recurring match are routine, except the atypical ones. Per kind (income, expense), the fence is `exp(Q3 + 1.5 × (Q3 − Q1))` over the logarithms of the absolute amounts of the history's routine candidates of that kind with a negative effect for expenses and a positive one for income; with fewer than eight candidates there is no fence. An entry whose size lies above the fence is atypical, in the history and in the current month, and stays out of the forecast. A refund passes the fence of its kind by its size: the refund of an atypical purchase is atypical too, and a small refund lowers the routine. |
| F7 | For each history month, the routine income rate and the routine expense rate are its routine income and expenses divided by its days. The remaining routine income is the median income rate times `n`; the remaining routine expenses `E` are the median expense rate times `n`. The pace `ρ` is the routine expense of the current month up to today divided by the median expense rate times `dom`, held to [0.5, 2], and 1 when that median is zero. The forecast routine expenses are `E × (1 + (ρ − 1) × dom ÷ L)`. Routine income and expenses are spread equally over the remaining days. |
| F8 | With three or more history months, the likely range is drawn in the tooltip. The routine net rate of a history month is its routine income rate minus its routine expense rate. With `X` the median income rate minus the median expense rate, the range's lower offset is `min(0, (q(0.25) − X) × n)` and its upper offset `max(0, (q(0.75) − X) × n)`. On the `k`-th remaining day the range runs from the forecast plus `lower × k ÷ n` to the forecast plus `upper × k ÷ n`. With fewer than three months the tooltip states no range. |
| F9 | The tooltip of a remaining day holds the forecast and the labels of F3 and F5, then "Scheduled: {amount}" / "Agendado: {amount}", "Estimated recurring: {amount}" / "Recorrente estimado: {amount}" and "Estimated day-to-day: {amount}" / "Dia a dia estimado: {amount}", each when its amount is not zero, and "Likely range: {low} to {high}" / "Faixa provável: {low} a {high}" under F8. Amounts are signed. |
| F10 | Under the card's note, a muted sentence states the sources: "Dashed: forecast from the schedules and the last {count} months" / "Tracejado: previsão pelos agendamentos e pelos últimos {count} meses"; with one history month, "… and the last month" / "… e pelo último mês"; with none, "Dashed: forecast from the schedules" / "Tracejado: previsão pelos agendamentos". |
| F11 | A day after today picked on the line is not a pick: the table keeps the month. |
| F12 | Privacy mode masks every amount of the forecast, line and tooltip (ADR 018). |

Removing realized occurrences from the history keeps a schedule from counting twice: its future occurrences enter under F3. A payment that a schedule took over in the last history month no longer matches there, so F4 drops it.

No regional value enters: the currency comes from settings, dates come from the ISO date, and the words come from the catalogs.

## 4. Code

The model knows no screen and no account scope: it takes dated, signed amounts with a series key and returns days. A caller chooses the scope (here every balance account in the base currency) and the history (here the variable entries).

| Piece | Place |
|---|---|
| `variableForecast({ entries, month, today })`: F4 to F8 | `web/src/features/forecast/variable-forecast.ts`, with the recurrence of F4 and F5 in `recurring-series.ts` and the fence of F6 in `atypical-fence.ts`; each pure and tested |
| `forecastDays({ month, today, start, scheduled, variable })`: F2, F3 counting, F8 range per day | `web/src/features/forecast/forecast-days.ts`, pure, tested |
| `seriesKey(category, payee, description)` | `web/src/features/forecast/series-key.ts`, pure, tested |
| `quantile(values, p)` | `web/src/features/forecast/quantile.ts`, pure, tested |
| Public surface | `web/src/features/forecast/index.ts` |
| `forecastEntries(transactions, categories, base, realized)` | `web/src/features/reports/forecast-entries.ts`, pure, tested: the variable entries with their series |
| `useNetWorthForecast(month, valueIn, start)`: F1, F3 and the inputs of F4 | `web/src/features/reports/use-net-worth-forecast.ts`: settings, accounts, the history transactions, the realized occurrences, the projections and the schedules |
| `mergeEvents`, `eventLines`, `monthDays`, `monthEnd` | reused from `features/overview` through its `index.ts`; `eventLines` takes any list of days with events |
| Chart | `net-worth-day-chart.tsx` draws the forecast series and the lines; `net-worth-forecast-lines.tsx` adds the lines of F9 under `ChartTooltipContent` |
| Rows | `netWorthRows(days, points)`: `web/src/features/reports/net-worth-rows.ts`, pure, tested |
| Messages | `report.netWorth.forecast*` in `catalog-reports.en.ts` and `catalog-reports.pt-BR.ts` |
| Slotted | #71: `ChartTooltipContent` needs `totalLabel`; #72: no series draws a band, so F8 is read in the tooltip only |
| Guide | the net worth paragraph of `internal/assistant/internal/guide/articles/reports.md` |

## 5. Acceptance

- S286 to S288 each have a web test whose name carries the scenario ID.
- The model's tests cover: no history month; the first month of the data left out; a monthly payment that recurs, one with a different amount each month, one already paid this month, one late by up to seven days, and one a schedule took over; high-frequency entries kept routine; the fence on a skewed history and below eight candidates; an atypical purchase in the current month left out of the pace; a small refund and the refund of an atypical purchase; the pace and its bounds; the range with three months; and `forecastDays` with an occurrence dated today.
