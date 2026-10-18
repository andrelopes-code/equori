# Web Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the planning screens of the web track (schedules and occurrences, budgets, projection, goals, committed amounts, the Home section) and the five backend gaps B1–B5 they need.

**Architecture:** Five backend tasks (B1–B5) come first in the `planning` module. The web part adds `web/src/features/planning/`, which consumes `features/accounts`, `features/transactions` and `features/setup` through their `index.ts`; `app/router.tsx` composes the planning routes and passes `ComingUpSection` to `HomePage`. Pure logic (dates, recurrence text, basis points, projection merge, budget and goal arithmetic) lands in one task before the screens.

**Tech Stack:** Go 1.27, sqlc, oapi-codegen; the web stack of sub-project 1 unchanged (React 19.3.1, TanStack Router 1.170.41, TanStack Query 5.104.1, Slotted `0.1.0-beta.2`, Vitest 5.0.5, Testing Library). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-18-web-planning-design.md` (P1–P30, Routes, Phone ergonomics, Data, Problem codes, Backend gaps, Tests). Inherited: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md`, `docs/superpowers/specs/2026-10-18-web-cards-design.md`, `docs/superpowers/specs/2026-10-18-web-import-classification-design.md`.

**Start condition:** every task of `docs/superpowers/plans/2026-10-18-web-cards.md` and `docs/superpowers/plans/2026-10-18-web-import-classification.md` is committed. Task 17 relies on `web/src/features/cards/card-overview-page.tsx`; Tasks 16 and 18 rely on the side navigation, More sheet and `web/src/app/routes-responsive.test.tsx` as left by import Task 22.

## Global Constraints

- Every Global Constraint of `docs/superpowers/plans/2026-10-18-web-cards.md` applies (Slotted docs and skills read before a screen, O1 `react/no-multi-comp`, O6 no literal JSX text, kebab-case files, pt-BR test strings with `writeLocale("pt-BR")`, fixed `today`, verification commands, pre-commit handling, execution slices).
- P1: `features/planning` imports `@/features/accounts`, `@/features/transactions` and `@/features/setup` (`settingsQuery`, `instrumentsQuery`) through `index.ts` only; none of them imports `@/features/planning`. Cross-feature composition lives in `web/src/app/`.
- P5: the client never computes an occurrence date or a business-day rule; dates come from `listOccurrences` and `getProjection`.
- O7: money is `{ amount: number; currency: string }` in integer minor units; percent, share and monthly-need arithmetic runs on integers or strings, never on floats.
- P30: occurrence, projection and committed queries set `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true`.
- Query keys and invalidations are exactly the spec's Data tables; planning mutations never call `transactionMutated`.
- Routed form drafts use the sessionStorage keys of the spec's Data section through `planning-draft.ts`; a restored draft is validated field by field and discarded when invalid.
- Every new route is registered in `web/src/app/router.tsx` under `authedRoute`; search params are validated with `validateSearch`; an invalid value falls back to its default.
- Web test fixture: `06-scenarios.md` 6.1 through `web/src/testing/planning-api.ts`; Today 2026-11-01 unless a test states otherwise.
- Each spec scenario ID (S27–S29, S60–S63) appears in the name of the web flow test that covers it, and in the Go test name of B1–B5 where the Backend gaps table names it.
- Each screen task ends with a jsdom responsive test at 360, 768 and 1280 (`setViewport` from `@/testing/viewport`) and a manual note: the route at the three widths in devtools, no horizontal scroll.
- Backend: every new query filters by `user_id` (ADR 003); each new endpoint has an apitest where another user receives 404. Commit scope `planning` for Tasks 1–5, `web` otherwise.
- Backend verification: `make db-up && go test ./internal/planning/ -run <Test> -count=1`, then `make check`. Web verification: `cd web && pnpm vitest run <files>`, then `make web-check`.

## Review Focus

1. A tolerance typed with the pt-BR decimal comma (`10,5`) posts `match_tolerance_bp: 1050`; `100,01` and `abc` show a field error and post nothing. Test: Task 6, `percentToBp` rows `comma decimal`, `above 100`, `not a number`.
2. Date windows and the projection `to` stay on the calendar date in a timezone west of UTC, and month-end clamps (`2027-01-31` + 1 month → `2027-02-28`). Test: Task 6, `plan-dates` rows `UTC boundary`, `month-end clamp`.
3. With more schedules than one page (`next_cursor` present), occurrences of a page-2 schedule show its description. Test: Task 7, `reads every schedule page`.
4. A double tap on the realize submit sends one `realizeOccurrence` request. Test: Task 10, `realizes once`.
5. The combined projection with no available base-currency account issues no `getProjection` request and renders the empty state, not a chart at zero. Test: Task 14, `combined without accounts`.

## Spec ambiguities resolved

| Topic | Resolution |
|---|---|
| B1 field values | `realized_by` enum `[auto, manual]`, present only while `state` is `realized`; `skip_reason` string `maxLength: 200`, present only when stored. Both come from `domain.Occurrence.RealizedBy` and `SkipReason`, already loaded. |
| B2 `payee_id: null` | The schema marks `payee_id` `nullable: true` with `x-go-type: json.RawMessage`, `x-go-type-import: {path: encoding/json}`, `x-go-type-skip-optional-pointer: true`: an absent key decodes to an empty `RawMessage`, `null` to the bytes `null` (encoding/json calls `UnmarshalJSON` on null). No dependency is added. |
| B2 empty body | `minProperties: 1` makes the contract middleware answer 400 `invalid_request`. An unknown `payee_id` returns 422 `validation_failed` on `payee_id` through `Ledger.MissingPayees`. |
| B3 shape | `operationId: listBudgetProgress`; `MonthBudgetProgress { month, items: BudgetProgressItem[] }`; items ordered by budget `id` (uuidv7, creation order). Another user receives `items: []`; the 404 isolation check applies to B4 and B5. |
| B4, B5 names | `updateBudget`, `deleteBudget`, `updateGoal`, `deleteGoal`. Budget amounts and goal accounts are removed by `ON DELETE CASCADE` (migrations 00018, 00019). A goal patch merges onto the stored goal, then runs the `CreateGoal` validation; `account_ids` replaces the set. |
| S62 `to` | The web test uses Today 2026-11-01 and `months=3`, asserts the request `to=2027-02-01` (P22), and serves the S62 response body; rendered values come from the response. |
| Recurrence text | Yearly reads day and month of `start`; daily renders "Daily" or "Every N days"; an end appends ", until <date>" or ", N times". pt-BR ordinals carry the weekday gender (sábado, domingo masculine). |
| Schedule list | One `listOccurrences` over the P7 upcoming window for every schedule; next date = the earliest `expected` or `overdue` item per `schedule_id`. Kind and state filters run client-side. |
| Schedule defaults | `match_tolerance_bp` and `grace_days` are omitted from the create body while equal to 1000 and 3 (S27 body). `adjustment` is always sent. |
| Edit body | B2 sends only changed fields; save stays disabled while nothing changed; clearing the payee sends `payee_id: null`. |
| Categories | Counterpart and budget pickers list accounts of class `expense` or `income` from `accountsQuery`, labelled by tree path. |
| Base currency | `settingsQuery` from `@/features/setup` gives the base currency (P23, P26); `instrumentsQuery` gives the instrument kind of an account currency (P14). |
| Percent display | `formatBp(3361, "pt-BR")` → `"33,61%"`, `("en")` → `"33.61%"`. |
| Home composition | `web/src/app/home-route.tsx` renders `<HomePage sections={[ComingUpSection]} />`; an inline component in `router.tsx` breaks `react/no-multi-comp`. |

