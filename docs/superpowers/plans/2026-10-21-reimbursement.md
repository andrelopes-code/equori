# Reimbursement of a recorded expense Implementation Plan

> **Superseded** by `2026-10-21-reimbursement-allocations.md`: tasks 1 to 3 were delivered uncommitted; the single-expense operation is replaced by allocations.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An incoming transaction that repays an expense already recorded becomes a reimbursement of that expense in one confirmation, with the expense netted to its true amount.

**Architecture:** One ledger operation applies a reimbursement to the incoming transaction: its category side becomes negative postings on the expense's categories (the shape `RefundPurchase` gives a card refund, A6) and a `reimbursement_of` link is stored. A second operation lists the expenses the incoming transaction can reimburse, ranked. The transaction detail screen proposes the best candidate and confirms it in one click.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen, React, TypeScript, Slotted.

**Spec:** Section Design below. The owner skipped the discovery questions; every default in Design is a decision of this plan.

## Motivation

Owner case, 2026-10-21. Transaction `01a14f07-1b9a-768a-b469-59c49408dc0f` (2026-10-17, `Pix enviado … EVERTON DE ALMEIDA SANTOS`, 15.00 from Mercado Pago) was categorized automatically as `Pix para pessoas`. Transaction `01a15f45-7053-740e-9ba8-8944791511f8` (2026-10-20, `Transferência Recebida|Esther Louise Silva Lopes`, 15.00 into Nubank) sits on `Receita sem categoria`. The second repays the first. Today the owner can only set a category on the second, which counts 15.00 as income and leaves the 15.00 expense standing.

## Design

- **Operation `reimburseTransaction`**: `POST /transactions/{id}/reimbursement`, body `ReimbursementInput {expected_version, original_id, category_id?}`, response `200` with the updated `Transaction`. `{id}` is the incoming transaction R, `original_id` the expense E.
- **Effect, in one database transaction**: (1) R's category postings are replaced by negative postings on E's expense categories, allocated by `domain.Allocate` over E's positive category amounts, summing to R's category total; (2) a `reimbursement_of` link R → E is stored; (3) when `category_id` is set, E's category postings are first replaced by one posting on that expense category (`wholeCategory`, A78) so both sides use it. Events: `EventTransactionCategorized` for R and, when recategorized, for E, with `Cause{Method: MethodManual}`.
- **Preconditions** (all `422` through `validationError` unless stated): R and E belong to the user (`404` otherwise) and differ; neither is voided (`ErrVoided`); R's category side is an inflow (category postings sum below zero), otherwise `ErrNotCategorizable`; E has expense-class category postings summing above zero; R, E and `category_id` share one currency; `category_id` is an expense account open on E's date; `|R total| ≤ E total − reimbursed(E)`, where `reimbursed(E)` is the absolute sum of expense-class postings of non-voided transactions linked `reimbursement_of` to E; R is not already linked to E; `expected_version` equals R's version (`409`).
- **Operation `listReimbursementCandidates`**: `GET /transactions/{id}/reimbursement-candidates` returns `ReimbursementCandidateList {items: [{transaction, remaining}]}`. Candidates: non-voided transactions other than R, dated from R.date − 90 days through R.date, with expense-class category postings and `remaining > 0`. Order: `remaining == |R total|` first, then date descending, then id descending. At most 10. Empty when R is not an inflow.
- **Screen**: the detail panel of an inflow whose category is uncategorized, with a first candidate whose `remaining` equals the amount, shows a suggestion row: description and date of the expense, a `Confirm reimbursement` button and a `Choose another` button. The action menu of every inflow offers `Mark as reimbursement`, which opens a dialog listing the candidates (best preselected) and an optional category field. Confirming calls `reimburseTransaction` and closes the dialog.
- **Non-goals**: reimbursement through receivable accounts (S18 stays as is); a reimbursement larger than the remaining amount; reimbursement of card purchases (`refundTransaction` stays); undoing a reimbursement (void R and record again); keeping R's postings in step when E is recategorized later (documented as a limitation in A117).

