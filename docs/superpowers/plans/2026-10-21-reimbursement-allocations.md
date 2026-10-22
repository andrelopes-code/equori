# Reimbursement allocations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One incoming transaction repays any number of recorded expenses, and one expense is repaid by any number of incoming transactions, with exact amounts per pair.

**Architecture:** A reimbursement is a set of allocations `(expense, amount)` on an incoming transaction R. The set is stored as `reimbursement_of` links that carry the amount. The operation replaces the whole set of R (like a `PUT`): R's category side becomes negative postings on the categories of each expense, in proportion to that expense's category amounts, plus the unallocated remainder on the uncategorized income account. Two read operations rank what R can repay and what can repay an expense.

**Tech Stack:** Go, PostgreSQL, goose, sqlc, oapi-codegen, React, TypeScript, Slotted.

**Spec:** Section Design. It supersedes `docs/superpowers/plans/2026-10-21-reimbursement.md`, whose single-expense operation (uncommitted) is replaced. Scenario S113 and amendment A117 are rewritten, S114 is added.

## Design

- **Allocation**: `(original_id, amount, category_id?)`. `amount` is positive, in the currency of R's category side and of the expense.
- **Operation `reimburseTransaction`**: `POST /transactions/{id}/reimbursement`, body `ReimbursementInput {expected_version, allocations}` (0 to 20 items), response `200` with the stored `Transaction`. In one database transaction: lock R and every expense in ascending id order; for each allocation with `category_id`, move the expense's category postings to that expense category (`wholeCategory`, A78); replace R's `reimbursement_of` links by the new set; replace R's category postings by, for each allocation, `Allocate(amount, expense category amounts)` negated on those categories, plus `−(inflow − Σ amounts)` on the uncategorized income account when positive.
- **Rules** (`422` through `validationError`, field in brackets): R and every expense exist for the user (`404`); none is voided (`409 transaction_voided`); `expected_version` equals R's (`409`); R's category side is an inflow in one currency, else `not_categorizable`; each amount is positive and in that currency [`allocations[i].amount`]; an expense is not R and appears once [`allocations[i].original_id`]; an expense has expense-class positive postings in that currency [`allocations[i].original_id`]; `amount ≤ expense total − held by other transactions` [`allocations[i].original_id`, message `reimbursements would total %d, above the expense %d`]; `Σ amounts ≤ inflow` [`allocations`]; an empty list is valid only when R already has `reimbursement_of` links, and then returns R's category side to the uncategorized income account [`allocations`].
- **Held by others** = Σ `ledger_link.amount` of non-voided transactions other than R that link `reimbursement_of` to the expense. Links without an amount hold nothing.
- **Operation `listReimbursementCandidates`**: `GET /transactions/{id}/reimbursement-candidates` returns `{items: [{transaction, remaining, allocated}], suggestion?: [uuid]}`. Items: non-voided transactions other than R, in R's currency, with expense-class positive postings, dated from R.date − 90 days through R.date, or already linked from R; `remaining = expense total − held by others` must be positive; `allocated` is R's current amount on it (zero when none). Order: `remaining == inflow` first, then date descending, then id descending; at most 15 plus the linked ones. `suggestion` is the id list (in item order) of the only subset of items whose `remaining` adds up to the inflow exactly; absent when none or several exist, and when R already has links. Empty items when R is not an inflow or is voided.
- **Operation `listReimbursementSources`**: `GET /transactions/{id}/reimbursement-sources` returns `{items: [{transaction, free}]}`. Items: non-voided inflows dated from the expense's date through 90 days after, other than the expense, in its currency, whose category postings are only uncategorized income or negative expense postings, not already linked to the expense, with `free = inflow − Σ link amounts of R > 0`. Order: date ascending, id ascending; at most 10. Empty when the transaction has no expense-class positive posting or is voided.
- **Screen, incoming transaction**: for an uncategorized inflow with candidates, a prompt at the top of the detail. With `suggestion`: "These expenses add up to exactly the amount received: A (50.00) + B (50.00)", buttons `Confirm` (allocates each full `remaining`) and `Choose others`. Without: "Does this repay recent expenses?" and the button `Match to expenses`. The dialog lists candidates with a checkbox and an amount field each; checking fills `min(remaining, unallocated)`; the footer shows allocated, total and leftover; one optional category applies to every checked expense; an inflow that already has links opens with them checked and can clear them. The menu action `Mark as reimbursement` of every inflow opens the same dialog.
- **Screen, expense**: the menu action `Record repayment` of an expense opens a dialog listing the sources (radio) with an amount field filled `min(free, remaining of the expense)`. Confirming sends, for the chosen inflow, its current allocations plus the new one.
- **Non-goals**: matching by names or text; learning payers; currencies other than the expense's; a repayment received before its expense; recategorizing the expense afterwards moves the reimbursement (documented limitation, A117).