## File Structure

```
api/openapi.yaml                                         B1–B5 fields, operations, schemas
db/queries/planning/{schedule.sql,budget.sql,goal.sql}   UpdateScheduleMetadata, BudgetsOfUser, SetBudgetRollover,
                                                         DeleteBudget, UpdateGoal, DeleteGoalAccounts, DeleteGoal
internal/planning/internal/app/{ports.go,schedules.go,budgets.go,goals.go}
internal/planning/internal/adapter/postgres/repository.go
internal/planning/internal/adapter/httpapi/{schedules.go,budgets.go,goals.go}
internal/planning/{realize_test.go,schedule_patch_test.go,budget_progress_test.go,budget_patch_test.go,goal_patch_test.go}
web/src/i18n/{catalog.en.ts,catalog.pt-BR.ts}
web/src/testing/planning-api.ts                          fixture and fake routes
web/src/app/{router.tsx,home-route.tsx,routes-responsive.test.tsx}, web/src/app/shell/{side-nav.tsx,more-sheet.tsx,app-frame.test.tsx}
web/src/features/accounts/{balance-groups.ts,index.ts,home-page.tsx,account-page.tsx}
web/src/features/cards/card-overview-page.tsx
web/src/features/planning/
  index.ts, api.ts
  plan-dates.ts, recurrence-text.ts, schedule-state.ts, basis-points.ts, occurrence-sign.ts,
  projection-merge.ts, budget-math.ts, goal-math.ts, planning-draft.ts (+ *.test.ts)
  schedules-page, schedule-row, schedule-new-page, schedule-form, schedule-form-state.ts, recurrence-editor,
  advanced-fields, counterpart-select, schedule-page, schedule-summary, terms-list, pause-list, occurrence-list,
  occurrence-row, occurrence-actions, realize-dialog, unrealize-dialog, skip-dialog, move-dialog,
  schedule-actions, schedule-edit-page, schedule-terms-page, pause-dialog, end-dialog,
  budgets-page, budget-row, budget-totals, month-controls, budget-new-page, budget-page, budget-amounts,
  add-amount-dialog, budget-history, delete-budget-dialog, projection-page, projection-chart, projection-stats,
  projection-points, foreign-accounts, goals-page, goal-card, goal-form-page, delete-goal-dialog,
  planning-page, committed-cards, overview-occurrences, overview-budgets, overview-goals, overview-projection,
  coming-up-section
```

---

### Task 1: B1, `realized_by` and `skip_reason` on occurrences

**Files:**
- Modify: `api/openapi.yaml` (`Occurrence` gains optional `realized_by`, `skip_reason`)
- Modify: `internal/planning/internal/adapter/httpapi/schedules.go` (`toOccurrenceAPI`); `internal/planning/internal/adapter/postgres/repository.go` only if its row-to-domain conversion drops `realized_by` or `skip_reason`
- Test: `internal/planning/realize_test.go`, `internal/planning/schedules_test.go` (`occurrenceView` gains `RealizedBy`, `SkipReason`)

**Interfaces:**
- Produces: `Occurrence.realized_by?: "auto" | "manual"`, `Occurrence.skip_reason?: string` on every occurrence response (`listOccurrences`, realize, unrealize, skip, move).

- [ ] **Step 1: Write the failing tests.**
  - `TestS27RealizedByAndSkipReason` (`newFixture(t, "2026-11-01")`, `f.rentSchedule()`): `f.pay("2026-11-05", 210000, f.rent, f.landlord)` and `f.h.Dispatch()` → sequence 1 `realized_by: "auto"`; `f.pay("2026-12-01", 150000, f.rent, f.landlord)` (outside the 10 % tolerance, stays unmatched), then `POST /api/v1/occurrences/{seq 2}/realize` `{transaction_id}` → 200 with `realized_by: "manual"`; `POST /occurrences/{seq 3}/skip` `{"reason":"Moved out"}` → `listOccurrences` returns `skip_reason: "Moved out"` on sequence 3; decoded into `map[string]any`, an `expected` item has neither key and sequence 1 has no `skip_reason`.
  - `TestOccurrenceStateFilter` (`newFixture(t, "2026-11-09")`, rent schedule, no payment): `from=2026-11-01&to=2026-11-30&state=overdue` returns exactly the 2026-11-05 occurrence; `state=expected` over the same window returns `[]`.
- [ ] **Step 2: Run** `make db-up && go test ./internal/planning/ -run 'TestS27RealizedByAndSkipReason|TestOccurrenceStateFilter' -count=1` → FAIL on the missing keys (the state filter test may pass on first run; it pins the open risk of the spec).
- [ ] **Step 3: Contract and mapping.** Add the two properties; `make gen`; map `o.RealizedBy` and `o.SkipReason` to pointers that stay nil on empty strings.
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(planning): expose how an occurrence was realized or skipped"`.

### Task 2: B2, `PATCH /schedules/{id}`

**Files:**
- Modify: `api/openapi.yaml` (`/schedules/{id}` gains `patch`, schema `SchedulePatch`), `db/queries/planning/schedule.sql`
- Modify: `internal/planning/internal/app/{ports.go,schedules.go}`, `internal/planning/internal/adapter/postgres/repository.go`, `internal/planning/internal/adapter/httpapi/schedules.go`
- Test: `internal/planning/schedule_patch_test.go`

**Interfaces:**
- Produces: `operationId: updateSchedule`; `SchedulePatch` (`additionalProperties: false`, `minProperties: 1`): `description` 1–200, `payee_id` per the ambiguity table, `match_tolerance_bp` 0–10000, `grace_days` 0–31; responses 200 `Schedule`, 400, 401, 404, 422.
- Produces: `app.SchedulePatch { Description *string; PayeeSet bool; PayeeID uuid.UUID; MatchToleranceBP *int; GraceDays *int }` (`PayeeSet` with `uuid.Nil` clears), `(*Service).UpdateSchedule(ctx context.Context, userID int64, id uuid.UUID, p SchedulePatch) (domain.Schedule, error)`: `InTx`, `LockSchedule`, apply, `MissingPayees`, `Repository.UpdateSchedule(ctx, userID int64, s domain.Schedule) (domain.Schedule, error)`; no occurrence is regenerated.
- Produces: `-- name: UpdateScheduleMetadata :one` updating description, payee, tolerance and grace days `WHERE user_id = @user_id AND id = @id RETURNING *`.

