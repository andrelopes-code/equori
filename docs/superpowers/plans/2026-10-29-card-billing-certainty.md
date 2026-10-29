# Card billing certainty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A card statement in equori matches the institution's bill: the open statement shows its own cycle, each posting knows who chose its statement, and a closed statement that differs from the institution proposes the postings that explain it.

**Architecture:** Ledger module only, plus one call in ingestion's review path. Domain functions (`Summarize`, a new difference search) stay pure and unit-tested; a stored `statement_basis` on `ledger_posting` records the source of each statement choice; the HTTP contract gains `open_amount`, `provisional`, a difference proposal and one operation to move postings to the next statement.

**Tech Stack:** Go, PostgreSQL (goose, sqlc), oapi-codegen, React + TypeScript (`web/`, Slotted).

**Spec:** `docs/superpowers/specs/2026-10-29-card-billing-certainty-design.md`

## Global Constraints

- Amendments A136, A137, A138; scenarios S176 to S180. Test names or comments carry the scenario ID.
- `statement_basis` values: `date`, `owner`, `institution`. Not regional; a closed `CHECK ... IN` is allowed.
- Provisional window: `MatchHardLimit` (10 days), the existing constant; no new constant.
- Difference search: at most 20 candidates per statement, latest dates first.
- No regional value; `docs/contributing/regions.md` unchanged.
- Every new operation in `api/openapi.yaml` gets an entry in `internal/server/tool_exposure_test.go`; every new `Problem.code` gets an HTTP test.
- `make gen` after editing `db/queries`, `db/migrations` or `api/openapi.yaml`; never edit `*.gen.go`.
- New migration file only; applied migrations are never edited.
- Commits: Conventional Commits, scope `ledger`, `web` or `api`; stage files by path.
- UI: read `web/CLAUDE.md` before touching `web/`; pt-BR and en catalog keys together.

## Review Focus

- A statement whose previous statement is `financed`: open amount must not subtract an unpaid amount the plan already carries. Test in Task 1.
- The first statement of a card (no previous): open amount equals amount due. Test in Task 1.
- A correction that changes only the description of a posting with basis `institution` keeps `institution`. Test in Task 2.
- A reconciled statement: none of its postings is provisional, whatever the basis and date. Test in Task 2.
- Two provisional postings of equal amount and equal date: the search returns one, deterministically (lowest transaction id). Test in Task 4.

---

## Slice 1

### Task 1: Open amount of a statement (A138, S180)

**Files:**
- Modify: `internal/ledger/internal/domain/statement.go` (`StatementSummary`, `Summarize`)
- Test: `internal/ledger/internal/domain/statement_test.go`
- Modify: `api/openapi.yaml` (`StatementSummary`: required `open_amount`)
- Modify: `internal/ledger/internal/adapter/httpapi/statements.go` (`toStatementAPI` and the detail mapping near line 122)
- Test: `internal/ledger/card_scenarios_test.go` (S180)
- Modify: `web/src/features/cards/statements-tab.tsx`, `card-tile.tsx`, `statements-chart.tsx` (open statement reads `open_amount`)
- Modify: `docs/domain/05-domain-model.md` (row "Amount due": add open amount, A138), `docs/domain/06-scenarios.md` (S180)

**Interfaces:**
- Produces: `StatementSummary.OpenAmount int64`; JSON `open_amount` on `StatementSummary` and `StatementDetail`.

- [ ] **Step 1: Write the failing table test `TestSummarizeOpenAmount`**

Cases, previous statement closing 2026-10-29 due 2026-11-05 with charges 1,238.65; current statement closing 2026-11-27 with charges 353.72:

| case | today | payments on current (dated) | want OpenAmount of current |
|---|---|---|---|
| before payment | 2026-11-01 | none | 35372 |
| full payment | 2026-11-04 | 123865 on 2026-11-03 | 35372 |
| partial payment | 2026-11-04 | 100000 on 2026-11-03 | 35372 |
| previous overdue | 2026-11-06 | none | 159237 |
| previous financed | 2026-11-01 | none, previous `Financed: true` | OpenAmount == AmountDue |
| first statement | 2026-11-01 | none, single input | OpenAmount == AmountDue |

- [ ] **Step 2: Run** `go test ./internal/ledger/internal/domain -run TestSummarizeOpenAmount` — expect FAIL (field missing).