## Global Constraints

- Everything is English: identifiers, files, comments, tests, docs, commit messages, UI source strings in `catalog.en.ts`; the Brazilian Portuguese strings go in `catalog.pt-BR.ts`.
- `*.gen.go`, `*.gen.ts` and `internal/**/api.gen.go` are regenerated with `make gen`, never edited.
- A behavior change starts with a failing test that was run and read. No test is loosened or deleted.
- Money is an integer plus an instrument code; never `float64`.
- Every query filters by `user_id` (ADR 003). Errors are RFC 9457 problems through `internal/platform/problem`.
- Web: rules O1–O8 and Slotted feedback of `web/CLAUDE.md`; JSX has no literal text; file names are kebab-case; one component per file.
- A new operation has an entry in `internal/server/tool_exposure_test.go`.
- Commits: Conventional Commits, scope `ledger`/`api`/`web`, no tool names.
- The working tree already holds unrelated uncommitted changes (`git status`). Before Task 1 the owner commits or stashes them, or the task commits only its own hunks with `git add -p`.

## Review Focus

- Voiding R after the reimbursement frees E's remaining amount (voided links do not count). Test in Task 1.
- A second inflow larger than the remaining amount of E is rejected, naming both totals. Test in Task 1.
- A foreign-currency expense is rejected with a field error on `original_id`. Test in Task 1.
- Recategorizing E afterwards leaves R's postings on the old category; the behavior is pinned, not changed. Test in Task 1.
- Candidates exclude expenses fully reimbursed, voided, dated after R and income-category transactions. Test in Task 2.

---

### Task 1: Reimbursement operation (domain, application, persistence, HTTP, scenario S113)

**Files:**
- Modify: `docs/domain/06-scenarios.md` (S113, in section 6.5 after S20; update the coverage paragraph near line 413), `docs/domain/03-domain-flows.md` (`ReimbursementReceived` row, section 3.10), `docs/domain/05-domain-model.md` (amendment A117 in the place the other amendments live)
- Modify: `api/openapi.yaml`, then `make gen`
- Create: `internal/ledger/internal/domain/reimburse.go`, `internal/ledger/internal/domain/reimburse_test.go`
- Create: `internal/ledger/internal/app/reimburse.go`
- Modify: `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/adapter/postgres/repository.go`, `db/queries/ledger/transaction.sql`, `internal/ledger/internal/adapter/httpapi/server.go`, `internal/ledger/ledger.go` (only if the public API must expose the method), `internal/server/tool_exposure_test.go`
- Test: `internal/ledger/reimbursement_test.go` (through `internal/apitest`)

**Interfaces:**
- Produces: `func (t Transaction) Reimburse(expectedVersion int, original Transaction, alreadyReimbursed int64, accounts map[uuid.UUID]Account) (Transaction, error)` in `domain`; returns the next version of t with category postings replaced and `Links` holding `{LinkReimbursementOf, original.ID}`.
- Produces: `type ReimbursementRequest struct { TransactionID, OriginalID uuid.UUID; ExpectedVersion int; CategoryID uuid.UUID; Cause Cause }` and `func (s *Service) Reimburse(ctx context.Context, userID int64, req ReimbursementRequest) (domain.Transaction, error)` in `app`.
- Produces: `Repository.AddLink(ctx context.Context, userID int64, from, to uuid.UUID, t domain.LinkType) error` and `Repository.ReimbursedTotal(ctx context.Context, userID int64, originID uuid.UUID) (int64, error)` in `app/ports.go`, implemented in `postgres`.

- [ ] **Step 1: Write the scenario text** S113 in `docs/domain/06-scenarios.md`: Mercado Pago −15.00 / Car +15.00 (expense, 2026-10-17); Nubank +15.00 / Uncategorized income −15.00 (2026-10-20); after reimbursement Nubank +15.00 / Car −15.00, link `reimbursement_of`, Car total for October 0.00. Add A117 (rule, preconditions, limitation on later recategorization) and update `ReimbursementReceived` in 03.

