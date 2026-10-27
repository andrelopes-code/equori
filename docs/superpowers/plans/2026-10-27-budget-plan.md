# Budget Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Plan view of the budgets tab that distributes a reference income across budgets, with the figures computed and saved by a new `budget-plan` resource.

**Architecture:** Planning computes the plan of a month from the ledger: own category totals by month, installments of earlier purchases, and income and savings occurrences. A pure domain function applies A129. One transaction saves the amounts and the reference choice (A130, A131). The web holds a draft of pending changes over the fetched plan. Suggestion and distribution (A132) are pure functions over that draft, and nothing reaches the server before **Save plan**.

**Tech Stack:** Go, PostgreSQL, goose, sqlc, oapi-codegen; React, TypeScript, TanStack Query and Router, `@slotted/react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-budget-plan-design.md`

## Global Constraints

- Everything in English, including the new catalog keys' English copy. `pt-BR` copy is added beside it, in the same task.
- No new dependency (Go or `web/package.json`).
- Money is integer minor units plus a currency (ADR 005, O7). No `float64` and no floating division of amounts. Percentages are computed in basis points with integer arithmetic, then formatted through `Intl`.
- Every query filters by `user_id` (ADR 003).
- `*.gen.go` and `schema.gen.ts` are regenerated with `make gen`, never edited.
- A new `operationId` has an entry in `internal/server/tool_exposure_test.go`.
- Each scenario test name carries its ID (`TestS158...`). Tests use `apitest.Today`, with no wall clock.
- Amounts in the web are written only through `useMoneyFormat()` (O9). JSX has no literal text (O6). CSS goes in co-located `*.module.css` inside `@layer app`, reading `var(--slotted-*)` only (O5).
- Before any UI task, read `web/CLAUDE.md` whole and apply the `compose-screen` skill. A missing Slotted family is reported per its "Slotted feedback" section, and the screen does not build around it silently.
- Commits follow Conventional Commits, with scope `planning`, `api` or `web`. No AI attribution.
- Slices follow the user's protocol: at most three tasks, then a checkpoint in `.claude/progress/current.md`.

## Review Focus

1. **A category merged or closed while it has a pending change in the draft.** The save returns 422 on that row. The row is marked, and the other pending changes stay. Tested in Task 4: closed category → 422 `amounts[0].category_id`.
2. **Two tabs save the same month.** The second save replaces the versions at M of the categories it lists, and leaves the others alone. Tested in Task 4, with the second PUT listing one category.
3. **A month with a version at M and the save sends the same amount.** The save is idempotent: no error, one version. Tested in Task 4.
4. **The reference panel's percent toggle with a reference of zero.** Fixed source with amount 0: shares read as a dash, and the toggle is disabled. Tested in Task 6 (`planShare` returns `undefined` for room ≤ 0).
5. **The largest-remainder split of an amount smaller than the number of rows** (3 minor units over 5 rows). The parts sum to 3, each part is 0 or 1, and the largest weights go first. Tested in Task 6.

---

## Slice 1: backend read

### Task 1: Reference table and budget amount upsert

**Files:**
- Create: `db/migrations/00066_planning_budget_reference.sql`
- Create: `db/queries/planning/budget_reference.sql`
- Modify: `db/queries/planning/budget.sql` (add `UpsertBudgetAmount`)
- Modify: `internal/planning/internal/app/ports.go` (Repository)
- Modify: `internal/planning/internal/adapter/postgres/repository.go`
- Modify: `internal/planning/internal/domain/budget.go`
- Test: `internal/planning/schema_test.go`

**Interfaces:**
- Produces:
  - `domain.ReferenceSource` (string) with constants `SourceExpectedIncome = "expected_income"`, `SourceAverageIncome = "average_income"` and `SourceFixed = "fixed"`.
  - `domain.Reference{Source ReferenceSource; Fixed int64; HasFixed bool}`.
  - Repository: `BudgetReference(ctx, userID int64) (domain.Reference, bool, error)`, where `ok` is false without a row.
  - Repository: `SaveBudgetReference(ctx, userID int64, r domain.Reference, currency money.Currency) error`.
  - Repository: `UpsertBudgetAmount(ctx, userID int64, budgetID uuid.UUID, a domain.BudgetAmount) error`.
  - Repository: `Budgets(ctx, userID int64) ([]domain.Budget, error)`, every budget with its amounts and no paging.

