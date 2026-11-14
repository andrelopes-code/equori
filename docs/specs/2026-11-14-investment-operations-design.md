# Investment operations: fills, odd lots, settlement, day trades, notes, corporate actions, custody

Status: draft (amendment A228 of P8)

## 1. Intent

A trade records one quantity at one unit price for cash of one brokerage, at average cost (A68), dated on the trade date for the cash and the security alike. Seven facts of an exchange account in Brazil do not fit that record:

1. An order filled at several prices. The owner divides the total by the quantity by hand; a unit price rounded to cents gives a gross a few cents off (15 units for 4,504.00 typed as 300.27 give 4,504.05).
2. The odd-lot market of the B3. `PIBB11F` is `PIBB11` traded in a lot of 1 to 99 units, with the same ISIN (in the B3 consolidated file of 2026-10-27, `PETR4` and `PETR4F` share `BRPETRACNPR6`, segments `CASH` and `ODD LOT`). Typed as a code, it creates a second holding with its own average cost, and `b3_cotahist` prices only the market `010` (`internal/marketdata/feed/b3cotahist/b3cotahist.go`, `spotMarket`), so the second holding has no price.
3. Settlement. The B3 settles the cash market two business days after the trade (D+2 since 2019-05-27, B3 project "D+2"). The broker's statement debits the cash on the settlement date; equori debits it on the trade date, so the settled balance and the import match (`coalesce(settled_on, booked_on)`) disagree for two business days.
4. Day trades. Under IN RFB 1.585/2015, art. 65, §1, I, a day trade is "a operação ou a conjugação de operações iniciadas e encerradas em um mesmo dia, com o mesmo ativo, em uma mesma instituição intermediadora"; §2 excludes the stock held before that day; §3 pairs "o 1º negócio de compra com o 1º de venda ou o 1º negócio de venda com o 1º de compra, sucessivamente". equori mixes the day's purchases into the average cost of the stock, so the cost of the sale, the average cost left and the result are wrong.
5. A brokerage note. One note holds several orders and one set of costs. Art. 56, §4 lets the costs be "rateados entre as operações executadas, proporcionalmente ao valor financeiro de cada operação". equori takes the fees of each trade from the owner.
6. Corporate actions. Positions hold only purchases and sales (`docs/specs/2026-11-09-market-quotes-design.md`, section 9). After a split 1:10 the quantity is ten times too small and the value falls 90%. Art. 58, §1 sets the cost of shares received in a bonus as "o valor do lucro ou reserva capitalizado que corresponder ao acionista".
7. Custody transfer. Moving a position from one brokerage to another keeps its cost. equori offers only a sale and a purchase, which realize a result that did not happen.

## 2. Goals, non-goals, anti-goals

| ID | Goal |
|---|---|
| G1 | The trade form takes the total of an order and derives a unit price whose gross equals the total to the cent. |
| G2 | An odd-lot code of an exchange that has one reaches the instrument of the round lot. |
| G3 | The cash of a trade settles on the settlement date of its exchange, or on a date the owner gives. |
| G4 | In a region whose tax rule separates day trades, a sale removes the cost of the day's purchases it closes, in the order of §3, and the cost of the earlier stock for the rest; the realized result is split by kind. |
| G5 | One request records a brokerage note: its orders as trades, its costs and its withheld tax allocated by value. |
| G6 | One request records a split, a reverse split or a bonus on one holding. |
| G7 | One request moves a quantity of one holding to another brokerage with its cost. |

| ID | Non-goal |
|---|---|
| NG1 | Monthly tax computation: the R$ 20,000 exemption (art. 59), loss carry-forward (art. 64), day-trade withholding computed by equori. The kind of a result is the input of that later feature. |
| NG2 | Fraction auctions. No official answer on their tax treatment was found (Receita "Perguntas e Respostas" searched on 2026-11-14). The fraction leaves the position with no cost of its own; the owner records the cash when it arrives as an ordinary income transaction. |
| NG3 | Restating sales recorded before this amendment. A69 fixes the cost of a sale when it is recorded. |
| NG4 | Spin-offs, mergers, code changes, subscription rights, return of capital (art. 58, §8). |
| NG5 | Suggestions of corporate actions from the splits Yahoo returns. |
| NG6 | Merging an existing holding of an odd-lot code into its round-lot holding. The owner corrects each trade with IC4, which may change the target. |
| NG7 | Settlement rules of exchanges other than the B3. US exchanges settle T+1 since 2024-05-28; EU, UK and Swiss markets move from T+2 to T+1 on 2027-10-11. Each needs its exchange calendar first. |
| NG8 | Assistant and MCP tools for the new operations (section 6, S1). |

