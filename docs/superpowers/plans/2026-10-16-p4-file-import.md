# P4 File Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P4: import OFX and CSV files into balance accounts as batches of external records, with deduplication (SC2), matching to existing transactions, a review queue for ambiguous matches and balance assertions from files.

**Architecture:** New module `ingestion` (ADR 002, chapter 4, 4.3.3) owning `ingestion_*` tables. File formats are parsed behind an anti-corruption layer (`ingestion/internal/ofx`, `ingestion/internal/csvfile`) into one `NormalizedRecord`. Ingestion calls the Ledger only through `internal/ledger`'s root package; every call is its own database transaction (ADR 002), made idempotent by the external record id stored on the Ledger transaction.

**Tech Stack:** As P3.5. New dependency: none (OFX and CSV parsing and Windows-1252 decoding use the standard library).

**Spec:** `docs/domain/` chapters 3 (F4), 4 (4.3.3), 5 (5.5), 7 (7.3), 8 (N07, N16, N19, N26), 1 (SC2); ADR 002, ADR 007; this plan's "Spec amendments" and "Scenarios".

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A11 | A transaction created or matched from a file stores the external record id (`ledger_transaction.external_record_id`, unique per user). Creating a transaction with an id already stored returns the existing transaction. | A database transaction never spans modules (ADR 002); the id makes the Ledger call idempotent, so an import interrupted between the Ledger commit and the Ingestion update completes on retry without a second transaction. It also answers N19 from the transaction side. |
| A12 | An external record left in state `received` by an interrupted import is processed again when the same record arrives in a later import, instead of being `ignored`. | Completes A11: `ignored` applies only to records already `matched`, `created`, `needs_review` or `discarded`. |
| A13 | CSV files are read with a per-account CSV profile: delimiter, header rows, date column and layout, amount column or debit and credit columns, decimal separator, description column, optional id column, amount sign (`as_is` or `inverted`). No bank presets. | Bank CSV layouts differ and change without notice; a profile set once per account covers them without code changes. |
| A14 | A created transaction's other posting goes to the system account `uncategorized_expense` when the account posting is negative, `uncategorized_income` when positive. On a card account a negative amount is a `charge`, a positive one a `credit`, billed by T04. Pairing a card payment with the checking debit that paid it is Classification work (P5). | Chapter 3 F4 names "Uncategorized" without sign or card role. |
| A15 | Files that are not valid UTF-8, or OFX files declaring `CHARSET:1252`, are decoded as Windows-1252. | Brazilian banks export OFX 1.x in Windows-1252. |
| A16 | Import upload: `multipart/form-data`, field `file`, at most 10 MiB, request body limit 11 MiB (N26 gains this route). | One year of statement lines fits; the limit matches attachments. |

## Scenarios (added to chapter 6, section 6.10 "Import")

| ID | Scenario |
|---|---|
| S32 | An OFX file for Nubank checking with three lines: −45.90 on 2026-10-05 matches the manual −45.90 entry of 2026-10-04 (posting `cleared`, record `matched`); −120.00 and +3,000.00 create transactions against `uncategorized_expense` and `uncategorized_income`; `LEDGERBAL` 2,834.10 on 2026-10-31 records an assertion and reconciles the account. Batch counts: received 3, matched 1, created 2, ignored 0. |
| S33 | Importing the S32 file again: received 3, ignored 3, created 0 (SC2). |
| S34 | A CSV file with two identical lines (2026-10-07, −8.50, "Padaria") creates two transactions; importing it again creates none; a later file with three such lines creates one. |
| S35 | Two manual −50.00 entries on 2026-10-09 and 2026-10-10 and one OFX line −50.00 on 2026-10-10: the record goes to `needs_review`; resolving it as a match to the 2026-10-10 entry clears that posting. |
| S36 | An OFX credit card statement for Itaú Visa: a −230.00 line on 2026-10-14 is recorded as a `charge` billed on 2026-11; a +230.00 line is a `credit`. |

## Global Constraints

- All earlier constraints apply (ADR 007 conventions: contract validation, `Money`, pagination, 201 with `Location` where a GET exists).
- Logs never contain account numbers from files (N16); OFX `ACCTID` is not stored.
- Matching window: ±3 days, same account, same amount, transaction not voided, transaction not linked to another external record (I07).
- Deduplication key: SHA-256 of `account_id`, source and the external id (OFX `FITID`, CSV id column); without an external id, of `account_id`, date, amount, normalized description (lowercase, trimmed, inner spaces collapsed) and the ordinal of identical records in the batch. `UNIQUE (user_id, dedup_key)` (I10).

## Review Focus

