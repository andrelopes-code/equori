# Web track, sub-project 4: Planning

- Date: 2026-10-18
- Branch: `feat/web-ledger`
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (K1–K7, O1–O8, theme, navigation, data, error and i18n policy), `docs/superpowers/specs/2026-10-18-web-cards-design.md` (C1–C23) and `docs/superpowers/specs/2026-10-18-web-import-classification-design.md` (I1–I34). This spec states only what differs from them or adds to them.
- Domain: `docs/domain/02-ubiquitous-language.md` 2.6 and 2.10, `03-domain-flows.md` F7, scenarios S27–S29 and S60–S63 of `06-scenarios.md`, P7 amendments A46–A57 (`docs/superpowers/plans/2026-10-17-p7-planning.md`), P8 amendment A72.

## Intent

The owner plans future money: schedules (bills, income, subscriptions, transfers, savings) and their occurrences, monthly budgets per category with rollover, goals over balance accounts, the projected balance of accounts, and the amount committed per month. Every read and command exists in the HTTP API (tag `planning`); this sub-project adds the client and five backend gaps (B1–B5).

## Scope

In scope: scenarios S27–S29 and S60–S63; schedule create, metadata edit, terms change, pause, end; occurrence realize, unrealize, skip, move; budgets with amount versions and rollover; goals; projection per account and combined; committed amounts; a Home section.

Out of scope:

| Item | Owner |
|---|---|
| Envelopes | not in the domain: chapter 2 defines Budget only |
| Budget periods other than monthly | not in the domain (A54: `period_type` `monthly`) |
| Deleting a schedule | no endpoint; ending (A52) is the domain operation |
| Recurrence date preview before create | no endpoint; the client never computes dates (P5) |
| Occurrence of a transaction on `/transactions/$id` | no lookup by `transaction_id` |
| `OccurrenceOverdue` and `BudgetExceeded` notifications | not published (A50) |
| Prices that value foreign accounts (`prices` lists render, editing them does not) | sub-project 5 |
| Card committed amount per account (`getCommitment`) | upcoming statements of C7 show the same installments |

## Decisions