| ID | Anti-goal: the work fails if |
|---|---|
| AG1 | A gross, a cost, a fee share or a result differs by one cent from the rule of its section. |
| AG2 | A rule of the B3 or of the Receita sits outside `region_defaults.go` or a `br` case. |
| AG3 | A sale, a note, an action or a transfer is partly written when it fails. |
| AG4 | An existing scenario changes its expected value, except S-numbers this document amends. |

## 3. Constraints

- A68: average cost, half to even, the whole cost basis when the whole quantity leaves. A69: a change dated on or before a non-voided sale of the same security account is 409 `later_sale_exists`.
- A posting of a security account carries a non-zero weight of the sign of its amount (`checkPostingWeight`); a transaction has at least two postings and its weights sum to zero.
- `ledger_posting.settled_on` is the date of the institution's view (`docs/domain/07-data-model.md`); `settled_on` is never before the transaction date (`checkPostingDetails`).
- The holding of a brokerage and an instrument is the child account of the brokerage with that instrument (`findOrCreateHolding`). One holding is one intermediary in the sense of art. 65.
- Transaction IDs are UUID v7: their order is the order of recording.

## 4. Parts, in delivery order

### 4.1 Total of an order (G1)

| ID | Rule | Reason |
|---|---|---|
| IO1 | The trade form has a choice "Preço" / "Total" above one amount field. With "Total", the request's `unit_price` is `total ÷ quantity`, rounded half to even to 12 decimals, computed on decimal strings (O7). The aside shows the gross the server computes. The contract of `/trades` does not change. | With quantity q in units and the unit price rounded to 12 decimals, the gross differs from the total by at most q × 5·10⁻¹³; below half a cent for any q < 10¹⁰ units, so `money.Convert` returns the total. |
| IO2 | The trade detail shows the unit price with its stored decimals. | The price is the average of the fills. |

### 4.2 Odd-lot codes (G2)

| ID | Rule | Reason |
|---|---|---|
| IO3 | `marketdata.RoundLotCode(mic, code) (string, bool)` in `internal/marketdata/region_defaults.go`: for `BVMF`, a code matching `^([A-Z0-9]{4}[0-9]{1,2})F$` returns the first group; any other exchange returns false. | B3 rule: the odd-lot code is the round-lot code with a final F (B3, "mercado fracionário"); same ISIN in the consolidated file. |
| IO4 | `Module.ResolveCode(ctx, code)`: when an exchange rule maps `code` to a code that is a known instrument of that exchange, it returns that code; otherwise `code`. Ledger calls it through its port `Instruments` before it resolves the target of a trade, an income, a note order, a corporate action and a custody transfer. | One holding per asset; prices from the round lot. |
| IO5 | `POST /instruments` with a code that IO3 maps for the given exchange answers 422 `odd_lot_code`, detail "PIBB11F is PIBB11 traded in the odd-lot market; register PIBB11". | The odd-lot code is not an instrument. |

### 4.3 Settlement date (G3)

| ID | Rule | Reason |
|---|---|---|
| IO6 | `TradeInput` gains `settlement_date` (date, optional, not before `date`, at most 30 days after it). | A broker or a fund may settle on another day. |
| IO7 | Absent, the settlement date is `marketdata.SettlementDate(ctx, code, date)`: the exchange's cycle from `SettlementCycle(mic, date) (days int, calendar string, ok bool)` in `region_defaults.go`. `BVMF`: 3 business days of `br_banking` for trades before 2019-05-27, 2 from that date. Other exchanges: no cycle, the trade date. The date counts `days` business days after the trade date. | B3 project D+2; the B3 settles on the national banking calendar. |
| IO8 | The cash posting of the trade carries `settled_on` = the settlement date when it is after the trade date. The security posting, the fee and the result postings keep the trade date. | The position and the tax facts are dated on the trade (art. 65, §1); the cash moves on settlement. |
| IO9 | `Trade` (detail of a trade transaction) gains `settlement_date`, the `settled_on` of the cash posting or the trade date. `PUT /trades/{id}` takes `settlement_date` as `POST /trades` does. | IC4: every field of the order may change. |

