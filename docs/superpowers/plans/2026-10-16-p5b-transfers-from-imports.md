# P5b Transfers from Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P5b: turn an imported line into a transfer between two of the owner's accounts, pair the two imported sides of one transfer (card payment from checking, P4 amendment A14) into one transaction, and add the rule actions "transfer to account" and "mark reimbursable to counterparty".

**Architecture:** An external record links to the posting it confirms instead of the whole transaction (A27), so one transfer transaction carries the record of each side. A Ledger command `Transfer` replaces the category side of a transaction with one posting on a balance-sheet account and re-derives card roles and statements (A28); when the other side already exists as an uncategorized imported transaction, the command pairs the two (A29). Imports and Classification reuse the command; Ingestion follows pairings through a Ledger event.

**Tech Stack:** As P5. New dependency: none.

**Spec:** `docs/domain/` chapters 3 (F4, F5), 5 (5.4), 6 (S18), 7 (I07), 9 (P5b row); P4 amendment A14; P5 amendments A17–A26; this plan's "Spec amendments" and "Scenarios".

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A27 | An external record links to one posting (`ledger_posting.external_record_id`, unique per user), on the record's account. A transaction holds at most one record per account; I07 becomes `UNIQUE (user_id, transaction_id, account_id)` on `ingestion_external_record`. A correction keeps each link on the first posting of the same account; a correction that removes every posting of a linked account is rejected (422 on `postings`). Matching candidates are unlinked postings. | A transfer between two imported accounts confirms one record per side; a transaction-level link admits only one. |
| A28 | Ledger command `Transfer` (expected version, account). It replaces every category posting with one posting on a balance-sheet account other than the transaction's own, for the sum of the replaced postings. Card postings get their role again (a positive card posting becomes `payment`) and are billed again (P2 amendment A5). A card posting whose role or statement changes must not be `reconciled` (409 `posting_reconciled`). It publishes `ledger.transaction_corrected.v1` with `categories_changed`. The owner calls it through `POST /transactions/{id}/transfer`. | Chapter 5 lists "mark as transfer to account" without the posting it produces; the role of a card posting depends on the other side (P2). |
| A29 | Pairing: a pairing candidate for transaction T and account X is a non-voided transaction of origin `import`, in category state `uncategorized`, with a posting on X of the opposite amount within ±3 days of T and no posting on T's account. `Transfer` with exactly one candidate pairs: T gets the posting on X carrying the candidate's record link, and the candidate is voided with reason `paired with <T>`. With several candidates the command returns 409 `pairing_ambiguous` unless the request names one (`pair_with`). When the candidate cannot be voided (a reconciled posting), T is voided instead and the candidate takes T's posting and link; when neither can, 409 `posting_reconciled`. It publishes `ledger.transactions_paired.v1` (kept, voided, moved record ids). | Importing both sides of a card payment otherwise counts the payment twice, as an expense and an income. |
| A30 | An imported line whose decision is a transfer to X completes a pairing candidate on X (the candidate takes the line's posting, linked to the line's record) instead of creating a transaction; without a candidate it creates the transfer transaction. When the candidate's card posting is reconciled, the line is created uncategorized. | Order of imports must not matter: card file first or checking file first ends in one transaction. |
| A31 | Rule actions `transfer` (`account_id`: an asset or liability account) and `mark_reimbursable` (`account_id`: a `receivable` account, chapter 5 M13). Each decides the category like `set_category` (P5 A21: the first matching rule that decides the category wins) and applies through `Transfer`. | Chapter 5, 5.4 actions; S18 step 1. |
| A32 | Ingestion keeps `ingestion_external_record.transaction_id` by consuming `ledger.transactions_paired.v1`: records moved to the kept transaction point to it. Delivery is idempotent. | A database transaction never spans modules (ADR 002). |

## Scenarios (added to chapter 6 as section 6.14 "Transfers from imports")

Data: Nubank checking, Itaú Visa (closing day 3, due day 10), Savings, Receivable Employer; statement 2026-11 of Itaú Visa holds 1,500.00 of charges.

| ID | Scenario |
|---|---|
| S45 | Rule "description contains `pagamento fatura`" → transfer to Itaú Visa. A checking OFX line −1,500.00 "PAGAMENTO FATURA ITAU" on 2026-11-10 creates one transaction: checking −1,500.00, Itaú Visa +1,500.00 `payment` billed on statement 2026-11. A card OFX line +1,500.00 "PAGAMENTO RECEBIDO" on 2026-11-11 matches the card posting; no transaction is created; statement 2026-11 is `paid`. |
| S46 | The card file of S45 is imported first: its line creates Itaú Visa +1,500.00 `credit` against `uncategorized_income`. The checking file then completes that transaction: version 2 holds Itaú Visa +1,500.00 `payment` and checking −1,500.00 linked to the checking record; there is one transaction and statement 2026-11 is `paid`. |
| S47 | Both files are imported before the rule exists. `POST /transactions/{checking}/transfer` with Itaú Visa pairs: the checking transaction holds both postings and both records; the card transaction is voided with reason `paired with <checking>`; the card record points to the checking transaction after the event is delivered. |
| S48 | Two card lines +1,500.00 on 2026-11-09 and 2026-11-11 are candidates: the transfer returns 409 `pairing_ambiguous`; with `pair_with` naming the second it pairs with that one. |
| S49 | Rule "description contains `hotel`" → mark reimbursable to Receivable Employer. A card line −800.00 "HOTEL IBIS" creates Itaú Visa −800.00 `charge`, Receivable Employer +800.00 (S18 step 1). |
| S50 | `POST /transactions/{id}/transfer` to Savings on an imported checking line −500.00 without candidates gives checking −500.00, Savings +500.00; the categorization record of the transaction is removed (category state `none`). |

