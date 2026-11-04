# Net worth within a month, beside the income and expenses of the month

- Status: delivered
- Date: 2026-11-04
- Scenarios: S283 and S284 of `docs/domain/06-scenarios.md`
- Extends: `getNetWorth` (investments design 4.3) and the net worth tab of `/reports`

## 1. Intent

The net worth tab of `/reports` draws one point per month end. Within a month, the overview's balance chart reads only the Available accounts, so a card purchase appears there only when its statement is due. Net worth counts a card purchase on its day: the purchase raises the card's liability, and paying the statement later moves money from an asset to the liability without changing net worth. A chart of net worth by day, beside the income and expenses of the month, shows every purchase on the day it happened and every income on the day it came in.

## 2. Rules

| ID | Rule |
|---|---|
| D1 | `GET /reports/net-worth/days?from&to&value_in` returns, for each day of `[from, to]` in order, the assets, liabilities and net worth at the end of that day, valued as `getNetWorth` values them. |
| D2 | `from` after `to`, or a range of more than 62 days, answers 400 `invalid_request` with a field error on `to`. A missing price answers 422 `price_missing`, as `getNetWorth` does. |
| D3 | The tab draws a card "Net worth by day · {month}" below the monthly chart. A month control in the card's header picks any month up to the current one; a point picked in the monthly chart sets the same month. With none picked, the card reads the current month. Its range runs from the first day of the month to its last day, or to today in the current month. |
| D4 | The card holds the net worth of each day as a line, and beside it a table of the month's income and expenses: date, description with its category under it, and the effect on net worth, signed (income plus, expense minus), the largest effect first. The table is ruled, without a frame of its own, inside the card. A day picked on the line filters the table to that day; clearing the pick returns to the month. Amended on 2026-11-04 by the owner: income stands beside the expenses. |
| D5 | An entry is a posting in the base currency on an account of class `income` or `expense`, dated by its transaction, in the accrual view: a card purchase counts on its date. Its effect on net worth is the posting's amount with the sign reversed: income adds, an expense subtracts, a refund of an expense adds. A transfer between balance accounts and a voided transaction are not entries. |
| D6 | A change of net worth on a day with no expense comes from income, a price, or an exchange rate. The chart draws no mark for it. |
| D7 | Privacy mode masks every amount of the chart, as the monthly chart does (ADR 018). |

No regional value enters: the currency comes from settings, and dates and month names come from `src/i18n/format.ts`.

## 3. Code

| Piece | Place |
|---|---|
| `NetWorthDays(ctx, booksID, from, to, in)` | `internal/portfolio/internal/app/allocation.go`, one `NetWorth` per day; `ErrInvalidDayRange` |
| Operation `getNetWorthDays` | `api/openapi.yaml`, tag `portfolio`, `x-book-role: read`; entry in `internal/server/tool_exposure_test.go` |
| `monthEntries(transactions, categories, base, day)` | `web/src/features/reports/net-worth-days.ts`, pure, tested |
| `NetWorthMonthChart` | `web/src/features/reports/net-worth-month-chart.tsx` |
| Selection | `net-worth-tab.tsx`: the monthly chart is `selectable`, and its selection sets the month of D3 |

## 4. Acceptance

- S283: checking holds 1,000.00 on 2026-10-19. A loan pays an expense of 300.00 on 2026-10-20. `getNetWorthDays` from 2026-10-19 to 2026-10-21 answers three days with net worth 1,000.00, 700.00 and 700.00.
- S284: `from=2026-10-21&to=2026-10-19` and `from=2026-08-01&to=2026-10-19` each answer 400 `invalid_request` on `to`.
- A web test picks a past month with the month control and finds its income and expenses; a test of `monthEntries` covers income, a card purchase, a refund, a transfer, a voided transaction and the filter by day.