## Global Constraints

- Everything is English: identifiers, files, comments, tests, docs, commit messages; Brazilian Portuguese strings only in `catalog.pt-BR.ts`.
- `*.gen.*` files come from `make gen`. A behavior change starts with a failing test that was run and read. No test is loosened or deleted except those of the superseded single-expense operation, which are rewritten.
- Money is an integer plus an instrument code. Every query filters by `user_id`. Errors are RFC 9457 problems.
- Web: rules O1–O8 and Slotted feedback of `web/CLAUDE.md`; domain controls (`ui/money-input`) before families.
- A new operation has an entry in `internal/server/tool_exposure_test.go` and in `web/src/features/admin/operations.ts`.
- The working tree holds unrelated uncommitted changes, including migrations 00034 and 00035. This plan adds migration 00036; the owner renumbers it if those migrations change. No task commits; the owner commits after the final check.

## Review Focus

- Correcting R (`PUT /transactions/{id}`) keeps its reimbursement links with their amounts. Test in Task 1.
- Two expenses on the same category repaid by one inflow keep exact per-expense amounts. Test in Task 2.
- Replacing the allocations of R while another inflow holds part of the same expense uses `held by others`, not the total. Test in Task 2.
- Voiding R frees what it held on every expense. Test in Task 2.
- A repeated request with the same allocations changes nothing but the version. Test in Task 2.
- A suggestion exists only when exactly one subset adds up. Test in Task 3.

---

### Task 1: Amount on reimbursement links

**Files:**
- Create: `db/migrations/00036_ledger_link_amount.sql`, `internal/ledger/link_amount_schema_test.go`
- Modify: `db/queries/ledger/transaction.sql`, `internal/ledger/internal/domain/transaction.go` (`Link`, validation), `internal/ledger/internal/adapter/postgres/mapping.go` (`snapshotLink`, link mapping), `internal/ledger/internal/adapter/postgres/repository.go`, `internal/ledger/internal/adapter/httpapi/convert.go`, `api/openapi.yaml`; then `make gen`
- Test: `internal/ledger/internal/domain/transaction_test.go`, `internal/ledger/link_amount_test.go`

**Interfaces:**
- Produces: `domain.Link{Type LinkType; Target uuid.UUID; Amount int64}`; zero means none. `NewTransaction` rejects `Amount != 0` on a type other than `reimbursement_of` and a negative amount (`links[i].amount`).
- Produces: API `Link.amount` and `LinkReference.amount` (optional `Money`, in the balancing currency of the transaction that holds the link), accepted on `Link` and returned on both.
- Produces: column `ledger_link.amount bigint`, `CHECK (amount IS NULL OR (amount > 0 AND link_type = 'reimbursement_of'))`.

