# Categorization slice 1: account tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver amendments A73 (no cycle in the account tree), A74 (archive and reopen) and A76 (transaction filter by subtree) of the categorization spec, with scenarios S72, S73 and S75.

**Architecture:** All changes sit in the Ledger module: `app.Service` (`CloseAccount`, new `ReopenAccount`, `checkParent`), one goose migration with a cycle trigger, one query change in `db/queries/ledger/transaction.sql`, one new operation in `api/openapi.yaml`. Classification needs no code change: `Allocate` already skips a category closed on the transaction date; a classification apitest pins S73.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen, goose; tests through `internal/apitest` and raw SQL schema tests.

**Spec:** `docs/superpowers/specs/2026-10-19-web-categorization-design.md` (sections A73, A74, A76, New scenarios, Delivery slice 1).

## Global Constraints

- Work happens in a worktree: `git worktree add ../equori-categorization -b feat/web-categorization HEAD`. The spec and this plan are uncommitted in the main tree; Task 0 copies them in.
- Test command for one test: `make db-up` once, then `EQUORI_TEST_DATABASE_URL='postgres://equori:equori@127.0.0.1:54329/postgres?sslmode=disable' go test ./internal/<pkg> -run '^<TestName>$' -count=1`. Written below as `T <pkg> <TestName>`.
- After editing `db/migrations`, `db/queries` or `api/openapi.yaml`: `make gen`. Never edit `*.gen.go` or `schema.gen.ts`.
- New migration: `db/migrations/00025_ledger_account_tree.sql`. Applied migrations are not edited.
- Problem codes: new `system_account` (422). Add it to the `Problem.code` description list in `api/openapi.yaml` (after `investment_transaction`).
- Event: `ledger.account_reopened.v1`, payload `{"account_id"}` (same `accountEvent` as `ledger.account_closed.v1`).
- Every test that a task adds must fail before its implementation step; run it and read the failure.
- Commits: Conventional Commits, scope `ledger` or `docs`; no tool or assistant names; `make check` passes before each commit.
- Each task ends with its docs line in `docs/domain/` (05 for rules, 06 for scenarios) in the same commit.

## Review Focus

1. A system account inside the subtree of a closed category (an owner can move a user category over a system account's parent, or set a system account's parent): closing the category rejects with 422 `system_account` and closes nothing. Test in Task 2.
2. Renaming an archived child of an archived parent: succeeds; the "open account under closed parent" rule applies only to open accounts. Test in Task 2.
3. A descendant opened after the requested `closed_on`: the whole close rejects with 422 `validation_failed` on `closed_on`; no account changes. Test in Task 2.
4. Reopening a category whose sibling was closed by the same parent close: the sibling stays closed. Test in Task 3.
5. The subtree filter combined with `uncategorized=true` and with a cursor: results stay ordered by date then id and the cursor continues within the subtree. Test in Task 4.

---

### Task 0: Workspace

- [ ] **Step 1:** `git worktree add ../equori-categorization -b feat/web-categorization HEAD`.
- [ ] **Step 2:** Copy `docs/superpowers/specs/2026-10-19-web-categorization-design.md` and `docs/superpowers/plans/2026-10-19-categorization-account-tree.md` from the main tree into the worktree.
- [ ] **Step 3:** In the worktree, run `make check`. Expected: pass (baseline).
- [ ] **Step 4:** Commit `docs: specify the categorization section and plan its first slice`.

### Task 1: A73 no cycle in the account tree (S72)

**Files:**
- Create: `db/migrations/00025_ledger_account_tree.sql`
- Modify: `internal/ledger/internal/app/service.go` (`checkParent`)
- Test: `internal/ledger/account_tree_test.go` (new, package `ledger_test`), `internal/ledger/schema_test.go`
- Docs: `docs/domain/05-domain-model.md` 5.2.2 (`parentId` row or a new row "Tree"), `docs/domain/06-scenarios.md` 6.13 (S72; add Food › Restaurants to the category list of 6.13)

**Interfaces:**
- Produces: trigger `ledger_account_no_cycle` (`BEFORE INSERT OR UPDATE OF parent_id ON ledger_account`), function `ledger_check_account_cycle()`, exception message containing `own ancestor`.

- [ ] **Step 1: Write the failing apitest**

```go
// S72: an account cannot move under its own descendant (A73).
func TestMoveUnderDescendantIs422(t *testing.T) {
	h := apitest.New(t)
	food := h.Account("Food", "expense", "", nil)
	groceries := h.Account("Groceries", "expense", "", map[string]any{"parent_id": food})
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/accounts/"+food, map[string]any{"parent_id": groceries}),
		http.StatusUnprocessableEntity, "validation_failed", "parent_id")
	// GET food: parent_id absent; GET groceries: parent_id == food.
}
```

