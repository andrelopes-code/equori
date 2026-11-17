# Goal that counts as savings

Amends `docs/specs/2026-11-15-income-buckets-design.md` (A233, A234) and `docs/specs/2026-11-15-planning-tabs-design.md` (A2).

## 1. Problem

A234 sends every deposit into a goal account to the one bucket that takes goals. An owner who builds an emergency reserve as a goal sees the deposit in that bucket, and the bucket that takes savings stays at zero, below its floor. The method has no way to state that one goal is savings.

## 2. Rule

### A239 Goal that counts as savings

A goal holds `counts_as_savings`, false by default.

- The goal set of A234 holds the accounts of the goals with `counts_as_savings` false, and their sub-accounts.
- The savings set of A233 adds the accounts held only by goals with `counts_as_savings` true, and their sub-accounts, whatever their kind.
- An account held by a goal of each kind is in the goal set only. A deposit counts once.
- A233 and A234 apply to each set as written: postings in base-currency asset and liability accounts outside the set, negated; yields and prices do not count; a withdrawal counts against its month.
- The field changes no figure of the goal itself: target, current, remaining and return stay as before.

A bucket reference on the goal was rejected: `saveBudgetBuckets` replaces every bucket row, so a bucket id does not survive a save of the method.

### A2 amendment (planning tabs)

An occurrence of a transfer stays out of the close, the inflows, the outflows, what is still to pay and the running balance of the agenda.

## 3. Data and API

- Migration 00110 adds `planning_goal.counts_as_savings boolean NOT NULL DEFAULT false`. Archive version 23 writes false into older goal rows.
- `Goal` returns `counts_as_savings`; `GoalInput` and `GoalPatch` accept it. No operation is added.
- `manage_budget_or_goal` accepts `counts_as_savings` on `create_goal` and `update_goal`; `get_budgets_and_goals` returns it when true.
- Web: the goal dialog holds one checkbox, "Count deposits as savings in the income split".

## 4. Cross-cutting questions

- R1: Does not apply: no value varies by country.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: `goals.countsAsSavings`, with pt-BR and en text.
- R6: Does not apply: the feature writes no number or date.
- C1: Does not apply: no amount is stored; the sums of A233 and A234 keep their integer minor units.
- C2: Every sum holds the base currency, as in A233.
- C3: An account in another instrument is not a source, as in A233.
- C4: Does not apply: no amount is added to a screen.
- T1: The month of a deposit is the calendar month of its transaction date, as in A233.
- T2: Does not apply: no business days and no due date.
- B1: Does not apply: no table is added.
- B2: No operation is added; `createGoal` and `updateGoal` keep `write`.
- B3: Does not apply: the field is data of a goal, not a setting.
- D1: `planning_goal` stays a fact; the archive version rises to 23 (`addGoalSavings`).
- D2: Migration 00110.
- D3: Does not apply: a goal is configuration; no recorded fact changes.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: No operation is added and no `Problem.code`.
- S2: The goal dialog is the one of the Goals screen, on every form factor it already serves.
- S3: `goals.md` and `schedules_and_occurrences.md` change in the commits of their slices.
- S4: The assistant reads and writes the field through `get_budgets_and_goals` and `manage_budget_or_goal`.
- X1: S538 and S539.
- X2: Does not apply: no regional value; the base currency rule is the one S446 and S448 already test.

## 5. Scenarios

- S538: a goal that counts as savings sends what went into its account to the bucket that takes savings, in the history and in the plan of the month; set back, the deposit counts in the bucket that takes goals.
- S539: an account held by a goal of each kind counts once, in the bucket that takes goals.