| ID | Decision |
|---|---|
| P1 | New feature `web/src/features/planning/` with `index.ts`, `api.ts`, one component per file (O1, O2). It imports `features/accounts` and `features/transactions` through `index.ts`; neither imports `features/planning`. |
| P2 | Every planning route sits under `/planning`. The bottom bar keeps five controls (SC-05). Side navigation gains one destination Planning (`/planning`), active for every path under `/planning`; the More sheet gains one item Planning. |
| P3 | `/planning` is the overview; the four areas (Schedules, Budgets, Projection, Goals) are reached from its section headers and from a `tabs` row on the overview at width ≥ 600 px. |
| P4 | Home composes planning by the C4 pattern: `HomePage` accepts `sections: ComponentType[]`, rendered after balances; `app/router.tsx` passes `[ComingUpSection]` from `features/planning`. This avoids an import cycle between `accounts` and `planning`. |
| P5 | The client never generates occurrence dates or applies business-day rules: dates come only from `listOccurrences` and `getProjection`. |
| P6 | Occurrence context: `listSchedules` (all pages, `limit` 200) is joined client-side on `schedule_id` to give description, kind, account and payee. |
| P7 | Occurrence windows (`listOccurrences` accepts at most 366 days): upcoming = `[today, today + 365 days]`; overdue = `[today − 365 days, today]` with `state=overdue`; past of one schedule = `[today − 365 days, today − 1 day]`. |
| P8 | Occurrence state tags: `expected` neutral, `overdue` warning, `realized` success, `skipped` neutral with the amount struck through. A moved occurrence shows "moved from `moved_from`". |
| P9 | Occurrence sign by kind (A46): `income` shows a positive amount in the positive tone; `bill`, `subscription` show a negative amount in the neutral tone; `transfer`, `savings` show a negative amount with the transfer icon. |
| P10 | Occurrence actions: `expected` and `overdue` → realize, skip, move; `realized` → open transaction, unrealize; `skipped` → none. Each is a dialog (C14 rule). The unrealize dialog states that the transaction stays in the ledger and no longer realizes this occurrence automatically (`app/realize.go` `Unrealize`). |
| P11 | Realize dialog lists `listTransactions?account_id=<schedule account_id>&from=<expected_on − 7 days>&to=<expected_on + 7 days>` (the A51 window) as a radio list: date, description, amount; "Widen to ± 30 days" re-queries once. Submit stays disabled until one is chosen. Body `{transaction_id}`. |
| P12 | Schedule state tag, derived client-side from `getSchedule`: Ended when `ends_on` ≤ today; Paused when a pause has `from` ≤ today ≤ `to`; Active otherwise. Terms in force: the latest `terms` entry with `effective_from` ≤ today, else the first. |
| P13 | `formatRecurrence(recurrence, locale)` in `features/planning` renders a sentence per A48 selector: "Monthly on day 5, next business day", "Monthly on the 5th business day", "Monthly on the last Friday", "Every 2 weeks on Monday", "Yearly on 12 Nov". |
| P14 | Schedule form is routed. Kind is a select (five options). Counterpart picker by kind (A46): `bill`, `subscription` → expense categories; `income` → income categories; `transfer`, `savings` → open balance accounts other than `account_id` with its instrument (A72). `account_id` lists open balance accounts whose instrument is a currency. |
| P15 | Recurrence editor: frequency select; interval number-field 1–120; for `monthly`, a segmented-control Day of month / Weekday / Business day with "Last" mapped to −1; adjustment select hidden for business day (A48); start date-picker defaulting to today; end segmented-control Never / On date (`until`) / After (`count` 1–10000). Defaults: `monthly`, interval 1, `day_of_month` = day of `start`, adjustment `none`, end Never. |
| P16 | "Advanced" disclosure holds `match_tolerance_bp` as a percent input (two decimals, string conversion to basis points, O7; default 10.00 %) and `grace_days` (0–31, default 3). |
| P17 | Terms change is a routed form: `effective_from` date-picker defaulting to the first day of next month, constrained after the latest `effective_from`; amount prefilled from the latest terms; switch "Change recurrence" reveals the editor prefilled from the latest rule. The body omits `recurrence` while the switch is off (A49 copies the rule). |
| P18 | Pause is a dialog with a date-range-picker (`from`, `to` inclusive). End is a dialog with `from` defaulting to the first day of next month and a statement that expected occurrences on or after it are removed and realized ones stay. |
| P19 | Budgets page holds `month` (`YYYY-MM`) in the search params, default the current month; previous and next controls and a month select (current month − 12 to + 12). Rows come from B3, grouped Expense and Income by the category class. |
| P20 | Budget row: category path, planned, carried (hidden when `rollover` is false), spent, available, progress-indicator of spent ÷ (planned + carried). Tones: available < 0 danger; spent × 10 ≥ (planned + carried) × 9 warning; otherwise positive. Planned + carried ≤ 0 with spent > 0 renders a full indicator in danger. |
| P21 | Budget detail history: one `getBudgetProgress` per month through `useQueries`, months from max(first `effective_from`, selected month − 11) to the selected month, so no request returns the 422 of a month before the first amount. Rendered as a bar `chart` of planned + carried against spent and a table. |
| P22 | Projection page holds `account_id` (absent = combined) and `months` (1, 3, 6, 12; default 3) in the search params; `to` = today + `months` months, the day clamped to the month length. |
| P23 | Combined projection: open balance accounts of group `available` (Home grouping) whose instrument is the base currency; `accounts/index.ts` exports `accountGroup(account)`. One `getProjection` per account through `useQueries`; `mergeProjections` sums openings and closings and merges points ordered by date, then signed amount ascending (A56), recomputing the running balance on integers. Accounts in another currency are listed below the chart with links to their own projection. |
| P24 | Projection chart: line `chart` with one vertex per point date at the last running balance of that date, starting at (today, opening). Stat-cards: opening, lowest balance with its date (danger when negative), closing. When closing ≠ last running balance, a note states the difference as recorded transactions dated after today (A56). |
| P25 | Goal card: name, due date, current / target, remaining, progress-indicator, `progress_bp` as a percent with two decimals by string conversion (3361 → 33.61 %), and monthly need = ⌈remaining ÷ m⌉ on integers, m = (due year × 12 + due month) − (current year × 12 + current month); m ≤ 0 shows a "Due" tag instead. `prices` render as "valued at" lines (A72). |
| P26 | Goal form is routed: name (1–60), target currency-field with currency select defaulting to the base currency, due date, accounts as a multi-select of open balance accounts (1–20). |
| P27 | Overview: committed stat-cards for the current month and the next two (`getCommitted`: installments, occurrences, total); overdue occurrences; upcoming occurrences of the next 30 days; budgets of the current month (overspent count and the five highest spent shares); goals (compact rows); combined projection sparkline for 3 months with the lowest balance. |
| P28 | `ComingUpSection` (Home): overdue count and the occurrences of the next 7 days, at most 5 rows, each opening its schedule; a budget inline-message "N budgets overspent in <month>" linking to `/planning/budgets` when N > 0. Nothing renders when both are empty. |
| P29 | `/accounts/$id` and `/cards/$accountId` gain a "Projection" link to `/planning/projection?account_id=` (typed route link, no feature import, I19 pattern). |
| P30 | Realization runs in the outbox after commit (`LISTEN outbox`, ADR 006), so it lags a ledger mutation. Occurrence, projection and committed queries use `staleTime: 0` and refetch on mount and window focus (I34); a ledger mutation does not assume them updated. |

