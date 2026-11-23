# Yield line of a reserved balance

- Status: requested by the owner on 2026-11-23
- Date: 2026-11-23
- Amendment: A264
- Scenarios: S687 and S688 of `docs/domain/06-scenarios.md`
- Amends: A261 (`docs/specs/2026-11-20-reconciled-sync-line-design.md`) and D3 (`docs/specs/2026-10-18-pluggy-reserved-balances-design.md`)

## 1. Defect

A Mercado Pago item reports the yield of each reserved balance twice: in the amount of the reserve, which D3 books on the reserve, and as a "Rendimentos" line of the checking account, which the import booked on the checking account. The lines started on 2026-11-20, dated from 2026-11-16.

A261 held only a line dated before the last reconciled balance. On 2026-11-23 the lines of the day arrived with the balance of the day:

| Date | Line | Yield D3 booked | Account of the yield |
|---|---|---|---|
| 2026-11-16 | 0.55, 4.35 | 0.55, 4.35 | Cofrinho Mercado Livre, Algum dinheiro |
| 2026-11-17 | 0.54, 4.30 | 0.54, 4.30 | the same |
| 2026-11-18 | 0.55, 4.31 | 0.55, 4.31 | the same |
| 2026-11-19 | 0.55, 4.32 | 0.55, 4.32 | the same |
| 2026-11-23 | 0.55, 4.34 | 0.55, 4.34 | the same |

The ten lines equal the ten yields in date and amount. The checking account's own yield (0.09 to 0.12 a day) is the only yield its reported balance holds. The stored fields of the lines (operation type, category, description, timestamp) are the same for the three balances. Of 273 yield lines, 76 carry no operation type and all carry category `03060000`.

The root cause is the assumption that a line the aggregator lists under an account moved that account.

## 2. Rules

| ID | Rule |
|---|---|
| RY1 | A yield line is a line the aggregator states as yield: in Pluggy, a credit of a bank account with category `03060000`. The rules apply to a yield line of a sync that no other rule matches, groups or sends to review, in an account whose connection lists at least one reserved balance. Another line is unchanged. |
| RY2 | The gap is the balance the aggregator reports for the account minus its settled balance, with every other line of the sync recorded. It exists when the sync reports a balance and the account has a reconciled balance. |
| RY3 | When the gap equals the sum of the new yield lines, the account's balance holds them all, and all are created. |
| RY4 | Otherwise, a yield line that equals the yield of a mapped reserve is the reserve's: it is discarded. The yields of a reserve are those D3 booked and the difference between its reported amount and its settled balance, each over the days since the previous assertion. A yield of several days equals the sum of at most one line of each day. More than one choice of lines matches none. |
| RY5 | The remaining new lines are created when no gap exists. With a gap, the only choice of at most one line of each day that sums to the gap is created, and the others wait for review with reason `yield`. Without such a choice all wait. |
| RY6 | A line A261 closes takes part in RY4; unmatched, it waits with reason `reconciled`. |
| RY7 | A line that waits with reason `yield` or `reconciled` is decided again by RY4 in each sync that returns it. A line with reason `yield` also takes part in RY5 when the new lines alone do not sum to the gap. |
| RY8 | A discarded line can be reopened (A140). A reopened line waits for the owner and no sync decides it again. |

Known limit: without a reconciled balance, the first sync of an account has no gap, and a reserve's line of a date before the reserve's first assertion is created.

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The category of a yield line is a value of the aggregator, held in `internal/ingestion/aggregator/pluggy` (ADR 016). |
| R2 | An aggregator that states no yield line changes nothing. |
| R3 | Does not apply: the review reasons are a closed list that does not grow with regions. |
| R4 | Does not apply: `NormalizedRecord.Yield` is a field of the existing aggregator port. |
| R5 | `batch.reason.yield`, in pt-BR and en. |
| R6 | Does not apply: the review screen already formats the record's date and amount. |
| C1 | Integers of minor units in the currency of the account. |
| C2 | Sums hold one currency: a reserved balance maps to an account of the currency of the bank account (D1). |
| C3 | Does not apply: no conversion. |
| C4 | Does not apply: no new amount is shown. |
| T1 | Calendar dates in the book's time zone, as stored. |
| T2 | Does not apply: no business day count. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Migration 00143 adds `yield` to the check of `ingestion_external_record.review_reason`. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | A line is discarded only when it equals a yield of a reserve and the account's balance does not hold it; every other doubt waits for review. A repeated sync creates nothing. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation; the enum `review_reason` of `ExternalRecord` gains `yield`. |
| S2 | The review screen is desktop only (ADR 027); the reason text is the only change. |
| S3 | `imports_and_bank_connections.md` states the rule. |
| S4 | Does not apply: `get_imports` returns the records as before. |
| X1 | S687 `TestS687ReserveYieldLine` and S688 `TestS688UnexplainedYieldLine` in `internal/ingestion`. |
| X2 | Does not apply: R1 is an aggregator value; C2 and C3 add no conversion. |
