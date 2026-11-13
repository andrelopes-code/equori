# Investment correction design

Issue #48. Amendment A227 of P8 amendment A69 (`docs/plans/2026-10-17-p8-currencies-investments.md`).

A trade (A68) and an investment income (A70) are corrected through their own order, as a new version of the same transaction. `PUT /transactions/{id}` keeps returning 409 `investment_transaction` for them: its body is postings, and the server builds the postings of a trade or an income from the order.

## Rules

| ID | Rule | Reason |
|---|---|---|
| IC1 | `PUT /trades/{id}` (`correctTrade`) takes `{expected_version, reason, trade: TradeInput}`; `PUT /investment-income/{id}` (`correctInvestmentIncome`) takes `{expected_version, reason, income: InvestmentIncomeInput}`. Both answer 200 with the `Transaction`, role `write`. | The order keeps the schema of its record operation; nesting it avoids a second copy of each field under `additionalProperties: false`. |
| IC2 | An `id` that names no trade (for `correctTrade`) or no income (for `correctInvestmentIncome`) of the book is 404 `not_found`. | The resource of the path is the trade or the income. A transaction does not change kind through a correction. |
| IC3 | The correction is a correction under DM4: same id, version + 1, a version row whose snapshot holds the previous transaction and `reason`, the event `ledger.transaction_corrected.v1`. `expected_version` other than the stored version is 409 `version_conflict`; a voided transaction is 409 `transaction_voided`; a `reason` empty after trimming is 422 `validation_failed` on `reason`. | The correction runs through `correctIn`, with the rules of `CorrectTransaction`; the reason is required because the history of a trade is the only trace of its previous order. |
| IC4 | Every field of the order may change: side, target (`account_id`, or `brokerage_id` with `instrument`), cash account, date, quantity, unit price, fees, taxes, taxes category, description; for an income, type, gross, withheld, categories. The transaction keeps its tags, payee and links. The order is validated and built as in `RecordTrade` and `RecordIncome`, with the same problems. | One rule set for recording and correcting. |
| IC5 | A non-voided sale of a security account other than the corrected transaction, dated on or after the old date (for the old postings) or the new date (for the new postings), refuses the correction with 409 `later_sale_exists`. | A69: the cost of a sale is fixed when it is recorded. `correctIn` and `correct` already run `checkLaterSales` for both versions. |
| IC6 | The holding that a corrected sale reads excludes the postings of the corrected transaction: `Holding` takes the id to exclude; `RecordTrade` passes `uuid.Nil`. | A sale of 50 of 150 units corrected to 150 units reads 150 held, not 100. |
| IC7 | `ReplaceTransaction` replaces the `ledger_trade` or `ledger_investment_income` row of the transaction with the detail of the new version. | The detail and the postings describe the same order. |
| IC8 | The version snapshot holds `trade` and `income`, omitted when absent; a snapshot without them reads as before. `GET /transactions/{id}/versions` returns the detail of each previous version. | D3: the previous price, fees and taxes stay traceable. |
| IC9 | The correction page draws the trade form for a transaction with `trade` and the income form for one with `investment_income`, filled from the transaction, with the reason field and without the kind picker. It keeps no draft in the browser. | The form of the record is the form of the correction. |
| IC10 | On that page the position, the sale cost, the quantity limit and the cash shortfall exclude the corrected transaction when its stored date is on or before the date of the form: its quantity and cost leave the position of its security account, and its cash amount leaves the balance of its cash account. | The position and the balance of the date already hold the transaction being replaced. |
| IC11 | The taxes category of a sale is the account of the positive posting, other than the cash account, placed before the posting of the security account (`sellPostings`). The income category is the account of the negative posting; the withheld category is the account of the positive posting other than the cash account (`BuildIncome`). | The detail stores no category; the posting order of the domain fixes them. |
| IC12 | The assistant tool `record_investment` takes `transaction_id` and `reason`: with them it proposes the correction of that trade or income at its stored version. `kind` `buy` or `sell` needs a trade, `income` needs an income (`not_found` otherwise); `reason` is required with `transaction_id`. | ADR 012: an operation has the tool that covers it. |
| IC13 | The detail of 409 `investment_transaction` reads "a trade or income transaction is corrected through its own order, not through its postings". The catalog text names the trade or income form. | The previous text sent the owner to void and record again. |