- [ ] **Step 1: Write the failing schema tests.** Add these cases to `TestSchemaInvariants`, each `INSERT INTO planning_budget_reference (user_id, source, amount, currency)` expected to fail:
  - `"reference with an unknown source"`: `('monthly_income', NULL, 'BRL')`;
  - `"fixed reference without an amount"`: `('fixed', NULL, 'BRL')`;
  - `"average reference with an amount"`: `('average_income', 100, 'BRL')`;
  - `"negative fixed reference"`: `('fixed', -1, 'BRL')`.

  Add one passing insert `('fixed', 0, 'BRL')` before them, followed by a second insert for the same user that must fail (`"two references for one user"`).
- [ ] **Step 2:** Run `go test ./internal/planning -run TestSchemaInvariants`. Expected: FAIL, relation `planning_budget_reference` does not exist.
- [ ] **Step 3:** Write the migration with the table of spec §4 and a `-- +goose Down` that drops it. Write the queries:
  - `GetBudgetReference :one`;
  - `UpsertBudgetReference :exec`, as `INSERT … ON CONFLICT (user_id) DO UPDATE SET source, amount, currency`;
  - `UpsertBudgetAmount :exec`, as `INSERT … ON CONFLICT (budget_id, effective_from) DO UPDATE SET amount = EXCLUDED.amount`;
  - `ListAllBudgets :many`, as `SELECT * FROM planning_budget WHERE user_id = @user_id ORDER BY id`.

  Run `make gen`, then implement the repository methods. `Budgets` reuses `ListBudgetAmounts`.