- [ ] **Step 3: Implement.** In `Summarize`, after statuses are computed: `out[i].OpenAmount = out[i].AmountDue`, minus `out[i-1].Unpaid` when `out[i-1].Status` is `StatusClosed` or `StatusPartiallyPaid`.

- [ ] **Step 4: Run** the domain test — expect PASS.

- [ ] **Step 5: API.** Add `open_amount` (required, `$ref Money`, description "Amount due less the unpaid amount of a previous statement not yet due (A138)") to `StatementSummary`; `make gen`; map it in both functions of `statements.go`.

- [ ] **Step 6: Write the S180 HTTP test** `TestStatementOpenAmount_S180` in `card_scenarios_test.go` using the existing card helpers of that file: card closing day 29, due day 5; charges 1,238.65 dated 2026-10-10 and 353.72 dated 2026-10-31. Harness with `apitest.Today("2026-11-01")`: statement 2026-12 `open_amount` 353.72. Harness with `apitest.Today("2026-11-06")`: 1,592.37. Check status 200 before decoding.

- [ ] **Step 7: Run** `go test ./internal/ledger -run S180` — expect PASS.

- [ ] **Step 8: Web.** `statements-tab.tsx:90,147`, `card-tile.tsx:84` and `statements-chart.tsx:49` read `open_amount` where the statement status is `open`, `amount_due` otherwise. Run `cd web && pnpm vitest run src/features/cards` and `make web-check`.

- [ ] **Step 9: Docs.** Amend the "Amount due" row of `05-domain-model.md` with the open amount formula (A138); add S180 to `06-scenarios.md`.

- [ ] **Step 10: Commit** `feat(ledger): show an open statement without the previous bill` (body names A138 and S180).

### Task 2: Statement basis and provisional postings (A136)

**Files:**
- Create: `db/migrations/00067_ledger_statement_basis.sql`
- Modify: `db/queries/ledger/transaction.sql` (insert and select of postings: `statement_basis`), `db/queries/ledger/import.sql:83` (`SettleImportedPosting` sets `statement_basis = 'institution'` when a statement id is given), `db/queries/ledger/card.sql` (`ListStatementPostings` returns `p.statement_basis`)
- Modify: `internal/ledger/internal/domain/transaction.go` (`Posting.StatementBasis string`, constants `BasisDate`, `BasisOwner`, `BasisInstitution`)
- Modify: `internal/ledger/internal/app/billing.go` (`bill`, `statementOf`), `internal/ledger/internal/app/imports.go:171` and `installment_import.go:82,146` (basis `institution` when `statementDue` decided)
- Modify: the statement detail assembly in `internal/ledger/internal/app` (where `ListStatementPostings` is read) to compute `Provisional`
- Modify: `api/openapi.yaml` (`StatementPosting`: required boolean `provisional`)
- Test: `internal/ledger/card_schema_test.go` (CHECK rejects `'guess'`), `internal/ledger/card_postings_test.go` (basis per path), `internal/ledger/internal/domain/statement_test.go` (provisional rule)
- Modify: `docs/domain/05-domain-model.md` (row "Billing": basis and provisional, A136), `docs/domain/07-data-model.md` (column)

**Interfaces:**
- Produces: `domain.Posting.StatementBasis`; `domain.Provisional(basis string, date, closing time.Time, reconciled bool) bool`; JSON `provisional` on `StatementPosting`.

- [ ] **Step 1: Migration** `ALTER TABLE ledger_posting ADD COLUMN statement_basis text NOT NULL DEFAULT 'date' CHECK (statement_basis IN ('date', 'owner', 'institution'))`, with Down. `make gen`.

- [ ] **Step 2: Failing tests.**
  - schema: update a posting to `statement_basis = 'guess'` with direct SQL, expect a check violation.
  - `TestStatementBasis` (HTTP, table): manual card charge without `statement` → `date`; with `statement` `"2026-12"` → `owner` (S178: dated 2026-10-27, card closing day 29, stays on 2026-12 after 2026-10-29); imported line with bill due date → `institution`; correction changing only the description of an `institution` posting → `institution`; correction changing `statement` → `owner`.
  - `TestProvisional` (domain, table): basis `date`, dated 2026-10-28, closing 2026-10-29, not reconciled → true; same dated 2026-10-18 (11 days) → false; dated 2026-10-19 (10 days) → true; basis `institution` → false; basis `owner` → true; reconciled → false.

- [ ] **Step 3: Run** them — expect FAIL.