1. An import interrupted after the Ledger created a transaction and before the record left `received`: the next import of the same file completes the record without a second transaction (A11, A12) (Task 5).
2. Two identical records in one file and one matching manual entry: the first record matches, the second creates; never two records linked to one transaction (I07) (Task 5).
3. A file balance dated before the account's last reconciliation, or after today: the import succeeds and the batch reports the assertion as skipped with the reason (Task 5).
4. An OFX 1.x file in Windows-1252 with accented names decodes correctly; a malformed file returns 422 on `file` and writes no batch (Task 3, Task 5).
5. A CSV profile whose columns do not exist in the file: 422 on `file` naming the missing column; no batch (Task 4).

---

## Slice A (Tasks 1–3)

### Task 1: Ledger support for imports

**Files:** `db/migrations/00009_ledger_import.sql`, `db/queries/ledger/transaction.sql`, `internal/ledger/ledger.go` (public API), `internal/ledger/internal/app/imports.go` and test, `internal/ledger/import_test.go`.

**Migration:** `ledger_transaction.external_record_id uuid NULL`, `UNIQUE (user_id, external_record_id)`.

**Public API (`ledger.Module`):**

```go
type ImportedPosting struct{ AccountID uuid.UUID; Date time.Time; Amount money.Money; Description string }
func (m *Module) RecordImported(ctx context.Context, userID int64, recordID uuid.UUID, p ImportedPosting) (txID uuid.UUID, err error) // A11, A14; idempotent by recordID
func (m *Module) MatchCandidates(ctx context.Context, userID int64, p ImportedPosting, window int) ([]uuid.UUID, error)  // transactions with a posting on the account, same amount, |date| ≤ window, not voided, no external_record_id
func (m *Module) ClearMatched(ctx context.Context, userID int64, recordID, txID uuid.UUID, accountID uuid.UUID) error // sets external_record_id; pending → cleared; idempotent
func (m *Module) AssertBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error // source import; wraps app.AssertBalance
```

Errors cross the boundary as `ledger.ErrNotFound`, `ledger.ErrValidation` (with field), `ledger.ErrAlreadyReconciled`, `ledger.ErrAlreadyMatched`.

**Tests:** idempotent `RecordImported` (same record id twice → one transaction); uncategorized side by sign; card charge and credit with statement; candidates exclude voided, other accounts, matched and out-of-window transactions; `ClearMatched` on a transaction matched to another record → `ErrAlreadyMatched`.

Commit `feat(ledger): support imported transactions and matching`.

### Task 2: Ingestion module and schema

**Files:** `db/migrations/00010_ingestion.sql`, `db/queries/ingestion/`, `sqlc.yaml`, `internal/ingestion/ingestion.go`, `internal/ingestion/internal/{domain,app,adapter/postgres,adapter/httpapi}`, `api/openapi.yaml` (tag `ingestion`), `internal/server/server.go`, `internal/ingestion/schema_test.go`.

**Tables (chapter 7, 7.3, without connection tables, which are P6):**
- `ingestion_csv_profile (user_id, account_id PK, delimiter, header_rows, date_column, date_layout, amount_column, debit_column, credit_column, decimal_separator, description_column, id_column, amount_sign, updated_at)`; exactly one of `amount_column` or (`debit_column`, `credit_column`).
- `ingestion_batch (id, user_id, account_id, source IN ('ofx','csv'), file_name, period daterange, received, ignored, matched, created, needs_review, assertion_status IN ('none','recorded','skipped'), assertion_reason, started_at, completed_at)`.
- `ingestion_external_record (id, user_id, batch_id, account_id, external_id, dedup_key bytea, raw jsonb, booked_on, amount bigint, description, balance_after, state IN ('received','ignored','matched','created','needs_review','discarded'), transaction_id, candidates uuid[])`, `UNIQUE (user_id, dedup_key)` (I10), `UNIQUE (user_id, transaction_id) WHERE transaction_id IS NOT NULL` (I07).

Each re-import of a duplicate is not stored as a row: the batch counts it as `ignored` (I10 holds one row per key).

**Tests:** I07 and I10 rejected by raw SQL; profile with both column layouts rejected; module registers routes and an empty batch list answers 200.

Commit `feat(ingestion): add the ingestion module and schema`.

### Task 3: OFX parser

**Files:** `internal/ingestion/internal/ofx/ofx.go` and test, `internal/ingestion/internal/ofx/testdata/*.ofx`, `internal/ingestion/internal/domain/record.go`.

