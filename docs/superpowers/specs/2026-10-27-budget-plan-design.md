# Budget plan: distributing a reference income across budgets

- Status: proposed
- Date: 2026-10-27
- Phase: P7 Planning, amendments A129 to A132, scenarios S158 to S166

## 1. Intent

The budgets screen today answers one question: how much of each budget was spent. It never compares the planned total with the money that comes in, so a person cannot answer "how much of my income still has no destination". Creating a budget takes a separate form, and changing an amount takes a dialog per budget. `AddBudgetAmount` accepts only a month after the latest version, so the amount of the current month cannot be corrected twice.

The budget plan adds a second view of the month, **Plan**, beside the current one, renamed **Track**. Plan takes a reference income, subtracts what is already committed, and lets the person distribute the rest across budgets in one editable table, with the unassigned amount always in sight. The method is zero-based budgeting: every unit of the reference income receives a destination.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. The largest figure of the Plan view is the unassigned amount of the month: reference income minus commitments minus planned budgets.
- G2. The reference income is chosen from three sources: expected income, average income, fixed amount.
- G3. Every budget amount of the month and every category with recent spending and no budget is editable in one table, and one action saves all changes in one transaction.
- G4. A suggestion from history fills the table for review before anything is written.
- G5. The unassigned rest is distributed in one action.

Non-goals:

- Category groups of the needs, wants and savings kind (the 50/30/20 rule). The category tree is the only grouping.
- Budgets of income categories in the plan. They stay in Track only.
- Changes to Track, to the budget detail page or to the budget form.
- Editing past months. Plan is read-only for months before the current one.
- Budgets in a currency other than the base currency (A54 keeps one currency per budget, the base one).

Anti-goals, which make the work a failure even when it runs:

- A total that counts the same money twice: a nested budget inside its ancestor's budget, or an installment already counted in an earlier month's accrual spending.
- A suggestion or a distribution written to the database without an explicit save.
- Any amount in the DOM while privacy mode is on (ADR 018).
- A figure on screen that does not reconcile with the figures it is built from.

## 3. Domain amendments

### A129 Plan figures of a month

For a user and a month M:

| Figure | Definition |
|---|---|
| `expected_income` | Sum of the occurrences of schedules of kind `income` with expected date in M and state `expected` or `realized`, valued in the base currency at today's prices (A72). Absent when the user has no schedule of kind `income`. |
| `average_income` | Sum of the accrual totals of the top-level income categories over the months M−3 to M−1 that are on or after the month of the user's first posting, divided by the number of those months, rounded half up to the minor unit. Absent when no such month exists. `average_months` carries the divisor (1 to 3). |
| `received_income` | The same total over M alone, up to today. Informative; never a source. |
| `installments` | Sum of the installments billed on card statements of reference month M whose purchase transaction date is before the first day of M, in the base currency. Accrual already counted these purchases in an earlier month, so no budget of M covers them. |
| `savings` | Sum of the occurrences of schedules of kind `savings` with expected date in M and state `expected` or `realized`, valued as `expected_income`. |
| `planned` | Sum of the amounts in force in M of the counted budgets. A counted budget is a budget of an expense category that has no ancestor with a budget in force in M. This is the rule `monthFigures` already applies in Track. |
| `reference` | The figure of the chosen source (A131). |
| `unassigned` | `reference − installments − savings − planned`. Negative when the plan exceeds the reference. |

Bills and subscriptions are not subtracted: their postings land in expense categories, which budgets cover.

Each row of the plan is a category. Rows are every expense category with a budget, plus every open expense category whose own postings over M−3 to M−1 total more than zero and that has no budget on itself or on an ancestor. This is the rule `unbudgeted` already applies in Track, taken over three months. A row carries:

- `category_id`;
- `budget_id`, when a budget exists;
- `planned`: the amount in force in M, zero when none;
- `last_month`: the accrual total of M−1;
- `average`: the accrual total over the months of `average_income`, divided by `average_months`; zero when `average_months` is absent;
- `counted`: a boolean, per the rule above;
- `next_change`: the month of the first version after M, when one exists.

`last_month` and `average` are subtree totals for a row with a budget, because a budget covers its subtree. They are own totals for a row without one.

### A130 Saving a plan

