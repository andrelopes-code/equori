# Valued balance sheet

- Status: accepted
- Amendment: A260
- Amends: AL3, C2 and C3 of `docs/specs/2026-11-13-accounts-list-design.md`

## Problem

The Accounts screen is the balance sheet of the book at a date: groups by kind, the totals of each group and the three figures assets, liabilities and net worth. AL3 adds to a group total only the balances in the base currency. A position of a brokerage and an account in another currency count only in the note of the group. For a book with investments, the net worth of the Accounts screen is lower than the net worth of Reports and of the Overview for the same date.

## Rules

| ID | Rule |
|---|---|
| VB1 | `GET /reports/net-worth` returns `accounts`: one item per asset or liability account with a non-zero balance at the date, `account_id` and `value`. `value` is the account's own balance valued in `value_in` with the stored prices of the date, with the sign of the ledger: a liability is negative. The sum of the asset values is `assets`; the sum of the liability values is `-liabilities`. |
| VB2 | On the basis `booked`, the Accounts screen reads `GET /reports/net-worth` at the date and at 30 days earlier, in the base currency. An account in another currency whose value is in the response adds that value to the total of its group, and does not count in the note of the group. |
| VB3 | A parent adds to its row the value of each child in another currency whose value is in the currency of the parent. A brokerage row holds its cash and the market value of its positions. A position row keeps its quantity (AL9). |
| VB4 | On the basis `settled`, and when the request fails (a missing price, `price_missing`), the screen keeps AL3: the account in another currency stays out of the total and counts in the note of the group. The values of `booked` are not applied to `settled` quantities, since a trade booked and not settled holds another quantity. |
| VB5 | The figures of the screen and the shares of AL4 read the valued groups, so assets, liabilities and net worth equal Reports and the Overview on the basis `booked` when every price is stored. The Overview figures read the same groups at today. |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: valuation has no regional value; the prices and the rates come from the stored price series. |
| R2 | Does not apply: no regional behavior. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | Does not apply: no text is added; the note `balanceSheet.excluded` keeps its text and counts only the accounts left unvalued. |
| R6 | The amounts keep `useMoneyFormat()`; no new number or date. |
| C1 | `value` is an integer of minor units with its currency (`Money`). |
| C2 | A group total holds the base currency. The conversion uses the stored price of the date, as `GET /reports/net-worth`. A missing price keeps the account out of the total, stated by the note of the group (VB4). |
| C3 | A position and an account in another currency show their own balance; their value in the base currency enters the totals. A test values a position and an account in USD. |
| C4 | The currency of a total is the base currency of the settings. |
| T1 | The date is the date of the screen, a calendar date of the book; today comes from `useToday()`. |
| T2 | Does not apply: no business days. |
| B1 | Does not apply: no table. |
| B2 | No new operation; `getNetWorth` keeps `x-book-role: read`. |
| B3 | Does not apply: no setting. |
| D1 to D5 | Does not apply: no table, no schema change, no recorded fact, no import, no diagnostic field. |
| S1 | No new operation; `getNetWorth` keeps its entry in `tool_exposure_test.go`. The tool `get_portfolio` view `net_worth` keeps its output. |
| S2 | The phone list of AL12 reads the same groups. |
| S3 | The article `accounts_and_categories` states that the totals value positions and accounts in another currency on the basis booked. |
| S4 | Does not apply: `get_portfolio` view `net_worth` and `get_balances` already give the assistant the totals and each balance. |
| X1 | S672: the accounts of the net worth of S129, through the HTTP API. |
| X2 | Does not apply: R1 and R2 do not apply; C3 is covered by a test with an account in USD on a BRL book. |

## Scenario

S672: the book of S129 holds checking 1,700.00, XP cash 400.00, 10 MXRF11 at 10.50 and a loan of 1,200.00. `accounts` holds checking 170000 BRL, XP cash 40000 BRL, XP MXRF11 10500 BRL and the loan -120000 BRL.
