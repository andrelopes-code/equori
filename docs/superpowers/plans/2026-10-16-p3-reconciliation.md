# P3 Reconciliation, Yield and Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P3: balance assertions, reconciliation of accounts and card statements, automatic yield on reserves, balance adjustments, explicit unlock of reconciled postings, and transaction attachments, with scenarios S24–S26 and S31.

**Architecture:** Extends the `ledger` module (ADR 002). Reconciliation decisions are pure domain functions; the application records assertions, yield and adjustment transactions and marks postings `reconciled` in one database transaction. Attachments are stored in PostgreSQL (D2), deduplicated by content hash per user.

**Tech Stack:** As P2. New dependency: none.

**Spec:** `docs/domain/` chapters 3 (F6), 5 (5.2.6), 6 (S24–S26, S31), 7 (7.2), 8 (N26); ADR 004; this plan's "Spec amendments".

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A7 | A card statement is reconciled when the user confirms the institution's amount due for it; equal amounts mark the statement's postings `reconciled` (completes P2 amendment A3). | The statement is the institution's record for a card; there is no daily card balance to assert. |
| A8 | Unlock: `POST /accounts/{id}/unlock {from}` returns the account's postings with settlement date ≥ `from` to `cleared` and deletes reconciliations dated ≥ `from`. It runs with `equori.unlock_reconciled` set for the transaction only. | Chapter 2 requires an explicit unlock before changing reconciled postings; it was never specified. |
| A9 | Balance assertions apply to leaf balance accounts only: a parent account or a category returns 422. | The institution reports one balance per real account; a parent sum mixes accounts with independent statements. |
| A10 | The yield transaction is dated on the assertion date and covers the period since the previous assertion; with no previous assertion, since the account's first posting. | Chapter 3 F6 names the period; it did not name the date of the transaction. |

## Global Constraints

- All P1 and P2 global constraints apply.
- Reconciliation compares settlement-date balances (`basis=settled`, chapter 5, 5.2.6).
- Attachment upload: `multipart/form-data`, field `file`, at most 10 MiB of content; the request body limit for that route is 11 MiB, every other route keeps 1 MiB (N26).

## Review Focus

1. An assertion recorded for a date earlier than an existing reconciliation of the same account: rejected with 409 `already_reconciled`, never re-reconciling history out of order (Task 3).
2. A positive difference on an account with yield mode `none`, and a negative difference on a reserve: both stay open as differences; neither becomes yield (Task 3).
3. A correction or void of a transaction whose posting became reconciled through an assertion: 409 `posting_reconciled` until unlocked; after unlock, the correction succeeds (Task 4).
4. The same file attached to two transactions: one blob row, two attachment rows; deleting one attachment keeps the other's content (Task 6).
5. An upload of 10 MiB + 1 byte: 413 `request_too_large` or 422 `validation_failed` on `file`, never a partial row (Task 6).

---

## Slice A (Tasks 1–3)

### Task 1: Schema

**Files:** `db/migrations/00008_reconciliation.sql`, `internal/ledger/reconciliation_schema_test.go`.

- `ledger_balance_assertion (id, user_id, account_id, date, amount bigint, source IN ('manual','import','open_finance'), recorded_at)`, composite foreign key, index `(account_id, date)`.
- `ledger_reconciliation (id, user_id, account_id, date, assertion_id UNIQUE NULL, statement_id UNIQUE NULL, difference bigint, resolution IN ('none','yield','adjustment','transactions_added'), resolution_transaction_id NULL, reconciled_at)`, `CHECK ((assertion_id IS NULL) <> (statement_id IS NULL))`, index `(account_id, date DESC)`.
- `ledger_attachment_blob (user_id, sha256 bytea, size int CHECK size BETWEEN 1 AND 10485760, content bytea, PRIMARY KEY (user_id, sha256))`.
- `ledger_attachment (id, user_id, transaction_id, sha256, file_name 1–255, media_type, created_at)`, foreign keys to transaction and blob, `UNIQUE (transaction_id, sha256)`.

Tests: reconciliation with both or neither of assertion/statement rejected; blob above 10 MiB rejected; attachment referencing another user's blob rejected.

Commit `feat(ledger): add reconciliation and attachment schema`.

### Task 2: Reconciliation rules (pure domain)

**Files:** `internal/ledger/internal/domain/reconciliation.go` and test.

```go
type Resolution string // ResolutionNone, ResolutionYield, ResolutionAdjustment, ResolutionTransactionsAdded
type AssertionOutcome struct {
	Difference int64      // asserted − settled balance
	Resolution Resolution // ResolutionNone, ResolutionYield, or "" when the difference stays open
	Yield      int64      // > 0 only for ResolutionYield
}
func DecideAssertion(asserted, settled int64, mode YieldMode) AssertionOutcome
func CheckAssertionDate(date time.Time, lastReconciled *time.Time) error // ErrAlreadyReconciled when date < lastReconciled
```

