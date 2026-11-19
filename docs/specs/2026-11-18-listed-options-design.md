# Listed options and the write-off of a holding

Coverage row E-12 of `docs/domain/br-product-coverage.md`; phase 6 of `docs/specs/2026-11-18-assistant-parity-and-br-instruments-design.md` (Q4). Issue andrelopes-code/equori#56.

## 1. Goal

A retail investor records the listed options bought on B3 (calls and puts on stocks) from the purchase to their sale, exercise or expiry, with the cost and the realized result the tax return needs. The same write-off records a subscription right left unexercised (gap of E-06) and a security that became worthless.

## 2. Decisions

| ID | Decision | Basis |
|---|---|---|
| O1 | An option is an instrument of type `option`, a security like a stock: code (such as PETRK300), scale, quote currency, exchange. Its terms (underlying, strike, expiry) live in the code and the name; no column holds them. | No computation of this slice reads the terms: the strike paid at an exercise is stated by the user, as the price of a right exercise is. A terms table waits for the slice that values an option. |
| O2 | A premium paid or received is a purchase or a sale of the option (`record_investment` buy and sell, `/trades`). | The premium is the price of the option; average cost, day trades and the tax class come from the trade model unchanged. |
| O3 | A write-off removes a quantity of a holding at zero proceeds: trade side `write_off`, no unit price, no cash posting. The cost of the quantity leaves to the realized losses account; a holding at zero cost leaves with no result. | IN RFB 1.585/2015 treats the premium of an option not exercised as a loss at its expiry; a right not exercised has cost zero (art. 58). A trade keeps the result in `get_tax_year` with the other sales. |
| O4 | The exercise of a call is `record_corporate_action` kind `right_exercise` on the option holding: its units become the underlying at the ratio, and the cost is the premium plus `amount`, the strike times the quantity, paid from the cash account. | The cost of a share bought by exercising a call is the strike plus the premium paid (IN RFB 1.585/2015); the mechanics are those of a right exercise. |
| O5 | The exercise of a put is a sale of the underlying at the strike and a write-off of the put. | The holder sells at the strike; the premium of the put is a loss of the same month. |
| O6 | The tax class of an option in Brazil is `option`, the class of its type: a common operation (15%) and a day trade (20%) as E-02 and E-03 compute neither. | Lei 11.033/2004 art. 2. |
| O8 | A write-off names its holding by account or by the brokerage and the code, as a sale does; the trade form offers it as a third side. | The trade form resolves the holding from the brokerage and the code; the same form serves the API, the tool and the screen. |
| O7 | Writing an option (a short position), a future with its daily settlement and a forward are later slices, each with a design of its own. |
| O9 | A future is an instrument of type `future` (such as WINZ26), traded at its value in the quote currency per contract (points times the multiplier the contract states). A day trade is a purchase and a sale on one day; its result is a day-trade result of the class `future` in `gain_tax`. A position held across days realizes its result at the sale that closes it; its daily settlements are not recorded, so the cash account shows the value of the contract while the position is open. A sold future (a short position) waits for the slice of O7. | IN RFB 1.585/2015 art. 54 (the result of a future is the sum of its settlements, realized at its liquidation) and art. 65 (day trade); Lei 11.033/2004 art. 2. | The ledger refuses a sale above the units held; a short position changes the average cost and the sign rules of the holding. |

## 3. Rules

| ID | Rule |
|---|---|
| W1 | `/trades` and `record_investment` accept side `write_off` with `quantity`, no `unit_price`, no `fees`, no `taxes` and no cash account; the quantity is at most the units held on the date. |
| W2 | The postings of a write-off: the holding −quantity with weight −cost; the realized losses account +cost when the cost is above zero. |
| W3 | The trade row of a write-off holds gross 0, proceeds 0 and the cost; the portfolio lists it as a realized result with proceeds 0 and result −cost. |
| W4 | A day trade is never a write-off: the write-off takes the average cost of the holding (or its oldest lots under FIFO) and no day-trade part. |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The type `option` and side `write_off` hold for every region; the tax class comes from `Jurisdiction.TaxClass`, which gives `option` in Brazil and the type in a region without a jurisdiction. |
| R2 | Without a jurisdiction the option has the class of its type and the write-off its result, as any sale. |
| R3 | The instrument type is a closed set checked in SQL (`marketdata_instrument_instrument_type_check`); `option` joins it, as every type did. The side is a closed set of the trade model. |
| R4 | Does not apply: no extension point is added. |
| R5 | Catalog keys: the label of the type `option` (`instruments.type.option`), the side `trade.side.write_off` and the title of a write-off (`transactions.title.write_off`), pt-BR and en. |
| R6 | The screens write the dates and amounts they already write; no new format. |
| C1 | The cost leaving with a write-off is an integer of minor units of the base currency, the weight of the holding. |
| C2 | Does not apply: a write-off sums no amounts across currencies. |
| C3 | The cost is in the base currency, as every holding's cost. |
| C4 | Amounts on screen go through `useMoneyFormat()`. |
| T1 | The date of a write-off is the expiry date or the day the security became worthless. |
| T2 | Does not apply: no business-day count. |
| B1 | Does not apply: no table is added. |
| B2 | The write-off is an operation of `/trades` (`write`), already covered by the role tests of the endpoint. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | One migration: the instrument type `option` and a trade with gross 0 for a write-off. |
| D3 | A write-off is a transaction voided and recorded again like any trade. |
| D4 | Does not apply: no bank, file or model input. |
| D5 | Does not apply. |
| S1 | No new operation; `recordTrade` and `record_investment` gain the side. |
| S2 | The trade form offers the side Write-off on the desktop and on the phone; it hides the cash account, the price, the total, the charges and the estimate (O8). A write-off shows in the transaction list with its title. |
| S3 | The guide articles `investment_operations` and `equities_br` describe the write-off and the options. |
| S4 | `record_investment` takes side `write_off`; `get_tax_year` returns its result. |
| X1 | S623 an option bought and expired, S624 a call exercised, S625 a right left unexercised written off. |
| X2 | The write-off test runs in a book of region BR; the class test without a jurisdiction runs in the neutral region. |
