# Categorization slice 2: merge categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver amendment A75 (merge categories) with its Classification and Planning consumers and scenario S74.

**Architecture:** Ledger `Service.MergeCategories` reuses the per-item `categorize` path (one new version per affected transaction, cause `merge`), moves the children, closes the source and publishes `ledger.categories_merged.v1`. Classification keeps the method of a transaction whose categorization cause is `merge` and rewrites rule actions, suggestions, source mappings and categorization rows in SQL on the merge event. Planning repoints schedules and moves or drops the source budget on the same event.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen; apitests through `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-19-categorization-design.md` (A75, S74).

## Global Constraints

- Worktree `../equori-categorization`, branch `feat/web-categorization` from `feat/web-ledger-sheet` HEAD; commits with `COMPOSE_PROJECT_NAME=equori`; at the end of the slice the commits move to `feat/web-ledger-sheet` by cherry-pick around a stash of the owner's WIP, verified against a backup.
- Test command: `EQUORI_TEST_DATABASE_URL='postgres://equori:equori@127.0.0.1:54329/postgres?sslmode=disable' go test ./internal/<pkg> -run '^<Name>$' -count=1`.
- Event payload `ledger.CategoriesMerged{From, Into uuid.UUID}` with JSON keys `from`, `into`; aggregate id = `from`.
- Cause method for merge versions: `merge` (`app.CauseMerge` in the ledger, the same literal in Classification).
- Problem codes: `validation_failed` on `into`, `system_account` (existing).
- `make gen` after OpenAPI or query changes.

## Review Focus

1. A transaction with postings on both the source and the destination: one destination posting with the sum. Test in Task 1.
2. A split transaction whose other part is on a third category: the third part is unchanged. Test in Task 1.
3. A voided transaction on the source: unchanged and not counted. Test in Task 1.
4. A suggestion whose fingerprint collides after the rewrite: the older stays, the newer is deleted. Test in Task 2.
5. Both categories with a budget: the destination budget and its amounts are unchanged, the source budget is gone. Test in Task 3.

---

### Task 1: Ledger merge

**Files:** `api/openapi.yaml` (`POST /accounts/{id}/merge`, `MergeAccountInput {into}` required, 200 `Account`, 401/404/422), `db/queries/ledger/account.sql` (`TransactionsWithAccount`: ids of non-voided transactions with a posting on the account, ordered by id), `internal/ledger/internal/app/{ports.go,service.go,categorize.go}`, `internal/ledger/internal/adapter/{postgres/repository.go,httpapi/server.go}`, `internal/ledger/ledger.go` (export `EventCategoriesMerged`, `CategoriesMerged`), test `internal/ledger/account_merge_test.go`, docs `05-domain-model.md` 5.2.2.

**Interfaces:**
- Produces: `func (s *Service) MergeCategories(ctx context.Context, userID int64, from, into uuid.UUID) (domain.Account, error)`; `EventCategoriesMerged = "ledger.categories_merged.v1"`; `CauseMerge = "merge"`; repository `TransactionsWithAccount(ctx context.Context, userID int64, accountID uuid.UUID) ([]uuid.UUID, error)`.

- [ ] **Step 1: Failing tests** (`account_merge_test.go`, fixture of `newCategoryTree` plus `travel` and `transport` expense accounts):

| Test | Assert |
|---|---|
| `TestMergeMovesPostingsAndChildren` | food › bakery, food › delivery; tx1 checking −1000, food +600, travel +400; tx2 checking −300, food +300 (voided). Merge food into travel → 200 `Account` travel; tx1 version 2 with one travel posting 1000 (Review Focus 1); tx2 unchanged at version 1 and still on food (Review Focus 3); bakery and delivery have `parent_id` travel; food `closed_on` = today; one `ledger.categories_merged.v1` with `{from: food, into: travel}` |
| `TestMergeKeepsOtherSplitParts` | tx checking −1000, food +700, transport +300 → after merge into travel: travel 700, transport 300 (Review Focus 2) |
| `TestMergeRejections` (table) | self; income into expense; destination closed; destination in the source subtree (bakery); system source (`uncategorized_expense`) → `system_account`; asset account → 422 on `into`; every case leaves the source open |

