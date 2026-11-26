# Release line of a reserved balance

- Status: approved by the owner on 2026-11-26
- Date: 2026-11-26
- Amendment: A268
- Scenarios: S738, S739 and S740 of `docs/domain/06-scenarios.md`
- Amends: D4 (A76) of `docs/specs/2026-10-18-pluggy-reserved-balances-design.md`; reads A212 and A264

## 1. Defect

On 2026-11-26 the owner withdrew the whole "Cofrinho Mercado Livre" (1,017.38) in two steps. The reserve keeps its yield for purchases on Mercado Livre, so less money reached the checking account than left the reserve. For each step the Mercado Pago item listed two lines under the checking account:

| Source timestamp (UTC) | Amount | Description | `operationType` | `categoryId` | Booked as |
|---|---:|---|---|---|---|
| 14:11:51.011 | −997.48 | Liberação de dinheiro | `OUTROS` | `03000000` | checking → uncategorized expense |
| 14:11:51.222 | +980.44 | Dinheiro retirado Cofrinho Mercado Livre | `TRANSFERENCIA_SALDO_RESERVADO` | `05060000` | reserve → checking (A76) |
| 14:28:54.963 | −19.90 | Liberação de dinheiro | `OUTROS` | `03000000` | checking → uncategorized expense |
| 14:28:55.206 | +19.56 | Dinheiro retirado Cofrinho Mercado Livre | `TRANSFERENCIA_SALDO_RESERVADO` | `05060000` | reserve → checking (A76) |

The reported balances show that the release line is the reserve's gross debit, not a movement of the checking account:

| Account | Reported 2026-11-25 | Reported 2026-11-26 | Lines that explain the change |
|---|---:|---:|---|
| Mercado Pago (checking) | 192.41 | 192.49 | +980.44 +19.56 −900.00 −100.00 +0.08 (yield); purchase −19.90 and refund +19.90 |
| Cofrinho Mercado Livre | 1,016.83 | 0.00 | +0.55 (yield) −997.48 −19.90 |

The checking account's change holds no release line. The reserve's change holds the two release amounts. The 17.38 retained (997.48 − 980.44 + 19.90 − 19.56) is the reserve's whole yield since the deposit and is in no balance the item reports. The ledger ended the day with the checking account 1,017.38 below the item and the reserve at 16.83 against 0.00. The 0.55 yield line waits with reason `yield`, because RY4 measures the reserve against the wrong settled balance.

The line had not appeared before: the withdrawal of 1,000.00 from the same reserve on 2026-10-08 came without it. The root cause is the one of A264: a line the aggregator lists under an account is assumed to have moved that account.

## 2. Rules

| ID | Rule |
|---|---|
| RL1 | A release line is a debit of a bank account, in a connection that lists at least one reserved balance, whose description folds (A212) to "Liberação de dinheiro". The wording is a value of the Pluggy adapter (`NormalizedRecord.ReserveRelease`). Another line is unchanged. |
| RL2 | A release line pairs with a withdrawal line of D4 (A76, resolved to one mapped reserve by A212) of the same account and the same sync, whose source timestamp falls 0 to 2 seconds after the release line's, when the release amount is at least the withdrawal amount. A line pairs at most once. A release line with more than one candidate, or a withdrawal line claimed by more than one release line, pairs with none. |
| RL3 | The pairs of a sync are booked only when both reported balances confirm them, computed before any pair is booked, with every pair booked as RL4 states. The bank account: the sync reports a balance and the account has a reconciled balance (RY2); the gap, with the release lines left out, is closed by RY3 to RY5 with no yield line waiting, or is 0 without yield lines. Each reserve of a pair: the item reports its amount and the reserve has a reconciled balance; its reported amount minus its settled balance less the release amounts lies between 0 and the bound B of D3, computed on the settled balance over the days since the reserve's last reconciled balance. |
| RL4 | A booked pair is one transaction created for the withdrawal line, dated its date, with its description: reserve −release amount, bank account +withdrawal amount and, when the two differ, the system income account "Yield" (role `yield`) +difference. The release line is discarded: the transaction books its amount on the reserve. |
| RL5 | A release line that pairs with none, or whose pairs RL3 does not confirm, waits for review with reason `reserve_release`; a later sync does not decide it again. Its withdrawal line follows D4 unchanged. |
| RL6 | A discarded release line can be reopened (A140). A reopened line waits for the owner and no sync decides it again. |

