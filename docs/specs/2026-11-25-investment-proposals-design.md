# Investment proposals of the assistant

Status: the owner approved concept A ("Boleta") of the mock on 2026-11-25. The mock is archived in `docs/superpowers/mocks/2026-11-25-investment-proposals-design/`.

## Problem

| Fact | Source |
|---|---|
| The preview of `record_brokerage_note` holds the number of orders and none of their fields. | `internal/ledger/toolapi/brokerage_note.go`, `planBrokerageNote` |
| A trade shows quantity × price as its total; the money the account pays or receives is absent. | `internal/ledger/toolapi/investment.go`, `appendGross` |
| No preview states the settlement date, which the ledger derives when it is absent. `record_investment` does not accept one. | `internal/ledger/app/trades.go`, `settlementOf` |
| The price is drawn as the API writes it ("105.47"). | `bodies/investment-body.tsx` |
| The target of a fixed income application is an English sentence with ISO dates. | `fixedIncomeTitle` |
| Income, write-off, correction, corporate action and brokerage note draw a list of fields. | `bodies/body-kind.ts` |
| At 318 px the total of a trade ends 6 px past the sheet, and "Confirm" is cut. | capture of 2026-11-25 |

## Block order

The owner confirmed on 2026-11-25: operation, money, dates.

## Preview contract

IP1. `net` is the signed change of the cash account: negative leaves it, positive enters it. A purchase is −(gross + fees); a sale is gross − fees − taxes; an income is gross − withheld; a note is sales − purchases − fees − taxes; a right exercise is −amount; a capital return is +amount; a fixed income application is −(amount + fees).

IP2. `settlement` is the date the cash moves: the one given, or the one of the exchange's cycle. A trade always carries it. A note carries it when every order settles on one date; otherwise each order carries its own in `items[].date`.

IP3. A note carries one item per order: `description` (code), `side`, `quantity`, `price`, `amount` (gross). `count` leaves the preview.

IP4. `record_investment` accepts `settlement_date` for buy and sell.

IP5. `account` names the cash account the service picks when the call gives none. With no candidate or more than one, the preview has no `account`, and the execution answers as before.

IP6. An income carries `income_type`.

IP7. The target of a fixed income application is the name of the contract, or the code of the contract that receives more money. A new contract carries `rate` (percent of the index), `index`, `spread` and `maturity`. Fees are carried when given. `institution` is the brokerage.

IP8. A correction carries `kind`, and each change it alters carries `before`: quantity, price, fees, taxes, withheld, amount, net, income type, date and settlement.

IP9. A custody transfer carries the giving brokerage as the `before` of `account`, and `instrument`. A corporate action carries `instrument`: the code held, as `before` when the action gives another security.

## Form

IP10. The row head holds the operation and, under it, the target. The titles are nouns ("Purchase", "Sale"). A note with one order takes the title of that order's side. An income takes the name of its type.

IP11. The body takes the width of the sheet and draws, in order: the operation (figure, code, price), the parts of the sum, the net with its account, the dates. A note draws its orders in place of the figure, five and a button that shows the rest.

IP12. The gross is left out when it is the net and no cost is stated. The parts above zero that reduce a net that enters carry a minus sign.

IP13. Two different dates are drawn as two stops from edge to edge of the card; one date is a row.

IP14. A correction draws the previous value struck before the new one.

IP15. A change the form has no place for stays a field row.

IP16. The second line of the footer is shortened to "Applies all" and neither line wraps nor pushes the buttons.

## Client derivations

| Value | Rule | Test |
|---|---|---|
| Direction of the net | The sign of `net` | `ticket-model.test.ts` |
| Price with its currency | The decimal of `price` in the currency of `amount`, padded to its decimals | `ticket-model.test.ts` |
| Totals of purchases and sales of a note | The sum of the orders' gross by side, in one currency | `ticket-model.test.ts` |

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The settlement cycle is read from `marketdata.SettlementCycle`; income types keep their registry. No new value. |
| R2 | An exchange without a cycle settles on the trade date: one date row. An income type without a label is drawn as its code. |
| R3 | `side` in the preview item is `^[a-z_]{2,40}$`. |
| R4 | None. |
| R5 | `assistant.ticket.*` and the titles of the investment actions, in pt-BR and en. |
| R6 | Dates, weekdays and quantities through `Intl` with the active tag. |
| C1 | `net` is a `money.Money` computed with integers. |
| C2 | Every part of a sum holds the currency of the cash account. The totals of a note hold the base currency, which `RecordBrokerageNote` requires. |
| C3 | A trade whose cash is not in the base currency is refused by the ledger, as before. |
| C4 | From the preview's values; every amount and quantity goes through `useMoneyFormat()`. |
| T1 | Trade and settlement dates of the order. |
| T2 | Through `marketdata.SettlementDate`. |
| B1 | Does not apply: no table. |
| B2, B3 | No operation, no setting. |
| D1, D2 | Does not apply: no table. |
| D3 | A correction keeps its version and reason. |
| D4 | Every proposal waits for the confirmation of the user, as before. |
| D5 | None. |
| S1 | No operation; fields of `AssistantPreviewItem`. |
| S2 | The same sheet on a phone, at 327 px. |
| S3 | The article `investment_operations.md` states `settlement_date` of `record_investment`. |
| S4 | Yes: the preview is the tool's. |
| X1 | None: the scenarios of the trades and notes keep their tests. |
| X2 | A trade without an exchange settles on its date (`TestRecordInvestmentPreviewSettlement`). |