- [ ] **Step 1: Write the failing schema test** `TestLinkAmountConstraint` in `link_amount_schema_test.go` (pattern of `reconciliation_schema_test.go`): inserting a `reimbursement_of` link with `amount = 0`, with `amount = -1`, and a `refund_of` link with `amount = 100` is rejected with SQLSTATE `23514`; a `reimbursement_of` link with `amount = 100` and one without amount are accepted. Run `go test ./internal/ledger -run LinkAmount`; expected FAIL, column missing.
- [ ] **Step 2: Write the failing API test** `TestReimbursementLinkAmountRoundTrips` and `TestCorrectKeepsReimbursementLinkAmount` in `link_amount_test.go`: `POST /transactions` with an inflow carrying `links: [{type: "reimbursement_of", target: E, amount: BRL(1000)}]` returns the link with `amount` 1000 on `GET`; `PUT /transactions/{id}` echoing the links keeps 1000; a `refund_of` link with an amount returns `422` on `links[0].amount`; `GET /transactions/{E}` returns `referenced_by` with the same amount. Expected: FAIL.
- [ ] **Step 3: Write the migration** adding the column and constraint, with a `Down` that drops them. Update `InsertLink` to take `amount` and `ListLinksFrom`/`LinksTo` mapping to return it; add `Amount` to `snapshotLink` (`json:"amount,omitempty"`) so versions keep it.
- [ ] **Step 4: Implement** `Link.Amount`, the validation in `NewTransaction`, the OpenAPI `Link.amount`, and the conversions. `make gen`.
- [ ] **Step 5: Run** `go test ./internal/ledger/... ./internal/server/...`; expected PASS. `make fmt-check lint`; expected PASS.

### Task 2: Allocations operation

**Files:**
- Modify: `internal/ledger/internal/domain/reimburse.go` and `reimburse_test.go` (rewritten), `internal/ledger/internal/app/reimburse.go`, `ports.go`, `postgres/repository.go`, `db/queries/ledger/transaction.sql`, `httpapi/server.go`, `api/openapi.yaml`, `internal/ledger/reimbursement_test.go` (rewritten); then `make gen`
- Modify: `docs/domain/06-scenarios.md` (S113 rewritten, S114 added), `docs/domain/05-domain-model.md` (A117 rewritten), `docs/domain/03-domain-flows.md`

**Interfaces:**
- Consumes: `domain.Link.Amount`.
- Produces: `type Allocation struct { Original Transaction; Amount, HeldByOthers int64 }` and `func (t Transaction) Reimburse(expectedVersion int, allocations []Allocation, uncategorized Account, accounts map[uuid.UUID]Account) (Transaction, error)` in `domain`.
- Produces: `type AllocationRequest struct { OriginalID, CategoryID uuid.UUID; Amount int64 }`; `ReimbursementRequest{TransactionID uuid.UUID; ExpectedVersion int; Allocations []AllocationRequest; Cause Cause}`; `Service.Reimburse(ctx, userID, req) (domain.Transaction, error)`.
- Produces: `Repository.ReimbursedTotal(ctx, userID int64, originID, exceptFrom uuid.UUID) (int64, error)` and `Repository.SetReimbursementLinks(ctx, userID int64, from uuid.UUID, links []domain.Link) error`; `AddLink` is removed.

