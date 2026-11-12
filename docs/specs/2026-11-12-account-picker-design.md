# Account picker redesign

Redesign of the sheet that opens from `AccountField` (`web/src/features/transactions/account-field/`). The owner chose concept 2 ("by consequence") of the session mock on 2026-11-12.

## Problem

Facts read from the code and from the running screen with the demo book:

- P1. With an amount of zero, each option repeats the balance under the label "fica": `consequenceOf` computes `after = balance + 0`.
- P2. The label "fica" appears for income and for the destination of a transfer, where no money leaves the account.
- P3. A card as destination of a transfer shows "fatura 10/12", while the entry pays the statement.
- P4. Every account is offered with the same weight in every use, including receivable and brokerage accounts for an expense.
- P5. The suggestion exists only with a category or payee and never moves its account.
- P6. A card has the same row as an account; only a 14 px badge tells them apart.
- P7. Rows wrap text: the reason of the suggestion, the closing note and the detail line take two to five lines.

## Decisions

| ID | Decision |
|---|---|
| D1 | The sheet is organised by what choosing an account does, one section per consequence (concept 2). |
| D2 | The suggested account moves to the first section, "Suggested", with its reason in the section heading. This replaces the rule "a suggestion never moves its account" of `account-option-list.tsx`. |
| D3 | An account kind is primary or other for each operation (R4). Other accounts sit in a collapsed block "Other accounts"; the block opens when it holds the chosen account. |
| D4 | A consequence is shown only when it changes the decision (R1 to R3). A balance is shown as a figure with its label; it is never repeated as a result. |
| D5 | A card is drawn as a miniature of the card of the Cards page. In a row it is a card-shaped mark; in the "goes to the statement" and "pays the statement" sections it is a wallet card. |
| D6 | A row has two lines and a fixed height. Nothing wraps. A text that does not fit has a short form (R8) before it is truncated. |
| D7 | The triangular warning icon is never drawn. A risk is written in words in the tone's text colour. |
| D8 | The `Listbox` family (`@slotted/react/listbox`) is the first choice for the options (CP-01): groups with `ListboxGroup`, `renderOption`, `columns`. Task 4 proves or refutes it. If the family cannot draw the mock, the options are an element of the application's own and a finding is opened in `andrelopes-code/slotted`. |

## Rules

Operation = `expense`, `income`, `transfer-out` (the source of a transfer) or `transfer-in` (the destination). Operation comes from `kind` and `direction` of `AccountField`.

| ID | Rule |
|---|---|
| R1 | Overdraw: the operation takes money out (`expense`, `transfer-out`), the account is an asset outside the cards, `amount > 0`, the balance is known and `balance - amount < 0`. The option shows "would be {after}" in the danger tone. |
| R2 | Reserve: same conditions as R1 with `balance - amount >= 0` and the account in the reserves group. The option shows "leaves the reserve" in the warning tone. |
| R3 | Card: for `expense` and `transfer-out` with a statement placement, the option shows the due date of the statement that receives the purchase, and "closed on day N" when the purchase date falls after a closing and before that statement is due. For `transfer-in` the option shows "pays the statement due {date}". For `income`, or without placement, nothing. A card whose free limit is lower than `amount` for `expense` or `transfer-out` is unavailable and shows "{missing} short of the limit". |
| R4 | Primary kinds. `expense`: checking, cash, benefit, credit_card. `income`: checking, savings, cash, benefit. `transfer-out`: checking, savings, cash, benefit, reserve, brokerage. `transfer-in`: those of `transfer-out` plus credit_card. An account without `kind` is primary. Every other kind is other. |
| R5 | Order inside a section: the position of the kind in the list of R4, then the name by the locale's collator. Other accounts are ordered by name. |
| R6 | Sections, in this order, each omitted when empty: suggested; then, for a field with an amount, the balance section ("Leaves the balance now" for `expense` and `transfer-out`, "Enters the balance" for `income` and `transfer-in`) with the non-card primary accounts, and the card section ("Goes to the statement" for `expense`, "Pays the statement" for `transfer-in`) with the primary cards; for a `compact` field the sections "Accounts" and "Credit cards" with the same members; then other accounts. |
| R7 | No consequence, no unavailability and no figure of balance after is computed when `compact` is set or when the account's currency differs from the entry's currency. |
| R8 | A card's fact has two forms: the long form with the closing note, and the short form without it. The short form shows when the row is narrower than 380 px. |
| R9 | The figure at the end of a row is the booked balance (account) or the free limit (card), with the label "balance" or "free limit". A risk of R1 or R2 replaces the label. An account without a balance in its currency shows no figure. |
| R10 | The sentence under the field follows R1 to R3: it exists for overdraw, reserve, statement and settles, and for nothing else. |
| R11 | The limit meter of a wallet card has 14 segments; the lit count is `round((creditLimit - freeLimit) / creditLimit * 14)`, clamped to 0..14. Without a credit limit the meter is not drawn. |