```go
type NormalizedRecord struct { ExternalID string; Date time.Time; Amount int64; Description string; Raw map[string]string }
type Statement struct { Currency string; Records []NormalizedRecord; Balance *Balance } // Balance{Date, Amount}
func Parse(r io.Reader, scale int) (Statement, error) // OFX 1.x SGML and 2.x XML; bank (STMTRS) and credit card (CCSTMTRS)
```

**Rules:** header `CHARSET:1252` or invalid UTF-8 → Windows-1252 (A15); `DTPOSTED` in `YYYYMMDD[HHMMSS[.XXX]][[±h:TZ]]` → the date part; `TRNAMT` with `.` or `,` decimal → minor units at the currency scale, rejecting more decimals than the scale; description from `NAME`, then `MEMO`; `LEDGERBAL` → balance. Errors name the element and line.

**Tests:** fixtures for 1.x bank in Windows-1252 with "Pão de Açúcar", 2.x XML bank, 1.x credit card; missing `FITID` → record without external id; malformed amount → error naming `TRNAMT`; truncated file → error (Review Focus 4).

Commit `feat(ingestion): parse OFX statements`.

**Slice A ends: checkpoint.**

---

## Slice B (Tasks 4–6)

### Task 4: CSV profiles and parser

**Files:** `internal/ingestion/internal/csvfile/csvfile.go` and test, `internal/ingestion/internal/domain/profile.go` and test, profile endpoints.

**Endpoints:** `GET /accounts/{id}/csv-profile`, `PUT /accounts/{id}/csv-profile` (A13; 200 with the profile).

**Rules:** `encoding/csv` with the profile delimiter; date layouts `DD/MM/YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`; decimal `,` or `.` with thousands separators removed; debit and credit columns produce negative and positive amounts; `inverted` flips the sign (card exports list charges as positive); the header row names columns, otherwise columns are 1-based indexes.

**Tests:** both column layouts; Brazilian decimals `1.234,56`; inverted sign; missing column → error naming it (Review Focus 5); Windows-1252 file.

Commit `feat(ingestion): read CSV files with account profiles`.

### Task 5: Import pipeline

**Files:** `internal/ingestion/internal/app/importer.go` and test, `internal/ingestion/internal/domain/dedup.go` and test, endpoints, `internal/ledger/ledger.go` body limit list (A16).

**Endpoints:** `POST /accounts/{id}/imports` (multipart: `file`, `format` = `ofx` | `csv`) → 201 `ImportBatch` with `Location`; `GET /import-batches` (paginated, newest first); `GET /import-batches/{id}`.

**Pipeline per record, in file order:** compute the key; insert the record in `received` (a key conflict with a finished record counts `ignored`; with a `received` record, resume it, A12); candidates from `MatchCandidates` minus transactions linked to records of this batch; one candidate → `ClearMatched`, `matched`; none → `RecordImported`, `created`; several → `needs_review` with the candidate ids. After the records: the file balance, when present, through `AssertBalance`; `already_reconciled` or a future date → `assertion_status = skipped` with the reason (Review Focus 3). The batch row is written first and completed last; a parse error rejects the file before any row (Review Focus 4).

**Tests:** S32, S33, S34; Review Focus 1 (simulate the interruption by running `RecordImported` for a record and leaving it `received`), 2, 3, 4; another user's account → 404.

Commit `feat(ingestion): import files with deduplication and matching`.

### Task 6: Review queue

**Endpoints:** `GET /import-batches/{id}/records?state=` (paginated); `POST /external-records/{id}/resolve {action: match | create | discard, transaction_id?}` → 200 record.

**Rules:** only `needs_review` records resolve (409 `record_resolved` otherwise); `match` requires a transaction among the stored candidates that is still unmatched (422 on `transaction_id`, 409 `already_matched`); the batch counts move from `needs_review` to the chosen state.

**Tests:** S35; resolving twice → 409; match to a non-candidate → 422.

Commit `feat(ingestion): resolve records that need review`.

**Slice B ends: checkpoint.**

---

## Slice C (Task 7)

### Task 7: Scenarios, performance and documentation

- S32–S36 in `internal/ingestion/scenarios_test.go`.
- N07: benchmark importing a generated 1,000-line OFX file into an account with 200 manual transactions, below 5 s on the CI runner (categorization arrives in P5).
- Chapter 6 gains section 6.10 with S32–S36 and coverage rows; chapters 3, 5, 7 and 8 gain A11–A16; README lists the endpoints.
- `make check`, self-review against Review Focus, merge to `main`, push, CI green, checkpoint, domain book republished.

Commits `test(ingestion): add P4 acceptance scenarios`, `docs: document file import`.

**P4 exit criterion: S32–S36 pass; SC2 (S33, S34); N07 benchmark below 5 s.**