- [ ] **Step 1: Write the failing API tests** in `reimbursement_test.go`, helper `reimburse(h, id, version, allocs ...map[string]any)`; every status is checked before the body is decoded:
  - `TestReimbursementTwoExpensesOneInflow_S114`: expenses A 5000 and B 5000 on the same category, inflow 10000, allocations `(A,5000),(B,5000)`; R postings `{bank +10000, car −10000}`; links hold amount 5000 each; the October category report shows 0.
  - `TestReimbursementHalfOfAnExpense_S114`: expense 20000, inflow 10000 with `(E,10000)`; `listReimbursementCandidates` of a second inflow of 10000 shows `remaining` 10000; its allocation `(E,10000)` returns `200`; a third of 100 returns `422` on `allocations[0].original_id` naming `20100` and `20000`.
  - `TestReimbursementLeftoverStaysUncategorized_S114`: expense 10000, inflow 12000, `(E,10000)`; R postings `{bank +12000, car −10000, uncategorized_income −2000}`.
  - `TestReimbursementReplaceUsesHeldByOthers_S114`: E 20000; R1 holds 10000; R2 sets `(E,10000)` then `(E,10000)` again returns `200` and the version moves by one each time, links unchanged.
  - `TestReimbursementEmptyListUndoes_S114`: after `(E,10000)`, an empty list returns R to `{bank +10000, uncategorized_income −10000}` with no links; an empty list on an unlinked R returns `422` on `allocations`.
  - `TestReimbursementVoidFreesRemaining_S114`: voiding R frees its amount for another inflow.
  - `TestReimbursementCategoryMovesExpense_S114`: `category_id` on an allocation moves the expense and the reimbursement to it.
  - `TestReimbursementRejects_S114` (table): voided R `409 transaction_voided`; voided expense `409`; outflow `422 not_categorizable`; income original, same transaction, foreign-currency original, duplicate expense, amount zero, amount above the inflow in total (`allocations`), stale version `409`, unknown expense `404`, unknown R `404`.
  - `TestReimbursementThenRecategorizeOriginalKeepsReimbursement_S114`: pins the documented limitation.
  Expected: FAIL (`allocations` unknown).
- [ ] **Step 2: Write the failing domain test** `TestReimburse` in `reimburse_test.go`: allocation over two categories, per-expense amounts, remainder on the uncategorized income account, links replaced (an old `reimbursement_of` link disappears, a `refund_of` link stays), and each rule of Design with its field. Expected: FAIL.
- [ ] **Step 3: Contract.** Replace `ReimbursementInput` by `{expected_version, allocations: [ReimbursementAllocation]}` and add `ReimbursementAllocation {original_id, amount: Money, category_id?}`; update the operation description. `make gen`.
- [ ] **Step 4: Implement `Transaction.Reimburse`** in `domain/reimburse.go` with the rules of Design in the order listed; it builds `[]CategoryPart` and returns `t.Categorize(...)` with `Links` set.
- [ ] **Step 5: Implement persistence.** Query `ReimbursedTotal` sums `ledger_link.amount` of links `reimbursement_of` to `$2` from transactions with `voided_at IS NULL` and `from_transaction_id <> $3`; `SetReimbursementLinks` deletes `reimbursement_of` links from the transaction and inserts the new ones.
- [ ] **Step 6: Implement `Service.Reimburse`** (lock order, per-allocation recategorization, held by others, `SystemAccount(ctx, userID, domain.RoleUncategorizedIncome)`, `ReplaceCategoryPostings`, `SetReimbursementLinks`, categorized events) and the handler.
- [ ] **Step 7: Rewrite the docs**: S113 (one expense) and S114 (the table of cases of the owner conversation: 2×50 ← 100; 200 ← 100 + 100; 120 for 100; 100 for 40 and 80), A117 with the rules and the limitation.
- [ ] **Step 8: Run** `go test ./internal/ledger/... ./internal/server/...`; expected PASS. `make fmt-check lint`; expected PASS.

### Task 3: Candidates, suggestion and sources

**Files:**
- Modify: `api/openapi.yaml`, `db/queries/ledger/transaction.sql`, `internal/ledger/internal/app/ports.go`, `reimbursement_candidates.go`, `postgres/repository.go`, `httpapi/server.go`, `internal/ledger/reimbursement_candidates_test.go` (rewritten), `internal/server/tool_exposure_test.go`; then `make gen`
- Create: `internal/ledger/internal/app/reimbursement_sources.go`, `internal/ledger/internal/domain/subset.go`, `internal/ledger/internal/domain/subset_test.go`, `internal/ledger/reimbursement_sources_test.go`

