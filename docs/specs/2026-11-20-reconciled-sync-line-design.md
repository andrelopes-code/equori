# Sync line dated before a reconciled balance

- Status: approved by the owner on 2026-11-20
- Date: 2026-11-20
- Amendment: A261
- Scenario: S673 of `docs/domain/06-scenarios.md`
- Extends: sync import (P6), reconciliation (`docs/domain/05-domain-model.md`, 5.2.6), reserved balances (`docs/specs/2026-10-18-pluggy-reserved-balances-design.md`, D3)

## 1. Defect

On 2026-11-20 one Pluggy sync of a Mercado Pago checking account returned eight "Rendimentos" lines dated 2026-11-16 to 2026-11-19. Their ids had not been returned before. They held the yield of two reserved balances of the same item (4.30 to 4.35 and 0.54 to 0.55 a day), which D3 had already booked on each reserve from its balance difference. The import created all eight on the checking account: +19.47 against a bank balance of 274.81, unchanged since 2026-11-19.

The lines carry the `operationType` `RESGATE_APLIC_FINANCEIRA`, the category `03060000`, the description and the timestamp of the checking account's own yield. No field of the line tells the two apart. The premise of the reserved balances spec, "Reserve yield: No line carries it", no longer holds.

The bank balances of 2026-11-16 to 2026-11-19 had been reconciled with difference 0 without these lines. A reconciled balance is a fact the bank reported after the line's date. A line it left out contradicts it, and a reconciliation already refuses an assertion, a resolution or a change of a reconciled posting before its date until an unlock (5.2.6, Order and Unlock). Only the creation of a new posting before that date was left open.

## 2. Rules

| ID | Rule |
|---|---|
| RL1 | In a sync, a line whose record is new and whose date is strictly before the date of the account's last reconciled balance assertion waits for review with reason `reconciled` instead of creating a transaction. |
| RL2 | A card statement reconciliation does not count: a card line dated before the closing date of a reconciled statement can belong to a later statement (A147). |
| RL3 | A line on the date of the last reconciled balance is created as before: the bank reports a balance at the instant of the item's last update (A42), so a later line of the same day is not in it. |
| RL4 | A withdrawn record the aggregator returns again is processed as A38 states: the source reported it before the reconciliation. |
| RL5 | A line that matches a recorded transaction, or that another rule sends to review first (repeated, group, duplicate, reserve), keeps its outcome. |
| RL6 | The owner resolves a `reconciled` record like any record in review: create, match or discard. A file import is unchanged. |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the rule compares two dates and holds no regional value. |
| R2 | Does not apply: no regional value. |
| R3 | Does not apply: the review reasons are a closed list that does not grow with regions. |
| R4 | Does not apply: no extension point. |
| R5 | `batch.reason.reconciled`, in pt-BR and en. |
| R6 | Does not apply: the review screen already formats the record's date and amount. |
| C1 | Does not apply: the rule stores no amount. |
| C2 | Does not apply: the rule adds no sum. |
| C3 | Does not apply: no amount is shown. |
| C4 | Does not apply: no amount is shown. |
| T1 | The line's date and the reconciliation's date are calendar dates in the book's time zone, as stored. |
| T2 | Does not apply: no business day count. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation; the review operations keep their roles. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Migration 00139 adds `reconciled` to the check of `ingestion_external_record.review_reason`. |
| D3 | Does not apply: a record waiting for review changes no recorded fact. |
| D4 | The rule moves a case equori decided alone, with a reconciled balance against it, to review. A repeated sync creates nothing: the record exists and is not new. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation; the enum `review_reason` of `ExternalRecord` gains `reconciled`. |
| S2 | The review screen is desktop only (ADR 027); the reason text is the only change. |
| S3 | `imports_and_bank_connections.md` states the rule and the owner's choice. |
| S4 | Does not apply: `get_imports` returns the records as before. |
| X1 | S673, `TestS673LineBeforeReconciledBalance` in `internal/ingestion`. |
| X2 | Does not apply: R1, R2, C2 and C3 do not apply. |