### 4.4 Day trades (G4)

| ID | Rule | Reason |
|---|---|---|
| IO10 | `ledger.SeparatesDayTrades(region string) bool` in `internal/ledger/region_defaults.go`: `BR` true, any other region false. With false, a sale keeps A68. | Art. 65 is Brazilian. |
| IO11 | With true, a sale of quantity q of holding A on date D reads, without the transaction being corrected: the buys of A dated D in ID order (quantity bᵢ, cost cᵢ = gross + fees); the sales of A dated D recorded before it, with their day-trade quantity; the holding of A at the end of D (H, C). `matched` is the sum of those day-trade quantities and `B` the sum of bᵢ. | §3 pairs the first purchase with the first sale; A69 makes the recording order the order of the day. |
| IO12 | The day-trade quantity is `dt = min(q, B − matched)`; the rest `sw = q − dt`. The day-trade cost is `F(matched + dt) − F(matched)`, where `F(x)` is the cost of the first x units of the day's buys: the sum of the whole buys before x plus `money.Fraction(cⱼ, x − before, bⱼ)` of the buy that holds x. | §3, sequential pairing. F telescopes, so the cost of the whole day's buys is their exact sum. |
| IO13 | The stock before the day is `H − (B − matched)` units with cost `C − (cost of the day's buys − F(matched))`. `sw` above it is 422 `quantity`, message as today. The swing cost is the whole stock cost when `sw` equals the stock, else `money.Fraction(stock cost, sw, stock)`. The cost of the sale is the sum. | §2: the earlier stock does not take part; its average does not change. |
| IO14 | `ledger_trade` gains `day_trade_quantity bigint NOT NULL DEFAULT 0` and `day_trade_cost bigint NOT NULL DEFAULT 0`, both 0 on a buy and at most `quantity` and `cost`. `Trade` gains both in the API. | The split is fixed with the cost (A69). |
| IO15 | Portfolio: a sale gives one result of kind `day_trade` when `dt > 0` and one of kind `swing` when `sw > 0`. The day-trade proceeds are `proceeds × dt ÷ q` half to even; the swing proceeds are the rest. `portfolio_realized_result` gains `kind`, part of its key. `RealizedResult.kind` is `swing` or `day_trade`. | Art. 64 and 65 tax the two kinds apart. |
| IO16 | A new transaction whose security postings only remove units (a sale, a custody transfer out) is accepted on the date of an earlier sale of the same holding; a sale dated after it still refuses it. A buy, a corporate action or a correction dated on or before a sale of the holding stays 409 `later_sale_exists`, whose detail names the brokerage note. | Removing units after a sale leaves that sale's cost and its pairing unchanged (A69 holds); a buy after a sale would change the pairing of §3. IO21 records a day in any order. |

### 4.5 Brokerage note (G5)

| ID | Rule | Reason |
|---|---|---|
| IO17 | `POST /brokerage-notes` (`x-book-role: write`), `BrokerageNoteInput`: `brokerage_id` (required), `cash_account_id`, `date` (required), `settlement_date`, `fees` (Money ≥ 0, every cost of the note), `taxes` (Money ≥ 0, income tax withheld on the note), `taxes_category_id`, `description`, `orders` (1 to 50 of `{side, instrument, quantity, unit_price}`). 201 with `BrokerageNote {transactions: [Transaction]}` in the order of `orders`. | One form for a note. |
| IO18 | Fees go to every order in proportion to its gross; taxes go to the sales in proportion to their gross. Each share is the floor of `amount × grossᵢ ÷ total`; the cents left go one each to the largest remainders, ties to the earlier order. Taxes above zero without a sale are 422 `taxes`. | Art. 56, §4; the shares add up to the note. |
| IO19 | Each order becomes one trade transaction with its fee share, its tax share, the note's settlement date, `taxes_category_id` and description. | One sale keeps one result (A68 to A69, IC4 per trade). |
| IO20 | Trades are recorded in one database transaction: buys in note order, then sales in note order. A failing order fails the note; the problem names `orders[i].<field>`. | AG3. |
| IO21 | Buys before sales give IO12 the pairing of §3 in either order of the day: the pairing depends on the order within each side only. | §3. |