- [ ] **Step 1: Write the failing test `TestUpdateSchedule`** (`newFixture(t, "2026-11-06")`, rent schedule with `payee_id` Landlord), status asserted before decoding:

| Row | Request | Expected |
|---|---|---|
| description | `{"description":"House rent"}` | 200; `GET /schedules/{id}` description `House rent`, payee unchanged |
| clear payee | `{"payee_id":null}` | 200; response has no `payee_id` key |
| keep payee | `{"grace_days":5}` | payee unchanged |
| grace 0 | `{"grace_days":0}` | 2026-11-05 occurrence `overdue` (it reads `expected` before the patch); occurrence ids and count unchanged |
| empty | `{}` | 400 `invalid_request` |
| unknown payee | random UUID | 422 `validation_failed`, field `payee_id` |
| other user | `h.Login("other@example.com")` | 404 `not_found` |

- [ ] **Step 2: Run** `go test ./internal/planning/ -run TestUpdateSchedule -count=1` → FAIL (405).
- [ ] **Step 3: Implement** contract, `make gen`, query, repository, service, handler `UpdateSchedule` (`len(body.PayeeId) > 0` sets `PayeeSet`; `null` keeps `uuid.Nil`, otherwise `uuid.Parse`).
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(planning): edit the description, payee and matching of a schedule"`.

### Task 3: B3, `GET /budget-progress`

**Files:**
- Modify: `api/openapi.yaml` (path `/budget-progress`, schemas `MonthBudgetProgress`, `BudgetProgressItem`), `db/queries/planning/budget.sql` (`BudgetsOfUser`)
- Modify: `internal/planning/internal/app/{ports.go,budgets.go}`, `internal/planning/internal/adapter/postgres/repository.go`, `internal/planning/internal/adapter/httpapi/budgets.go`
- Test: `internal/planning/budget_progress_test.go`

**Interfaces:**
- Produces: `operationId: listBudgetProgress`, query `month` required, pattern `^[0-9]{4}-[0-9]{2}$`; `BudgetProgressItem { budget_id, category_id, rollover, planned, carried, spent, available }`, all required.
- Produces: `Repository.Budgets(ctx context.Context, userID int64) ([]domain.Budget, error)` (`SELECT * FROM planning_budget WHERE user_id = @user_id ORDER BY id` plus `ListBudgetAmounts`); `app.MonthItem { Budget domain.Budget; Progress domain.Progress; Currency money.Currency }`; `(*Service).MonthProgress(ctx context.Context, userID int64, month time.Time) ([]MonthItem, error)`, which skips a budget whose first `effective_from` is after `month` and shares the computation of `BudgetProgress` through an extracted `progressOf`.

- [ ] **Step 1: Write the failing test `TestS60MonthBudgetProgress`** reusing the setup of `TestS60BudgetWithRollover` plus the 2026-12 amount 200000: 2026-10 → `(180000, 0, 150000, 30000)`; 2026-11 → `(180000, 30000, 230000, −20000)`; 2026-12 → `(200000, −20000, 0, 180000)` (`checkProgress` order planned, carried, spent, available); a second budget on Salary created with `effective_from` 2026-12 is absent from 2026-11 and second in 2026-12; `month=2026-13` → 400; missing `month` → 400; another user → 200 `items: []`.
- [ ] **Step 2: Run** `go test ./internal/planning/ -run TestS60MonthBudgetProgress -count=1` → FAIL.
- [ ] **Step 3: Implement** contract, `make gen`, query, repository, service, handler `ListBudgetProgress` (reuses `parseMonth`).
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(planning): read the progress of every budget of a month"`.

### Task 4: B4, budget rollover and deletion

**Files:**
- Modify: `api/openapi.yaml` (`/budgets/{id}` gains `patch` with `BudgetPatch { rollover }` required, and `delete`), `db/queries/planning/budget.sql`
- Modify: `internal/planning/internal/app/{ports.go,budgets.go}`, `internal/planning/internal/adapter/postgres/repository.go`, `internal/planning/internal/adapter/httpapi/budgets.go`
- Test: `internal/planning/budget_patch_test.go`

**Interfaces:**
- Produces: `updateBudget` → 200 `Budget`; `deleteBudget` → 204; both 404 for an unknown or foreign id. `Repository.SetBudgetRollover(ctx, userID int64, id uuid.UUID, rollover bool) (domain.Budget, error)` (`SetBudgetRollover :one`), `Repository.DeleteBudget(ctx, userID int64, id uuid.UUID) error` (`DeleteBudget :execrows`, zero rows → the existing not-found sentinel); service methods `SetBudgetRollover` and `DeleteBudget` with the same parameters.

- [ ] **Step 1: Write the failing test `TestS60BudgetRolloverAndDelete`** (S60 setup): `PATCH {"rollover":false}` → 200 `rollover: false`; progress 2026-11 → carried 0, available −50000; `{}` → 400; `DELETE` → 204; `GET /budgets/{id}` → 404; `GET /budgets/{id}/progress?month=2026-11` → 404; `createBudget` on Food → 201; another user's `PATCH` and `DELETE` → 404.
- [ ] **Step 2: Run** `go test ./internal/planning/ -run TestS60BudgetRolloverAndDelete -count=1` → FAIL.
- [ ] **Step 3: Implement** contract, `make gen`, queries, repository, service, handlers.
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(planning): change budget rollover and delete a budget"`.

### Task 5: B5, goal edit and deletion

**Files:**
- Modify: `api/openapi.yaml` (`/goals/{id}` gains `patch` with `GoalPatch` and `delete`), `db/queries/planning/goal.sql`
- Modify: `internal/planning/internal/app/{ports.go,goals.go}`, `internal/planning/internal/adapter/postgres/repository.go`, `internal/planning/internal/adapter/httpapi/goals.go`
- Test: `internal/planning/goal_patch_test.go`

**Interfaces:**
- Produces: `GoalPatch` (properties of `GoalInput`, none required, `minProperties: 1`, `additionalProperties: false`); `updateGoal` → 200 `Goal`, 400, 404, 422; `deleteGoal` → 204, 404.
- Produces: `app.GoalPatch { Name *string; Target *money.Money; DueOn *time.Time; AccountIDs []uuid.UUID }`; `(*Service).UpdateGoal(ctx context.Context, userID int64, id uuid.UUID, p GoalPatch) (GoalView, error)`; `(*Service).DeleteGoal(ctx context.Context, userID int64, id uuid.UUID) error`; `validateGoal(ctx, userID int64, g domain.Goal) error` extracted from `CreateGoal`; `Repository.UpdateGoal(ctx, userID int64, g domain.Goal) (domain.Goal, error)` (rewrites the account set; a unique violation maps to the `name` field error of `InsertGoal`), `Repository.DeleteGoal(ctx, userID int64, id uuid.UUID) error`.