Add a second case: three levels (Food › Groceries › Organic), moving Food under Organic → same 422.

- [ ] **Step 2: Write the failing schema test** `TestAccountTreeRejectsCycle` in `schema_test.go`: with `newSchemaFixture`, insert accounts `a`, `b` (expense); `UPDATE ledger_account SET parent_id = a WHERE id = b` succeeds; `UPDATE ledger_account SET parent_id = b WHERE id = a` → `requireViolation(t, err, "23514", "own ancestor")`; `UPDATE ... SET parent_id = id WHERE id = a` → same violation.
- [ ] **Step 3:** `T ledger TestMoveUnderDescendantIs422` and `T ledger TestAccountTreeRejectsCycle`. Expected: the apitest fails with status 200; the schema test fails with a nil error.
- [ ] **Step 4: Write the migration.** Up: the function walks ancestors of `NEW.parent_id` with `WITH RECURSIVE up(id) AS (SELECT NEW.parent_id UNION SELECT a.parent_id FROM ledger_account a JOIN up ON a.id = up.id WHERE a.parent_id IS NOT NULL)`; `UNION` (not `UNION ALL`) so the walk terminates on rows that already form a cycle; raises `'account % would be its own ancestor'` with `ERRCODE = 'check_violation'` when `NEW.id` is in `up`. Down: drop trigger and function. Use `-- +goose StatementBegin/End` around the function as `00004_ledger.sql` does.
- [ ] **Step 5: Implement the check in `checkParent`.** After loading `parent` and before `domain.ValidateParent`: when `a.ID != uuid.Nil`, follow `ParentID` from `parent` through `r.Account` until `uuid.Nil`; meeting `a.ID` returns `&domain.FieldError{Field: "parent_id", Message: "must not be a descendant of the account", Err: domain.ErrValidation}`.
- [ ] **Step 6:** Rerun both tests. Expected: PASS. Run `T ledger 'TestCreateAccount|TestValidationErrors'` to confirm no regression.
- [ ] **Step 7:** Docs lines (05: "An account is never its own ancestor (A73)"; 06: S72 text from the spec). `make check`.
- [ ] **Step 8:** Commit `fix(ledger): reject an account tree cycle`.

### Task 2: A74 archive a category

**Files:**
- Modify: `internal/ledger/internal/app/service.go` (`CloseAccount`, `checkParent`), `internal/ledger/internal/app/ports.go` (`ErrSystemAccount`), `internal/ledger/internal/adapter/httpapi/errors.go`, `api/openapi.yaml` (`closeAccount` summary and description; `Problem.code` list)
- Test: `internal/ledger/account_tree_test.go`
- Docs: `docs/domain/05-domain-model.md` 5.2.2 row `openedOn`, `closedOn` (line 172)

**Interfaces:**
- Produces: `var ErrSystemAccount = errors.New("system accounts cannot be closed, reopened or merged")` in `app/ports.go`; mapped to 422 `system_account` in `toProblem`.
- `CloseAccount(ctx context.Context, userID int64, id uuid.UUID, closedOn time.Time) error` keeps its signature.

- [ ] **Step 1: Write the failing tests** (all in `account_tree_test.go`; fixture: `checking` (asset/checking), `food` (expense), `bakery` and `delivery` (expense, parent `food`)):

| Test | Arrange | Assert |
|---|---|---|
| `TestArchiveCategoryWithPostings` | record 2026-10-10: checking −850, bakery +850 | `POST /accounts/{food}/close {"closed_on":"2026-10-31"}` → 200 with `closed_on` `2026-10-31`; GET bakery and delivery: `closed_on` `2026-10-31`; `outbox_event` has one `ledger.account_closed.v1` per account (aggregate ids food, bakery, delivery) |
| `TestArchiveRejectsPostingsAfterDate` | record 2026-11-02 on bakery | close food on 2026-10-31 → 409 `account_not_empty`; food, bakery, delivery have no `closed_on` |
| `TestArchiveRejectsLateOpenedDescendant` | create `organic` under food with `opened_on` 2026-11-15 | close food on 2026-10-31 → 422 `validation_failed` field `closed_on`; no account closed |
| `TestCloseSystemAccountIs422` | read `uncategorized_expense` id from `GET /accounts?limit=200` | close it → 422 `system_account` (S73 last sentence) |
| `TestArchiveRejectsSystemAccountInSubtree` | `PATCH` the `fees` system account with `parent_id` food | close food → 422 `system_account`; nothing closed |
| `TestOpenAccountUnderClosedParentIs422` | close delivery on 2026-10-31 | `POST /accounts {"name":"Pizza","class":"expense","currency":"BRL","parent_id":delivery}` → 422 field `parent_id`; `PATCH bakery {"parent_id": delivery}` → 422 field `parent_id` |
| `TestRenameArchivedChildOfArchivedParent` | close food on 2026-10-31 | `PATCH bakery {"name":"Old bakery"}` → 200, name `Old bakery` |

