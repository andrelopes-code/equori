# Spending pace: the month's spending against the same days of the month before

- Status: draft
- Date: 2026-11-04
- Scenarios: S273 to S275 of `docs/domain/06-scenarios.md`
- Amends: `docs/specs/2026-10-26-analytics-design.md`, section 5.2 (the set of hideable blocks)

## 1. Intent

The overview states what the month spent by category ("Spending by category") and in the Available group ("Outflow"). It states no comparison: a reader on the 17th cannot tell from the screen whether the month spends faster than the month before. The budgets block answers it only for categories with a budget. This widget compares the spending of the current month up to today with the spending of the same days of the previous month.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. One overview widget shows the spending of the current month from its first day to today.
- G2. The widget shows the change against the same days of the previous month, as a delta and as the previous amount.
- G3. The widget's amount equals the sum of the categories that "Spending by category" reads for the same days.

Non-goals:

- A comparison with a trailing mean or with the same month of the previous year.
- A projection of the month's total spending.
- A per-category pace. The budgets block covers pace per budget (`budgetPace`).
- A new operation or an assistant tool. The widget reads `GET /reports/categories`.

Anti-goals:

- A threshold, a tone or a word that judges the pace beyond the delta's direction. The delta reads as `Outflow` does (`goodWhen="down"`).
- A delta computed against a previous amount that is zero or negative.
- Any amount in the DOM while privacy mode is on (ADR 018). The delta is a percentage and stays visible, as the indicator ratios do (analytics design, section 3).

## 3. Definitions

| Term | Definition |
|---|---|
| Today `d` | The date of `useToday()`. The overview always reads the current month. |
| Current range | From the first day of the month of `d` to `d`. |
| Previous range | From the first day of the previous month to the same day of the month as `d`. When the previous month is shorter, the range ends on its last day. |
| Spending of a range | The sum of `total.amount` over the items of `GET /reports/categories` for that range, class `expense`, accrual view, whose currency is the base currency. Refunds enter as negative totals and reduce the sum. |
| Change | (current − previous) ÷ previous, as a fraction; absent when previous ≤ 0. |

The accrual view and the base currency are the basis of `useSpending`, so G3 holds by construction.

## 4. Widget

| Rule | Detail |
|---|---|
| Key and title | `pace`; "Spending pace" / "Ritmo de gasto". |
| Value | The spending of the current range, through `MoneyValue` in the base currency. |
| Delta | The change, through `StatCardDelta`, `goodWhen="down"`. No delta when the change is absent. |
| Note | "Same days of {month}: {amount}" / "Mesmos dias de {month}: {amount}", with the previous month's name written as `overview.spending.empty` writes it, and the previous spending. When the previous spending is ≤ 0: "No spending in the same days of {month}" / "Nenhum gasto nos mesmos dias de {month}". |
| Trend | None: the sparkline belongs to the indicator figures only (analytics design 5.1). |
| Link | "Open categories" to `/categories`, as the spending block. Below 600 px the link is not drawn (ADR 027, S6). |
| Placement | Hideable. At the desk, after the indicator figures, 4 columns by 2 rows. On the phone, after the month flow figures, 4 columns by 2 rows. |
| Loading and failure | One `FigureWidget`: each of the two queries loads and fails inside the widget, and a retry refetches the query that failed. |

## 5. Code

| Piece | Place |
|---|---|
| `paceRanges(today)` and `spendingOf(items, base)` and `paceChange(current, previous)` | `web/src/features/overview/spending-pace.ts`, pure, with `spending-pace.test.ts` |
| `SpendingPaceFigure` | `web/src/features/overview/spending-pace-figure.tsx`, built on `FigureWidget` |
| Messages | `overview.pace.title`, `overview.pace.note`, `overview.pace.noPrevious` in `catalog.en.ts` and `catalog.pt-BR.ts` |
| Page | `overview-page.tsx` places the widget in both layouts under the key `pace` |

No regional value enters: dates and month names come from `src/i18n/format.ts` through `Intl`, and the currency from settings.

## 6. Acceptance

- S273 to S275 each have a web test whose name carries the scenario ID, through `renderApp` and the fake API, as S154 does in `indicator-figure.test.tsx`.
- `spending-pace.test.ts` covers the ranges of a 31-day month after a 30-day one, of 31 March after February in a common and a leap year, the base currency filter, a negative previous sum and a refund.
- The privacy test of the overview (`masks every amount in privacy mode`) covers the widget.
- The edit-mode test hides and restores the widget.

## 7. Left to the builder

- The desk cell when a stored layout predates the widget: the grid places a widget with no stored cell in the first free cell (analytics design 5.2).
- Whether the guide article of the overview topic needs a sentence, per the navigation map of `internal/assistant/internal/guide/`.