- [ ] **Step 1: Write the failing test `TestS61GoalUpdateAndDelete`** (setup of `TestS61GoalProgress`): `PATCH {"target":{"amount":2000000,"currency":"BRL"}}` → `remaining.amount` 991659, `progress_bp` 5041; with a second goal `Trip`, `PATCH {"name":"Emergency"}` on it → 422 field `name`; `account_ids` holding the Rent expense account → 422 field `account_ids`; `{}` → 400; `DELETE` → 204; `GET /goals/{id}` → 404; another user's `PATCH` and `DELETE` → 404.
- [ ] **Step 2: Run** `go test ./internal/planning/ -run TestS61GoalUpdateAndDelete -count=1` → FAIL.
- [ ] **Step 3: Implement** contract, `make gen`, queries, repository, service, handlers; `CreateGoal` calls `validateGoal`, and `TestS61GoalProgress` and `TestGoalErrors` stay green.
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(planning): edit and delete a goal"`.

### Task 6: Planning logic and problem messages

**Files:**
- Create: `web/src/features/planning/{plan-dates.ts,recurrence-text.ts,schedule-state.ts,basis-points.ts,occurrence-sign.ts,projection-merge.ts,budget-math.ts,goal-math.ts,planning-draft.ts}` and a `*.test.ts` beside each
- Modify: `web/src/features/accounts/{balance-groups.ts,index.ts}`, `web/src/i18n/catalog.en.ts`, `catalog.pt-BR.ts`

**Interfaces:**
- Produces (`Schedule`, `Recurrence`, `Projection`, `ProjectionPoint` from `components["schemas"]`):
  - `plan-dates.ts`: `addDays(date: string, n: number): string`, `addMonthsClamped(date: string, n: number): string`, `firstOfNextMonth(date: string): string`, `monthOf(date: string): string`, `addMonths(month: string, delta: number): string`, `monthRange(center: string, before: number, after: number): string[]`, `monthIndex(month: string): number` (year × 12 + month); every computation on `Date.UTC`.
  - `formatRecurrence(r: Recurrence, locale: Locale, t: ReturnType<typeof useT>): string` (keys `planning.recurrence.*`; weekday and month names from `Intl.DateTimeFormat(locale, { timeZone: "UTC" })`).
  - `scheduleState(s: Schedule, today: string): "active" | "paused" | "ended"`, `termsInForce(s: Schedule, today: string): ScheduleTerms` (P12).
  - `bpToPercent(bp: number): string` (`3361` → `"33.61"`), `percentToBp(text: string): number | null` (`.` or `,`, at most two decimals, 0–100), `formatBp(bp: number, locale: Locale): string`.
  - `occurrenceSign(kind: ScheduleKind, amount: Money): { money: Money; tone: "positive" | "neutral"; transfer: boolean }` (P9).
  - `mergeProjections(ps: Projection[]): { opening: number; closing: number; points: ProjectionPoint[] }`, `chartSeries(today: string, opening: number, points: ProjectionPoint[]): { date: string; balance: number }[]`, `lowestBalance(today: string, opening: number, points: ProjectionPoint[]): { amount: number; date: string }` (earliest date of the minimum).
  - `budgetShare(planned: number, carried: number, spent: number): number` (0–100, `Math.floor(spent × 100 / base)`, base = planned + carried; base ≤ 0 → 100 when spent > 0, else 0), `budgetTone(planned: number, carried: number, spent: number, available: number): "danger" | "warning" | "positive"` (P20), `historyMonths(firstEffective: string, selected: string): string[]` (P21; `[]` when first > selected).
  - `monthsLeft(dueOn: string, today: string): number`, `monthlyNeed(remaining: number, dueOn: string, today: string): number | null` (`null` when m ≤ 0; otherwise `Math.floor((remaining + m − 1) / m)`).
  - `loadDraft<T>(key: string, valid: (raw: unknown) => raw is T): T | null`, `saveDraft(key: string, value: unknown): void`, `clearDraft(key: string): void`; every storage call in `try`/`catch`.
  - `accountGroup(account: Account): Group | undefined` in `balance-groups.ts` (the `groupOfKind` lookup), exported from `accounts/index.ts`; `groupBalances` uses it.
  - Catalog: the seven problem codes of the spec with its en messages; pt-BR: `occurrence_closed` "Esta ocorrência já foi realizada, pulada ou liberada.", `transaction_in_use` "Essa transação já realiza outra ocorrência.", `pause_overlap` "Esta pausa se sobrepõe a outra pausa do agendamento.", `schedule_ended` "O agendamento termina nesta data ou antes dela.", `budget_exists` "Esta categoria já tem um orçamento.", `currency_unsupported` "O instrumento desta conta não pode ser usado aqui.", `price_missing` "Nenhuma cotação armazenada converte este valor.".

`mergeProjections` recomputes the running balance; the server's per-account `balance` is discarded:

```ts
const points = ps.flatMap((p) => p.points)
  .sort((a, b) => a.date.localeCompare(b.date) || a.amount.amount - b.amount.amount);
let running = ps.reduce((s, p) => s + p.opening.amount, 0);
const merged = points.map((p) => ({ ...p, balance: { ...p.balance, amount: (running += p.amount.amount) } }));
```