`TestCloseAccountWithBalanceIs409` (existing) stays unchanged and must keep passing: balance accounts keep the zero-balance rule.

- [ ] **Step 2:** Run each with `T ledger <name>`. Expected failures: the first returns 409 `account_not_empty` (balance 850); the system-account tests return 200; the closed-parent test returns 201.
- [ ] **Step 3: Implement `CloseAccount`.** Inside `InTx`: load the account; build its subtree from `r.AllAccounts` (children by `ParentID`, root first); any member with `SystemRole != ""` → `ErrSystemAccount`; for each open member: `AccountTotals`; a balance-class member (`IsBalance()`) with `Total != 0` → `ErrNonZeroBalance`; `LastBookedOn.After(closedOn)` → `ErrPostingsAfterClose`; then set `ClosedOn`, `domain.NewAccount` (its `closed_on` validation yields the late-opened case), `UpdateAccount`, and publish `EventAccountClosed` per closed member. Members already closed keep their date.
- [ ] **Step 4: Extend `checkParent`.** When `a.ClosedOn == nil` and `parent.ClosedOn != nil`: `&domain.FieldError{Field: "parent_id", Message: "must be open", Err: domain.ErrValidation}`.
- [ ] **Step 5: Map the error.** In `toProblem`: `errors.Is(err, app.ErrSystemAccount)` → `problem.New(http.StatusUnprocessableEntity, "system_account", err.Error())`. Update `closeAccount` in `api/openapi.yaml`: summary "Close an account; a category closes with its subcategories (A74)", description stating the zero-balance rule for asset, liability and equity accounts. Add `system_account` to the code list. `make gen`.
- [ ] **Step 6:** Run the Step 1 tests and `T ledger TestCloseAccountWithBalanceIs409`. Expected: PASS.
- [ ] **Step 7:** Docs: replace "Closing requires a zero balance." with "Closing an asset, liability or equity account requires a zero balance; closing an income or expense account requires no posting after the date and closes its open descendants. System accounts are never closed (A74)." `make check`.
- [ ] **Step 8:** Commit `feat(ledger): archive a category with its subcategories`.

### Task 3: A74 reopen (S73)

**Files:**
- Modify: `api/openapi.yaml` (new path), `internal/ledger/internal/app/service.go` (`ReopenAccount`, `EventAccountReopened`), `internal/ledger/internal/adapter/httpapi/server.go` (`ReopenAccount` handler)
- Test: `internal/ledger/account_tree_test.go`; `internal/classification/import_test.go` (S73)
- Docs: `docs/domain/05-domain-model.md` 5.2.2; `docs/domain/06-scenarios.md` 6.13 (S73)

**Interfaces:**
- Consumes: `ErrSystemAccount` (Task 2).
- Produces: `func (s *Service) ReopenAccount(ctx context.Context, userID int64, id uuid.UUID) (domain.Account, error)`; `EventAccountReopened = "ledger.account_reopened.v1"`; operation `reopenAccount` `POST /accounts/{id}/reopen`, no request body, responses 200 `Account`, 401, 404, 422 (all `Problem` except 200), tag `ledger`.

- [ ] **Step 1: Write the failing ledger tests:**

| Test | Arrange | Assert |
|---|---|---|
| `TestReopenCategoryReopensAncestors` | food › bakery, food › delivery; close food on 2026-10-31 | `POST /accounts/{bakery}/reopen` → 200, no `closed_on`; GET food: no `closed_on`; GET delivery: `closed_on` `2026-10-31`; `outbox_event` has `ledger.account_reopened.v1` for bakery and food only |
| `TestReopenOpenAccountIs422` | food open | reopen food → 422 `validation_failed` |
| `TestReopenSystemAccountIs422` | `uncategorized_expense` | reopen → 422 `system_account` |
| `TestReopenForeignAccountIs404` | an expense account created by `h.Login("other@example.com")` | reopen it as the owner → 404 `not_found` |