- [ ] **Step 2: Write the failing API tests** in `internal/ledger/reimbursement_test.go`. Names and assertions:
  - `TestReimbursementNetsExpense_S113`: records both transactions through `h.Record`, calls `POST /transactions/{R}/reimbursement` with `{expected_version: 1, original_id: E}`, asserts status `200`; R postings are `{nubank: +1500, car: -1500}`; R links hold `{type: "reimbursement_of", target: E}`; E gains an inbound `LinkReference` of the same type; the category report for October shows Car `0`.
  - `TestReimbursementPartialAndCeiling_S113`: E = 1500; R1 = 1000 reimburses (200); R2 = 500 reimburses (200); R3 = 100 returns `422` and the problem detail contains `1600` and `1500`.
  - `TestReimbursementRecategorizesBoth_S113`: with `category_id` = Maintenance, E and R both end on Maintenance; Car has no postings left.
  - `TestReimbursementVoidFreesRemaining_S113`: reimburse R1 (1500), void R1, reimburse R2 (1500) returns `200`.
  - `TestReimbursementRejects_S113`: table with status and `errors[].field`: voided R → `422`; voided E → `422`; R is an outflow → `422`; E is income-category → `422` on `original_id`; same transaction → `422` on `original_id`; foreign-currency E → `422` on `original_id`; stale `expected_version` → `409`; unknown `original_id` → `404`; same pair twice → `422`.
  - `TestReimbursementThenRecategorizeOriginalKeepsReimbursement_S113`: `categorizeTransaction` on E to another category returns `200` and R keeps its negative posting on the old category.
  - Each status is checked before the body is decoded.

- [ ] **Step 3: Run `go test ./internal/ledger -run Reimbursement`**. Expected: FAIL, route not found or compile error on the missing operation.

- [ ] **Step 4: Write the failing domain test** `TestReimburse` in `reimburse_test.go`: allocation over two expense postings (1000 and 500, reimbursing 300 gives −200 and −100), the ceiling error, the inflow check, the currency check. Run `go test ./internal/ledger/internal/domain -run TestReimburse`; expected FAIL, `Reimburse` undefined.

- [ ] **Step 5: Implement `Transaction.Reimburse`** in `domain/reimburse.go`. It collects expense-class positive postings of `original`, checks the preconditions of Design in the order listed, builds `[]CategoryPart` from `Allocate(|total|, shares)` with negated amounts, and returns `t.Categorize(Categorization{ExpectedVersion: expectedVersion, Parts: parts}, accounts)` with `Links` appended. Errors use `invalid(field, message)`; the ceiling message reads `reimbursements would total %d, above the expense %d`.

- [ ] **Step 6: Add the contract.** In `api/openapi.yaml` add the path `/transactions/{id}/reimbursement` (tag `ledger`, responses `200`, `400`, `401`, `404`, `409`, `422`) and the schema `ReimbursementInput` (`additionalProperties: false`, required `expected_version`, `original_id`). Run `make gen`.

- [ ] **Step 7: Implement persistence.** `db/queries/ledger/transaction.sql`: `-- name: ReimbursedTotal :one` summing `-p.amount` over postings of expense-class accounts, non-voided, of transactions that link `reimbursement_of` to `$2`, filtered by `user_id`. `AddLink` wraps the existing `InsertLink`. Run `make gen`.

- [ ] **Step 8: Implement `Service.Reimburse`** in `app/reimburse.go`: `InTx`; lock R and E in ascending id order; load accounts of both plus `CategoryID`; when `CategoryID` is set call `wholeCategory` on E and `Categorize` it (publish `EventTransactionCategorized`); call `Transaction.Reimburse`; `ReplaceCategoryPostings(prev, next, reasonCategorized)`; `AddLink`; publish `EventTransactionCategorized` with `newTransactionEvent(next, accounts, prev)` and `Cause`.