## Routes

| Route | Content | Actions |
|---|---|---|
| `/planning` | P27 sections | open area; occurrence actions (P10) |
| `/planning/schedules?kind=&state=` | `listSchedules` rows: description, kind tag, state tag (P12), amount in force, `formatRecurrence`, next occurrence date (P7 upcoming window); filters kind and state | new schedule; open |
| `/planning/schedules/new` | form P14–P16: kind, account, counterpart, payee (optional), description (1–200), amount, recurrence, advanced | `createSchedule`; navigates to the detail |
| `/planning/schedules/$scheduleId?tab=` | header: description, kind, state; description-list: account, counterpart, payee, amount in force, recurrence, tolerance, grace days, `ends_on`; terms versions newest first, in force tagged (C16 pattern); pauses; occurrences in tabs `upcoming` / `past` (P7): date, amount, state tag (P8), transaction link, `realized_by` and `skip_reason` (B1) | edit (B2); change terms; pause (P18); end (P18); occurrence actions (P10) |
| `/planning/schedules/$scheduleId/edit` | description, payee, tolerance, grace days | B2 |
| `/planning/schedules/$scheduleId/terms` | form P17 | `changeScheduleTerms` |
| `/planning/budgets?month=` | P19, P20; totals row of planned, spent and available per group | new budget; open; change month |
| `/planning/budgets/new` | category picker (categories without a budget), amount, `effective_from` month select (current month − 12 to + 12), rollover switch | `createBudget` |
| `/planning/budgets/$budgetId` | category, rollover; amount versions newest first, in force tagged; history P21 | add amount (dialog: month after the latest, amount; `addBudgetAmount`); rollover switch (B4); delete (B4, confirmation) |
| `/planning/projection?account_id=&months=` | account select (Combined first), months segmented-control; P23, P24; points table: date, schedule description, amount, running balance (danger when negative) | change account or range; open a point's schedule |
| `/planning/goals` | goal cards P25, ordered by `due_on` | new; edit; delete (B5, confirmation) |
| `/planning/goals/new`, `/planning/goals/$goalId/edit` | form P26 | `createGoal`; B5 |
| `/` (existing) | `ComingUpSection` P28 | open schedule; open budgets |

## Phone ergonomics

Section 2 of the foundation spec applies. Specific rules:

- Overview: the tabs row of P3 is absent; section headers link to each area. Committed stat-cards render as one row of three compact values; overdue occurrences come first.
- Occurrence row: description and amount on the first line; date, state tag and moved note on the second (LP-01). A tap opens an action-sheet with the P10 actions; their dialogs open as bottom drawers.
- Realize drawer: transactions as full-width radio choices; the widen control and submit sit in the drawer footer.
- Schedule detail: the state tag sits on the page-header line; edit, change terms, pause and end sit in an action-sheet "Schedule actions".
- Schedule form: the recurrence editor renders as one stacked card; selector segmented-controls wrap to full width; interval, day, ordinal and count use number-field with `inputmode="numeric"` and steppers.
- Budgets: the month controls sit in the page-header; a row shows category and available on the first line and the progress-indicator with spent / planned on the second; carried shows on the detail only.
- Projection: chart height 200 px; the three stat-cards render above the chart as one row; the points table becomes rows of date and amount on the first line, description and balance on the second.
- Goals: one card per row; the monthly need sits under the progress-indicator.

## Data

Keys (`features/planning/api.ts`, `planningKeys`), all under `planningKeys.all = [...transactionKeys.all, "planning"]` so the existing `transactionMutated` invalidates every planning query without change (C5 pattern):

| Key | Query |
|---|---|
| `[...all, "schedules"]`, `[...all, "schedule", s]` | `listSchedules` (all pages), `getSchedule` |
| `[...all, "occurrences", from, to, scheduleId \| "all", state \| "any"]` | `listOccurrences` |
| `[...all, "realize-candidates", o, days]` | `listTransactions` window of P11 |
| `[...all, "budgets"]`, `[...all, "budget", b]` | `listBudgets` (all pages), `getBudget` |
| `[...all, "budget-progress", month]`, `[...all, "budget", b, "progress", month]` | B3, `getBudgetProgress` |
| `[...all, "goals"]`, `[...all, "goal", g]` | `listGoals` (all pages), `getGoal` |
| `[...all, "projection", accountId, to]` | `getProjection` |
| `[...all, "committed", month]` | `getCommitted` |