**Interfaces:**
- Produces: `func ExactSubset(values []int64, target int64) ([]int, bool)` in `domain`: the indexes of the only subset (size ≥ 1) of at most 20 values that adds up to target, in ascending order; false when there is none or several.
- Produces: `ReimbursementCandidate{Transaction domain.Transaction; Remaining, Allocated money.Money}`, `Service.ReimbursementCandidates(ctx, userID, id) (candidates []ReimbursementCandidate, suggestion []uuid.UUID, err error)`.
- Produces: `ReimbursementSource{Transaction domain.Transaction; Free money.Money}`, `Service.ReimbursementSources(ctx, userID, id) ([]ReimbursementSource, error)`.

- [ ] **Step 1: Write the failing tests.** `subset_test.go`: `TestExactSubset` table (`[50,50]` target 100 → `[0,1]`; `[50,50,100]` target 100 → none, two subsets; `[30,70,100]` target 100 → none; `[40,60]` target 50 → none; empty → none; 21 values → none). `reimbursement_candidates_test.go`: ranking and exclusions of the previous tests kept with the new `remaining`; `TestReimbursementCandidatesSuggestion_S114` (two expenses of 5000 and an inflow of 10000 give `suggestion` of both; a third expense of 10000 makes it absent; a single exact expense gives a one-item suggestion; none once R has links); `TestReimbursementCandidatesAllocated_S114` (R's own allocation appears in `allocated` and does not reduce `remaining`; a linked expense older than 90 days still appears). `reimbursement_sources_test.go`: `TestReimbursementSources_S114` (free = inflow − allocated; excludes voided, outflows, inflows categorized as income, inflows already linked to the expense, inflows before the expense date or beyond 90 days; empty for an income transaction). Expected: FAIL.
- [ ] **Step 2: Implement `ExactSubset`** by enumerating bitmasks; nothing else in `domain/subset.go`.
- [ ] **Step 3: Contract.** Add `allocated` to `ReimbursementCandidate`, `suggestion` to `ReimbursementCandidateList`, the path `/transactions/{id}/reimbursement-sources` (`listReimbursementSources`) with `ReimbursementSource {transaction, free}` and `ReimbursementSourceList`; exposure entry `"-pending"`. `make gen`.
- [ ] **Step 4: Rewrite the candidates query** to compute `remaining` with `held by others` (links from other transactions, `ledger_link.amount`), `allocated` from R's own links, the window-or-linked predicate, the ranking and the limit; add the sources query with the predicates of Design.
- [ ] **Step 5: Implement the services and handlers.** `suggestion` comes from `domain.ExactSubset` over the first 20 items' `remaining` and the inflow, only when `allocated` is zero everywhere.
- [ ] **Step 6: Run** `go test ./internal/ledger/... ./internal/server/...`; expected PASS. `make fmt-check lint`; expected PASS. Write the checkpoint and end the slice.

### Task 4: Web, incoming transaction

**Files:**
- Modify: `web/src/features/transactions/api.ts`, `reimbursement.ts`, `reimbursement-suggestion.tsx` (renamed content: the prompt), `reimbursement-dialog.tsx`, `reimbursement-error.ts`, `transaction-detail.tsx`, `web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts`, `web/src/testing/reimbursement-api.ts`, `web/src/features/admin/operations.ts`; tests `reimbursement.test.ts`, `reimbursement-suggestion.test.tsx`, `reimbursement-dialog.test.tsx` (rewritten); then `make gen`

**Interfaces:**
- Consumes: `POST /transactions/{id}/reimbursement` with `allocations`, `GET …/reimbursement-candidates` with `allocated` and `suggestion`.
- Produces: `useReimburseTransaction()` with variables `{ current: Transaction; allocations: { original_id: string; amount: Money; category_id?: string }[] }`; `reimbursementCandidatesQuery(api, id)`; `fillAllocation(remaining: number, unallocated: number): number` (`min`) and `allocationTotals(rows, inflow): { allocated: number; leftover: number }` in `reimbursement.ts`.

- [ ] **Step 1: Read** `node_modules/@slotted/react/dist/docs/index.md`, the `compose-screen` skill, `checkbox.md`, and `src/ui/money-input.tsx`.
- [ ] **Step 2: Write the failing tests.** `reimbursement.test.ts`: `fillAllocation(5000, 10000) = 5000`, `fillAllocation(8000, 3000) = 3000`, `allocationTotals` leftover and over-allocation. `reimbursement-suggestion.test.tsx`: with `suggestion` the prompt names both expenses and their sum and `Confirm` posts `allocations` of the two full remainders; without `suggestion` but with candidates it shows `Match to expenses` and no `Confirm`; nothing for an outflow, a categorized inflow or no candidates; a `422` on `allocations[0].original_id` shows its message. `reimbursement-dialog.test.tsx`: candidates start unchecked; checking one fills `min(remaining, unallocated)`; checking a second fills the leftover; the footer shows allocated, total and leftover; submit posts exactly the checked rows and the optional category on each; an inflow with `allocated` rows opens them checked and an `Clear` action posts an empty list; the submit is disabled with nothing checked or with an over-allocation. Expected: FAIL.
- [ ] **Step 3: Implement** the query and mutation, `reimbursement.ts` helpers, the prompt, the dialog (one component per file; a row component `reimbursement-row.tsx` for checkbox, description and `MoneyInput`), the strings in both catalogs, and the admin operation body `{expected_version: 1, allocations: []}`. `make gen`.
- [ ] **Step 4: Run** `cd web && pnpm vitest run src/features/transactions src/features/admin`; expected PASS. `pnpm exec eslint src` and `pnpm exec prettier --check src`; expected PASS.

### Task 5: Web, expense side, and final checks

**Files:**
- Modify: `web/src/features/transactions/detail-actions.tsx`, `transaction-detail.tsx`, `api.ts`, `reimbursement.ts`, catalogs, `web/src/testing/reimbursement-api.ts`, `web/src/features/admin/operations.ts`
- Create: `web/src/features/transactions/repayment-dialog.tsx`, `web/src/features/transactions/repayment-dialog.test.tsx`

**Interfaces:**
- Consumes: `GET /transactions/{id}/reimbursement-sources`, the `allocations` operation, `Transaction.links[].amount`.
- Produces: `reimbursementSourcesQuery(api, id)`; `expenseState(tx, accounts): { expense: boolean; amount: number }` in `reimbursement.ts`; `RepaymentDialog({ transaction, accounts, scale, open, onOpenChange })`.

- [ ] **Step 1: Write the failing tests** `repayment-dialog.test.tsx`: sources listed with date and free amount, the first radio unchecked; choosing one fills `min(free, remaining of the expense)`; submit posts to `/transactions/{inflow}/reimbursement` the inflow's existing allocations (from its `links` with amounts) plus `(expense, amount)`; the menu offers `Record repayment` for an expense and not for an inflow or a transfer; empty sources show the empty message. Expected: FAIL.
- [ ] **Step 2: Implement** `expenseState`, the sources query, the dialog and the menu action; the remaining of the expense is its expense-class posting total minus the sum of `referenced_by[].amount`.
- [ ] **Step 3: Run the full checks**: `make fmt-check lint`, `make test`, `cd web && pnpm vitest run`, `pnpm exec tsc --noEmit`; report each failure by name and whether it belongs to this plan.
- [ ] **Step 4: Verify in the running app** read-only: open the detail of the owner's incoming `Esther Louise Silva Lopes` transaction and confirm the prompt lists the 17/10 expense, with the browser closed in a `finally` block; no confirmation click without the owner's word.
- [ ] **Step 5: Write the checkpoint** with the exact commit sequence for the owner.