## Visual contract

The mock is `/tmp/claude-1000/-home-dreco-dev-equori/53ed5bdb-f86e-443f-a63d-4fadb23c9d61/scratchpad/mock/src.html` (served as `mock.html?c=2`). It defines, and the implementation reproduces from `--slotted-*` tokens:

- Row: a 52 px mark column, name 14 px semibold over a fact line 13 px muted, figure 14 px semibold over a label 12 px muted, end-aligned; minimum height 62 px; the chosen row has the accent border and surface and a check badge on the mark.
- Marks: square with a logo plate (accounts), circle with the goal ring (reserves), card-shaped 52×33 miniature with the material of the Cards page (cards).
- Wallet card: aspect ratio 1.586; header with a 22 px logo tile and the name; fact line; figure with the symbol and the cents small and the integer at 22 px; 14-segment meter; two columns in the sheet, a horizontal rail of 224 px cards below 600 px.
- Material: the layers of `account-card.module.css` (light, sheen band, hairlines at 135°, inset keyline).

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: account kinds are domain values, not regional. |
| R2 | Does not apply. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point. |
| R5 | Texts: the catalog keys of the plan's Contract, each with pt-BR and en text. |
| R6 | Dates "10/12" take their format from the active tag through `formatDayMonthNumeric`; amounts through `useMoneyFormat()`. |
| C1 | No amount is stored. `missing = amount - free` and `after = balance - amount` are integers of minor units. |
| C2 | A sum holds one currency: R7 suppresses every computation when the currencies differ. |
| C3 | When the account's currency differs from the entry's, the row shows the figure in the account's currency and no consequence. |
| C4 | Currency comes from the account; amounts go through `useMoneyFormat()`, so privacy mode masks the figures and the risk text. |
| T1 | The dates are calendar dates of the statement placement, computed by the server in the book's time zone. |
| T2 | The closing and due dates come from the server's calendar; the client only compares them. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply. |
| D2 | Does not apply. |
| D3 | Does not apply: the picker records nothing. |
| D4 | Does not apply. |
| D5 | Does not apply. |
| S1 | Does not apply: no operation in `api/openapi.yaml`. |
| S2 | The sheet adapts below 600 px (bottom sheet, card rail). Whether the entry routes are phone routes follows ADR 027 and is checked in task 7. |
| S3 | The guide articles `transactions_and_postings.md` and `transfers.md` in `internal/assistant/guide/articles/` change in the same commit as the screen (task 7). |
| S4 | Does not apply. |
| X1 | Does not apply: no acceptance scenario of `docs/domain/06-scenarios.md`. |
| X2 | A pure-model test runs with a currency different from the account's (R7). A rendering test runs with the locale `en`. |

## Out of scope

- A suggestion from general recency without a category or payee: it needs an unfiltered query of recent transactions.
- The four last digits and the network of a card: `Account` does not carry them.
- Other pickers (the institution field, the category field).
