# Reimbursement dialog: score and rows

The dialog "Mark as reimbursement" (A117) of an inflow lists the expenses of the last 90 days that the inflow may repay. This spec replaces its layout. The approved mock is the contract: `docs/superpowers/mocks/2026-11-22-reimbursement-dialog-design/` (concept A, approved 2026-11-22; local, outside Git). No operation, table or rule of A117 changes.

## Questions and blocks

| Order | Question | Block |
|---|---|---|
| 1 | How much of the inflow is distributed, and how much stays as income? | Score |
| 2 | Which expenses does the inflow repay? | Exact match line, list |
| 3 | How much of each expense does it repay? | Column "Repays" of the list |

The owner confirmed the order on 2026-11-22.

## Rules

- RD1. The header description names the inflow: its description and its date.
- RD2. The score sits at the top of the body and stays in view while the list scrolls. It shows Received (the inflow amount), Distributed (the sum of the checked shares) and Stays as income (inflow minus distributed). When distributed exceeds the inflow, the third figure reads "Exceeds by" with the excess, in the danger tone.
- RD3. A meter under the figures fills by `min(1, distributed / inflow)`; its fill takes the danger tone when distributed exceeds the inflow. It carries `role="meter"` and the name "Distributed X of Y".
- RD4. A status line under the meter states, in this order of precedence: the submit error; the first checked expense whose share is zero ("<description> has no amount", danger); the first checked expense whose share exceeds its remaining amount ("<description> exceeds what is left", danger); an excess ("Lower an amount or uncheck an expense", danger); no expense checked; the count of checked expenses.
- RD5. The submit button is enabled only when the status line is not in the danger tone and at least one expense is checked (the current rule of A117, unchanged).
- RD6. Each expense is one row of fixed height: checkbox with the description on one line (ellipsis) and the date under it; the remaining amount in the column "Remaining"; the share in the column "Repays", as `MoneyInput size="field"`, only while the row is checked. A checked row with a zero share marks the field invalid.
- RD7. At phone width (≤ 599 px) the column "Remaining" leaves and the remaining amount follows the date: "18/11/2026 · R$ 80.00 left".
- RD8. When the candidates answer a suggestion and no row is checked, one line above the list names the suggested expenses ("Exact sum of the amount received: …") with the action "Check". The action checks each suggested expense with its remaining amount.
- RD9. The category field opens behind a one-line toggle "Category of the expenses: keep the current ones". The field and its hint appear when the toggle opens.
- RD10. While the candidates load, the dialog draws the score with Received known and skeletons for the other figures, the list header, and six skeleton rows with box, name, date and amount.
- RD11. When the candidates are empty, the body shows a title and a sentence; the footer holds only "Close".
- RD12. When the candidates fail, the body shows a title, a sentence and the action "Try again", which refetches; the footer holds only "Close".
- RD13. "Clear reimbursement" sits at the start of the footer when the transaction already repays an expense.

## Client derivations

| Value | Rule | Test |
|---|---|---|
| Status line | RD4 | `reimbursement-status.test.ts` |
| Meter fraction | RD3 | `reimbursement-status.test.ts` |

## Cross-cutting questions

- R1: Does not apply: no regional value; dates and amounts use the active locale's formatters.
- R2: Does not apply: no regional behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New catalog keys `reimbursement.*` for the score, status, columns, match line, category toggle, empty and failure states, in pt-BR and en.
- R6: Dates through `formatDate`, amounts through `useMoneyFormat()`.
- C1: The shares stay integers of minor units in the inflow's balancing currency.
- C2: Sums hold one currency: the candidates are filtered to the inflow's currency by A117 on the server.
- C3: Does not apply: the dialog shows the inflow's balancing currency only.
- C4: The currency comes from the transaction record; every amount goes through `useMoneyFormat()`.
- T1: Does not apply: no date computed on the client.
- T2: Does not apply.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply.
- D2: Does not apply.
- D3: Unchanged: the reimbursement writes a new transaction version (A117).
- D4: Does not apply: the suggestion is checked only by the reader's action.
- D5: Does not apply.
- S1: Does not apply: no operation.
- S2: Yes: the dialog opens full screen on the phone; RD7 sets its phone form.
- S3: The guide article `reimbursement` describes the dialog; its steps change in the same commit.
- S4: Does not apply: the assistant's reimbursement tool is unchanged.
- X1: Does not apply: no scenario added.
- X2: Does not apply.