## Global Constraints

- All P5 constraints apply.
- The A27 migration moves each existing transaction link to the posting on the record's account; it reads `ingestion_external_record` with `SELECT` only, once.
- Pairing never deletes a row: the replaced transaction is voided and stays in history.
- Re-importing any file of S45–S48 after pairing ignores every line (SC2).

## Review Focus

1. A correction of a transaction with a linked posting keeps the link; removing the linked account's postings returns 422 and changes nothing (Task 1).
2. Pairing when the card posting of the candidate is in a reconciled statement: the checking side is voided instead, or 409 when both are reconciled; no partial change (Task 2).
3. Re-import of both files after S47: received 1, ignored 1 for each file; no new transaction (Task 3).
4. `ledger.transactions_paired.v1` delivered twice or before the record exists in a retried import: the record ends pointing to the kept transaction (Task 3).
5. `transfer` to the transaction's own account, to a category, to a closed account or to an account in another currency: 422 on `account_id` (Task 2, Task 4).

---

## Slice A (Tasks 1–3)

### Task 1: Posting-level record links (A27)

**Files:** `db/migrations/00012_posting_record_link.sql`, `db/queries/ledger/{import.sql,transaction.sql}`, `internal/ledger/internal/domain/transaction.go` (`Posting.ExternalRecordID`, link carried by `Correct`), `internal/ledger/internal/app/imports.go`, `internal/ledger/internal/adapter/postgres`, `internal/ledger/ledger.go` (`UnlinkedPosting` keyed by posting), `internal/ingestion` (matcher on posting candidates; I07 index), tests in `internal/ledger/import_test.go`, `internal/ledger/schema_test.go`, `internal/ingestion/schema_test.go`.

**Migration:** add `ledger_posting.external_record_id uuid`, `UNIQUE (user_id, external_record_id) WHERE external_record_id IS NOT NULL`; copy each `ledger_transaction.external_record_id` to the posting on `ingestion_external_record.account_id`; drop the transaction column and its index; replace `ingestion_record_transaction_idx` with `UNIQUE (user_id, transaction_id, account_id) WHERE transaction_id IS NOT NULL`.

**Tests:** migration test over a database seeded with an imported, a matched and a resumed record (links land on the account's posting); correction keeps the link and rejects removing the linked account (Review Focus 1); schema tests for both unique indexes; the P4 suite unchanged.

Commit `refactor(ledger)!: link external records to postings`.

### Task 2: `Transfer` command and pairing (A28, A29)

**Files:** `internal/ledger/internal/domain/transfer.go` and test, `internal/ledger/internal/app/transfer.go`, `internal/ledger/internal/adapter/{postgres,httpapi}`, `db/queries/ledger/transfer.sql`, `api/openapi.yaml` (`transferTransaction`, codes `pairing_ambiguous`), `internal/ledger/ledger.go`, `internal/ledger/transfer_test.go`.

```go
type TransferRequest struct { TransactionID uuid.UUID; ExpectedVersion int; AccountID uuid.UUID; PairWith uuid.UUID; Cause Cause }
type TransferResult struct { Kept, Voided uuid.UUID } // Voided is zero without pairing
var ErrPairingAmbiguous = errors.New("several transactions can pair")
func (m *Module) Transfer(ctx context.Context, userID int64, r TransferRequest) (TransferResult, error)
func (m *Module) PairingCandidates(ctx context.Context, userID int64, txID, accountID uuid.UUID) ([]uuid.UUID, error)
```

**HTTP:** `POST /transactions/{id}/transfer` `{expected_version, account_id, pair_with?}` → 200 `{transaction, voided_transaction_id?}`.

**Tests:** S50, S47 (ledger side), S48; domain table for roles and billing (credit → payment on the oldest unpaid closed statement), reconciled card posting (Review Focus 2), every 422 of Review Focus 5; one `transactions_paired` event per pairing.

Commit `feat(ledger): transfer and pair imported transactions`.

### Task 3: Imports that complete pairings (A30, A32)

**Files:** `internal/ledger/internal/app/imports.go` (`ImportDecision.TransferTo`), `internal/ingestion/ingestion.go` (subscription to `ledger.transactions_paired.v1`), `internal/ingestion/internal/app`, `internal/ingestion/transfer_test.go`.

**Tests:** S45 and S46 with the decision given directly to the ledger port (rules arrive in Task 4); Review Focus 3 and 4.

Commit `feat(ingestion): complete transfers across imported accounts`.

**Slice A ends: checkpoint.**

---

## Slice B (Tasks 4–5)

### Task 4: Transfer and reimbursable rule actions (A31)

**Files:** `internal/classification/internal/domain/{rule.go,decide.go,codec.go}` and tests, `internal/classification/internal/app/{rules.go,classify.go,imports.go}`, `api/openapi.yaml` (`RuleAction.type` gains `transfer`, `mark_reimbursable`; `account_id`), `internal/classification/transfer_test.go`.

**Tests:** S45, S46 through rules; S49; `POST /rules/run` pairs two uncategorized imported transactions; rule validation of `account_id` (Review Focus 5).

Commit `feat(classification): transfer and reimbursable rule actions`.

### Task 5: Documentation and closing

- Chapter 3 F4 and F5 rows, chapter 5 5.4 actions, chapter 6 6.14 S45–S50 and coverage line, chapter 7 (I07, `ledger_posting.external_record_id`), chapter 9 P5b row (scenarios S45–S50, exit criterion).
- README endpoint summary.
- `make check`, self-review against Review Focus, merge `--ff-only` into `main`, push, CI green, checkpoint, domain book republished.

Commit `docs: describe transfers from imports`.

**Exit criterion: S45–S50 pass through the API; a card payment imported from both files counts once in every order; SC2 holds after pairing.**
