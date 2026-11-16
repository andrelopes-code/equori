# Fixed income sales by purchase lot

Status: approved by review of 2026-11-15 (amendment A234 of P8, replaces A68 for the accounts named in FL1)

## 1. Intent

A sale removes cost at the average cost of the holding (A68, `averageLot` in `internal/ledger/domain/trade.go`). Tesouro Direto sells the oldest purchase first ("PEPS", primeiro a entrar, primeiro a sair; https://www.tesourodireto.com.br/en/sobre-o-tesouro/regras-e-regulamento). Income tax of a fixed income security counts the days from each purchase (rates 22.5%, 20%, 17.5% and 15% by holding period; STN, "Tesouro Direto: perguntas frequentes").

With two purchases at different prices and a partial sale, the cost, the realized result and the cost left in equori differ from the broker's statement. A later calculation of income tax by holding period needs the date of each lot, which an average does not keep.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. A sale of a `fixed_income` security in a book of region `BR` removes the cost of the oldest lots first.
- G2. A custody transfer of the same holding moves lots oldest first and keeps each lot's purchase date.
- G3. The method is a value of region and instrument type, so another region adds its own case.
- G4. No schema change: lots are derived from postings, so a correction reaches every later read.
- G5. The sale form shows the cost the server will record.

Non-goals:

- NG1. Income tax, IOF and custody fee of a sale.
- NG2. Display of lot dates on a screen. The API returns them (FL11).
- NG3. Mutual funds (tax by come-cotas) and a sale that chooses its lot.
- NG4. Rewriting the cost posted by a sale already recorded.

Anti-goals:

- AG1. No lot table, no backfill, no stored copy of a lot.
- AG2. No silent fallback to the average when lots and holding disagree (FL7).
- AG3. No second implementation of the lot rule with its own rounding: the web reads lots from the API and applies the rule through shared fixtures (FL11).

## 3. Constraints

- A68 stays the method of every other instrument type and of every region without a case.
- A sale posts one security posting with the total cost; the postings and the realized result keep their shape.
- Amounts are integers of minor units; rounding is half to even (ADR 005).
- `Repository.Holding` sums `amount` and `weight` of every non-voided posting of the account up to the date (`investment.sql`, `Holding`). The lots cover the same postings.

## 4. Decisions

| ID | Decision | Reason |
|---|---|---|
| FL1 | `CostMethod(region, instrumentType string) string` in `internal/ledger/region_defaults.go` returns `fifo` or `average`. `BR` with `fixed_income` returns `fifo`; every other pair returns `average`. The app declares it in the port that declares `SeparatesDayTrades`. | Extension point under ADR 016, same file and port as day-trade separation (A228 IO10). |
| FL2 | The `Instrument` of `app.Instruments` gains `Type`. The adapter in `internal/server/adapters.go` fills it from Market data. | `Instrument` holds no type today; the method depends on it. |
| FL3 | `OpenLots(account, date, exclude)` replays the non-voided postings of the account up to `date`, ordered by `booked_on` then recording order. A posting with a positive amount adds a lot (acquisition date, quantity, cost = `weight`). A posting with a negative amount consumes lots oldest first. `exclude` removes the transaction being edited, as `Holding` does. | Derivation from postings follows every correction without a second source of truth (AG1). |
| FL4 | A positive posting of a custody transfer takes the acquisition date and the cost share of each lot its sibling negative posting consumed at the source. The source is replayed up to that posting. | The holding period runs from the original purchase, not from the transfer. |
| FL5 | A partial consumption removes lot cost × q ÷ lot quantity, half to even. A lot the consumption closes removes its whole remaining cost. | A68 applies the same closing rule to the whole holding. |
| FL6 | Each earlier sale or transfer out removes its posted cost (`weight`). Lots take their FIFO share; the difference between the posted cost and the FIFO cost adjusts the oldest remaining lot. | A sale posted at the average before this change leaves open lots whose cost still sums to the holding's cost basis. A sale posted at FIFO has a difference of zero. |
| FL7 | `soldCost` and `BuildCustodyTransfer` take the open lots when the method is `fifo` and sum the consumed cost; under `average` they call `averageLot` unchanged. A `fifo` account never receives a `Day`. | One call site for both operations. Day-trade pairing (IN RFB 1.585/2015, art. 65) concerns variable income. |
| FL8 | When the open lots sum to a quantity other than the holding's, or a lot with units has a cost of zero or less, the operation fails with an internal error that names the account. | A mismatch is a defect of the derivation; a fallback would hide it. |
| FL9 | A sale already recorded keeps its posted cost. | NG4; the average method behaves the same. |
| FL10 | No change to the later-sale check. A correction of a sale, or a change dated before a later sale, is refused with `ErrLaterSaleExists` whatever the cost method (A69, A228 IO16); a sale recorded after another of its day reads the lots the first one left, since the replay orders by transaction. | Lots depend on the order of the earlier sales; the check already keeps that order fixed (FL-S6, FL-S9). |
| FL11 | `GET /api/accounts/{id}/lots?date=` (role `read`) returns `method`, `quantity`, `cost_basis` and `lots` (`acquired_on`, `quantity`, `cost`) from the same `OpenLots` call. The sale entries of the web (`trade-math.ts`, `note-model.ts`, `foreign-math.ts`) get the cost from one function that applies the average when `method` is `average` and the lots when it is `fifo`. Go and TypeScript tests read one fixture file of lots, quantities and expected costs. | The sale form shows the cost the server records (G5) and the rule has one specification (AG3). |

## 5. Scenarios

Fixtures: purchases of 10 units at 100.00 on 2026-01-05 and 10 units at 120.00 on 2026-02-05, no fees.

| ID | Case | Expected |
|---|---|---|
| FL-S1 | Region `BR`, `fixed_income`, sale of 5 units | Cost 500.00; cost left 1,700.00 for 15 units |
| FL-S2 | Region `BR`, `fixed_income`, sale of 15 units | Cost 1,600.00 (1,000.00 + 600.00); cost left 600.00 for 5 units |
| FL-S3 | Region `BR`, `stock`, same fixtures, sale of 5 units | Cost 550.00 (average, unchanged) |
| FL-S4 | Region `NZ`, base currency NZD, `fixed_income`, same fixtures, sale of 5 units | Cost 550.00 |
| FL-S5 | Region `BR`, `fixed_income`, transfer of 5 units to another brokerage, then sale of 10 units there | The destination holds one lot of 5 units acquired on 2026-01-05 at cost 500.00; the sale of 10 units removes that lot first |
| FL-S6 | Region `BR`, `fixed_income`, a sale of 5 units on 2026-03-01, then the 2026-01-05 purchase is corrected to 11 units | The correction returns `ErrLaterSaleExists` (FL10) |
| FL-S7 | Region `BR`, `fixed_income`, a sale of 5 units posted at the average cost of 550.00 before the change, then a sale of 5 units | The open lots sum to the holding's cost basis; the second sale removes the oldest remaining lot |
| FL-S8 | Region `BR`, `fixed_income`: the posted cost of an earlier sale is changed by direct SQL so the oldest lot would have a cost of zero or less | The next sale returns an internal error (500); no transaction is written |
| FL-S9 | Region `BR`, `fixed_income` and `stock`: a sale of 5 units is corrected to 4 units after a second sale of its day | `ErrLaterSaleExists` (409) for both methods |
| FL-S10 | `GET /api/accounts/{id}/lots` for FL-S1 before the sale; roles `owner`, `write`, `read`; a member of another book | Two lots; 200 for the three roles; 404 for the other book |

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The cost method varies by region and instrument type: case of `internal/ledger/region_defaults.go` (`CostMethod`). The holding-period tax rule that motivates it stays outside this feature (NG1). |
| R2 | A region without a case gets `average`, the behavior of A68. |
| R3 | `method` is `average` or `fifo` in the response of FL11. It is a closed, internal set that does not grow with regions: a region chooses a value, it does not add one. The OpenAPI schema uses an `enum` of these two values. |
| R4 | One row "Cost method" in `docs/contributing/regions.md`, after the row "Day-trade separation". |
| R5 | No text. The error of FL8 is an internal error with no catalog key. |
| R6 | The sale form already formats dates and amounts; it adds no number or date. |
| C1 | Lot cost and consumed cost are integers of the base currency's minor units; lot quantity is an integer at the instrument's scale. |
| C2 | Each lot holds one currency: the base currency, as A68 does. |
| C3 | The cost stays in the base currency; an instrument quoted in another currency changes nothing (FL-S4 runs with base NZD). |
| C4 | The cost on the sale form keeps its current component and goes through `useMoneyFormat()`. |
| T1 | Acquisition dates are calendar dates of the book; "today" comes from `platform/clock`. |
| T2 | No business days. |
| B1 | Does not apply: no table. |
| B2 | `GET /api/accounts/{id}/lots` declares `x-book-role: read`; FL-S10 covers the three roles and a member of another book. `/trades` and the custody transfer keep their roles. |
| B3 | No setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | No recorded fact changes; FL9 keeps posted costs. |
| D4 | No bank, file or model writes lots. |
| D5 | No diagnostic field. |
| S1 | One operation: `GET /api/accounts/{id}/lots`. The entry in `internal/server/tool_exposure_test.go` is an exclusion with the reason "screen only: cost preview of a sale form". No new `Problem.code`. |
| S2 | The sale form is an entry kind of `/transactions/new`, a phone route. The cost line keeps one line at 390 px and at desktop width. |
| S3 | The guide article of the investments topic (`internal/assistant/guide/articles/investments.md`) states that a fixed income sale in Brazil removes the oldest purchase first. |
| S4 | Does not apply: the assistant reads the realized result through existing tools. |
| X1 | S447 to S455: FL-S1 is S447, FL-S2 S448, FL-S3 S449, FL-S4 S450, FL-S5 S451, FL-S6 S452, FL-S9 S453. FL-S7 is tested by `TestReplayLots`, FL-S8 is S454, FL-S10 is S455. Each has a test that carries its ID. |
| X2 | FL-S4 runs outside Brazil with a base currency other than BRL. |

## 7. Left to the builder

- Replay query: one SQL read of the postings of the account with the transaction id and the posting order. The recursion of FL4 stops at an account with no transfer in, and a visited posting is never replayed twice.
- `docs/domain/05-domain-model.md`, row `Position`: names the method by instrument type and region.
- Failing test first: FL-S1 under the current code returns 550.00.
