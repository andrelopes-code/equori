A **Budget** sets a monthly amount for an expense category from a month on. The month control steps a month at a time with its arrows, marks the current month with a dot and returns to it with the button Today. Each month shows the planned amount, what was carried from the previous month when rollover is on, what was spent in the category and its subcategories, and what remains available.

Budgets use the **Accrual view**: a card purchase counts in the month of its date, not when the statement is paid.

The Track view of the budgets tab shows the month over every budget in one line of four figures (spent, left, committed, overspent) and one table line per budget under its top category; the spending no budget covers and where the spending went stay closed at the end until opened; a budget's page shows its amounts by month and compares planned and spent. A budget that stops from a month on is ended: "End from {month}" in the actions of its line, in the current month or a later one, keeps the months before with their amounts, removes the amounts set for that month and later, and the budget leaves Track, the overview and the plan from that month; a rollover balance does not pass the end. A new amount after the end resumes the budget, from "Change amount" or from the plan. A budget created by mistake is deleted from the actions of its line or from its page; the deletion removes every month, past ones included, and its category and transactions stay. The assistant also creates, ends and deletes budgets, changes their amounts and reports their progress.

The **Income split** divides the income into buckets, each with a share and the expense categories placed in it. The Plan view groups the budgets by bucket and the Track view compares each bucket with its target. The topic income_split explains it.

An expense a goal paid is left out of what the budget spent; the row and the page of the budget state the amount as "paid by goals". For a yearly expense, use a budget whose balance carries over; for money kept apart in an account, a goal.

The tools. get_budgets_and_goals reads, by kind: budgets (planned, carried, spent and available of the month), goals, both (when kind is absent), plan (the budget plan of the month: the reference income, the installments, savings and goal deposits it pays, the budgets and the unassigned rest), split and bucket_entries (topic income_split). month is YYYY-MM, the current month when absent.

manage_budget_or_goal writes budgets, goals, the plan and the split; action names the operation. For budgets:

- create_budget: category_id (an expense category), amount (the monthly amount) and month (the first month, YYYY-MM); rollover carries the unspent amount to the next month.
- set_budget_amount: budget_id, amount and month, the first month of the new amount; earlier months keep theirs.
- end_budget: budget_id and month, the first month without the budget (YYYY-MM, from the current month); the months before keep their amounts, and later amounts are removed.
- delete_budget: budget_id; removes every month of the budget, past ones included; the category and its transactions stay, and the deletion is not undone. To stop a budget from a month on, use end_budget.
- save_plan: month and amounts, the categories whose amount changes from that month on, each with category_id and amount. source is the reference income of the plan: expected_income (the income expected in the month), average_income (the average income of the past months) or fixed, which takes amount as the reference; the stored source stays when absent. savings_target_bp is the share of the reference to save, in basis points.

The actions create_goal, update_goal, delete_goal, link_expense, unlink_expense and allocate are in the topic goals; save_buckets, move_category and delete_bucket_version in the topic income_split.

New budget asks for the "Category", the "Monthly amount", the "First month" and whether to "Carry the balance to the next month", then "Create budget" opens the page of the budget; a category that already has a budget opens that one. The question mark of the New budget header opens the help page Create a budget (/help/create-budget).