Invalidation:

| Mutation | Invalidates |
|---|---|
| every ledger transaction mutation (existing `transactionMutated`) | `planningKeys.all` through the prefix |
| `realizeOccurrence`, `unrealizeOccurrence`, `skipOccurrence`, `moveOccurrence` | `[...all, "occurrences"]`, `[...all, "projection"]`, `[...all, "committed"]` |
| `createSchedule`, B2, `changeScheduleTerms`, `pauseSchedule`, `endSchedule` | `[...all, "schedules"]`, `[...all, "schedule", s]`, `[...all, "occurrences"]`, `[...all, "projection"]`, `[...all, "committed"]` |
| `createBudget`, `addBudgetAmount`, B4 | `[...all, "budgets"]`, `[...all, "budget", b]`, `[...all, "budget-progress"]` |
| `createGoal`, B5 | `[...all, "goals"]`, `[...all, "goal", g]` |

Planning mutations write no ledger rows, so none calls `transactionMutated`. Routed forms persist drafts in sessionStorage under `planning.schedule.new`, `planning.schedule.edit.<id>`, `planning.terms.<id>`, `planning.budget.new` and `planning.goal.<goalId | "new">`. Field errors attach by `field`; `recurrence.*` paths attach to the recurrence editor input of the same name, and `date` of `moveOccurrence` (a date inside a pause, F7) attaches to the dialog date input.

## Problem codes

New catalog entries (`problem.<code>`, en and pt-BR):

| Code | Status | Operation | en message |
|---|---|---|---|
| `occurrence_closed` | 409 | `realizeOccurrence`, `unrealizeOccurrence`, `skipOccurrence`, `moveOccurrence` | This occurrence was already realized, skipped or released. |
| `transaction_in_use` | 409 | `realizeOccurrence` | That transaction already realizes another occurrence. |
| `pause_overlap` | 409 | `pauseSchedule` | This pause overlaps another pause of the schedule. |
| `schedule_ended` | 409 | `changeScheduleTerms`, `pauseSchedule`, `endSchedule`, `moveOccurrence` | The schedule ends on or before this date. |
| `budget_exists` | 409 | `createBudget` | This category already has a budget. |
| `currency_unsupported` | 422 | `createSchedule` | This account's instrument cannot be used here. |
| `price_missing` | 422 | `getCommitted`, `listGoals`, `getGoal`, `createGoal`, B5 | No stored price converts this amount. |

`currency_unsupported` attaches to `account_id` or `counterpart_id`. Existing entries reused: `validation_failed`, `invalid_request`, `not_found`, `mixed_instruments` (goals, projection). Each new code gets a web test rendering its message.

## Backend gaps

Delivered first, each with an apitest through `internal/apitest`, the OpenAPI contract and `make gen`; every query filters by `user_id` (ADR 003) and an apitest shows another user's resource returns 404.

| ID | Endpoint | Reason | apitest |
|---|---|---|---|
| B1 | `Occurrence.realized_by: auto\|manual` (present when realized) and `Occurrence.skip_reason` (present when given) on every occurrence response | the detail distinguishes a manual link, which ledger changes never release (A51), and shows why an occurrence was skipped | S27: the PIX realization returns `auto`; `realizeOccurrence` returns `manual`; `skipOccurrence {reason}` returns it on `listOccurrences` |
| B2 | `PATCH /schedules/{id}` `{description?, payee_id? (null clears), match_tolerance_bp?, grace_days?}` → `Schedule`; regenerates no occurrence | a schedule has no write path besides terms, pause and end; a typo or a wrong payee is otherwise permanent | change description; clear payee; `grace_days` 0 makes the 2026-11-05 occurrence `overdue` with Today 2026-11-06; empty body → 400 `invalid_request` |
| B3 | `GET /budget-progress?month=` → `{month, items: [{budget_id, category_id, rollover, planned, carried, spent, available}]}` in budget creation order; a budget whose first amount is after `month` is omitted | the budgets page needs every budget of a month in one call | S60 for 2026-10, 2026-11, 2026-12; a budget starting 2026-12 is absent from 2026-11; malformed `month` → 400 |
| B4 | `PATCH /budgets/{id}` `{rollover}` → `Budget`; `DELETE /budgets/{id}` → 204, removing its amounts | rollover is fixed at creation and a budget cannot be removed | S60 with rollover false: November carried 0.00, available −500.00; after delete, `createBudget` on Food → 201 |
| B5 | `PATCH /goals/{id}` `{name?, target?, due_on?, account_ids?}` → `Goal` (A55 validation); `DELETE /goals/{id}` → 204 | goals have no edit or delete | S61 with target 20,000.00: remaining 9,916.59, `progress_bp` 5041; a duplicate name → 422 on `name`; after delete, `getGoal` → 404 |