- [ ] **Step 2: Write the failing S73 apitest** `TestArchivedCategoryStopsRuleUntilReopened` in `internal/classification/import_test.go`, using `newBooks` (today 2026-11-05): create `bakery` (expense); rule "Bakery" `contains("padaria")` → `setCategory(bakery)`; close bakery on 2026-10-31; `b.importLines(t, "s73.ofx", line("20261102", "-8.50", "s73", "PADARIA SAO JOAO"))` → amounts `{uncategorized: 850}`; reopen bakery; `POST /rules/run` → `examined` 1, `categorized` 1; `dispatch`; the transaction's postings put 850 on bakery and `categorizationOf` gives method `rule` with the rule id.
- [ ] **Step 3:** Run all five tests. Expected: 404 or 405 on `/reopen` (route missing).
- [ ] **Step 4:** Add the operation to `api/openapi.yaml` after `/accounts/{id}/close`; `make gen`.
- [ ] **Step 5: Implement `ReopenAccount`.** Inside `InTx`: load the account; `SystemRole != ""` → `ErrSystemAccount`; `ClosedOn == nil` → `&domain.FieldError{Field: "id", Message: "account is open", Err: domain.ErrValidation}`; walk ancestors through `r.Account`, collecting the closed ones; clear `ClosedOn` on the account and on each collected ancestor, `UpdateAccount`, publish `EventAccountReopened` per reopened account. The handler returns `ReopenAccount200JSONResponse(toAccountAPI(a))`.
- [ ] **Step 6:** Rerun the five tests. Expected: PASS.
- [ ] **Step 7:** Docs: 05 gains "Reopening an account reopens its closed ancestors; an open account never has a closed parent (A74)."; 06 gains S73 from the spec. `make check`.
- [ ] **Step 8:** Commit `feat(ledger): reopen an archived account`.

### Task 4: A76 transaction filter by subtree (S75)

**Files:**
- Modify: `db/queries/ledger/transaction.sql` (`ListTransactions`), `api/openapi.yaml` (`listTransactions` parameter `account_id` description)
- Test: `internal/ledger/transaction_search_test.go`
- Docs: `docs/domain/06-scenarios.md` 6.13 (S75)

- [ ] **Step 1: Write the failing tests:**
  - `TestAccountFilterIncludesSubAccounts` (S75): accounts checking; food; groceries, bakery, delivery under food; travel. Record one transaction per category (2026-10-01 delivery, 2026-10-02 groceries, 2026-10-03 bakery, 2026-10-04 food, 2026-10-05 travel). `GET /transactions?account_id={food}` → exactly the ids of the food (10-04), bakery (10-03), groceries (10-02) and delivery (10-01) transactions, in that order; travel absent. `account_id={bakery}` → only the bakery transaction.
  - `TestAccountFilterSubtreeWithCursorAndUncategorized` (Review Focus 5): record five transactions on `groceries` 2026-10-01..05 and one with postings checking −1000, groceries +600, `uncategorized_expense` +400 on 2026-10-06; `GET /transactions?account_id={food}&limit=2` then follow `next_cursor` to the end → six ids, date descending, no repeat; `account_id={food}&uncategorized=true` → empty (the 2026-10-06 transaction has a categorized posting).
- [ ] **Step 2:** `T ledger TestAccountFilterIncludesSubAccounts`. Expected: FAIL, the food filter returns only the food transaction.
- [ ] **Step 3: Change `ListTransactions`.** Prefix the query with `WITH RECURSIVE tree AS (SELECT a.id FROM ledger_account a WHERE a.user_id = @user_id AND a.id = sqlc.narg(account_id)::uuid UNION ALL SELECT c.id FROM ledger_account c JOIN tree ON c.parent_id = tree.id WHERE c.user_id = @user_id)` and replace `p.account_id = sqlc.narg(account_id)::uuid` with `p.account_id IN (SELECT id FROM tree)`. `make gen`; the generated parameter struct keeps the same fields, so `repository.go` compiles unchanged (fix the call site if sqlc renames a field).
- [ ] **Step 4:** Run both tests and `T ledger 'TestTransactionSearch|TestPagination'`. Expected: PASS.
- [ ] **Step 5:** OpenAPI description of `account_id` on `listTransactions`: "Transactions with a posting on the account or on one of its descendants (A76)." `make gen`. Docs: S75. `make check`.
- [ ] **Step 6:** Commit `feat(ledger): filter transactions by an account subtree`.

### Task 5: Record the amendments

**Files:**
- Modify: `docs/domain/05-domain-model.md` 5.8 "Decisions in this chapter" (or the amendment list the chapter uses) with A73, A74, A76 one line each, pointing to the spec.

- [ ] **Step 1:** Add the three lines; check with `rg -n "A7[346]" docs/domain` that each ID appears where Tasks 1–4 placed its rule and in 5.8.
- [ ] **Step 2:** `make check`. Commit `docs: record amendments A73, A74 and A76`.