A plan save for month M carries the reference choice and a list of category amounts. In one transaction:

- M is the current month or later; an earlier M is a 422 on `month`.
- Each category is an expense category of the user; a category listed twice is a 422.
- Each amount is in the base currency and not negative.
- A category with a budget gets a version at M: the version at M is replaced when it exists, inserted otherwise. Versions before and after M are not touched. T09 holds: history before M is kept.
- A category without a budget and an amount above zero gets a new budget with `rollover` false and its first version at M. An amount of zero creates nothing.
- The reference choice is stored (A131).

The existing `addBudgetAmount` keeps its rule: it only accepts a month after the latest version.

### A131 Reference choice

One choice per user, not per month: `source` is `expected_income`, `average_income` or `fixed`. Only `fixed` carries an amount, in the base currency, not negative. Without a stored choice, the source is `expected_income` when that figure is present, else `average_income` when present, else `fixed` with no amount. When the stored source has no figure in M, the response reports it with `reference` absent, and the screen asks for another source.

### A132 Suggestion and distribution

These are computations of the screen; nothing reaches the server before a save.

- A suggestion takes a basis, either the 3-month `average` or `last_month`. It proposes that value for every row whose value differs from `planned`, and leaves out rows where both are zero.
- When `reference − installments − savings` is smaller than the sum of the proposed amounts and the unchanged counted amounts, **Fit to reference** is on by default. It scales the proposed amounts so the sum equals that room, and leaves the unchanged rows untouched.
- Distributing the rest takes the positive `unassigned` amount. **In proportion to the plan** splits it over the counted rows by their `planned`. **All to one category** adds it to the chosen row.
- Every split into minor units uses the largest-remainder method, so the parts sum exactly to the amount split.

## 4. Data and API

Migration `planning_budget_reference`:

```sql
CREATE TABLE planning_budget_reference (
    user_id  bigint NOT NULL PRIMARY KEY REFERENCES identity_user (id) ON DELETE CASCADE,
    source   text   NOT NULL CHECK (source IN ('expected_income', 'average_income', 'fixed')),
    amount   bigint CHECK (amount >= 0),
    currency text   NOT NULL,
    CHECK ((source = 'fixed') = (amount IS NOT NULL))
);
```

The source set is not regional (ADR 016 does not apply), so a closed `CHECK` is correct. The amount version upsert of A130 needs no schema change: the primary key `(budget_id, effective_from)` already allows one version per month.

Operations, tag `planning`:

- `GET /budget-plan?month=YYYY-MM` (`getBudgetPlan`) returns `BudgetPlan`. The month is at most today + 12 months, as `getBudgetProgress` enforces.
- `PUT /budget-plan?month=YYYY-MM` (`saveBudgetPlan`) takes `BudgetPlanInput` and returns `BudgetPlan`. Its error codes are 422 for field errors, and 422 `currency` when the base currency differs.

```yaml
BudgetPlan:
  required: [month, currency, source, installments, savings, planned, rows]
  properties:
    month: { type: string }
    currency: { type: string }
    source: { enum: [expected_income, average_income, fixed] }
    fixed: Money              # present when source is fixed
    expected_income: Money    # absent per A129
    expected_items:           # one item per income schedule with occurrences in M
      items: { schedule_id, description, amount: Money }
    average_income: Money
    average_months: { type: integer, minimum: 1, maximum: 3 }
    received_income: Money
    reference: Money          # absent when the source has no figure
    installments: Money
    savings: Money
    planned: Money
    unassigned: Money         # absent with reference
    prices: [Price]           # A72, as Committed
    rows:
      items: { category_id, budget_id?, planned: Money, last_month: Money, average: Money,
               counted: boolean, next_change?: string }
BudgetPlanInput:
  required: [source, amounts]
  properties:
    source: { enum: [expected_income, average_income, fixed] }
    fixed: Money              # required when source is fixed
    amounts:
      items: { category_id, amount: Money }   # changed rows only
```

Both operations get entries in `internal/server/tool_exposure_test.go`. `getBudgetPlan` is covered by `get_budgets_and_goals`, through a new kind `plan`. `saveBudgetPlan` is covered by `manage_budget_or_goal`, through a new action `save_plan` previewed like the other actions of that tool.