### 4.6 Corporate actions (G6)

| ID | Rule | Reason |
|---|---|---|
| IO22 | `POST /corporate-actions` (`x-book-role: write`), `CorporateActionInput`: the holding as `account_id` or `brokerage_id` with `instrument` (BC6), `kind` (`split`, `reverse_split`, `bonus`), `date` (the first day without the right), `ratio_from` and `ratio_to` (integers 1 to 1,000,000: `ratio_to` units for each `ratio_from` held), `unit_cost` (Rate, bonus only; absent is the zero cost of art. 58, §2), `category_id` (income category, required with `unit_cost`), `description`. 201 with the `Transaction`. | One holding per brokerage: the broker reports the action per account. |
| IO23 | `split` and `bonus` need `ratio_to > ratio_from`; `reverse_split` needs `ratio_to < ratio_from`. Otherwise 422 `ratio_to`. | |
| IO24 | The held quantity q is the holding at the end of the day before `date`. q = 0 is 422 `account_id` "holds nothing on the day before date". The exact new quantity is `q × ratio_to ÷ ratio_from`; the new quantity n is its floor at the instrument's scale; the fraction is the rest. n = 0 is 422 `ratio_to` "leaves no unit". | NG2. |
| IO25 | Postings: the holding −q with weight −C; the holding +n with weight +C + V; for a bonus with V > 0, the income category −V. V = `(n − q) × unit_cost`, half to even to the cent. | Art. 58: a split keeps the total cost; §1: a bonus adds the capitalized value. Two postings keep every weight non-zero. |
| IO26 | `ledger_corporate_action` holds the D1 detail: `transaction_id`, `books_id`, `account_id`, `kind`, `ratio_from`, `ratio_to`, `held`, `received`, `fraction_remainder` (`q × ratio_to mod ratio_from`, in minor units of the instrument), `unit_cost`, `value`. `Transaction.corporate_action` returns it with `fraction` = remainder ÷ (`ratio_from` × 10^scale) as a decimal of at most 12 places, half to even. | The detail shows the action, not two postings. |
| IO27 | A corporate action is not corrected; it is voided and recorded again. `PUT /transactions/{id}` answers 409 `investment_transaction`, as it answers for a trade (A227 IC13). A void dated on or before a later sale is 409 `later_sale_exists`. | A69. |
| IO28 | Portfolio emits an income event of type `bonus_shares` with gross V and nothing withheld for a bonus with V > 0. `br` treatment of `bonus_shares` is `exempt`. | IRPF: "Bonificações em ações" are an exempt income at the capitalized value. |

### 4.7 Custody transfer (G7)

| ID | Rule | Reason |
|---|---|---|
| IO29 | `POST /custody-transfers` (`x-book-role: write`), `CustodyTransferInput`: `account_id` (the holding that gives), `brokerage_id` (the brokerage that receives), `date`, `quantity`, `description`. 201 with the `Transaction`. | |
| IO30 | The receiving holding is found or created (`findOrCreateHolding`). The same brokerage is 422 `brokerage_id`. A quantity above the holding at the end of `date` is 422 `quantity`. | |
| IO31 | Postings: the giving holding −q with weight −c; the receiving holding +q with weight +c; c is the whole cost basis when q is the whole holding, else `money.Fraction(C, q, H)`. | A68. Cost travels with the units; no result. |

## 5. Scenarios

Every scenario runs in a Brazilian book (base BRL) unless it says otherwise. Holdings are at brokerage "Corretora A" unless named. Amounts are BRL.