## Scenarios

- S415 Correction of a trade (IC1 to IC8): MXRF11 bought on 2026-10-05, 150 units at 10.05 with fees 4.90 (cash −1512.40), corrected with reason "price" to 150 units at 10.00 with fees 4.90: cash −1504.90, security +150 with weight 1504.90, unit price "10", version 2, one version row with reason "price" whose snapshot trade holds unit price "10.05". A sale of 50 of the 150 units on 2026-10-20 at 10.80 with fees 2.10 corrected to 150 units: cost 1504.90, result 1620.00 − 2.10 − 1504.90 = 113.00 to realized gains, cash +1617.90. The buy corrected after that sale is 409 `later_sale_exists`, and a buy corrected through `PUT /trades/{id}` of an income is 404.
- S416 Correction of an investment income (IC1 to IC4): a dividend of MXRF11 on 2026-10-26 of gross 12.00, corrected to gross 15.00 and withheld 1.00: cash +14.00, withheld category +1.00, income category −15.00, version 2.

## Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: no value varies by country. The default withholding of an income keeps its region extension point (`WithholdingBP`). |
| R2 | Does not apply: the correction has no regional value. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | `problem.investment_transaction` changes (IC13); the correction pages reuse the keys of the trade and income forms and `correct.reason`, `correct.reasonHint`, `correct.reasonRequired`, `correct.save`, `correct.done`. |
| R6 | The forms keep their formats: dates and rates through `Intl` and `formatRate`, amounts through `MoneyInput` and `useMoneyFormat()`. |
| C1 | Amounts are integers of minor units with their currency (`money.Money`); the unit price is a `money.Rate`. |
| C2 | Sums hold one currency: cash, fees, taxes, cost and result are in the base currency, the quantity in the security's instrument (A68). No conversion. |
| C3 | The cash account must be in the base currency, as when recording (422 `currency_unsupported` on `cash_account_id`). |
| C4 | The base currency comes from settings and the instrument from the account; amounts go through `useMoneyFormat()`. |
| T1 | The date is the trade or payment date of the order, a calendar date. No "today" is read by the correction. |
| T2 | Does not apply: no business day count. |
| B1 | Does not apply: no table is added. |
| B2 | `correctTrade` and `correctInvestmentIncome` declare `x-book-role: write`; HTTP tests cover a reader (403 `book_role_required`) and a member of another book (404). |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table is added; the archive carries `ledger_trade`, `ledger_investment_income` and the version snapshots as before. |
| D2 | Does not apply: no schema change. |
| D3 | The correction is a version of the transaction with its reason; the snapshot holds the previous detail (IC8). |
| D4 | Does not apply: the owner or the confirmed assistant writes the correction. |
| D5 | Does not apply: no field of the diagnostic file. |
| S1 | `correctTrade` and `correctInvestmentIncome` map to `record_investment` in `internal/server/tool_exposure_test.go`. No new `Problem.code`. |
| S2 | `/transactions/$id/correct` is a phone route (ADR 027 S3); it draws the trade and income forms that `/transactions/new` serves on a phone. |
| S3 | `internal/assistant/guide/articles/investments.md` states that a trade or an income is corrected from its page. |
| S4 | `record_investment` covers the correction (IC12). |
| X1 | S415 and S416, tests in `internal/ledger/trade_correction_test.go`. |
| X2 | Does not apply: R1, R2, C2 and C3 add no regional or cross-currency rule. |