- [ ] **Step 1: Write the failing tests.**
  - `plan-dates`: `addDays("2026-11-01", 365)` → `"2027-11-01"`; `addDays("2026-11-01", −365)` → `"2025-11-01"`; **month-end clamp** `addMonthsClamped("2027-01-31", 1)` → `"2027-02-28"`; `firstOfNextMonth("2026-12-15")` → `"2027-01-01"`; **UTC boundary**: with `process.env.TZ = "America/Sao_Paulo"` restored in `afterEach`, `addDays("2026-11-01", 0)` → `"2026-11-01"`; `monthRange("2026-11", 12, 12)` has 25 entries from `"2025-11"` to `"2027-11"`.
  - `recurrence-text` (en and pt-BR): S27 rule → `"Monthly on day 5, next business day"` / `"Mensal no dia 5, próximo dia útil"`; `business_day_ordinal: 5` → `"Monthly on the 5th business day"` / `"Mensal no 5º dia útil"`; `weekday: "friday", ordinal: −1` → `"Monthly on the last Friday"` / `"Mensal na última sexta-feira"`; `weekday: "saturday", ordinal: −1` pt-BR → `"Mensal no último sábado"`; weekly interval 2 Monday → `"Every 2 weeks on Monday"` / `"A cada 2 semanas na segunda-feira"`; yearly start 2026-11-12 → `"Yearly on 12 Nov"` / `"Anual em 12 de nov."`; `day_of_month: −1` → `"Monthly on the last day"`; `count: 12` appends `", 12 times"`.
  - `schedule-state`: S29 pause 2027-02-01–2027-03-31 → paused on 2027-02-01 and 2027-03-31, active on 2027-04-01; `ends_on` 2027-06-01 → ended on 2027-06-01, active on 2027-05-31; terms 2026-11-01 and 2027-01-01 → on 2026-12-31 the first, on 2027-01-01 the second; **future only** (single terms 2027-01-01, today 2026-11-01) → that terms.
  - `basis-points`: `bpToPercent(3361)` → `"33.61"`, `(1000)` → `"10.00"`, `(5)` → `"0.05"`; `percentToBp("10.00")` → `1000`; **comma decimal** `("10,5")` → `1050`; `("10.555")` → `null`; **above 100** `("100.01")` → `null`; **not a number** `("abc")` → `null`; `formatBp(3361, "pt-BR")` → `"33,61%"`.
  - `occurrence-sign`: income 500000 → `+500000` positive; bill 210000 → `−210000` neutral; savings → `−` with `transfer: true`.
  - `projection-merge`: two accounts (openings 500000 and 100000; points 2026-11-05 −210000 and 2026-11-05 +50000) → opening 600000, order −210000 then +50000, balances 390000 and 440000; `lowestBalance` of S62 points → `{ amount: 290000, date: "2026-11-05" }`; with every point above opening → `(today, opening)`; `chartSeries` holds one vertex per date at the last balance of that date, the first at `(today, opening)`.
  - `budget-math`: 90 % boundary `budgetTone(1000, 0, 900, 100)` → warning, `(1000, 0, 899, 101)` → positive, available −1 → danger; `budgetShare(0, 0, 0)` → 0; `(0, 0, 5)` → 100; `(180000, 30000, 230000)` → 100; `historyMonths("2026-10", "2026-12")` → `["2026-10","2026-11","2026-12"]`; `("2025-01", "2026-12")` → 12 entries from `"2026-01"`; `("2027-01", "2026-12")` → `[]`.
  - `goal-math`: S61 `monthlyNeed(1991659, "2027-06-30", "2026-11-01")` → `284523`; due 2026-11-30 (m = 0) → `null`; due 2026-10-31 → `null`.
  - `planning-draft`: round-trip under `planning.goal.new`; an invalid stored value → `null`; throwing storage → load `null`, save does not throw.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning src/features/accounts/balance-groups.test.ts` → FAIL.
- [ ] **Step 3: Implement** the functions above.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add planning logic and problem messages"`.

### Task 7: Planning data layer and schedules list

**Files:**
- Create: `web/src/features/planning/{index.ts,api.ts,schedules-page.tsx,schedules-page.test.tsx,schedule-row.tsx}`, `web/src/testing/planning-api.ts`
- Modify: `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `transactionKeys` (`@/features/transactions`); `accountsQuery` (`@/features/accounts`); Task 6 functions.
- Produces in `planning/api.ts`: `planningKeys` with the keys of the spec's Data table (`all = [...transactionKeys.all, "planning"]`); `schedulesQuery(api)`, `budgetsQuery(api)`, `goalsQuery(api)` (all pages, `limit: 200`, `next_cursor`); `scheduleQuery(api, id)`, `budgetQuery(api, id)`, `goalQuery(api, id)`; `occurrencesQuery(api, { from, to, scheduleId?, state? })`, `projectionQuery(api, accountId, to)`, `committedQuery(api, month)` with the P30 options; `monthProgressQuery(api, month)` (B3), `budgetProgressQuery(api, budgetId, month)`; `occurrenceWindows(today): { upcoming; overdue; past }` (P7).
- Produces in `testing/planning-api.ts`: `rentID`, `salaryID`, `foodID` reuse, `rentScheduleID`, `rentSchedule` (S27), `occurrence(sequence: number, over?: Partial<Occurrence>): Occurrence`, `planningRoutes(over?)` = `sharedRoutes` + planning routes.
- Produces: route `/_authed/planning/schedules` (search `{ kind?: ScheduleKind; state?: "active" | "paused" | "ended" }`); `SchedulesPage` exported from `planning/index.ts`.

- [ ] **Step 1: Write the failing tests.**
  - The page requests `GET /schedules?limit=200` and one `GET /occurrences?from=2026-11-01&to=2027-11-01`; the Rent row renders description, kind tag, state tag Ativo, amount `R$ 2.100,00`, `"Mensal no dia 5, próximo dia útil"` and next date 2026-11-05; each row links `/planning/schedules/<id>`.
  - `?kind=income` lists only Salary; `?state=ended` lists only an ended schedule; `?kind=nope` falls back to every kind.
  - **reads every schedule page**: page 1 with `next_cursor: "c2"`, page 2 holding Salary → the second request carries `cursor=c2` and the Salary row shows its next date.
  - The "new schedule" action links `/planning/schedules/new`.
  - Responsive at 360/768/1280: at 360 each row renders description and amount on the first line, recurrence and next date on the second.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/schedules-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page`, `PageHeader`, `List`/`ListItemLink`, `Tag`, `Select` (filters), `Skeleton`, `ResultState` via `QueryError`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note: 360/768/1280 px without horizontal scroll.
- [ ] **Step 5: Commit** `git commit -m "feat(web): list planning schedules with their next occurrence"`.

### Task 8: Schedule form