## 5. The Plan view

The page is `planning-page.tsx`, with its month selector. The budgets tab gets a segmented control: **Plan** and **Track**. The view lives in the URL search (`view=plan|track`). Without that parameter, months after the current one open in Plan; the current and earlier months open in Track.

### 5.1 Layout, top to bottom

1. **Reference panel.**
   - Left: the label "Unassigned" and `unassigned` as the page's largest figure. Under it, one sentence: "{share} of {source name} for {month} has a destination". Over the reference, the sentence reads "{amount} over the reference". The figure and the sentence take the danger tone.
   - Right: the source segmented control, then the breakdown of the chosen source.
     - Expected income: each `expected_items` entry with its amount.
     - Average income: "average of {n} months".
     - Fixed amount: a `MoneyInput` of size `field`.
     - All three also show `received_income` as "received so far".
   - A source without a figure is disabled, with its reason as a tooltip.
2. **Allocation bar,** full width.
   - Segments, in order: installments and savings in the neutral tone; one segment per root group, by planned amount descending, in steps of the accent; the unassigned rest as a dashed outline.
   - Labels sit under each segment wide enough for them (8 % or more), with name, amount and share. Narrower segments show their label on hover and on focus.
   - Over the reference, the scale becomes `installments + savings + planned`. A danger segment marks the excess past a tick at the reference.
3. **Toolbar.**
   - The heading "Budgets of {month}".
   - **Distribute the rest**, a menu with *In proportion to the plan* and *All to one category…*. The second opens a combobox of the rows. The menu is disabled while `unassigned` ≤ 0.
   - **Suggest from history**, a menu with *3-month average* and *Spent in {previous month}*.
4. **Plan table.**
   - Columns: Category, Spent in {previous month}, 3-month average, Planned, Of reference. The Planned header carries a two-state toggle, currency and percent, that switches every input between minor units and a percentage of the reference with one decimal.
   - Rows are grouped by root category. A group row shows the sums of its counted rows, a share meter and a caret. Groups collapse; the collapsed state is a per-browser convenience in `localStorage`.
   - A group "Without a budget" collects the rows without `budget_id`, after the others.
   - A row that is not counted shows "inside {ancestor}" and is left out of the sums.
5. **Save bar.** It floats at the bottom while at least one change is pending.
   - Left: the number of changes, the net change of `planned`, and the validity text "applies from {month}", or "applies from {month} to {month before next_change}" when a changed row has `next_change`.
   - Right: **Discard** and **Save plan**.

### 5.2 Interactions

- **Live figures.** Each keystroke recomputes the row's share, its group sums, `planned`, `unassigned`, the bar and the sentence. The largest figure tweens over 180 ms; the bar segments animate their size over 200 ms. Under `prefers-reduced-motion`, both change at once.
- **Changed rows.** The input takes the accent border, and the row shows "was {amount}" under it. **Esc** in the input reverts that row.
- **Average hint.** When the average is above zero and `|planned − average| ≥ 10 %` of the average, a chip "average {amount}" sits beside the input. Activating it sets the planned value to the average.
- **Keyboard.**
  - **Enter** moves to the next row's input, and **Shift+Enter** to the previous one, skipping collapsed groups.
  - **Ctrl/Cmd+S** saves the plan.
  - **Ctrl/Cmd+Z** outside an input undoes the last bulk action (suggestion, distribution, discard).
- **Bar and table link.** Hovering or focusing a segment highlights its group rows, and hovering a group row highlights its segment. Activating a segment expands its group and scrolls it into view. Segments are buttons, with the accessible name "{group}, {amount}, {share} of the reference".
- **Suggestion review.**
  - Choosing a basis enters review mode. A banner states the basis, the number of rows that change, the net change and the resulting `unassigned`, plus the **Fit to reference** switch when A132 applies.
  - A Suggested column appears with the delta, or "new" for a row without a budget, and a checkbox per row, checked by default.
  - **Apply {n} checked** turns them into pending changes, and a toast offers **Undo**. **Discard** leaves review mode with no change.
