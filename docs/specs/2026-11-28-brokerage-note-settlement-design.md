# Brokerage note settlement: one bank debit per note

Status: accepted, 2026-11-28 (amendment A272 of A228). Owner directive of 2026-11-28: the fix keeps one trade per order and the note form unchanged, and leaves no case to a guess.

## 1. Intent

A note recorded against a bank account of the brokerage's institution (A228 IO17, `cash_account_id`) puts one cash posting per order on that account (IO19). The bank debits the note's total in one line ("Débito B3 - Nota Bov 26/11/2026", −360.04 for B5P211 −230.66 and LFTB11 −129.38). Matching compares a line with one posting (A98 to A100); grouped confirmation covers one entry confirmed by several lines and leaves several entries confirmed by one line out of scope (`docs/specs/2026-11-01-grouped-confirmation-design.md`, section "Out of scope"). The line finds no candidate inside the amount bound of A98 and creates a second debit.

## 2. Rules

| ID | Rule | Reason |
|---|---|---|
| NS1 | A note whose `cash_account_id` is neither the brokerage nor a child of it, at a brokerage with exactly one open child account in the currency of that cash account that holds no security, records its orders with that child as their cash account. | The orders keep one trade each (IO19); their cash moves inside the brokerage. |
| NS2 | The note then records one settlement transaction per distinct settlement date of its orders: the cash account takes the sum of the cash postings of those orders, the brokerage child takes its opposite. Both postings carry `settled_on` = that settlement date when it is after the note date. The transaction is dated on the note date, `origin` manual, described by the ledger's wording `NoteSettlement` with the note date ("Liquidação da nota de 26/11/2026"). A sum of zero records no settlement. | The bank account shows the note as the bank does: one line per note and settlement date. A statement line then confirms one posting (A98 to A100), with no search over sums. |
| NS3 | The orders and the settlements are recorded in the database transaction of the note (IO20). The response of `POST /brokerage-notes` is unchanged: the trades, in the order of `orders`. | AG3. |
| NS4 | Any other note (no `cash_account_id`, a cash account inside the brokerage, a brokerage without such a child or with several) is recorded as before (IO19). | No guess of a cash account. |
| NS5 | A later correction or void of one trade of the note leaves its settlement as recorded: the difference stays on the brokerage child, where its balance shows it. | The settlement records what the bank moves; the trades record the orders. |

## 3. Scenarios

| ID | Rules | Scenario |
|---|---|---|
| S701 | NS1, NS2 | Note of 2026-11-10 at Corretora A against its institution's checking account, fees 2.51: buy 100 PETR4 at 30.00, buy 50 VALE3 at 60.10. The two trades post −3001.25 and −3006.26 on the brokerage's cash account, `settled_on` 2026-11-12. One settlement: checking −6007.51, brokerage cash +6007.51, both `settled_on` 2026-11-12, described "Liquidação da nota de 10/11/2026" in a Brazilian book. |
| S702 | NS2 | The note of S701, then a statement line of the checking account of −6007.51 on 2026-11-12: the import matches 1 and creates 0; the settlement's checking posting confirms the line. |
| S703 | NS4 | The note of S701 at a brokerage without a cash child: each trade posts its cash on the checking account; no settlement is recorded. |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The settlement date keeps IO7 (`SettlementCycle` in `internal/marketdata/region_defaults.go`). The wording `NoteSettlement` is in `internal/ledger/domain/wording_pt.go` and `wording_en.go`. |
| R2 | An exchange without a cycle settles on the note date: the settlement postings carry no `settled_on`. |
| R3 | Does not apply: no value set. |
| R4 | Does not apply: no extension point. |
| R5 | `NoteSettlement`: "Liquidação da nota de %s", "Settlement of the note of %s". No catalog key: the screen adds no text. |
| R6 | The date in the description takes the layout of the book's region (`locale.ConventionsOf`). |
| C1 | The settlement amount is the integer sum of the orders' cash postings, in the cash account's currency. |
| C2 | One currency per sum: NS1 requires the child in the currency of the cash account. |
| C3 | A cash account in a foreign currency (FC9) needs a brokerage child in that currency; without one, NS4. |
| C4 | Does not apply: no new figure on screen. |
| T1 | The note date and the settlement date (IO6, IO7). |
| T2 | IO7 counts business days of `br_banking`. |
| B1 | Does not apply: no table. |
| B2 | `POST /brokerage-notes` keeps `write`. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | The settlement is a versioned transaction; it is corrected or voided like any transaction. |
| D4 | Matching is unchanged; a line of the note's total confirms the settlement only under A100. |
| D5 | Does not apply: no diagnostic field. |
| S1 | Does not apply: no operation. |
| S2 | Does not apply: the note form keeps its phone scope. |
| S3 | `internal/assistant/guide/articles/investment_operations.md` states the settlement. |
| S4 | The tool `record_brokerage_note` calls the same service and records the settlement. |
| X1 | S701 and S703 in `internal/ledger/note_settlement_test.go`; S702 in `internal/ingestion/note_settlement_test.go`. |
| X2 | The rules read no regional value besides the wording and the cycle of IO7, whose neutral case S422 covers. The English wording has no test of its own. |
