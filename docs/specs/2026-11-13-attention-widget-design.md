# Attention widget

The Attention widget of the overview ranks what needs a decision by impact and draws each item with the weight of its impact. Today every item has one weight, a budget over its amount stays listed for the whole month, and the budgets collapse into one count.

## 1. Scope

- The widget keeps the data it reads (statements, connections, uncategorized and unconfirmed transactions, reconciliation differences, budget progress). No operation is added.
- The list keeps every item: no row limit and no "more" row. The widget body scrolls when the items exceed its height.
- Out of scope: dismissing an item, a per-budget margin setting, a time series of the overrun.

## 2. Decisions

| ID | Decision |
|---|---|
| AT1 | An item has one weight. `critical`: a statement past its due date. `high`: a statement due within `statementNoticeDays` and the connections that need action. `normal`: a budget over its amount by more than the margin, the transactions to review, an open reconciliation difference. `low`: a budget over its amount within the margin. |
| AT2 | Order: by weight (`critical` first), then by kind in this order: statements by due date ascending, connections, budgets by overrun share descending then id, review, difference, budgets within the margin by overrun share descending then id. |
| AT3 | The margin is `budgetMarginPercent = 10` in `attention.ts`. A budget is within the margin when its overrun share (AT4) is at most 10, so the weight agrees with the percentage written on the row. `overrun` is `-available`. A budget with `planned + carried <= 0` has share 100 and is above the margin. The value is a product decision of the owner; changing it changes one constant and its test. |
| AT4 | Each budget over its amount is its own item with the name of its category, the overrun amount, the overrun share (`round(overrun * 100 / (planned + carried))`, 100 when `planned + carried <= 0`), the spent amount and the amount of room (`planned + carried`). The aggregated `budget_over` count is removed. |
| AT5 | The header count is the number of items whose weight is not `low`. |
| AT6 | The transactions to review are one item. Its segments are the uncategorized count and the unconfirmed count of each account that has no open reconciliation difference (A133: the difference item carries those). The total is the sum. When the uncategorized read reports `more`, the total reads "N+". The bar draws one segment per source, widest first. The legend is one line per source with the counts ending on one vertical line: the three widest sources, each a link to its destination (the uncategorized list, the statement of the earliest unconfirmed entry, or the account), and one "Other" line for the rest that links to `/accounts`. The total sits on the title line. |
| AT7 | A statement past its due date draws a block of its own: the unpaid amount at 32 px, the days late written, and a ruler with one segment per late day, at most 7, filled in the danger tone. The block holds one link, the Pay button, that opens the statement. |
| AT8 | Days late is the calendar-day difference between the book's today and the due date. Days left is the same difference reversed; 0 reads "today". |
| AT9 | The only tones are danger for `critical`, warning for the due-soon description, and neutral elsewhere. A weight is told by height, ground, type size and type weight, never by color alone. The widget uses no icon. |
| AT10 | Own elements: the overrun bar (a bar that ends at the amount, a mark at the amount, the overrun in the danger tone) and the segment bar. Slotted families checked: `meter` and `progress` draw one value against one limit and cannot draw a part beyond the limit; `chart` is not used because the data is two or three values per element. |
| AT11 | Rows are Slotted `ListItem`s inside one `List`. The block (the widget's placement) keeps 4 columns and takes 8 rows. |

## 3. Derivation

- `attention.ts` returns the ranked items with weight, days, overrun figures and review segments. It stays pure and holds no text.
- `use-attention.ts` holds the queries and returns `{ items, loading, error, sources }`.
- One component per file renders each kind. The bars read only tokens of the groups of `tokens.md`.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the margin is a ratio of the budget, not a regional value. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | `overview.attention.count`, `.countOne`, `.pay`, `.lateDays`, `.lateDaysOne`, `.lateSince`, `.dueToday`, `.dueIn`, `.dueInOne`, `.statementOf`, `.budgetOver`, `.overrun`, `.review`, `.reviewOther`, `.reviewUncategorized`, with pt-BR and en text, singular and plural as separate keys; `overview.attention.more`, `.uncategorized`, `.unconfirmed`, `.budget_over`, `.statement_due`, `.statementDueOn` and `.statementOverdue` are removed. |
| R6 | Dates through `formatDate`; counts and percentages through `numberFormatter`; the plural of days and items through the ICU `plural` form of the catalog. |
| C1 | Does not apply: the widget computes no stored amount; the overrun is a difference of two integers of one currency. |
| C2 | The overrun subtracts amounts of one budget, which holds one currency. The statement amount is shown in the currency of its card. The count of items sums no amounts. |
| C3 | Each amount shows the currency of its record. |
| C4 | Amounts go through `useMoneyFormat()` (`MoneyFigure` or `fmt.money`), so privacy mode masks them. The overrun percentage is not an amount and is not masked. |
| T1 | "Today" comes from `useToday()`; due dates are calendar dates. |
| T2 | Does not apply: no business-day count. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting; the margin is a constant (AT3). |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation is added. |
| S2 | The overview is a phone route (ADR 027). The widget is one column at 390 px with the same rows and no horizontal scroll. |
| S3 | The guide article of the overview topic describes the widget and changes in the same commit when it names the old row set. |
| S4 | Does not apply: the assistant reads the underlying data through its own tools. |
| X1 | Does not apply: no acceptance scenario is added; S247 and S248 keep their tests, updated for the per-budget item. |
| X2 | Does not apply: no region or currency dependent behavior. |