- [ ] **Step 9: Implement the handler** `ReimburseTransaction` in `adapter/httpapi/server.go` next to `TransferTransaction`: `auth.MustUserID`, `Cause{Method: app.MethodManual}`, response `ReimburseTransaction200JSONResponse{toTransactionAPI(t)}` after `s.svc.Transaction`.

- [ ] **Step 10: Add exposure entries** `"reimburseTransaction": "-write"` and `"listReimbursementCandidates": "-pending"` to `internal/server/tool_exposure_test.go`.

- [ ] **Step 11: Run** `go test ./internal/ledger/... ./internal/server/...`. Expected: PASS. Then `make check-commit`; expected PASS.

- [ ] **Step 12: Commit** `feat(ledger): reimburse a recorded expense with an incoming transaction`; body names S113 and A117.

### Task 2: Reimbursement candidates

**Files:**
- Modify: `api/openapi.yaml`, `db/queries/ledger/transaction.sql`, `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/adapter/postgres/repository.go`, `internal/ledger/internal/adapter/httpapi/server.go`; then `make gen`
- Create: `internal/ledger/internal/app/reimbursement_candidates.go`
- Test: `internal/ledger/reimbursement_candidates_test.go`

**Interfaces:**
- Consumes: `Repository.ReimbursedTotal` and the preconditions of Task 1.
- Produces: `type ReimbursementCandidate struct { Transaction domain.Transaction; Remaining int64 }`; `func (s *Service) ReimbursementCandidates(ctx context.Context, userID int64, id uuid.UUID) ([]ReimbursementCandidate, error)`; `Repository.ReimbursementCandidates(ctx context.Context, q CandidateQuery) ([]ReimbursementCandidateRow, error)` with `CandidateQuery{UserID int64; ExcludeID uuid.UUID; From, To time.Time; Limit int}`.
- Produces (API): `listReimbursementCandidates`, schemas `ReimbursementCandidate {transaction: Transaction, remaining: Money}` and `ReimbursementCandidateList {items}`.

- [ ] **Step 1: Write failing API tests** `TestReimbursementCandidates_S113`:
  - exact-amount expense ranks first over a newer partial match; ordering by date descending then id descending after that;
  - excludes: fully reimbursed, voided, dated after R, dated 91 days before R, income-category transactions, R itself;
  - includes an expense dated exactly 90 days before R;
  - `remaining` equals E total minus reimbursed (1500 − 1000 → 500);
  - returns `[]` (not `null`) when R is an outflow;
  - `404` for an unknown id; every status is checked before decoding.

- [ ] **Step 2: Run `go test ./internal/ledger -run ReimbursementCandidates`**. Expected: FAIL.

- [ ] **Step 3: Implement the query** `ListReimbursementCandidates` in `transaction.sql`: expense-class positive postings grouped by transaction, minus the reimbursed total computed with the same predicate as `ReimbursedTotal`, filtered by `user_id`, date window, `NOT voided`, `ORDER BY` the ranking of Design applied in Go after the query (the SQL orders by `date DESC, id DESC` and limits to 50 rows). Run `make gen`.

- [ ] **Step 4: Implement `Service.ReimbursementCandidates`**: loads R, returns an empty slice when R is voided or its category side is not an inflow, applies the window `R.Date − 90 days … R.Date`, moves candidates with `Remaining == |R total|` first (stable), truncates to 10.

- [ ] **Step 5: Add the path, schemas and handler**, then `make gen`. Run `go test ./internal/ledger/... ./internal/server/...`; expected PASS; `make check-commit`; expected PASS.

- [ ] **Step 6: Commit** `feat(ledger): list the expenses an incoming transaction can reimburse`.

### Task 3: Web: suggestion, dialog and menu action