- [ ] **Step 4: Implement.** `statementOf` returns the basis with the reference (`owner` when `p.Statement` came from the request, `date` otherwise). A correction copies the previous posting's basis when the requested statement equals the previous one, else `owner`; the request layer must distinguish "statement sent" from "statement carried", so carry `StatementBasis` on the previous version and compare references. `statementDue` callers set `institution`. `Provisional` lives in `domain/statement.go`; window `MatchHardLimit` days before closing, inclusive.

- [ ] **Step 5: Run** the tests of Step 2 and `go test ./internal/ledger/...` — expect PASS.

- [ ] **Step 6: API.** Add `provisional` to `StatementPosting`; `make gen`; map it. Run `go test ./internal/ledger -run Statement`.

- [ ] **Step 7: Docs** rows of Step "Files"; commit `feat(ledger): record which source chose a posting's statement`.

### Task 3: Owner's match applies the line's bill (A136, S176)

**Files:**
- Modify: `internal/ingestion/internal/app/review.go:77` (after `ClearMatched` succeeds, call `s.billMatched(ctx, &rec, false)`)
- Test: `internal/ingestion/review_test.go` (or the file holding review HTTP tests; S176)
- Modify: `docs/domain/06-scenarios.md` (S176)

**Interfaces:**
- Consumes: `billMatched(ctx, rec *domain.ExternalRecord, pending bool) error` (`importer.go:501`); basis `institution` from Task 2.

- [ ] **Step 1: Failing test `TestReviewMatchBillsLine_S176`.** Card closing day 29, due day 5. Manual charge 7.13 dated 2026-10-28 (statement 2026-11). Import a card line 7.13 dated 2026-10-29 with bill due 2026-12-07 that lands in review with the charge as candidate (use the existing review fixtures of that file). Resolve with action `match`. Assert: the charge's statement reference is `2026-12`, its statement posting has `provisional: false`, statement 2026-11 no longer lists it.

- [ ] **Step 2: Run** — expect FAIL (statement stays 2026-11).

- [ ] **Step 3: Implement** the one call; `ErrReconciled` handling is inside `billMatched`.

- [ ] **Step 4: Run** `go test ./internal/ingestion/... -run S176` — expect PASS.

- [ ] **Step 5: Commit** `fix(ingestion): bill a reviewed match on the line's statement`.

Slice 1 ends: write `.claude/progress/current.md`.

## Slice 2

### Task 4: Difference search (A137)

**Files:**
- Create: `internal/ledger/internal/domain/statement_difference.go`
- Test: `internal/ledger/internal/domain/statement_difference_test.go`

**Interfaces:**
- Produces:
  ```go
  type DifferenceCandidate struct {
      TransactionID uuid.UUID
      Date          time.Time
      Amount        int64 // ledger sign: a charge is negative
  }
  type DifferenceExplanation struct {
      Move     []uuid.UUID // postings to move to the next statement; nil when none found
      Rounding bool        // no subset found and |difference| <= lineCount minor units
  }
  // ExplainDifference: difference = amount due − institution total.
  func ExplainDifference(difference int64, lineCount int, candidates []DifferenceCandidate) DifferenceExplanation
  ```

- [ ] **Step 1: Failing table test `TestExplainDifference`.**
  - S177: difference 713; candidates −713 (2026-10-28), −713 (2026-10-23), −1112 (2026-10-27) → Move = [id of 2026-10-28].
  - two postings needed: difference 1825; candidates −713 (10-28), −1112 (10-27), −399 (10-26) → Move = [10-28, 10-27].
  - equal amount and date: two −713 on 10-28, ids `…01` and `…02` → Move = [`…01`].
  - credit moves: difference −500; candidate +500 → Move = [that id].
  - S179 rounding: difference 1, lineCount 40, no candidate of ±1 → Move nil, Rounding true.
  - no explanation: difference 5000, lineCount 40, candidates −713 → Move nil, Rounding false.
  - zero difference → empty explanation.
  - 25 candidates: only the 20 latest enter the search (a match only among the 5 oldest yields nil).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement.** Sort candidates by date descending, then transaction id ascending; keep the first 20. A posting moved contributes `−Amount` to the reduction. Search subsets by increasing size; within a size, the first subset in lexicographic order of sorted indexes wins (this prefers latest dates and lowest ids). Bitmask enumeration over at most 2^20 subsets is the bound.

- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(ledger): find the postings that explain a statement difference`.

### Task 5: Proposal and move operation (A137, S177)

**Files:**
- Modify: `internal/ledger/internal/app` statement detail assembly (fill `Explanation` when the statement is closed, holds a fact, is not reconciled and differs; candidates are its provisional charges and credits)
- Create: `internal/ledger/internal/app/defer_postings.go` (`DeferPostings`)
- Modify: `api/openapi.yaml`: `StatementDetail.difference_proposal` (optional object: `transaction_ids` uuid array, `amount` Money) and `rounding_difference` (optional boolean); new operation `POST /api/card-statements/{id}/defer` (`deferStatementPostings`, body `{transaction_ids: [uuid]}`, 200 `StatementDetail`), following the path style of the existing reconcile operation
- Modify: `internal/ledger/internal/adapter/httpapi/statements.go`, `internal/server/tool_exposure_test.go`
- Test: `internal/ledger/card_scenarios_test.go` (S177, S179), problem-code tests

**Interfaces:**
- Consumes: `domain.ExplainDifference`, `domain.Provisional`, basis `owner`.
- Produces: `func (s *Service) DeferPostings(ctx context.Context, userID int64, statementID uuid.UUID, txIDs []uuid.UUID) error` — each transaction's card posting on the statement is corrected to the next statement with basis `owner`, through `CorrectTransaction` so a version is recorded. Problems: `statement_reconciled` (409) when the statement is reconciled; `posting_not_on_statement` (422) when a transaction has no posting on it.

- [ ] **Step 1: Failing test `TestStatementDifferenceProposal_S177`.** Card closing day 29; imported cleared charge −7.13 on 2026-10-23 with bill due 2026-11-05 (basis `institution`), manual −7.13 on 2026-10-28; owner facts total = amount due − 7.13; today 2026-10-30. GET detail: `difference_proposal.transaction_ids` = [manual charge], amount 7.13. POST defer with that id → 200; detail `amount_difference` = 0; the charge is on statement 2026-12.
- [ ] **Step 2: Failing tests** `TestStatementRoundingDifference_S179` (fact differs by 0.01, no 0.01 posting → `rounding_difference: true`, no proposal), `TestDeferReconciled` (409 `statement_reconciled`), `TestDeferForeignPosting` (422 `posting_not_on_statement`).
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement**, `make gen`, add the tool exposure entry. **Step 5: Run** `go test ./internal/ledger/... ./internal/server/...` — PASS.
- [ ] **Step 6: Docs** `05-domain-model.md` (A137 row after "Settlement"), `06-scenarios.md` (S177, S179). **Commit** `feat(ledger): propose and move the postings a statement difference names`.

### Task 6: Web: provisional tag, proposal action, statement choice

**Files:**
- Modify: `web/src/features/cards/statement-page.tsx` / `statement-lines.tsx` (tag "Fatura provisória" with description "O banco ainda não confirmou em qual fatura este lançamento entra."), a new `difference-proposal.tsx` beside them (alert with the amount, the named postings and the action "Mover para a fatura seguinte"; rounding text "Diferença de arredondamento do banco: {amount}.")
- Modify: `web/src/features/cards/api.ts` (mutation `deferStatementPostings`)
- Modify: `web/src/features/transactions/transaction-form.tsx` and its draft (`form-draft.ts`): for a card charge dated within 10 days before the predicted closing, a choice between the predicted statement and the next one, sent as `PostingInput.statement`; follow the pattern of `foreign-form.tsx:305`
- Modify: pt-BR and en catalogs
- Test: `difference-proposal.test.tsx`, `form-draft.test.ts` (choice shown only inside the window)

- [ ] **Step 1:** read `web/CLAUDE.md`; run the `compose-screen` skill for the statement page change.
- [ ] **Step 2: Failing tests** for the proposal component (renders the action only with `difference_proposal`; rounding text only with `rounding_difference`) and for the draft (window boundary 10 days inclusive).
- [ ] **Step 3: Run** `cd web && pnpm vitest run src/features/cards src/features/transactions` — FAIL. **Step 4: Implement.** **Step 5: Run** the tests and `make web-check` — PASS.
- [ ] **Step 6: Commit** `feat(web): show provisional statements and move a difference's postings`.

Slice 2 ends: `make check`; write `.claude/progress/current.md`.

## Data correction (owner's database, after Slice 2)

With the owner's confirmation in the session: on statement 2026-11 of Nubank Gold, record the owner fact 1,238.65 (if absent) and accept the proposal through the UI; the manual 7.13 of 2026-10-28 moves to 2026-12.