## Tests

Flow tests use the fake fetch (K5), the fixture of `06-scenarios.md` 6.1, Today 2026-11-01 through the `today` provider unless stated, and assert the exact request body and the rendered values. Each test name carries its scenario ID.

| Scenario | Web flow test |
|---|---|
| S27 | schedule form posts `{kind: "bill", account_id, counterpart_id: Housing › Rent, payee_id: Landlord, description: "Rent", amount: {amount: 210000, currency: "BRL"}, recurrence: {frequency: "monthly", interval: 1, day_of_month: 5, adjustment: "following", start: "2026-11-01"}}` with no tolerance or grace; detail renders 2026-11-05, 2026-12-07, 2027-01-05 and "Monthly on day 5, next business day"; the 2026-11 occurrence renders `realized` with the transaction link; manual realize posts `{transaction_id}`; `transaction_in_use` and `occurrence_closed` render their messages |
| S28 | `day_of_month: 31` with start 2027-01-31 posts its body; detail renders 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30 |
| S29 | terms form posts `{effective_from: "2027-01-01", amount: {amount: 4490, currency: "BRL"}}` without `recurrence`; pause posts `{from: "2027-02-01", to: "2027-03-31"}`; end posts `{from: "2027-06-01"}`; with Today 2027-02-15 the state tag renders Paused; `pause_overlap` renders its message |
| S60 | budgets page for 2026-10, 2026-11, 2026-12 renders planned / carried / spent / available 1,800.00 / 0.00 / 1,500.00 / 300.00, 1,800.00 / 300.00 / 2,300.00 / −200.00 (danger), 2,000.00 / −200.00 / 0.00 / 1,800.00; add amount posts `{effective_from: "2026-12", amount: {amount: 200000, currency: "BRL"}}`; `budget_exists` renders its message |
| S61 | goal card renders current 10,083.41, remaining 19,916.59, 33.61 %, monthly need 2,845.23 (m = 7); create posts `{name: "Emergency", target: {amount: 3000000, currency: "BRL"}, due_on: "2027-06-30", account_ids: [Emergency fund]}` |
| S62 | projection of Nubank checking to 2026-12-31 renders points −2,100.00 → 2,900.00, +5,000.00 → 7,900.00 on 2026-11-09, −2,100.00 → 5,800.00 and +5,000.00 → 10,800.00 on 2026-12-07; stat-cards opening 5,000.00, lowest 2,900.00 on 2026-11-05, closing 10,800.00 |
| S63 | overview committed card for 2026-12 renders installments 333.33, occurrences 2,139.90, total 2,473.23 |

Unit tests: `formatRecurrence` for each A48 selector in both locales; schedule state (P12) at boundary dates; basis-point percent conversion (P16, P25) on strings; `mergeProjections` ordering and running balance (P23); lowest balance (P24); monthly need (P25) with m = 0; budget tones (P20) at the 90 % boundary; history month range (P21). Router test: `/planning/*` paths mark the Planning side-navigation destination active (P2).

## Verification

- `make check` passes on the branch head.
- B1–B5 each have the apitest of the Backend gaps table.
- `rg -n "S(2[7-9]|6[0-3])" web/src/features/planning` lists a flow test for each scenario of the Tests table.
- Each route of the Routes table renders at 360, 768 and 1280 px with no horizontal scroll.

## Open risks

| Risk | Check |
|---|---|
| Realization lags a ledger mutation (P30); a list opened in the same instant shows the previous state | refetch on focus and mount; S27 test renders the realized state from the second response |
| The combined projection issues one request per available account (P23) | accepted below 20 accounts; a later `GET /projection` replaces it without changing the page |
| The `state` filter of `listOccurrences` applies the state read, overdue included (`app/schedules.go` `Occurrences`), but no apitest sends the query parameter `state=overdue` (`realize_test.go` asserts the state read only) | B1's apitest adds: rent 2026-11-05 with Today 2026-11-09 is returned by `state=overdue` and absent from `state=expected` |