**Files:**
- Modify: `web/src/features/transactions/api.ts`, `web/src/features/transactions/detail-actions.tsx`, `web/src/features/transactions/transaction-detail.tsx`, `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`
- Create: `web/src/features/transactions/reimbursement-suggestion.tsx`, `web/src/features/transactions/reimbursement-dialog.tsx`
- Test: `web/src/features/transactions/reimbursement-suggestion.test.tsx`, `web/src/features/transactions/reimbursement-dialog.test.tsx`, `web/src/features/transactions/api.test.ts`

**Interfaces:**
- Consumes: `POST /transactions/{id}/reimbursement` and `GET /transactions/{id}/reimbursement-candidates` from `schema.gen.ts` (regenerated by `make gen`).
- Produces: `reimbursementCandidatesQuery(api: Client<paths>, id: string)`; `useReimburseTransaction()` with variables `{ current: Transaction; originalId: string; categoryId?: string }`, which calls `mutated(queryClient, current, result)` like `useTransferTransaction`; `ReimbursementSuggestion({ transaction })`; `ReimbursementDialog({ transaction, open, onOpenChange })`.

- [ ] **Step 1: Read the guidance.** `web/node_modules/@slotted/react/dist/docs/index.md`, the `compose-screen` skill, and the families used (`dialog`, `radio-group`, `select`, `button`, `inline-message`). Reuse `ui/money-input` formatting helpers and the `account-field` category picker if one exists for categories; otherwise `Select`, as `transfer-dialog.tsx` does.

- [ ] **Step 2: Write failing tests.**
  - `api.test.ts`: `useReimburseTransaction` sends `POST /transactions/{id}/reimbursement` with exactly `{expected_version, original_id}` and adds `category_id` only when set.
  - `reimbursement-suggestion.test.tsx`: renders the expense description, date and amount and a `Confirm reimbursement` button when the first candidate's `remaining` equals the amount; clicking it posts `{expected_version: 1, original_id: "<id>"}` and shows the success toast; renders nothing without candidates, with a non-exact first candidate, for an outflow and for an already categorized transaction; shows the problem text of a `422`.
  - `reimbursement-dialog.test.tsx`: lists candidates with the best preselected; selecting another candidate changes `original_id`; the category field is optional and its value is sent as `category_id`; the confirm button is disabled without a selection; a `409` shows the problem text.

- [ ] **Step 3: Run `cd web && pnpm vitest run src/features/transactions/reimbursement`**. Expected: FAIL, modules missing.

- [ ] **Step 4: Implement** `reimbursementCandidatesQuery` and `useReimburseTransaction` in `api.ts`; `ReimbursementSuggestion` and `ReimbursementDialog` (one component per file, text through `useT()`, CSS only if needed in a co-located `*.module.css` under `@layer app`); the `Mark as reimbursement` item in `detail-actions.tsx` (shown for inflows, beside `detail.transfer`); the suggestion row placed above the category section in `transaction-detail.tsx` and the dialog mounted beside `TransferDialog`.

- [ ] **Step 5: Add strings** `reimbursement.*` and `detail.reimburse` to both catalogs; pt-BR copy: `Parece um reembolso de {description} ({date}, {amount})`, `Confirmar reembolso`, `Escolher outra`, `Marcar como reembolso`, `Despesa reembolsada`, `Categoria da despesa (opcional)`.

- [ ] **Step 6: Run** `cd web && pnpm vitest run src/features/transactions`; expected PASS. Then `make web-check`; expected PASS. Then `make check-commit`; expected PASS.

- [ ] **Step 7: Verify in the running app** with `make run-dev` and a Playwright script that closes the browser in `finally`: open `/transactions`, select the 2026-10-20 `Esther Louise Silva Lopes` transaction, confirm the suggestion shows the 2026-10-17 `Pix enviado` expense, click `Confirm reimbursement`, and read the category report for October. At most four screenshots.

- [ ] **Step 8: Report `Slotted findings`** per `web/CLAUDE.md`, or state that none arose.

- [ ] **Step 9: Commit** `feat(web): propose and confirm a reimbursement from the transaction detail`.