**Files:**
- Create: `web/src/features/planning/{schedule-new-page.tsx,schedule-new-page.test.tsx,schedule-form.tsx,schedule-form-state.ts,schedule-form-state.test.ts,recurrence-editor.tsx,advanced-fields.tsx,counterpart-select.tsx}`
- Modify: `planning/api.ts` (`useCreateSchedule`), `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `accountsQuery`, `settingsQuery`, `instrumentsQuery`, `percentToBp`, `bpToPercent`, `saveDraft`/`loadDraft`.
- Produces: `RecurrenceDraft` (string-valued fields of P15), `recurrenceFromDraft(d: RecurrenceDraft): Recurrence`, `draftFromRecurrence(r: Recurrence): RecurrenceDraft`, `defaultRecurrence(today: string): RecurrenceDraft`, `toScheduleInput(v: ScheduleFormValues): ScheduleInput`; `RecurrenceEditor` props `{ value: RecurrenceDraft; onChange: (d: RecurrenceDraft) => void; errors: Record<string, string> }` (reused by Task 11); route `/_authed/planning/schedules/new`; `useCreateSchedule` invalidates per the Data table and navigates to `/planning/schedules/<id>`.

- [ ] **Step 1: Write the failing tests.**
  - `schedule-form-state`: `defaultRecurrence("2026-11-01")` → monthly, interval 1, day 1, adjustment `none`, end Never; selector Business day omits `adjustment` (A48); "Last" maps to `−1`; end After 12 → `count: 12`; tolerance `"10.00"` and grace `"3"` are omitted from the body.
  - **S27**: kind Conta, account Nubank checking, counterpart Moradia › Aluguel, payee Landlord, description `Rent`, amount `2.100,00`, day 5, adjustment following, start 2026-11-01 → posts exactly the S27 body of the spec and navigates to the detail.
  - **S28**: day 31, start 2027-01-31 → body `recurrence` `{frequency: "monthly", interval: 1, day_of_month: 31, adjustment: "none", start: "2027-01-31"}`.
  - Counterpart options by kind: `income` → income categories only; `transfer` → open balance accounts other than the chosen account; the account select excludes accounts whose currency is not a `currency` instrument.
  - `currency_unsupported` 422 with field `counterpart_id` renders its message under the counterpart select; `recurrence.day_of_month` 422 renders under the day input.
  - The draft under `planning.schedule.new` restores after remount; an invalid stored draft is discarded.
  - Responsive at 360: the recurrence editor is one stacked card; interval, day and count inputs carry `inputmode="numeric"`.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/schedule-form-state.test.ts src/features/planning/schedule-new-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page` `measure`, `Form`, `Select`, `TextField`, `CurrencyField`, `NumberField`, `SegmentedControl`, `DatePicker`, `Disclosure` (Advanced), `Button`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): create a schedule with its recurrence"`.

### Task 9: Schedule detail and occurrences

**Files:**
- Create: `web/src/features/planning/{schedule-page.tsx,schedule-page.test.tsx,schedule-summary.tsx,terms-list.tsx,pause-list.tsx,occurrence-list.tsx,occurrence-row.tsx}`
- Modify: `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `scheduleQuery`, `occurrencesQuery`, `occurrenceWindows`, `scheduleState`, `termsInForce`, `formatRecurrence`, `occurrenceSign`, `formatBp`.
- Produces: route `/_authed/planning/schedules/$scheduleId` (search `{ tab?: "upcoming" | "past" }`, default `upcoming`); `OccurrenceRow` props `{ occurrence: Occurrence; schedule: Schedule; actions?: ReactNode }` (reused by Task 16).

- [ ] **Step 1: Write the failing tests.**
  - **S27**: the upcoming tab requests `from=2026-11-01&to=2027-11-01&schedule_id=<rent>` and renders 2026-11-05, 2026-12-07, 2027-01-05; the description list shows `"Mensal no dia 5, próximo dia útil"`, tolerance `10,00%`, grace 3; **S27 realized after refetch**: the first response holds sequence 1 `expected`, a window `focus` refetches and the second response renders `realized` with a link to `/transactions/<tx>` and the "automatic" label from `realized_by`.
  - **S28**: the occurrence list renders 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30.
  - The past tab requests `from=2025-11-01&to=2026-10-31`; a skipped item renders the amount struck through and its `skip_reason`; a moved item renders "movida de 05/11/2026".
  - Terms render newest first with the in-force tag (P12); pauses list `from`–`to`.
  - Responsive: at 360 the state tag sits on the page-header line and each occurrence row has two lines (LP-01).
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/schedule-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page`, `PageHeader`, `DescriptionList`, `Tabs`, `List`, `Tag`, `MoneyText`, `Skeleton`, `QueryError`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show a schedule with its terms and occurrences"`.

### Task 10: Occurrence actions

**Files:**
- Create: `web/src/features/planning/{occurrence-actions.tsx,occurrence-actions.test.tsx,realize-dialog.tsx,unrealize-dialog.tsx,skip-dialog.tsx,move-dialog.tsx}`
- Modify: `planning/api.ts` (`useRealizeOccurrence`, `useUnrealizeOccurrence`, `useSkipOccurrence`, `useMoveOccurrence`, `realizeCandidatesQuery(api, occurrence, accountId, days)`), `planning/occurrence-row.tsx`, catalogs

**Interfaces:**
- Consumes: `OccurrenceRow`; `addDays`.
- Produces: `OccurrenceActions` props `{ occurrence: Occurrence; schedule: Schedule }` (P10 matrix; an `action-sheet` at width < 600, a menu otherwise); mutations invalidate `[...all, "occurrences"]`, `[...all, "projection"]`, `[...all, "committed"]`.

- [ ] **Step 1: Write the failing tests.**
  - Matrix: `expected` and `overdue` offer realize, skip, move; `realized` offers open transaction and unrealize; `skipped` offers none.
  - **S27 manual realize** for the 2026-12-07 occurrence: candidates request `GET /transactions?account_id=<checking>&from=2026-11-30&to=2026-12-14`; submit stays disabled until a radio is chosen; "Ampliar para ± 30 dias" requests `from=2026-11-07&to=2027-01-06` once; submit posts `{"transaction_id":"<id>"}`.
  - **S27 transaction_in_use** and **S27 occurrence_closed**: each 409 renders its catalog message inside the dialog.
  - **realizes once**: two clicks on submit → one request.
  - Skip posts `{"reason":"Mudança"}`, or `{}` with an empty reason; move posts `{"date":"2026-12-10"}`; a 422 with field `date` renders under the date input; `schedule_ended` on move renders its message.
  - Unrealize renders the statement that the transaction stays in the ledger, then posts.
  - Responsive: at 360 a row tap opens the action-sheet and the dialogs open as bottom drawers with the widen control and submit in the footer.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/occurrence-actions.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `ActionSheet`, `Menu`, `Dialog`/`Drawer`, `RadioGroup`, `TextField`, `DatePicker`, `InlineMessage`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): realize, skip and move schedule occurrences"`.

### Task 11: Schedule edit, terms, pause and end

**Files:**
- Create: `web/src/features/planning/{schedule-actions.tsx,schedule-edit-page.tsx,schedule-terms-page.tsx,pause-dialog.tsx,end-dialog.tsx,schedule-changes.test.tsx}`
- Modify: `planning/api.ts` (`useUpdateSchedule`, `useChangeScheduleTerms`, `usePauseSchedule`, `useEndSchedule`), `planning/schedule-page.tsx`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `RecurrenceEditor`, `draftFromRecurrence`, `recurrenceFromDraft`, `termsInForce`, `firstOfNextMonth`.
- Produces: routes `/_authed/planning/schedules/$scheduleId/edit` and `/terms`; mutations invalidate per the Data table.

