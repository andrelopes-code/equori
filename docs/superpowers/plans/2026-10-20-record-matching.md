# Record Matching by Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statement lines link to manual entries by a Fellegi–Sunter score, with review zones, corrections to the institution's facts and a list of unconfirmed entries.

**Architecture:** The score and the one-to-one assignment are pure functions of `internal/ingestion/internal/domain`. The importer asks the ledger for unlinked postings with payee and description, asks classification for each line's payee, assigns, and stores the review reason and the scored candidates on the record. The ledger corrects a matched transaction to the line's amount and date.

**Tech Stack:** Go, PostgreSQL (goose, sqlc), oapi-codegen.

**Spec:** `docs/superpowers/specs/2026-10-20-record-matching-design.md` (A98–A104, S91–S97).

## Global Constraints

- Weights, zones and bounds exactly as A98–A100; constants named in `domain/match.go`.
- `make check` cannot pass in the main tree while the owner's theme WIP is uncommitted; each task runs the package tests and golangci-lint of the changed packages. Nothing is committed without the owner's request.
- Every acceptance scenario S91–S97 has an apitest named after it.

## Review Focus

1. A line with a payee and a manual entry without one: description overlap decides, never the payee conflict.
2. Two lines of one batch competing for one posting: the higher score takes it; the other is scored again without it.
3. A record in review whose candidate was voided before resolution: `match` refuses it.
4. Category parts scaled to a new amount keep their sum equal to the amount (remainder on the last part).
5. A line that changes amount after linking to a reconciled posting: no ledger change; review reason `changed`.

---

### Task 1: Score and assignment (A98–A100)

**Files:** Modify `internal/ingestion/internal/domain/match.go`, Test `internal/ingestion/internal/domain/match_test.go`.

**Produces:** `LedgerPosting{TransactionID, Date, Amount, PayeeID uuid.UUID, Description string}`; `MatchLine{Date, Amount, PayeeID, Description}`; `Scored{TransactionID uuid.UUID; Score int; Amount, Date, Counterparty string}`; `Zone` (`ZoneLink`, `ZoneProbable`, `ZoneAmbiguous`, `ZoneNew`); `Assignment{Zone; TransactionID uuid.UUID; Candidates []Scored}`; `Assign(lines []MatchLine, postings []LedgerPosting) []Assignment`; `MatchHardLimit = 10`.

- [ ] Table test with the numbers of S91–S95, S32 and S35, the blocking bounds, the Jaccard overlap and the batch competition of Review Focus 2.
- [ ] Run `go test ./internal/ingestion/internal/domain/ -run 'TestScore|TestAssign'`: FAIL (undefined).
- [ ] Implement; `Candidates` and `MatchWindow` are removed.
- [ ] Run: PASS.

### Task 2: Unlinked postings with payee and description

**Files:** Modify `db/queries/ledger/import.sql` (`ListUnlinkedPostings`), `internal/ledger/internal/app/imports.go`, `internal/ledger/ledger.go`, `internal/ledger/internal/adapter/postgres/import.go`, `internal/ingestion/ingestion.go`. Test `internal/ledger/import_test.go`.

- [ ] Extend `TestUnlinkedPostingsAndClearMatched` to assert payee and description; FAIL; implement; PASS.

### Task 3: Importer by score

**Files:** Migration `00033_ingestion_record_review.sql` (`review_reason text CHECK IN ('ambiguous','probable','changed')`, `candidate_scores jsonb NOT NULL DEFAULT '[]'`); `db/queries/ingestion/record.sql`; `internal/ingestion/internal/app/importer.go`; port `LinePayees(ctx, userID, lines []Line) ([]uuid.UUID, error)` in `internal/ingestion/ingestion.go` through `classification.DecideImport`; `api/openapi.yaml` (`ExternalRecord.review_reason`, `ExternalRecord.scored_candidates`); httpapi mapping. Tests `internal/ingestion/matching_test.go`: S91, S93, S94, S95; existing S32, S35 unchanged.

### Task 4: Resolution corrects to the line (A101)

**Files:** `internal/ledger/internal/app/confirm_line.go` with `ConfirmLine(ctx, userID int64, txID, accountID uuid.UUID, amount int64, date time.Time, reason string) error`; ledger module export; ingestion port; `review.go`. Test S92 and Review Focus 3 and 4.

### Task 5: Changes after the match (A102)

**Files:** `importer.go` (`update`). Test S96 and Review Focus 5.

### Task 6: Unconfirmed entries (A103)

**Files:** `GET /accounts/{id}/unconfirmed` in the ingestion module (it holds the feed's start and last synced or imported date) with the ledger's unlinked postings; openapi; test S97.

### Task 7: Domain docs

**Files:** `docs/domain/03-domain-flows.md` (`ExternalRecordMatched`, `ExternalRecordUpdated`), `05-domain-model.md` (Matching), `06-scenarios.md` (S91–S97), `07-data-model.md` (record columns).
