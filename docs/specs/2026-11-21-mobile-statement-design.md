# Mobile statement

Status: approved 2026-11-21 (owner). Approved mock: `docs/superpowers/mocks/2026-11-21-mobile-statement-design/` (local, outside Git).

Below 600 px the transaction list of `/transactions` reads as a bank statement: rows grouped by day, one fixed row height, the amount at the end. The desktop grid does not change. Wave 1 of the phone redesign; account activity and the card statement adopt the same row in later slices.

## Rules

| ID | Rule |
|---|---|
| MS1 | A phone page keeps 16 px (`--slotted-space-6`) between the screen edge and its content. Theme rule `compactInsetRule` (Slotted issue #163). |
| MS2 | Below 600 px `/transactions` draws the loaded rows as a `List` of `ListSection`s, one per day, in the order of the API. The grid stays from 600 px. |
| MS3 | A day section names the day as the grid's group row does (`Hoje`, `Ontem`, a weekday and date this year, a full date before) and ends with the day's total: money in less money out of its loaded rows, transfers and voided rows left out (`periodTotals`). The label sticks while its rows scroll and sits on the page ground (Slotted issue #161). |
| MS4 | A row is 64 px: the category mark; the title over one line of detail; the amount at the end. The detail is `category · accounts`; an uncategorized row reads `Sem categoria` in the accent tone, then the accounts; a transfer reads its accounts. A voided row strikes its title and reads `Anulada` before the accounts. Every text holds one line and cuts with an ellipsis; the amount never cuts. |
| MS5 | The amount reads money in with `+` in the success tone and money out with `−` in the text colour (`useMoneyFormat().signed`); a transfer and a voided row read in the text colour and muted tone. |
| MS6 | A row's pressed fill is a rounded tile 8 px inside the page margin (Slotted issue #162). On a touch screen no hover fill is drawn (Slotted issue #160). |
| MS7 | Tapping a row opens `/transactions/$id`. Select, in the header menu (MS12), starts selection mode and End selection ends it, clearing the selection: each row becomes the label of its checkbox in place of the mark, a tap toggles it, and the selection bar of the page footer acts on the selection. |
| MS8 | Below 600 px the page header holds the title and the tabs; the subheading leaves. |
| MS9 | Loading draws eight placeholder rows in the row's shape; empty, no result and failure draw `TransactionsEmpty`, as the grid does. |
| MS10 | The page scroller asks for the next page when the last row comes within one screen (mobile.md M3). |
| MS11 | Below 600 px the period is one ghost button that names it and opens the period control's choices (`PeriodMenu`); it stands under the search with the row count at the end of the same line. The filter bar draws no empty pills, no count and no voided switch. |
| MS12 | Below 600 px the header's actions are one menu (`TransactionsMenu`): Select or End selection, Refresh, and Show voided outside the uncategorized queue. |
| MS13 | The statement's parts are shared in `web/src/ui/statement/` (`StatementList`, `StatementDay`, `StatementItem`, `StatementPlaceholder`). Below 600 px the activity tab of `/accounts/$id` draws its movements with them: each day ends with its net change; each row has the mark of the category it went to (the arrows for a movement between own accounts, "?" for the uncategorized account), the other accounts under the title, the signed amount and, for a leaf account, the balance it left under the amount. Cleared and reconciled are the normal state and carry no word; a pending or voided movement names its state before the accounts. |
| MS14 | Below 600 px the lines of `/cards/$accountId/statements/$statementId` draw with the same parts: each day ends with its net; each row holds the description, then a line the bank has not reported (warning) or else a provisional one (info) named first, the role of a credit or a payment and the installment; the amount at the end; a charge's commands (refund, dispute, installment plan) in a menu beside the row. The day's net steps back by the menu's width, so it ends on the amounts' edge. The line has no category, so the row has no mark. |

The category mark of the categorization method (`Manual`, rule), the tags and the description that differs from the payee leave the phone row; the transaction page shows them.

## Cross-cutting questions

- R1: Does not apply: no regional value; dates and amounts use the active tag's formatters.
- R2: Does not apply: no regional behaviour.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New keys `transactions.actions`, `transactions.select`, `transactions.selectDone` and `transactions.statement.count.one`, `.other`, `.more`, in pt-BR and en; the rows reuse `transactions.uncategorized`, `transactions.voided`, `transactions.split`, `transactions.untitled`, `day.today` and `day.yesterday`.
- R6: The day label through `formatDayHeader` and `formatDate`; the amounts through `useMoneyFormat()`.
- C1: Does not apply: nothing stored; the day total is computed by `periodTotals` in minor units.
- C2: The day total holds one currency: `periodTotals` returns null for a day with more than one, and the section draws no total.
- C3: Each amount reads in its own currency, as the grid does.
- C4: Currency from the record; amounts through `useMoneyFormat()`.
- T1: Days are the transaction's calendar date; today from `useToday()`.
- T2: Does not apply.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1 to D5: Does not apply: no data written.
- S1: Does not apply: no API operation.
- S2: Phone route `/transactions` (ADR 027 S3), kind "Record work" (mobile.md M1): a list over the same sort and selection.
- S3: The guide article of the transactions topic states the phone statement.
- S4: Does not apply.
- X1: Does not apply: no scenario.
- X2: Does not apply.