- [ ] **Step 1: Write the failing tests.**
  - Edit: changing the description posts `PATCH /schedules/<id>` `{"description":"House rent"}`; clearing the payee posts `{"payee_id":null}`; save is disabled with no change; the draft key is `planning.schedule.edit.<id>`.
  - **S29 terms**: `effective_from` defaults to 2026-12-01; dates on or before the latest `effective_from` are disabled; 2027-01-01 with `44,90` posts `{"effective_from":"2027-01-01","amount":{"amount":4490,"currency":"BRL"}}` without `recurrence`; with "Alterar recorrência" on, the body carries `recurrence` prefilled from the latest rule.
  - **S29 pause** posts `{"from":"2027-02-01","to":"2027-03-31"}`; **S29 pause_overlap** renders its message; **S29 end** defaults `from` to the first day of next month, renders the removal statement and posts `{"from":"2027-06-01"}`; `schedule_ended` on terms renders its message.
  - **S29 paused state**: with Today 2027-02-15 the detail state tag renders Pausado.
  - Responsive: at 360 edit, change terms, pause and end sit in the "Ações do agendamento" action-sheet.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/schedule-changes.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `ActionSheet`, `Form`, `Switch`, `DatePicker`, `DateRangePicker`, `Dialog`/`Drawer`, `AlertDialog` (end).
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): edit, reprice, pause and end a schedule"`.

### Task 12: Budgets page and new budget

**Files:**
- Create: `web/src/features/planning/{budgets-page.tsx,budgets-page.test.tsx,budget-row.tsx,budget-totals.tsx,month-controls.tsx,budget-new-page.tsx,budget-new-page.test.tsx}`
- Modify: `planning/api.ts` (`useCreateBudget`), `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `monthProgressQuery`, `budgetsQuery`, `accountsQuery`, `budgetShare`, `budgetTone`, `monthRange`, `addMonths`.
- Produces: routes `/_authed/planning/budgets` (search `{ month?: string }`, `YYYY-MM`, default the current month) and `/budgets/new`; `MonthControls` props `{ month: string; onChange: (m: string) => void; options: string[] }` (reused by Task 13).

- [ ] **Step 1: Write the failing tests.**
  - **S60**: for `?month=2026-10`, `2026-11`, `2026-12` the Food row renders planned / carried / spent / available `R$ 1.800,00 / R$ 0,00 / R$ 1.500,00 / R$ 300,00`, `R$ 1.800,00 / R$ 300,00 / R$ 2.300,00 / −R$ 200,00` (danger, indicator 100), `R$ 2.000,00 / −R$ 200,00 / R$ 0,00 / R$ 1.800,00`; each request is `GET /budget-progress?month=<m>`.
  - Rows group under Despesas and Receitas by category class; the totals row sums planned, spent and available per group; carried is hidden on a `rollover: false` row.
  - Previous and next controls change `month`; the month select spans current month − 12 to + 12; **invalid month param** `?month=2026-13` renders 2026-11.
  - New budget: the category picker excludes Food (already budgeted); submit posts `{"category_id":"<id>","amount":{"amount":50000,"currency":"BRL"},"effective_from":"2026-11","rollover":true}`; **S60 budget_exists** 409 renders its message.
  - Responsive: at 360 the month controls sit in the page-header; a row shows category and available on line one, indicator and spent / planned on line two.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/budgets-page.test.tsx src/features/planning/budget-new-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page`, `PageHeader`, `Section`, `List`, `ProgressIndicator`, `MoneyText`, `Select`, `Switch`, `CurrencyField`, `Button`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show monthly budgets and create a budget"`.

### Task 13: Budget detail

**Files:**
- Create: `web/src/features/planning/{budget-page.tsx,budget-page.test.tsx,budget-amounts.tsx,add-amount-dialog.tsx,budget-history.tsx,delete-budget-dialog.tsx}`
- Modify: `planning/api.ts` (`useAddBudgetAmount`, `useUpdateBudget`, `useDeleteBudget`), `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `budgetQuery`, `budgetProgressQuery`, `historyMonths`, `MonthControls`.
- Produces: route `/_authed/planning/budgets/$budgetId` (search `{ month?: string }`).

- [ ] **Step 1: Write the failing tests.**
  - Amount versions render newest first with the in-force tag.
  - History with first amount 2026-10 and `?month=2026-12` issues exactly three `GET /budgets/<id>/progress` requests (2026-10, 2026-11, 2026-12) and none for 2026-09; the table renders the S60 rows; the chart receives planned + carried and spent per month.
  - **S60 add amount**: the month select starts after the latest version; 2026-12 with `2.000,00` posts `{"effective_from":"2026-12","amount":{"amount":200000,"currency":"BRL"}}`.
  - The rollover switch posts `PATCH /budgets/<id>` `{"rollover":false}`; delete opens an `AlertDialog`, sends `DELETE /budgets/<id>` and navigates to `/planning/budgets`.
  - Responsive at 360/768/1280: carried shows here at every width.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/budget-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement** (`useQueries` for the history). Families: `Page`, `DescriptionList`, `List`, `Chart` (bar), `Table`, `Dialog`/`Drawer`, `AlertDialog`, `Switch`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show budget history and manage its amounts"`.

### Task 14: Projection

**Files:**
- Create: `web/src/features/planning/{projection-page.tsx,projection-page.test.tsx,projection-chart.tsx,projection-stats.tsx,projection-points.tsx,foreign-accounts.tsx}`
- Modify: `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `projectionQuery`, `accountsQuery`, `accountGroup`, `settingsQuery`, `mergeProjections`, `chartSeries`, `lowestBalance`, `addMonthsClamped`.
- Produces: route `/_authed/planning/projection` (search `{ account_id?: string; months?: 1 | 3 | 6 | 12 }`, default 3); `ProjectionChart` props `{ series: { date: string; balance: number }[]; currency: string; height: number; compact?: boolean }` (reused by Task 16).

- [ ] **Step 1: Write the failing tests.**
  - **S62** (`?account_id=<checking>`, months 3): request `GET /accounts/<checking>/projection?to=2027-02-01`; the points table renders `−R$ 2.100,00 → R$ 2.900,00` on 2026-11-05, `+R$ 5.000,00 → R$ 7.900,00` on 2026-11-09, `−R$ 2.100,00 → R$ 5.800,00` and `+R$ 5.000,00 → R$ 10.800,00` on 2026-12-07; stat-cards opening `R$ 5.000,00`, lowest `R$ 2.900,00` on 05/11/2026, closing `R$ 10.800,00`.
  - Months control 6 → `to=2027-05-01`; a negative running balance renders in danger; closing ≠ last running balance renders the A56 note with the difference.
  - Combined (no `account_id`): two available BRL accounts → two requests and the merged values of Task 6; a USD account is listed below the chart with a link to its own projection; **combined without accounts** → no projection request and the empty state.
  - A point row links its schedule.
  - Responsive: at 360 the chart height is 200 px, the three stat-cards sit above it in one row, and each point is two lines.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/projection-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement** (`useQueries` for the combined case). Families: `Page`, `PageHeader`, `Select`, `SegmentedControl`, `StatCard`, `Chart` (line), `Table`, `List`, `EmptyState`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): project account balances from schedules"`.

### Task 15: Goals