- [ ] **Step 2:** Run; expect 404 (route missing).
- [ ] **Step 3: Implement.** In `InTx`: load both accounts and `AllAccounts`; validate; for each id of `TransactionsWithAccount(from)` lock the transaction, build `[]domain.CategoryPart` from its income/expense postings with `from` mapped to `into` and equal accounts summed, and call `s.categorize` with `ExpectedVersion` = current version and `Cause{Method: CauseMerge}`; an item error returns as the merge error on field `into`. Move each child (`ParentID = into`, `UpdateAccount`), close `from` on `s.clock.Today()`, publish the event. The handler returns the destination.
- [ ] **Step 4:** Tests pass; `go test ./internal/ledger` passes.
- [ ] **Step 5:** Docs line: "Merging a category moves its postings (one new version per transaction), its children and its references to the destination and closes it (A75)." Commit `feat(ledger): merge a category into another`.

### Task 2: Classification consumers

**Files:** `internal/classification/internal/app/events.go` (cause `merge`), new `internal/classification/internal/app/merge.go`, `db/queries/classification/merge.sql`, `internal/classification/internal/adapter/postgres/repository.go`, `internal/classification/classification.go` (subscription to `ledger.EventCategoriesMerged`), test `internal/classification/merge_test.go`.

**Interfaces:**
- Consumes: `ledger.EventCategoriesMerged`, `ledger.CategoriesMerged` (Task 1).
- Produces: `func (s *Service) HandleCategoriesMerged(ctx context.Context, userID int64, from, into uuid.UUID) error`; repository `MergeCategory(ctx context.Context, userID int64, from, into uuid.UUID) error`.

- [ ] **Step 1: Failing tests:**

| Test | Assert |
|---|---|
| `TestMergeKeepsMethodAndRepointsRules` | `newBooks`; manual tx on travel; rule "Uber" `set_category` travel; split rule with a travel part; merge travel into transport; `dispatch`; categorization method `manual`; both rules name transport in their actions |
| `TestMergeRepointsSourceCategoryAndSuggestions` | source category mapped to travel (insert through `CountSourceCategories` path as `source_category_test` does, or direct SQL in the test); pending suggestion for travel and another for transport with the same match key (two pairs of corrections); after merge and `dispatch`: mapping names transport; one suggestion left, the older (Review Focus 4) |

- [ ] **Step 2:** Run; expect method `manual`→ wrong and rules still naming travel.
- [ ] **Step 3: Implement.** `HandleEvent`: when `e.Cause.Method == causeMerge`, copy the stored record (missing → `errRecordPending`), set the version and date, recompute `CategoryID` with `describeCorrection` when `Corrected`, never call `suggest`. `merge.sql`: delete pending/decided suggestions whose rewritten fingerprint already exists (keeping the older by id); `UPDATE` with `replace(x::text, from::text, into::text)` on `classification_rule.actions`, `classification_suggestion.actions` and `fingerprint`; `UPDATE classification_source_category SET category_id`; `UPDATE classification_categorization SET category_id`. All filtered by `user_id`.
- [ ] **Step 4:** Tests pass; `go test ./internal/classification` passes.
- [ ] **Step 5:** Commit `feat(classification): follow a category merge`.

### Task 3: Planning consumer and S74

**Files:** `db/queries/planning/merge.sql`, planning repository and service (`HandleCategoriesMerged`), `internal/planning/planning.go` (subscription), tests `internal/planning/merge_test.go`, S74 apitest in `internal/classification/merge_test.go`, docs `06-scenarios.md` (S74).

- [ ] **Step 1: Failing tests:** `TestMergeMovesBudgetAndSchedules`: budget on travel, schedule (kind bill) with counterpart travel; merge into transport; `h.Dispatch()`; `GET /budgets` lists one budget naming transport; the schedule's counterpart is transport. `TestMergeDropsSourceBudgetWhenBothHaveOne`: budgets on both; after merge `GET /budgets` lists only the transport budget with its original amounts (Review Focus 5). `TestS74MergeCategories` (classification package): the S74 text.
- [ ] **Step 2:** Run; expect the budget still naming travel.
- [ ] **Step 3: Implement** in SQL: delete the source budget's amounts and budget when the destination has a budget, otherwise update `category_account_id`; update `planning_schedule.account_id` and `counterpart_id`. All filtered by `user_id`.
- [ ] **Step 4:** Tests pass; `go test ./internal/planning` passes.
- [ ] **Step 5:** S74 in `06-scenarios.md`; commit `feat(planning): follow a category merge`.
