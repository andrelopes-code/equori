# Net worth within a month, with the spending of each day

- Status: draft
- Date: 2026-11-04
- Scenarios: S283 and S284 of `docs/domain/06-scenarios.md`
- Extends: `getNetWorth` (investments design 4.3) and the net worth tab of `/reports`

## 1. Intent

The net worth tab of `/reports` draws one point per month end. Within a month, the overview's balance chart reads only the Available accounts, so a card purchase appears there only when its statement is due. Net worth counts a card purchase on its day: the purchase raises the card's liability, and paying the statement later moves money from an asset to the liability without changing net worth. A chart of net worth by day, with the spending of each day, shows every purchase on the day it happened.

## 2. Rules

| ID | Rule |
|---|---|
| D1 | `GET /reports/net-worth/days?from&to&value_in` returns, for each day of `[from, to]` in order, the assets, liabilities and net worth at the end of that day, valued as `getNetWorth` values them. |
| D2 | `from` after `to`, or a range of more than 62 days, answers 400 `invalid_request` with a field error on `to`. A missing price answers 422 `price_missing`, as `getNetWorth` does. |
| D3 | The tab draws a second chart, "Net worth in {month}", below the monthly chart. It reads the month of the point selected in the monthly chart, and the current month when none is selected. Its range runs from the first day of the month to its last day, or to today in the current month. |
| D4 | The chart draws net worth as a line on the start axis and the spending of each day as bars on the end axis. |
| D5 | The spending of a day is the sum, in the base currency, of the postings dated that day on accounts of class `expense`, in the accrual view: a card purchase counts on its date. A refund is a negative posting and lowers the sum. A transfer between balance accounts is not spending. |
| D6 | A change of net worth on a day with no spending comes from income, a price, or an exchange rate. The chart draws no mark for it. |
| D7 | Privacy mode masks every amount of the chart, as the monthly chart does (ADR 018). |

No regional value enters: the currency comes from settings, and dates and month names come from `src/i18n/format.ts`.

## 3. Code

| Piece | Place |
|---|---|
| `NetWorthDays(ctx, booksID, from, to, in)` | `internal/portfolio/internal/app/allocation.go`, one `NetWorth` per day; `ErrInvalidDayRange` |
| Operation `getNetWorthDays` | `api/openapi.yaml`, tag `portfolio`, `x-book-role: read`; entry in `internal/server/tool_exposure_test.go` |
| `dailySpending(transactions, expenseIDs, base)` | `web/src/features/reports/net-worth-days.ts`, pure, tested |
| `NetWorthMonthChart` | `web/src/features/reports/net-worth-month-chart.tsx` |
| Selection | `net-worth-tab.tsx`: the monthly chart is `selectable`, and its selection sets the month of D3 |

## 4. Acceptance

- S283: checking holds 1,000.00 on 2026-10-19. A loan pays an expense of 300.00 on 2026-10-20. `getNetWorthDays` from 2026-10-19 to 2026-10-21 answers three days with net worth 1,000.00, 700.00 and 700.00.
- S284: `from=2026-10-21&to=2026-10-19` and `from=2026-08-01&to=2026-10-19` each answer 400 `invalid_request` on `to`.
- A web test draws the month chart with the bars of the spending of each day, and a test of `dailySpending` covers a card purchase, a refund and a transfer.
