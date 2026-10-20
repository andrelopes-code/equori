# Categorization slices 3–6, backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the backend amendments A77–A84 of the categorization spec with scenarios S76–S79, so the web slices only consume endpoints.

**Architecture:** Reporting gains category totals over `reporting_account_day`. Ledger gains account appearance (colour, icon), a parent setter that can clear the parent, bulk categorization over the existing `Categorize` batch, and payee rename and merge. Classification gains categorizations by transaction, rule usage counts, a rule preview over the last 365 days, and consumers of the payee merge; Planning gains the payee merge consumer.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen, goose; apitests through `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-19-categorization-design.md` (A77–A83, S76–S79); amendment A84 and the A82 and A83 contract changes below are added to the spec in Task 7.

## Global Constraints

- Worktree `../equori-categorization`, branch `feat/web-categorization`; commits with `COMPOSE_PROJECT_NAME=equori` through the hook; each slice moves to `feat/web-ledger-sheet` by cherry-pick around a verified stash of the owner's WIP.
- No new Go dependency: nullable fields that clear use PUT bodies whose fields are required and `nullable: true` (pattern of `SourceCategoryMapping`).
- New migration numbers: `00026_ledger_account_appearance.sql`, `00027_ledger_payee_merge.sql`.
- Range errors follow `ErrInvalidRange` of Reporting: 400 `invalid_request` on `to`.
- Every query filters by `user_id`; every new endpoint has a 404 or empty-result apitest for another user's resource.

## Contract decisions (recorded in the spec by Task 7)

- A83: colour and icon change through `PUT /accounts/{id}/appearance` `{color: integer 1–8 | null, icon: CategoryIcon | null}`, both required; `AccountInput` accepts both optional on creation; `Account` returns both when set.
- A84: `PUT /accounts/{id}/parent` `{parent_id: uuid | null}` sets or clears the parent with the checks of `checkParent`; `null` makes the account top level.
- A82: the source payee is kept with `merged_into` set and leaves `GET /payees`; `GET /payees/{id}` is not added. Voided transactions of the source payee take the destination payee without a new version.

## Review Focus

1. A77 with a category that has postings only in its subcategories: `total` 0, `subtree_total` the children's sum; an income category reports earnings as a positive amount. Test in Task 1.
2. A78 with the same transaction twice: 422 on `items`. Test in Task 3.
3. A81 with an invalid rule body: the `createRule` 422 with the same field path. Test in Task 5.
4. A82 merging a payee into itself or into a merged payee: 422 on `into`. Test in Task 6.
5. A84 clearing the parent of an archived account under an archived parent: allowed; setting an open account under a closed parent: 422. Test in Task 2.

---

### Task 1: A77 category totals (S76)

**Files:** `api/openapi.yaml` (`GET /reports/categories`, tag reporting, params `from`, `to` (date, required), `class` (`income|expense`, required); 200 `CategoryTotals {items: [{account_id, total: Money, subtree_total: Money}]}`), `db/queries/reporting/account_day.sql` (`CategoryTotals`), `internal/reporting/internal/{app/series.go,adapter/postgres/repository.go,adapter/httpapi/server.go}`, test `internal/reporting/categories_test.go`, docs 06 (S76).

- [ ] Failing tests: `TestS76CategoryTotals` (Food › Delivery 4500 and 1000 in October, Food › Groceries 2000, Travel 2390, a November posting excluded; expense items in name order with exact `total` and `subtree_total`, Food `total` 0 and `subtree_total` 7500); `TestCategoryTotalsIncomeIsPositive` (salary +300000 earnings → `total` 300000); `TestCategoryTotalsRange` (`to` before `from`, and 367 days → 400 on `to`); `h.Dispatch()` before reading.
- [ ] Query: every account of the class with the sum of `delta_booked` in `[from, to]` (LEFT JOIN), `parent_id`, `closed_on`, `instrument`, `name`; Go computes subtree sums by parent, negates income, keeps an account when open or when its own or subtree total is non-zero.
- [ ] Commit `feat(reporting): total the categories of a period`.

### Task 2: A83 appearance and A84 parent

**Files:** migration `00026_ledger_account_appearance.sql` (`color smallint CHECK (color BETWEEN 1 AND 8)`, `icon text CHECK (icon ~ '^[a-z0-9-]{1,40}$')`), `db/queries/ledger/account.sql` (insert, update, select carry both), `internal/ledger/internal/domain/account.go` (`Color int`, `Icon string`), `app/service.go` (`SetAppearance`, `SetParent`), httpapi, `api/openapi.yaml` (`CategoryIcon` enum, `AccountAppearance`, `AccountParent`, operations `setAccountAppearance`, `setAccountParent`), tests `internal/ledger/account_appearance_test.go`, schema test.

