# Savings target: the share of the reference income set aside each month

- Status: delivered
- Date: 2026-11-01
- Phase: P7 Planning, amendments A187 to A189, scenarios S262 to S264

## 1. Intent

A person who sets aside a share of every income (for example 25%) has no place in the app to state that share. The budget plan (`docs/specs/2026-10-27-budget-plan-design.md`) subtracts the month's `savings` occurrences from the reference income as an amount in currency. It never shows that amount as a share of the reference or compares it with an intended share. After a salary change, the person recomputes the share by hand and edits the terms of each savings schedule.

This change stores one target share and shows, in the Plan view, the savings rate of the month, the target amount and the gap.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. The plan states the savings of the month as basis points of the reference income.
- G2. The person stores one savings target in basis points, with the reference choice, in the same save.
- G3. The plan states the target amount and the gap between it and the savings of the month.

Non-goals:

- A savings schedule whose amount is a share of income. Occurrences are stored with an amount up to 12 months ahead (A49); a share would have to reprice them whenever expected income changes.
- Editing the terms of savings schedules from the plan. The gap is informative.
- Splitting a contribution across destination accounts.
- A target per month or per destination.
- Assistant tools for the target. `manage_budget_or_goal` with `save_plan` keeps its arguments and writes the stored target back (A187).

Anti-goals:

- A default target. The field starts empty (`docs/specs/2026-10-26-calculators-design.md`, anti-goal on unsourced defaults).
- A rate or a gap computed from a reference that is absent or not positive.
- Any amount or rate in the DOM while privacy mode is on (ADR 018).

## 3. Domain amendments

### A187 Stored savings target

`planning_budget_reference` gains `savings_target_bp int`, null when no target is set, between 0 and 10000 otherwise. `PUT /budget-plan/{month}` carries `savings_target_bp` beside the reference choice and stores both in the transaction of A130. A save without the field clears the target.

The save of the assistant tool `manage_budget_or_goal` with `save_plan` reads the stored target and writes it back unchanged.

### A188 Plan figures of the target

For a plan whose `reference` is present and above zero:

| Figure | Definition |
|---|---|
| `savings_rate_bp` | `savings × 10000 ÷ reference`, truncated toward zero. |
| `savings_target` | `reference × savings_target_bp ÷ 10000`, rounded half up to the minor unit. Present only with a stored target. |
| `savings_gap` | `max(savings_target − savings, 0)`. Present only with a stored target. |

Without a reference, or with a reference that is zero, the three figures are absent. `savings_target_bp` is returned whenever stored.

### A189 Validation

A `savings_target_bp` below 0 or above 10000 is a 422 on `savings_target_bp`, code `validation_failed`. The database rejects the same values with a check constraint.

## 4. Region

The target is a unitless share. No regional value is introduced.

## 5. Scenarios

### S262 Rate, target and gap

A fixed reference of 8,000.00 and savings occurrences of 1,200.00 in the month: `GET /budget-plan` returns `savings_rate_bp` 1500. After `PUT` with `savings_target_bp` 2500, the plan returns `savings_target` 2,000.00 and `savings_gap` 800.00. With savings of 2,000.00 or more the gap is 0.00.

### S263 Stored and cleared

Before any save, the plan has no `savings_target_bp`. A `PUT` with 2500 makes `GET` return 2500. A second `PUT` without the field makes `GET` return no target and no `savings_target` or `savings_gap`. A reference of zero returns no rate, target amount or gap, and keeps `savings_target_bp`. A save through `manage_budget_or_goal` with `save_plan` keeps the stored target.

### S264 Invalid target

`PUT` with `savings_target_bp` 10001 and with -1 return 422 on `savings_target_bp` and store nothing. A direct SQL update of the column to 10001 is rejected by the database.

## 6. Web

The reference panel of the Plan view (`web/src/features/planning/plan-reference-panel.tsx`) gains:

- a percent field for the target, empty by default, saved by the existing plan save;
- the savings rate of the month beside the savings row;
- the gap, shown only with a target and a gap above zero.

Rates are formatted by the locale formatter; amounts go through `useMoneyFormat()` (web O9). New text goes to both catalogs.

## 7. Tests

- Go: scenarios S262 to S264 through `internal/apitest`; a schema test for the check constraint; a domain test for the rounding of `savings_target`.
- Web: a test of the panel for the empty target, a stored target with a gap, and a stored target without a gap.
