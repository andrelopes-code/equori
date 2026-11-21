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
| MS7 | Tapping a row opens `/transactions/$id`. In selection mode tapping toggles the row and the mark becomes a checkbox; the selection bar of the page footer acts on the selection. |
| MS8 | Below 600 px the page header holds the title and the tabs; the subheading leaves. |
| MS9 | Loading draws eight placeholder rows in the row's shape; empty, no result and failure draw `TransactionsEmpty`, as the grid does. |
| MS10 | The page scroller asks for the next page when the last row comes within one screen (mobile.md M3). |

The category mark of the categorization method (`Manual`, rule), the tags and the description that differs from the payee leave the phone row; the transaction page shows them.

## Cross-cutting questions

- R1: Does not apply: no regional value; dates and amounts use the active tag's formatters.
- R2: Does not apply: no regional behaviour.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New catalog keys: `transactions.statement.uncategorized`, `transactions.statement.voided`, with pt-BR and en.
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