- **Distribution.** It turns into pending changes on the affected rows, and a toast offers **Undo**.
- **Sticky strip.** When the reference panel leaves the viewport, a strip pins under the page header. It holds `unassigned`, a thin copy of the bar and "of {reference}". The panel is watched by an `IntersectionObserver`.
- **Pending changes guard.** Switching the month, switching to Track or leaving the route with pending changes opens a dialog: "Discard {n} changes?", with **Keep editing** and **Discard**.
- **Saving.**
  - **Save plan** shows its loading state. Success clears the pending state, refetches the plan and the Track queries, and shows the toast "Plan for {month} saved".
  - A failure keeps every pending change and shows an `Alert` above the table with the problem's detail. A field error marks its row.
- **Past months.** Inputs are read-only, the toolbar is hidden, and a note says "Past months are read-only".

### 5.3 States

- **Loading:** skeletons shaped like the panel, the bar and five rows (`waiting-states`).
- **No budgets and no history:** the reference panel stays. The table lists the top-level expense categories with zero inputs. The note "Start with a suggestion" is hidden, because no history exists.
- **No budgets with history:** the table lists the rows with history. The toolbar's suggestion is the primary button.
- **No reference:** the panel asks for a source or a fixed amount. The bar and `unassigned` show a grey dash, and the table stays editable. The percent toggle is disabled.
- **Privacy on:**
  - Amounts are masked by `useMoneyFormat()`. Percentages stay visible (ADR 018).
  - Inputs are replaced by masked read-only text, because `entry()` is not masked (P4).
  - An `Alert` reads "Show amounts to edit the plan", with the privacy toggle as its action.
  - The test calls `expectNoAmounts` (P6).
- **Phone (compact query):**
  - The panel stacks: figure, sentence, source control, breakdown.
  - The bar labels only its three largest segments and the rest.
  - Rows become two lines: name with its share, then the input. The previous month and the average go in the row's description.
  - The save bar spans the width, fixed above the bottom navigation.
  - The sticky strip keeps the figure only.

### 5.4 Accessibility

- Each input is labelled "Planned for {category}".
- `unassigned` sits in a polite live region, updated 500 ms after the last keystroke.
- The percent toggle states its unit in its accessible name.
- Colour never carries a state alone: the excess segment has the label "over", and changed rows carry the text "was {amount}".

## 6. Tests

- Apitest scenarios through `internal/apitest`, each named with its ID:
  - S158: plan figures with income schedules, card installments from an earlier purchase and from a purchase in M, and a savings schedule. Only the earlier installment is subtracted.
  - S159: `average_income` with one month of history (divisor 1) and with three.
  - S160: nested budgets. A child budget is not counted.
  - S161: save replaces the version at M, keeps the versions before and after M, and reports `next_change`.
  - S162: save creates a budget for a category without one, and skips an amount of zero.
  - S163: save for a past month is a 422 on `month`. A duplicated category is a 422. A category of another user is a 422.
  - S164: reference choice round trip, including the default order of A131.
  - S165: the `plan` kind of `get_budgets_and_goals`.
  - S166: the `save_plan` action of `manage_budget_or_goal`, previewed before it runs.
- Schema tests for `planning_budget_reference`: an unknown source, a fixed source without an amount, a non-fixed source with an amount, and a negative amount are each rejected.
- Web tests:
  - the largest-remainder split and the fit-to-reference scaling, as unit tests of a pure module beside `budget-month.ts`;
  - the Plan view: live recompute, average chip, Esc revert, Enter navigation, suggestion review with apply and undo, distribution, the save payload holding changed rows only, the pending-changes guard, the past-month read-only state and privacy masking.

## 7. Regional values

None. The currency comes from settings, and money, percentages and months are formatted through `Intl` from the active tag. The sources and the 3-month window are not regional.

## 8. Left to the builder

- The module layout of the plan computation inside `internal/planning`, and the ledger query that separates installments by purchase date.
- Component split of the Plan view under `web/src/features/planning`, within O1 to O14 of `web/CLAUDE.md`, including the Slotted families chosen for the bar, the toggle, the toast and the sticky strip, with Slotted feedback where a family is missing.
- Copy of every string in `en` and `pt-BR`, following the words above.
- The order of slices. The calls made in this document: one reference choice per user, Track unchanged, income budgets out of the plan, and the assistant tool extensions as the last slice.