| ID | Rules | Scenario |
|---|---|---|
| S417 | IO1 | A buy of 15 PIBB11 with total 4504.00 sends unit price `300.266666666667`; the trade's gross is 4504.00 and the cash posting −4504.00. |
| S418 | IO3, IO4 | A buy with instrument `PIBB11F`, 1 unit at 306.10, records on the holding PIBB11; no instrument PIBB11F exists after it. |
| S419 | IO5 | `POST /instruments` with code `PIBB11F`, exchange `BVMF`, is 422 `odd_lot_code`. |
| S420 | IO7, IO8 | A buy of 100 PETR4 at 30.00 on 2026-11-19: the cash posting has `settled_on` 2026-11-24 (2026-11-20 is a holiday of `br_banking`); the security posting has none; `trade.settlement_date` is 2026-11-24. |
| S421 | IO6 | A buy with `settlement_date` 2026-11-18 on date 2026-11-19 is 422 `settlement_date`. |
| S422 | IO7 | A buy of an instrument of exchange `XNAS` on 2026-11-19 has no `settled_on`; `trade.settlement_date` is 2026-11-19. |
| S423 | IO11 to IO15 | Stock: 100 PETR4 bought 2026-11-03 at 10.00 (cost 1000.00). On 2026-11-10: buy 50 at 12.00, then sell 50 at 13.00. Sale: day-trade quantity 50, day-trade cost 600.00, cost 600.00, result 50.00. Holding after: 100 units, cost 1000.00. One result `day_trade`: quantity 50, cost 600.00, proceeds 650.00, result 50.00. |
| S424 | IO12, IO13, IO15 | Same stock. On 2026-11-10: buy 30 at 12.00, then sell 50 at 13.00. Day-trade 30, cost 360.00; swing 20 from the stock of 100 at 1000.00, cost 200.00; sale cost 560.00. Results: `day_trade` 30, cost 360.00, proceeds 390.00, result 30.00; `swing` 20, cost 200.00, proceeds 260.00, result 60.00. Holding after: 80 units, 800.00. |
| S425 | IO12 | No stock. On 2026-11-10: buy 10 at 300.20, buy 5 at 300.40, sell 10 at 301.00 (cost 3002.00, result 8.00), sell 5 at 301.00 (cost 1502.00, result 3.00). Holding after: 0 units, 0.00. |
| S426 | IO10 | A book of the neutral profile (`apitest.Neutral`: region NZ, base NZD) with the sequence of S423 on an instrument of exchange `XNZE` quoted in NZD: the sale's cost is 533.33 (1600.00 × 50 ÷ 150), result 116.67, one result `swing`, day-trade quantity 0. |
| S427 | IO17 to IO19 | Note of 2026-11-10 at Corretora A, fees 2.51: buy 100 PETR4 at 30.00 (gross 3000.00), buy 50 VALE3 at 60.10 (gross 3005.00). Fee shares: PETR4 1.25, VALE3 1.26 (fractional cents 0.3955 and 0.6045). Two trades; cash −3001.25 and −3006.26, both `settled_on` 2026-11-12. |
| S428 | IO18 | A note with taxes 0.50 and only buys is 422 `taxes`. |
| S429 | IO20, IO21 | Stock of S423. Note of 2026-11-10 with orders: sell 100 PETR4 at 13.00, buy 100 PETR4 at 12.00, fees 0. The buy is recorded first; the sale has day-trade 100, cost 1200.00, result 100.00. Holding after: 100 units, 1000.00. |
| S430 | IO20 | A note whose second order sells 500 PETR4 with 100 held is 422 `orders[1].quantity`, and no trade of the note exists. |
| S431 | IO22 to IO26 | 100 PETR4 at cost 1000.00; split 1 to 10 on 2026-11-10: postings −100 (−1000.00) and +1000 (+1000.00). Detail: held 100, received 1000, fraction 0. |
| S432 | IO24, IO25 | 15 units at cost 150.00; reverse split 10 to 1: postings −15 (−150.00) and +1 (+150.00); fraction 0.5. |
| S433 | IO25, IO28 | 100 units at cost 1000.00; bonus 10 to 11 with unit cost 5.00 and category "Bonificações": postings −100 (−1000.00), +110 (+1050.00), category −50.00. Portfolio income event `bonus_shares`, gross 50.00, withheld 0, treatment `exempt`. |
| S434 | IO27 | A split dated 2026-11-10 on a holding with a sale on 2026-11-12 is 409 `later_sale_exists`. |
| S435 | IO24 | A split on a holding opened on the action's date is 422 `account_id`. |
| S436 | IO29 to IO31 | 100 PETR4 at cost 1000.00 at Corretora A; transfer of 40 to Corretora B on 2026-11-10: A −40 (−400.00), B +40 (+400.00); B's holding is created. A: 60 units, 600.00; B: 40 units, 400.00. |
| S437 | IO30 | A transfer of 101 of those 100 is 422 `quantity`; a transfer to Corretora A is 422 `brokerage_id`. |

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Odd-lot rule and settlement cycle: cases of `internal/marketdata/region_defaults.go` keyed by MIC (IO3, IO7). Day-trade separation: case of `internal/ledger/region_defaults.go` (IO10). Bonus treatment: case of `internal/portfolio/jurisdiction/br` (IO28). |
| R2 | An exchange without a case keeps its codes and settles on the trade date; a region without a case keeps A68; a jurisdiction without `bonus_shares` gives no treatment. |
| R3 | `kind` of a corporate action and of a realized result are closed sets that do not grow with regions; `income_type` `bonus_shares` matches the existing pattern. |
| R4 | Three rows in `docs/contributing/regions.md`: odd-lot code, settlement cycle, day-trade separation. |
| R5 | Catalog keys of plan section Contract, each with pt-BR and en. |
| R6 | Dates through the date formatter, quantities through `numberFormatter`, ratios as two integers through it. |
| C1 | Fee and tax shares, costs, results and bonus values are integers of the base currency's minor units. Quantities are integers at the instrument's scale. |
| C2 | Each sum holds one currency: a note's orders share its cash account in the base currency. |
| C3 | A trade, a note, an action and a transfer use the base currency for cash and cost, as A68 does; an instrument quoted in another currency keeps its quote for valuation only. |
| C4 | Amounts on screen through `useMoneyFormat()`; the currency from the cash account. |
| T1 | Trade, settlement, action and transfer dates are calendar dates of the book; "today" from `platform/clock`. |
| T2 | The settlement date counts business days of `br_banking` (IO7). |
| B1 | `ledger_corporate_action` has `books_id`; queries filter by it; a schema test rejects a row without a book. |
| B2 | The three new operations declare `write`; HTTP tests cover owner, write, read (403) and no membership (404). |
| B3 | No setting. |
| D1 | `ledger_corporate_action` is a fact of the export; the archive version rises. |
| D2 | One migration for `ledger_trade`, `portfolio_realized_result` and `ledger_corporate_action`. |
| D3 | Trades and actions are transactions with versions; a note is its trades; a correction of a trade keeps IC8. |
| D4 | No bank, file or model writes these records. |
| D5 | No diagnostic field. |
| S1 | `recordBrokerageNote`, `recordCorporateAction`, `recordCustodyTransfer`: excluded from tools in `internal/server/tool_exposure_test.go` with the reason "screen only (A228 NG8)". `odd_lot_code` has an HTTP test (S419). |
| S2 | The three forms are entry kinds of `/transactions/new`, a phone route: one column (forms.md), tested at 390 px and at desktop width. |
| S3 | The topic `investment_operations` (`internal/assistant/guide/articles/investment_operations.md`, at most 3000 bytes) holds the total of an order, odd lots, settlement, day trades, notes, corporate actions and custody transfers; `web/src/navigation/navigation-map.json` lists it and the tasks of `/transactions/new`. |
| S4 | The assistant reads trades through existing tools; the new detail fields reach it through `get_transaction`. |
| X1 | S417 to S437. |
| X2 | S422 (exchange without a cycle) and S426 (neutral profile, region NZ, base NZD). |

## 7. Left to the builder

- Names of unexported helpers and of test fixtures.
- The layout of the order rows of the note form within forms.md.