Tests: difference 0 → none; +8,341 with `auto` → yield 8,341; +8,341 with `none` → open; −1,000 with `auto` → open (Review Focus 2); assertion before the last reconciliation → `ErrAlreadyReconciled`, on the same date → allowed.

Commit `feat(ledger): add reconciliation rules`.

### Task 3: Balance assertions with automatic reconciliation and yield

**Endpoints:** `POST /accounts/{id}/balance-assertions {date, amount, source?}` → `201 {assertion, difference, resolution?, yield_transaction_id?}`; `GET /accounts/{id}/balance-assertions`; `PATCH /accounts/{id}` gains `yield_mode`.

**Rules:** leaf balance accounts only (A9); amount in the account currency; `CheckAssertionDate` against the latest reconciliation (409 `already_reconciled`). Difference against the settled balance at the date. Resolution `none` → reconcile; `yield` → record the yield transaction (account +yield, system account `yield` −yield, origin `system`, description "Yield <period>", A10) then reconcile; open → no reconciliation. Reconcile = insert `ledger_reconciliation` and `UPDATE ledger_posting SET status = 'reconciled'` for the account's non-voided postings with settlement date ≤ date. Publishes `ledger.account_reconciled.v1 {account_id, date}`.

**Tests:** S24 (yield 83.41, reserve reconciled, postings `reconciled`); negative difference stays open; yield mode `none` stays open; parent account → 422; Review Focus 1.

Commit `feat(ledger): reconcile accounts from balance assertions and record yield`.

**Slice A ends: checkpoint.**

---

## Slice B (Tasks 4–6)

### Task 4: Resolutions, status and unlock

**Endpoints:** `POST /balance-assertions/{id}/resolution {resolution: "adjustment" | "transactions_added"}`; `GET /accounts/{id}/reconciliation` → `{last_reconciled_on, open_difference?: {assertion_id, date, difference}}`; `POST /accounts/{id}/unlock {from}` (A8).

**Rules:** `adjustment` records account `difference`, equity `adjustments` `−difference`, then reconciles (S26). `transactions_added` recomputes the difference; zero → reconcile, otherwise 409 `difference_remains` with the current difference in `detail`. Resolving an assertion already reconciled → 409 `already_reconciled`.

**Tests:** S26; `transactions_added` after recording the missing posting; still different → 409; Review Focus 3 (correct after reconciliation → 409; unlock; correct → 200; the reconciliation row is gone).

Commit `feat(ledger): resolve differences, report reconciliation and unlock`.

### Task 5: Statement reconciliation

**Endpoint:** `POST /statements/{id}/reconciliation {amount_due}` (A7).

**Rules:** the statement's closing date must have passed (409 `statement_not_closed`); `amount_due` equals the derived amount due → reconciliation row with `statement_id`, postings of the statement `reconciled`; otherwise 409 `difference_remains`.

**Tests:** reconciled statement; its purchase can no longer be corrected; different amount → 409.

Commit `feat(ledger): reconcile card statements`.

### Task 6: Attachments

**Endpoints:** `POST /transactions/{id}/attachments` (multipart, field `file`) → `201 {id, file_name, media_type, size, sha256}`; `GET /transactions/{id}/attachments`; `GET /attachments/{id}/content` (raw bytes, `Content-Type` stored, `Content-Disposition: attachment`); `DELETE /attachments/{id}` → 204 (blob deleted when no attachment references it).

**Rules:** media type detected with `http.DetectContentType` on the first 512 bytes; allowed: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `text/plain`; otherwise 422 on `file`. `httpserver.Middleware` body limit becomes per route: 11 MiB for `POST /api/v1/transactions/{id}/attachments`, 1 MiB elsewhere. Attachment ids are opaque; content is served only to the owning user.

**Tests:** S31 (same file twice: one blob; 12 MiB rejected); Review Focus 4 and 5; another user's attachment → 404; unsupported type → 422.

Commit `feat(ledger): add transaction attachments`.

**Slice B ends: checkpoint.**

---

## Slice C (Task 7)

### Task 7: Acceptance scenarios and documentation

- S24, S25 (redemption with income tax as a generic transaction), S26, S31 through the API in `internal/ledger/reconciliation_scenarios_test.go`.
- Chapters 2, 3 and 5 gain amendments A7–A10; README lists the endpoints.
- `make check`, merge to `main`, push, CI green.

Commits `test(ledger): add P3 acceptance scenarios`, `docs: document reconciliation and attachments`.

**P3 exit criterion (chapter 9): scenarios S24–S26 and S31 pass.**