RL4 books the difference against "Yield" because the retained amount is yield the reserve had booked as income (D3, A264) and never reached money the owner can spend outside Mercado Livre. No new account or category is created.

Known limits:

- A release line and its withdrawal line that arrive in different syncs wait for review (RL5). The rule never changes a transaction booked by an earlier sync.
- The two-second window comes from two observations (211 ms and 243 ms). A wider gap sends the line to review, never to a wrong booking.
- D3 books no yield on a reserve whose settled balance is 0 or less. A withdrawal of a whole reserve that holds the yield of the day leaves that yield as an open difference of the reserve, as before this amendment.

## 3. Repair of 2026-11-26

The four transactions of section 1 are corrected through the MCP tools `void_transaction` and `change_transaction`, with the postings of RL4:

| Transaction | Action |
|---|---|
| `01a218bb-c994-72a2-b213-964b1bb98919` (−997.48) | void, reason "A268: release line of Cofrinho Mercado Livre" |
| `01a218bb-c950-7751-953d-3d1e89370016` (−19.90) | void, same reason |
| `01a218bb-c991-7095-9a51-2749169bb458` (+980.44) | correct: reserve −997.48, checking +980.44, Yield +17.04 |
| `01a218bb-c8e7-74ce-892a-2ad7f37a1533` (+19.56) | correct: reserve −19.90, checking +19.56, Yield +0.34 |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The wording "Liberação de dinheiro" is a value of the aggregator, held in `internal/ingestion/aggregator/pluggy` beside the prefixes of D4 (ADR 016). |
| R2 | An aggregator that sets no `ReserveRelease` changes nothing. |
| R3 | Does not apply: the review reasons are a closed list that does not grow with regions. |
| R4 | Does not apply: `NormalizedRecord.ReserveRelease` is a field of the existing aggregator port. |
| R5 | `batch.reason.reserve_release`, in pt-BR and en. |
| R6 | Does not apply: the review screen already formats the record's date and amount. |
| C1 | Integers of minor units in the currency of the account. |
| C2 | Sums hold one currency: a reserved balance maps to an account of the currency of the bank account (D1). |
| C3 | Does not apply: no conversion. |
| C4 | Does not apply: no new amount is shown. |
| T1 | Calendar dates in the book's time zone, as stored; the two-second window compares the source timestamps. |
| T2 | Does not apply: no business day count. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | A new migration adds `reserve_release` to the check of `ingestion_external_record.review_reason`. |
| D3 | RL6: a discarded release line is reopened through A140; the withdrawal line's transaction is a created record with its existing undo. Section 3 corrects through new versions and voids. |
| D4 | A pair is booked only when two reported balances confirm it (RL3); every other case waits for review (RL5). |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation; the enum `review_reason` of `ExternalRecord` gains `reserve_release`. |
| S2 | The review screen is desktop only (ADR 027); the reason text is the only change. |
| S3 | `imports_and_bank_connections.md` states the rule. |
| S4 | Does not apply: `get_imports` returns the records as before. |
| X1 | S738 the two pairs of section 1 book RL4 and both balances reconcile. S739 a release line whose bank balance holds it waits with reason `reserve_release`, and its withdrawal line is a D4 transfer. S740 two withdrawal lines within two seconds of one release line pair none. All in `internal/ingestion`. |
| X2 | Does not apply: R1 is an aggregator value; C2 and C3 add no conversion. |