- [ ] **Step 4:** Run `go test ./internal/planning -run TestSchemaInvariants`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planning): store the budget reference choice and upsert amounts`.

### Task 2: Ledger figures for the plan

**Files:**
- Modify: `db/queries/ledger/balance.sql` (add `OwnCategoryMonthlyTotals`)
- Modify: `db/queries/ledger/card.sql` (add `PriorInstallments`)
- Modify: `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/adapter/postgres/*`, `internal/ledger/internal/app/card_operations.go`, `internal/ledger/ledger.go`
- Modify: `internal/planning/internal/app/ports.go` (Ledger), `internal/planning/planning.go` (`ledgerPort`)
- Test: `internal/planning/plan_test.go` (Task 3 drives it; this task adds only the code)

**Interfaces:**
- Produces, on the ledger module: `OwnCategoryMonthlyTotals(ctx, userID int64, class string, from, to time.Time) ([]CategoryMonth, error)`, with `CategoryMonth{CategoryID uuid.UUID; Month time.Time; Total money.Money}`. Totals are in the base currency and come from the own postings of each category of the class, booked in `[from, to)`. The query groups by `p.account_id, date_trunc('month', p.booked_on)` and sums `p.weight`, filtered by `ledger_account.account_class = @class`, as `CategoryMonthlyTotals` does.
- Produces, on the ledger module: `PriorInstallments(ctx, userID int64, cardID uuid.UUID, month time.Time) (money.Money, error)`. It is `CommittedInstallments` with two changes: the `closing_date > @today` filter is removed, and `ledger_transaction.date < @month_start` is added. The join is on `p.transaction_id`; confirm the date column name in `db/migrations/00004_ledger.sql`.
- Produces, on the planning `Ledger` port: `OwnCategoryMonthlyTotals(ctx, userID int64, class string, from, to time.Time) (map[uuid.UUID]map[time.Time]int64, error)` and `PriorInstallments(ctx, userID int64, cardID uuid.UUID, month time.Time) (int64, error)`.

- [ ] **Step 1:** Add the two queries, run `make gen`, and implement the module methods and the `ledgerPort` adapters.
- [ ] **Step 2:** Run `go build ./... && go vet ./internal/ledger/... ./internal/planning/...`. Expected: no output.
- [ ] **Step 3:** No commit yet. Task 3 adds the tests that exercise these methods and commits both tasks together.

### Task 3: Plan computation and `GET /budget-plan`

**Files:**
- Create: `internal/planning/internal/domain/plan.go`, `internal/planning/internal/domain/plan_test.go`
- Create: `internal/planning/internal/app/plan.go`
- Create: `internal/planning/internal/adapter/httpapi/plan.go`
- Modify: `api/openapi.yaml` (path `/budget-plan` GET, schemas `BudgetPlan`, `BudgetPlanRow`, `BudgetPlanIncome`, enum `BudgetPlanSource`)
- Modify: `internal/server/tool_exposure_test.go` (`"getBudgetPlan": "get_budgets_and_goals"`)
- Modify: `docs/domain/05-domain-model.md` (Budget plan row: A129, A131), `docs/domain/06-scenarios.md` (S158 to S160, S164), `docs/domain/07-data-model.md` (`planning_budget_reference`), and the amendments table of `docs/superpowers/plans/2026-10-17-p7-planning.md` (A129 to A132)
- Test: `internal/planning/plan_test.go`

**Interfaces:**
- Consumes: Task 1 Repository methods and Task 2 Ledger methods.
- Produces, in the domain:
  - `type PlanCategory struct{ ID, ParentID uuid.UUID; Open bool }`
  - `type PlanInput struct{ Month time.Time; Categories []PlanCategory; Budgets []Budget; Own map[uuid.UUID]map[time.Time]int64; FirstPosting time.Time; HasPostings bool }`
  - `type PlanRow struct{ CategoryID, BudgetID uuid.UUID; Planned, LastMonth, Average int64; Counted bool; NextChange time.Time; HasNextChange bool }`
  - `func PlanRows(in PlanInput) (rows []PlanRow, averageMonths int)`, implementing the row rules of A129.
  - `func AverageMonths(month, firstPosting time.Time) int`, returning 0 to 3.
  - `func Divide(total int64, n int) int64`, rounding half up.
- Produces, in app:
  - `type Plan struct{ Month time.Time; Currency money.Currency; Reference domain.Reference; Expected *int64; ExpectedItems []PlanIncome; Average *int64; AverageMonths int; Received, Installments, Savings, Planned int64; Rows []domain.PlanRow; Prices []Price }`
  - `type PlanIncome struct{ ScheduleID uuid.UUID; Description string; Amount int64 }`
  - `func (s *Service) BudgetPlan(ctx, userID int64, month time.Time) (Plan, error)`
  - `func (p Plan) ReferenceAmount() (int64, bool)`; `unassigned` is computed in httpapi from it.

- [ ] **Step 1: Write failing domain tests** in `plan_test.go`, table-driven:
  - `AverageMonths`: month 2026-12 with first posting 2026-11-03 → 1; first posting 2026-08-01 → 3; first posting 2026-12-02 → 0.
  - `Divide(10, 3) == 3`, `Divide(11, 2) == 6`, `Divide(-11, 2) == -6`.
  - `PlanRows`, nested budgets: Food has a budget and Supermarket, its child, has one too. Supermarket gets `Counted == false` and Food `true`. Restaurant, also under Food, with own spending and no budget, is not a row.
  - `PlanRows`, budget with versions 2026-10 and 2027-01 for month 2026-11: `Planned` is the 2026-10 amount, and `NextChange` is 2027-01.
- [ ] **Step 2:** Run `go test ./internal/planning/internal/domain -run 'Plan|Average|Divide'`. Expected: FAIL, undefined names.
- [ ] **Step 3:** Implement `plan.go`. A budgeted row's `LastMonth` and `Average` sum its subtree from `Own`; an unbudgeted row uses its own totals. Rows are sorted by category ID, so the output is deterministic.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Write the failing apitest scenarios** in `internal/planning/plan_test.go`, reusing `newFixture`, `f.schedule`, `f.budget` and `monthly`:
  - `TestS158PlanFigures`. Today is 2026-11-01, on a card (`f.h.Card("Visa", 3, 10, "next")`):
    - a 3-installment purchase of 900.00 on 2026-10-20;
    - a 2-installment purchase of 400.00 on 2026-11-05;
    - income schedule "Salary" of 7,200.00 on day 5;
    - income schedule "Freelance" of 1,300.00 on day 20;
    - savings schedule of 500.00 on day 10;
    - a Rent budget of 2,100.00 from 2026-11.

    `GET /api/v1/budget-plan?month=2026-12` returns:
    - `expected_income.amount == 850000`, with `expected_items` holding two entries;
    - `installments.amount` equal to the 2026-12 statement's installment of the October purchase only. Read the value from `GET /api/v1/commitments?month=2026-12` before the November purchase, and assert the two are equal;
    - `savings.amount == 50000`, `planned.amount == 210000`;
    - `source == "expected_income"`, `reference.amount == 850000`;
    - `unassigned.amount == 850000 - installments - 50000 - 210000`.
  - `TestS159AverageIncome`. Salary postings of 6,000.00 on 2026-09-05, 2026-10-05 and 2026-11-05, today 2026-12-01: month 2026-12 has `average_income.amount == 600000` and `average_months == 3`. A fixture with one posting on 2026-11-05 gives `average_months == 1`. A fixture with no postings has no `average_income`.
  - `TestS160NestedBudgets`. Budgets Food 1,800.00 and Supermarket 1,000.00 (child): `planned.amount == 180000`. The Supermarket row has `counted == false`.
  - `TestS164ReferenceDefault`. Without an income schedule and with postings: `source == "average_income"`. Without either: `source == "fixed"`, with no `reference` and no `unassigned`.
  - `TestBudgetPlanMonthBounds`. `month=2027-12` with today 2026-11-01 returns 422 on `month`; `month=2026-13` returns 422.
- [ ] **Step 6:** Run `go test ./internal/planning -run 'TestS15[89]|TestS16[04]|TestBudgetPlan'`. Expected: FAIL with 404 (no route).
- [ ] **Step 7:** Add the operation and schemas to `api/openapi.yaml` exactly as spec §4. `BudgetPlanSource` is `enum: [expected_income, average_income, fixed]`; money fields are `$ref: Money`. Run `make gen`. Implement `Service.BudgetPlan`:
  - categories, from `AccountFacts`;
  - own totals for M−3 to M, through one `OwnCategoryMonthlyTotals` call per class;
  - `PriorInstallments` per base-currency card, as `Committed` loops;
  - occurrences of kinds `income` and `savings` in M, in states `expected` and `realized`, valued as `Committed` values them, with A72 prices appended;
  - the reference default of A131.

  The month bound is the one of `BudgetProgress` (`s.horizon()`). Implement the handler in `httpapi/plan.go`, add the exposure entry, and update the domain docs listed under Files.
- [ ] **Step 8:** Run `go test ./internal/planning/... ./internal/server -run 'TestS15[89]|TestS16[04]|TestBudgetPlan|Plan|TestToolExposure'`. Expected: PASS.
- [ ] **Step 9: Commit** Tasks 2 and 3 together as `feat(planning): compute the budget plan of a month`.

**Checkpoint:** write `.claude/progress/current.md`.

## Slice 2: backend write and tools

### Task 4: `PUT /budget-plan`

**Files:**
- Modify: `api/openapi.yaml` (PUT on `/budget-plan`, `BudgetPlanInput`, `BudgetPlanAmount`)
- Modify: `internal/planning/internal/app/plan.go`, `internal/planning/internal/adapter/httpapi/plan.go`
- Modify: `internal/server/tool_exposure_test.go` (`"saveBudgetPlan": "manage_budget_or_goal"`)
- Modify: `docs/domain/05-domain-model.md` (A130), `docs/domain/06-scenarios.md` (S161 to S163)
- Test: `internal/planning/plan_test.go`

**Interfaces:**
- Produces:
  - `type PlanAmount struct{ CategoryID uuid.UUID; Amount money.Money }`
  - `func (s *Service) SaveBudgetPlan(ctx, userID int64, month time.Time, ref domain.Reference, amounts []PlanAmount) (Plan, error)`. It runs in one `s.repo.InTx` and returns `BudgetPlan(ctx, userID, month)` after the commit.

- [ ] **Step 1: Write failing tests:**
  - `TestS161SaveReplacesVersion`. Budget Food 1,800.00 from 2026-11 and a version of 2,000.00 from 2027-01; today 2026-11-10. PUT for month 2026-11 with Food 1,500.00 returns 200. `GET /budgets/{id}` then holds amounts `[2026-11: 150000, 2027-01: 200000]`. The plan row has `next_change == "2027-01"`. A second identical PUT returns 200 and still two amounts (Review Focus 3).
  - `TestS162SaveCreatesBudget`. PUT with Pets 210.00 and Gifts 0.00 (neither has a budget): `GET /budgets` lists one new budget, Pets with `rollover == false` and amounts `[2026-11: 21000]`. Gifts has no budget.
  - `TestS163SaveErrors`, table-driven, each 422 with the field named:
    - month 2026-10 with today 2026-11-10 → `month`;
    - the same category twice → `amounts[1].category_id`;
    - a category of another user → `amounts[0].category_id`;
    - an income category → `amounts[0].category_id`;
    - a closed category → `amounts[0].category_id` (Review Focus 1);
    - a negative amount → `amounts[0].amount`;
    - an amount in USD → `amounts[0].amount.currency`;
    - `source: "fixed"` without `fixed` → `fixed`.

    After the errors, `GET /budgets` is unchanged.
  - `TestS164ReferenceRoundTrip`. PUT with `source: "fixed"`, `fixed: 600000` and no amounts: `GET` returns `source == "fixed"`, `fixed.amount == 600000` and `reference.amount == 600000`.
  - `TestSavePlanListsOnlyItsCategories` (Review Focus 2). Food and Health budgets; a PUT with Food only leaves Health's amounts unchanged.
- [ ] **Step 2:** Run `go test ./internal/planning -run 'TestS16[1-4]|TestSavePlan'`. Expected: FAIL (405 or 404).
- [ ] **Step 3:** Add the operation and schemas, then run `make gen`. Implement `SaveBudgetPlan`:
  - validate before any write;
  - lock each existing budget with `LockBudget`;
  - `UpsertBudgetAmount` for existing budgets;
  - `InsertBudget` for categories without one when the amount is above zero;
  - `SaveBudgetReference`.

  A field error uses `domain.FieldError` with the indexed field names above. The month check compares `domain.MonthOf(month)` with `domain.MonthOf(s.clk.Today())`. Add the exposure entry and the docs.
- [ ] **Step 4:** Run the same command, plus `go test ./internal/server -run TestToolExposure`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planning): save a budget plan in one transaction`.

### Task 5: Assistant tools over the plan

**Files:**
- Modify: `internal/planning/internal/adapter/toolapi/budgets.go` (kind `plan`), `internal/planning/internal/adapter/toolapi/budget_goal.go` (action `save_plan`)
- Modify: `internal/server/testdata/tools.json` (regenerated)
- Modify: `docs/domain/06-scenarios.md` (S165, S166)
- Test: `internal/planning/budget_tool_test.go`

**Interfaces:**
- Consumes: `Service.BudgetPlan` and `Service.SaveBudgetPlan`.
- Produces:
  - `getBudgetsAndGoalsKind.Values()` returns `{"budgets", "goals", "both", "plan"}`. Kind `plan` returns the plan of `month` as a `planView` with the same JSON field names as `BudgetPlan`.
  - Action `save_plan` of `manage_budget_or_goal` takes `month`, `source`, `fixed` and `amounts[{category_id, amount}]`. It is previewed as a proposal, as `create_budget` is, before it runs.

- [ ] **Step 1: Write failing tests,** following the existing tests in `budget_tool_test.go` (`apitest.Tool` and `ExpectToolError`):
  - `TestS165PlanTool`: kind `plan` for 2026-12 in the S158 fixture returns `unassigned` equal to the HTTP value.
  - `TestS166SavePlanTool`: `save_plan` returns a proposal. Confirming it writes the amount, which the next `GET /budget-plan` shows. Rejecting it writes nothing.
- [ ] **Step 2:** Run `go test ./internal/planning -run 'TestS16[56]'`. Expected: FAIL.
- [ ] **Step 3:** Implement both, then run `go test ./internal/server -run TestToolCatalog -update` and review the diff of `tools.json`.
- [ ] **Step 4:** Run `go test ./internal/planning/... ./internal/server -run 'TestS16[56]|TestTool'`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planning): read and save the budget plan through the assistant`.

**Checkpoint.**

## Slice 3: web core

### Task 6: Plan API client and pure math

**Files:**
- Modify: `web/src/features/planning/api.ts`
- Create: `web/src/features/planning/plan-math.ts`, `web/src/features/planning/plan-math.test.ts`
- Modify: `web/src/testing/budget-api.ts` (a `budgetPlanFixture` and its route in `budgetApi()`)

**Interfaces:**
- Produces, in `api.ts`:
  - `budgetPlanQuery(api, month: string)`, with query key `["budget-plan", month]`;
  - `useSaveBudgetPlan(month: string)`, a mutation over `PUT /budget-plan`. On success it invalidates `["budget-plan"]`, `budgetsQuery` and `budgetProgressQuery`.
- Produces, in `plan-math.ts` (all amounts are integers in minor units):
  - `largestRemainder(total: number, weights: readonly number[]): number[]`. The parts sum to `total`, and ties go to the lower index. It returns all zeros when every weight is 0.
  - `fitToRoom(proposed: ReadonlyMap<string, number>, room: number): Map<string, number>`. It scales by `largestRemainder(room, values)` when `sum > room`; otherwise it returns a copy.
  - `planTotals(rows: readonly PlanDraftRow[], plan: BudgetPlan): { planned: number; unassigned: number | undefined }`. Only counted rows count; `unassigned` is `reference − installments − savings − planned`.
  - `planShare(amount: number, reference: number): number | undefined`, in basis points with integer arithmetic. It returns `undefined` when `reference <= 0`.
  - `fromShare(bp: number, reference: number): number`, rounding half up.
  - `suggestion(rows: readonly PlanDraftRow[], basis: "average" | "last_month"): Map<string, number>`, per A132.
  - `type PlanDraftRow = BudgetPlanRow & { draft: number }`.

- [ ] **Step 1: Write failing tests** in `plan-math.test.ts`:
  - `largestRemainder(3, [5,4,3,2,1])` equals `[1,1,1,0,0]` (Review Focus 5);
  - `largestRemainder(1000, [1,1,1])` equals `[334,333,333]`;
  - `largestRemainder(500, [0,0])` equals `[0,0]`;
  - `fitToRoom` of `{a: 600, b: 400}` with room 500 gives `{a: 300, b: 200}`; room 2000 gives the input unchanged;
  - `planShare(283000, 850000) === 3329`; `planShare(1, 0) === undefined` (Review Focus 4);
  - `fromShare(1200, 850000) === 102000`;
  - `suggestion` leaves out a row with `average === draft` and a row with both values 0;
  - `planTotals` on the spec §1 data (base 850000, installments 64000, savings 0, groups summing 570000) gives `unassigned === 216000`, and skips a row with `counted: false`.
- [ ] **Step 2:** Run `pnpm --dir web exec vitest run src/features/planning/plan-math.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Run `make gen` so `schema.gen.ts` has `BudgetPlan`. Implement `plan-math.ts` and `api.ts`, and add the fixture: the spec's sample month with base 8,500.00, installments 640.00, and the twelve rows of the mockup data.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): plan math and budget plan client`.

### Task 7: Plan draft state

**Files:**
- Create: `web/src/features/planning/use-plan-draft.ts`, `web/src/features/planning/use-plan-draft.test.ts`

**Interfaces:**
- Produces `usePlanDraft(plan: BudgetPlan)`, which returns:
  ```ts
  {
    rows: PlanDraftRow[];
    source: BudgetPlanSource; fixed: number | undefined;
    pending: number;           // changed rows plus 1 when the reference changed
    delta: number;             // sum of draft − planned over counted rows
    set(categoryId: string, amount: number): void;
    revert(categoryId: string): void;
    setSource(source: BudgetPlanSource, fixed?: number): void;
    apply(changes: ReadonlyMap<string, number>): void;  // one undo step
    distribute(mode: "proportional" | { categoryId: string }): void; // one undo step
    undo(): void; canUndo: boolean;
    discard(): void;           // one undo step
    payload(): BudgetPlanInput; // changed rows only
  }
  ```
  A refetched `plan` with a new identity resets the draft only when `pending === 0`.

- [ ] **Step 1: Write failing tests** with `renderHook`:
  - `set` then `payload()` holds that row only;
  - `revert` restores it, and `pending` returns to 0;
  - `distribute("proportional")` on unassigned 216000 adds parts that sum to 216000, after which `planTotals(...).unassigned === 0`;
  - `undo` after `apply` restores the previous drafts;
  - `distribute` is a no-op when unassigned ≤ 0.
- [ ] **Step 2:** Run `pnpm --dir web exec vitest run src/features/planning/use-plan-draft.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the hook with `useReducer`, keeping an undo stack of draft snapshots.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): plan draft with undo`.

**Checkpoint.**

## Slice 4: web screen

All copy lives in a new pair `web/src/i18n/catalog-budget-plan.en.ts` and `catalog-budget-plan.pt-BR.ts`, with keys prefixed `plan.`, wired as `catalog-reports.*` is wired. English copy follows spec §5. The pt-BR copy uses: "Planejar", "Acompanhar", "Falta distribuir", "Acima da base", "Base de referência", "Receita prevista", "Média de {n} meses", "Valor fixo", "Recebido até agora", "Distribuir o restante", "Na proporção do plano", "Tudo em uma categoria…", "Sugerir pelo histórico", "Média de 3 meses", "Gasto em {month}", "Sem orçamento", "dentro de {ancestor}", "era {amount}", "média {amount}", "Salvar plano", "Descartar", "Vale a partir de {month}", "Plano de {month} salvo", "Descartar {n} alterações?", "Continuar editando", "Meses passados são somente leitura", "Mostre os valores para editar o plano", "Aplicar {n} marcadas", "Ajustar à base", "Desfazer".

### Task 8: Plan view, reference panel, bar, table and save bar

**Files:**
- Create: `web/src/features/planning/budget-plan-tab.tsx`, `plan-reference-panel.tsx`, `plan-allocation-bar.tsx`, `plan-table.tsx`, `plan-row.tsx`, `plan-save-bar.tsx`, `budget-plan.module.css`
- Create: `web/src/features/planning/budget-plan.test.tsx`
- Create: `web/src/i18n/catalog-budget-plan.en.ts`, `catalog-budget-plan.pt-BR.ts`
- Modify: `web/src/features/planning/planning-search.ts` (`view?: "plan" | "track"`), `web/src/features/planning/planning-page.tsx` (segmented control, default view rule of spec §5)

**Interfaces:**
- Consumes: Tasks 6 and 7.
- Produces: `BudgetPlanTab({ month }: { month: string })`. `planning-page.tsx` renders it for `view=plan`, and the existing `BudgetsTab` for `view=track`.

- [ ] **Step 1: Write failing tests** in `budget-plan.test.tsx` with `renderApp("/planning?tab=budgets&view=plan&month=2026-11", { fetch: budgetApi() })`:
  - `"shows the unassigned amount of the month"`: the text `R$2,160.00` inside the region named by `plan.unassigned`;
  - `"recomputes while typing"`: typing in the input labelled `Planned for Energy` changes the unassigned figure by the same amount;
  - `"applies the average from the chip"`: activating `average R$205.00` sets the input to 205.00;
  - `"reverts a row with Escape"`;
  - `"moves to the next row with Enter"`: focus is on the next input;
  - `"saves only changed rows"`: the PUT body equals `{ source: "expected_income", amounts: [{ category_id: <energy>, amount: { amount: 18000, currency: "BRL" } }] }`;
  - `"keeps changes when the save fails"`: a 422 on `amounts[0].amount` shows an `Alert`, and the row stays changed;
  - `"opens Track by default for the current month and Plan for a later one"`, with `apitest`-style `today` 2026-11-10;
  - `"shows a bar segment per group with its share"`: the button `Housing, R$2,830.00, 33.3% of the reference`.
- [ ] **Step 2:** Run `pnpm --dir web exec vitest run src/features/planning/budget-plan.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement per spec §5.1 and §5.2:
  - inputs are `MoneyInput size="field"` in currency mode, and a percentage `TextField` in percent mode;
  - the largest figure tweens through `requestAnimationFrame` over 180 ms, skipped under `prefers-reduced-motion`;
  - bar segments are `<button>`, with CSS `flex-grow` transitions;
  - Enter, Shift+Enter, Esc and Ctrl/Cmd+S are handled at the table level;
  - the live region is debounced 500 ms.
- [ ] **Step 4:** Run the same command, then `make web-check`. Expected: PASS, with no lint or type errors.
- [ ] **Step 5: Commit** `feat(web): plan the month's budgets against a reference income`.

### Task 9: Suggestion, distribution, guard, sticky strip and states

**Files:**
- Create: `web/src/features/planning/plan-toolbar.tsx`, `plan-suggestion-banner.tsx`, `plan-sticky-strip.tsx`, `plan-discard-dialog.tsx`
- Modify: `budget-plan-tab.tsx`, `plan-table.tsx` (Suggested column in review mode)
- Test: `web/src/features/planning/budget-plan.test.tsx`

**Interfaces:**
- Consumes: `suggestion`, `fitToRoom`, and `apply`, `distribute` and `undo` from Tasks 6 and 7.

- [ ] **Step 1: Write failing tests:**
  - `"reviews a suggestion before applying it"`:
    - choosing `3-month average` shows the banner with `8` rows and `+R$715.00` (Energy +25, Market +140, Restaurants +120, Fuel −40, Apps +30, Outings +110, Pets +210, Gifts +120);
    - unchecking Restaurants and applying changes seven rows;
    - nothing was sent to the server;
    - **Undo** in the toast restores them.
  - `"fits a suggestion to the reference"`: with fixed source 6,000.00, the switch is on, and the applied sum equals the room.
  - `"distributes the rest in proportion"`: afterwards the unassigned figure reads `R$0.00`.
  - `"asks before discarding pending changes"`: switching the month with one change opens the dialog, and **Keep editing** keeps the month.
  - `"reads past months only"`: month 2026-10 with today 2026-11-10 has no enabled input and shows the read-only note.
  - `"hides amounts in privacy mode"`: render hidden and call `expectNoAmounts`; the `Alert` with the privacy action is present.
  - `"lists top-level categories when there is no history"`.
  - `"phone layout keeps the save bar"`, under the compact query used by `budgets.test.tsx`.
- [ ] **Step 2:** Run `pnpm --dir web exec vitest run src/features/planning/budget-plan.test.tsx`. Expected: FAIL on the new cases.
- [ ] **Step 3:** Implement per spec §5.2 and §5.3:
  - the sticky strip uses `IntersectionObserver` on the reference panel;
  - the guard covers month and view changes through the page's own navigation handlers, and route leave through TanStack Router's blocker;
  - toasts use the Slotted toast family.
- [ ] **Step 4:** Run the same command, then `make web-check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): suggest, distribute and guard the budget plan`.

**Final step of the slice:** run `make check`. Expected: exit 0. Write the checkpoint.
