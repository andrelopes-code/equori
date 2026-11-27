# Cash in another currency at a brokerage

Status: accepted, 2026-11-27 (amendment A271, issue #75). Owner directive of 2026-11-27: no item of bringing an existing portfolio left for later.

## Intent

A person who invests abroad keeps dollars, euros or another currency at a foreign broker. The dollars pay purchases and receive sales and dividends. Today every trade and every income settles in cash of the base currency (`brokerageAccounts`, `internal/ledger/app/trades.go`): the dollars at the broker cannot pay a purchase in equori, and every price, fee and dividend is converted to the base currency by hand.

## Goals

- G1. A trade, an income, a brokerage note, an opening and a fixed income application settle in cash of the instrument's quote currency, with prices, fees and taxes in that currency.
- G2. The cost basis, the realized result and the income stay in the base currency, converted at the exchange rate of the date, or at the rate the person gives.
- G3. The annual tax on investments abroad counts the exchange result of a remunerated cash balance abroad, and leaves out the one of a balance that earns nothing (Lei 14.754/2023, art. 2, § 3; art. 3, § 2; art. 15).

## Non-goals

- Cash in a third currency, neither the base nor the instrument's quote currency.
- Physical foreign currency held by the person (art. 2, §§ 4 and 5).

## Anti-goals

- A sum across currencies without a rate.
- A rate read as zero when none is stored.
- An exchange result taxed on a balance that earns nothing.

## Facts

Lei 14.754/2023, read on 2026-11-27 at planalto.gov.br:

- Art. 15: a foreign currency amount becomes reais at the closing rate for sale that the Banco Central publishes on the date of the taxable event. The feed `bcb_ptax` stores that rate.
- Art. 3, § 2: the income of a financial application abroad is taxed at its redemption, amortization, sale or maturity, and the exchange variation of the principal counts in it.
- Art. 2, § 3: the exchange variation of current-account or card deposits abroad is not taxed when the deposits earn nothing and the institution is authorized by the monetary authority of its country.

Code:

- A posting carries `Amount` in its account's currency and `Weight` in the transaction's balancing currency (`domain.Posting`, DM1). An exchange (M12) already posts a foreign amount with a weight in the base currency.
- A security account sits under a brokerage of its quote currency (`domain.ValidateParent`). A cash account of that brokerage holds the brokerage's currency.
- `ledger_trade` stores gross, fees, taxes, cost and day-trade cost in one `currency`. The portfolio computes realized results from these amounts in the base currency (`internal/portfolio/domain/rebuild.go`).
- `yield_mode` `auto` marks an account that earns a yield; `none` one that does not.

## Approaches

1. **Amounts of the detail in the base currency, the cash posting in its own currency (chosen).** The trade detail keeps one currency, the base, so the portfolio, the monthly tax and the attribution read it unchanged. A new column `exchange_rate` records the rate, and the cash posting holds the foreign amount with its weight in the base currency.
2. **Amounts of the detail in the cash currency, cost in the base.** Every reader of `ledger_trade` would convert again, and one row would hold two currencies.
3. **An automatic exchange per trade.** A hidden conversion of base cash into foreign cash before each purchase: two transactions per trade, and a cash balance abroad that never matches the broker's statement.

## Rules

### Ledger

- FC1. The cash of a trade, an income or a brokerage note is an account in the base currency, as today, or an account in the quote currency of the instrument that is a cash account of the brokerage or an open account of its institution. Any other currency is refused with 422 on `cash_account_id` ("must be in the base currency <BASE> or in <QUOTE>").
- FC2. With cash in the quote currency F, `unit_price`, `fees`, `taxes`, `gross` and `withheld` are in F. The order takes an optional `exchange_rate`: units of the base currency for one unit of F, above zero, at most 12 decimals. Absent, the rate is the stored price of F in the base currency on the trade date (the latest close on or before the date, as `BaseValue` reads it). Without one, the order is refused with 422 on `exchange_rate`, code `price_missing`.
- FC3. Each amount in F converts to the base currency as `round_half_even(amount × rate)` in the base's minor units: gross, fees and taxes of a trade, gross and withheld of an income. Every other figure is computed in the base currency from these, as today: the cost of a purchase, the cost removed by a sale and its result.
- FC4. The cash posting holds the amount in F, and its weight is the base amount of FC3: for a purchase, gross plus fees; for a sale, gross minus fees and taxes; for an income, gross minus withheld. The transaction balances in the base currency.
- FC5. The trade and income details store their amounts in the base currency and the rate in a new nullable column `exchange_rate` (numeric(30,12), above zero). With cash in the base currency it is null. `unit_price` stays in the currency of the cash, or in the quote currency for an opening (FC7).
- FC6. A sale paid in F separates no day trade: its day-trade quantity and cost are zero. The day-trade rule of a Brazilian book reads trades of BVMF, which settle in reais. A foreign holding is taxed once a year on its whole result (Lei 14.754/2023, art. 2).
- FC7. An opening of an instrument quoted in a currency other than the base takes `unit_price` and `fees` in the quote currency, and the optional `exchange_rate` of FC2 on its date. Its cost is the base amount of FC3. An instrument quoted in the base currency opens as today.
- FC8. A fixed income application in F takes `amount` and `fees` in F, and the cash and rate of FC1 and FC2.
- FC9. A brokerage note takes `exchange_rate` once for the whole note. Its orders share it.
- FC10. The investment file gains a last column `exchange_rate`, so the header becomes `kind,date,instrument,quantity,unit_price,fees,taxes,gross,withheld,income_type,exchange_rate`. An empty cell takes the stored rate of FC2. Its lines settle in the cash of the import, so with cash in F their amounts are in F. The match of IF6 compares the amounts in the cash currency and the rate as recorded.
- FC11. A correction (A227) of a trade or an income in F takes the rate again: given, or the stored rate of the new date.
- FC12. `TradeInput`, `InvestmentIncomeInput`, `BrokerageNoteInput` and `FixedIncomeApplicationInput` gain `exchange_rate` (`Rate`). The trade and income outputs carry `exchange_rate`, nullable.
- FC13. Migration: `ledger_trade.exchange_rate` and `ledger_investment_income.exchange_rate`, `numeric(30,12) NULL CHECK (exchange_rate > 0)`.

### Portfolio

- FC14. The annual tax abroad (`AbroadTax`) gains an item per outflow of a remunerated cash balance abroad.
  - A balance account (asset, not a security, not an equity, liability or category account) in a currency other than the base currency, with `yield_mode` `auto`, is a remunerated balance abroad.
  - Its postings are replayed in date order.
  - A posting of a transaction balanced in the base currency that adds units adds them at its weight.
  - A posting of such a transaction that removes units realizes, as an item of its year, its weight (as a positive base amount) minus the units removed at the average base cost of the balance. The same posting lowers the cost by that average cost.
  - A posting of a transaction balanced in another currency moves units at the average cost and realizes nothing.
- FC15. A balance in another currency with `yield_mode` `none` gives no item (art. 2, § 3). It keeps its average cost in the replay, so a transfer to a remunerated balance carries that cost.
- FC16. The ledger port of the portfolio gains `ForeignBalancePostings(ctx, booksID, to)`. It returns the postings of such accounts up to `to`: account, date, amount, weight, and whether the transaction balances in the base currency.

### Assistant

- FC17. `record_investment`, `record_brokerage_note`, `record_fixed_income` and `import_investment_file` (through the file) take `exchange_rate`. The preview of a trade or income in F lists the amounts in F, the rate and the base amount of the cost or proceeds.
- FC18. `get_tax_year` view `abroad_tax` counts FC14 in the gains and losses it returns. No new field.

### Web

- FC19. The trade form, the brokerage note form, the income form and the fixed income form list as paying accounts those of FC1. With an account in a currency other than the base, the price, fees and taxes fields are labelled with that currency. A field "Câmbio" (optional, "{base} por {quote}") shows. The aside states the amount that moves in the cash currency and the cost or proceeds in the base currency, when a rate is typed. Without a typed rate, it states that the rate of the day applies.
- FC20. The opening of an instrument quoted in another currency labels its price and fees with the quote currency and shows "Câmbio".
- FC21. The header line of the file dialog follows FC10.

### Export

- FC22. `ArchiveVersion` becomes 39; the step `addExchangeRates` sets `exchange_rate` to null on every row of the trade and income details.

### Guide

- FC23. `investments.md` (cash abroad, the rate, FC14), `investment_operations.md` (the rate on the forms and the note), `investment_income.md` (an income in F), `investments_br.md` (the annual tax and the exchange result of a remunerated balance). The paragraph "Investments abroad" of `equities_br.md` replaces the sentence on reais of each trade with FC2 and FC14.

## Scenarios

IDs follow S766. Book region BR, base BRL, unless stated. USD/BRL closes stored for the dates used.

- S767 Purchase paid in dollars. Brokerage IBKR in USD with Cash USD 10,000.00. Buy 10 VOO at 500.00 with fees 1.00 on 2026-03-03, with `exchange_rate` 5.20 and no stored close. Cash USD −5,001.00. Holding cost 26,005.20, which is 26,000.00 + 5.20. The cash posting weighs −26,005.20. `exchange_rate` is stored.
- S768 Rate of the day. As S767 without `exchange_rate`, with USD/BRL 5.10 stored for 2026-03-03: cost 25,505.10. With no close on or before the date: 422 `price_missing` on `exchange_rate`.
- S769 Sale paid in dollars. S767, then sell 4 at 600.00, fees 1.00, on 2026-09-01 at 5.50. Cash USD +2,399.00. Proceeds in reais 13,194.50, which is 13,200.00 − 5.50. Cost removed 10,402.08, which is 4/10 of 26,005.20. Result 2,792.42. No day-trade part.
- S770 Income in dollars. A dividend of VOO, gross 20.00 and withheld 6.00, on 2026-06-20 at 5.00. Cash USD +14.00. Income in reais 100.00, withheld 30.00.
- S771 Refused cash. A buy of VOO paid from a EUR account: 422 on `cash_account_id`. A buy of PETR4 (BRL) paid from Cash USD: 422 on `cash_account_id`.
- S772 Opening in dollars. Opening of 10 VOO at 380.00 on 2021-05-03 with `exchange_rate` 5.40: cost 20,520.00. Opening of PETR4 unchanged (S753).
- S773 File in dollars. A file with an opening and a sale of VOO, the sale with `exchange_rate` 5.50, imported with Cash USD: 2 created. The same file again: 2 skipped.
- S774 Note in dollars. A note of two buys of VOO and QQQ with fees 2.00 and `exchange_rate` 5.20: fees split by gross, every amount in reais at 5.20.
- S775 Exchange result of a remunerated balance.
  - Cash USD with `yield_mode` `auto`.
  - 2026-01-10: an exchange of 5,000.00 BRL for 1,000.00 USD.
  - 2026-04-10: a purchase paid with 1,000.00 USD at 5.50.
  - `abroad_tax` of 2026 counts a gain of 500.00 from the exchange result: 5,500.00 − 5,000.00.
  - With `yield_mode` `none`, no gain is counted.
- S776 Correction. S767 corrected with `exchange_rate` 5.30: cost 26,505.30.
- S777 Outside Brazil. A book of `apitest.Neutral` (base NZD) buys VOO with Cash USD at 1.70: cost in NZD. `abroad_tax` is empty, since the region has no jurisdiction.
- S778 Archive. A trade of S767 exported and imported keeps its rate and its amounts.

## Cross-cutting questions

- R1. The exchange result of FC14 is a rule of the Brazilian jurisdiction (`internal/portfolio/jurisdiction/br/abroad_tax.go`). The ledger rules hold no regional value.
- R2. A region without a jurisdiction records trades in F (S777) and computes no tax abroad.
- R3. Does not apply: no value set.
- R4. Does not apply: `AbroadTax` is an existing extension point. Its row in `docs/contributing/regions.md` gains "exchange result of remunerated balances".
- R5. New keys in pt-BR and en: the "Câmbio" field with its unit "{base} por {quote}" and its hint, the aside lines for the cash amount and the base amount, the line for the rate of the day, the refusal texts of FC1 and FC2, and the assistant field labels of `exchange_rate`.
- R6. Amounts go through `useMoneyFormat()` with their currency. The rate is written with `Intl.NumberFormat` and at most 6 decimals on screen.
- C1. Every amount is in minor units with its currency. The rate is a `Rate` (numeric(30,12)).
- C2. Base amounts come from FC3 with the rate named: given, or the stored close of the date. A missing rate is a 422 (FC2), never zero.
- C3. The screen states both currencies: the cash movement in F, the cost or proceeds in the base (FC19).
- C4. Currencies come from the accounts and the instrument, never from a literal.
- T1. The rate's date is the trade, income or opening date.
- T2. Does not apply.
- B1. Does not apply: no new table; the new columns sit on tables that hold `books_id`.
- B2. Does not apply: no new operation.
- B3. Does not apply.
- D1. Changed exported tables: `ArchiveVersion` 39 (FC22).
- D2. One new migration (FC13).
- D3. Trades and incomes keep their versions and voids. A correction records the new rate.
- D4. The file's rule of IF6 holds with the rate (FC10).
- D5. Does not apply.
- S1. No new operation. Every refusal of FC1 and FC2 reuses `validation_failed` or `price_missing`.
- S2. The forms keep their phone scope.
- S3. FC23.
- S4. FC17, FC18.
- X1. S767 to S778.
- X2. S777 runs in `apitest.Neutral`. Every scenario except S777 runs with a base other than the cash's currency.