**Files:**
- Create: `web/src/features/planning/{goals-page.tsx,goals-page.test.tsx,goal-card.tsx,goal-form-page.tsx,goal-form-page.test.tsx,delete-goal-dialog.tsx}`
- Modify: `planning/api.ts` (`useCreateGoal`, `useUpdateGoal`, `useDeleteGoal`), `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `goalsQuery`, `goalQuery`, `monthlyNeed`, `formatBp`, `accountsQuery`, `settingsQuery`.
- Produces: routes `/_authed/planning/goals`, `/goals/new`, `/goals/$goalId/edit`; `GoalCard` props `{ goal: Goal; compact?: boolean }` (reused by Task 16).

- [ ] **Step 1: Write the failing tests.**
  - **S61** card (target 3,000,000, current 1,008,341, due 2027-06-30): current `R$ 10.083,41`, remaining `R$ 19.916,59`, `33,61%`, monthly need `R$ 2.845,23`; a goal due 2026-11-30 renders the Vencida tag and no monthly need; `prices` render as "avaliado a" lines; cards sort by `due_on`.
  - **S61 create**: name `Emergency`, target `30.000,00` (currency defaults to BRL), due 2027-06-30, accounts [Emergency fund] → posts `{"name":"Emergency","target":{"amount":3000000,"currency":"BRL"},"due_on":"2027-06-30","account_ids":["<savings>"]}`.
  - Edit sends `PATCH /goals/<id>` with the changed fields only; a 422 on `name` renders under the name field; delete confirms through an `AlertDialog` and sends `DELETE /goals/<id>`.
  - `price_missing` 422 on `listGoals` renders its message.
  - Draft key `planning.goal.<goalId | "new">`.
  - Responsive: at 360 one card per row, monthly need under the progress-indicator.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/goals-page.test.tsx src/features/planning/goal-form-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page`, `Card`, `ProgressIndicator`, `Tag`, `Form`, `TextField`, `CurrencyField`, `Select`, `MultiSelect`, `DatePicker`, `AlertDialog`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): track goals over balance accounts"`.

### Task 16: Planning overview and navigation

**Files:**
- Create: `web/src/features/planning/{planning-page.tsx,planning-page.test.tsx,committed-cards.tsx,overview-occurrences.tsx,overview-budgets.tsx,overview-goals.tsx,overview-projection.tsx}`
- Modify: `web/src/app/shell/{side-nav.tsx,more-sheet.tsx,app-frame.test.tsx}`, `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `committedQuery`, `occurrencesQuery`, `occurrenceWindows`, `monthProgressQuery`, `goalsQuery`, `projectionQuery`, `OccurrenceRow`, `OccurrenceActions`, `GoalCard`, `ProjectionChart`, `budgetShare`, `lowestBalance`.
- Produces: route `/_authed/planning`; side-navigation destination Planejamento (`/planning`) and a More sheet item.

- [ ] **Step 1: Write the failing tests.**
  - **S63**: committed cards request `GET /commitments?month=2026-11`, `2026-12`, `2027-01`; the 2026-12 card renders installments `R$ 333,33`, occurrences `R$ 2.139,90`, total `R$ 2.473,23`; `price_missing` on one month renders its message in that card only.
  - Overdue (`state=overdue`, `from=2025-11-01&to=2026-11-01`) renders before upcoming (`from=2026-11-01&to=2026-12-01`); the budgets section shows the overspent count and the five highest spent shares of 2026-11; goals render compact; the sparkline covers 3 months with the lowest balance.
  - At 1280 a `tabs` row links Agendamentos, Orçamentos, Projeção, Metas; at 360 it is absent, section headers link each area and the committed values render as one row of three.
  - Router (P2): `/planning/budgets/<id>` and `/planning/schedules/new` mark the Planejamento destination active; the bottom bar keeps five controls.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/planning-page.test.tsx src/app/shell/app-frame.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Page` `wide`, `Section`, `Tabs`, `StatCard`, `List`, `Chart`, `InlineMessage`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the planning overview and navigation"`.

### Task 17: Home section and projection links

**Files:**
- Create: `web/src/features/planning/{coming-up-section.tsx,coming-up-section.test.tsx}`, `web/src/app/home-route.tsx`
- Modify: `web/src/features/accounts/{home-page.tsx,home-page.test.tsx,account-page.tsx,account-page.test.tsx}`, `web/src/features/cards/{card-overview-page.tsx,card-overview-page.test.tsx}`, `planning/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `occurrencesQuery`, `monthProgressQuery`, `schedulesQuery`.
- Produces: `HomePage` prop `sections?: ComponentType[]`, rendered after balances; `ComingUpSection` exported from `planning/index.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `ComingUpSection`: overdue count; occurrences of `[2026-11-01, 2026-11-08]` capped at 5 rows, each linking `/planning/schedules/<id>`; with Food overspent in 2026-11 an inline-message "1 orçamento estourado em nov. de 2026" links `/planning/budgets`; with nothing overdue, upcoming or overspent the section renders no element.
  - `home-page.test.tsx`: a passed section renders after the balances; omitted `sections` renders as before.
  - `/accounts/<checking>` and `/cards/<cardID>` each render a "Projeção" link to `/planning/projection?account_id=<id>`.
  - Responsive at 360/768/1280 on `/`: the section stays below balances.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/planning/coming-up-section.test.tsx src/features/accounts src/features/cards/card-overview-page.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Families: `Section`, `List`/`ListItemLink`, `InlineMessage`, `ButtonLink`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0. Manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show upcoming planning on home and link projections"`.

### Task 18: Responsive verification of the planning routes

**Files:**
- Modify: `web/src/app/routes-responsive.test.tsx`

- [ ] **Step 1: Extend the test** with every route of the spec's Routes table (`/planning`, `/planning/schedules`, `/new`, `/$scheduleId`, `/edit`, `/terms`, `/planning/budgets`, `/new`, `/$budgetId`, `/planning/projection`, `/planning/goals`, `/new`, `/$goalId/edit`, `/`), using `planningRoutes()`. Per width 360/768/1280: the navigation assertions of sub-project 1 Task 19, the page header title text, no `result-state` error, five bottom-bar controls.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/app/routes-responsive.test.tsx` → PASS (a failure is a defect of the owning screen task, fixed there with its own failing test).
- [ ] **Step 3: Scenario coverage.** `rg -n "S(2[7-9]|6[0-3])" web/src/features/planning` lists S27, S28, S29, S60, S61, S62, S63; `rg -n "func TestS(27|60|61)" internal/planning` lists the B1, B3, B4 and B5 tests.
- [ ] **Step 4: Manual pass.** `make db-up`, `make dev`, `make web-dev`; each planning route at 360, 768 and 1280 px in devtools: no horizontal scroll, pinned actions above the safe area; record the result in the commit body.
- [ ] **Step 5: Gates.** `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "test(web): verify planning routes at three widths"`.