- [ ] `CategoryIcon` enum: the kebab-case names of `lucide-react` icons listed in the spec by Task 7; every name is checked against the `lucide-react` package tarball (`npm pack lucide-react@<pinned>` into the scratchpad, list `dist/esm/icons/*.js`) before it enters the enum.
- [ ] Failing tests: appearance set, read back, cleared with nulls; 422 on `icon` outside the enum and on `color` 9; schema test inserting `color` 9 and `icon` `Bad Icon`; parent cleared with null (Food › Bakery → Bakery top level); Review Focus 5.
- [ ] Commit `feat(ledger): give an account a colour, an icon and a top-level move`.

### Task 3: A78 bulk categorization (S77)

**Files:** `api/openapi.yaml` (`POST /transactions/categorize`, `BulkCategorizeInput {category_id, items[1..200] {id, expected_version}}`, 200 `{results: [{id, status, version?}]}`), `internal/ledger/internal/adapter/httpapi/server.go`, `app/categorize.go` (`CategorizeMany(ctx, userID, categoryID uuid.UUID, items []BulkItem) ([]BulkResult, error)` over `Categorize` with one part holding each transaction's category total, cause `manual`), test `internal/ledger/bulk_categorize_test.go`.

- [ ] Failing tests: `TestS77BulkCategorize` (three uncategorized, one stale version → `categorized`, `categorized`, `version_conflict`, versions 2); voided item → `transaction_voided`; unknown id → `not_found`; closed category → 422 on `category_id`; Review Focus 2.
- [ ] Each item reads its transaction for the category total; an item error maps to its status by the problem code of the same name.
- [ ] Commit `feat(ledger): categorize several transactions at once`.

### Task 4: A79 categorizations by transaction and A80 rule usage

**Files:** `db/queries/classification/categorization.sql` (`CategorizationsByIDs`, `RuleUsage`), classification app and httpapi, `api/openapi.yaml` (`GET /categorizations?transaction_id=` repeated 1..200; `Rule.categorized_count`, `Rule.last_categorized_at`), tests `internal/classification/categorizations_test.go`.

- [ ] Failing tests: two transactions and one without a row → two items; 201 ids → 400 on `transaction_id`; rule with two categorized transactions → `categorized_count` 2 and `last_categorized_at` the later decision; a voided one is not counted; a new rule has count 0 and no `last_categorized_at`.
- [ ] Commit `feat(classification): read categorizations by transaction and rule usage`.

### Task 5: A81 rule preview (S78)

**Files:** `db/queries/classification/categorization.sql` (`PreviewCandidates`: transaction ids of non-voided rows dated in `[from, to]`), `internal/classification/internal/app/preview.go`, httpapi, `api/openapi.yaml` (`POST /rules/preview`, body `RuleInput`, 200 `RulePreview`).

- [ ] Failing tests: `TestS78RulePreview` (S41 data: `would_categorize` 0, `conflicts` 1 with the Travel transaction id); an uncategorized match → `would_categorize` 1; Review Focus 3; a transaction dated 366 days ago is ignored.
- [ ] `Preview(ctx, userID, r domain.Rule) (RulePreview, error)`: the catalog of `catalog` with `Rules: []domain.Rule{r}`, facts in pages of `runPage`, `domain.Decide` per subject; `conflicts` when the decision's allocation differs, as a multiset of category and amount, from the current category postings.
- [ ] Commit `feat(classification): preview a rule over the last year`.

### Task 6: A82 payee rename and merge (S79)

**Files:** migration `00027_ledger_payee_merge.sql` (`merged_into uuid`, FK to `ledger_payee (user_id, id)`), ledger queries, app (`RenamePayee`, `MergePayees`, `EventPayeesMerged = "ledger.payees_merged.v1"`, payload `PayeesMerged{From, Into}`), httpapi, `api/openapi.yaml` (`PATCH /payees/{id}`, `POST /payees/{id}/merge`), classification consumer (`MergePayee`: aliases `payee_id`, `replace` on rule conditions and actions, categorization `match_key`, suggestion fingerprints and conditions with the older-stays rule), planning consumer (`planning_schedule.payee_id`), tests in ledger, classification and planning.

- [ ] Failing tests: `TestS79MergePayees` (S38 alias names the destination after `dispatch`; transactions of the source at version + 1; `GET /payees` lists one); rename 1–120 characters; Review Focus 4; schedule payee follows.
- [ ] Non-voided transactions get a version through `ReplaceCategoryPostings` with the payee changed, cause `merge` on `ledger.transaction_categorized.v1`; voided ones change in place.
- [ ] Commit `feat(ledger): rename and merge payees`.

### Task 7: Spec and domain docs

- [ ] Spec: A82 and A83 contract decisions above, new A84, the `CategoryIcon` list.
- [ ] `06-scenarios.md`: S76–S79; coverage paragraph S72–S79.
- [ ] Commit `docs: record amendments A77 to A84`.
