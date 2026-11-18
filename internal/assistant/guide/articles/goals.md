A **Goal** is a target amount to reach by a date over one or more of your balance accounts. Its progress is the current value of those accounts against the target; for investment accounts the value uses stored prices. The goal also shows the return of its accounts over the last 12 months.

Create, change and delete goals on the Goals screen, which also shows what-if values. A goal marked "Count deposits as savings in the income split" sends what goes into its accounts to the bucket that takes savings instead of the bucket that takes goals; an emergency reserve built as a goal is the usual case.

A goal can pay an expense. An expense paid from an account the goal alone holds is paid by the goal with no further step. An expense paid from another account, after a withdrawal from the goal, is linked to the goal on Transaction detail, in "Paid by a goal", or on the goal's card: after a withdrawal the card states its amount and date, and "Choose the expenses it paid" lists the expenses recorded since then, each with Link. The card states what the goal spent, and "See expenses" lists the expenses with Remove. An expense a goal paid stays in the reports and counts against neither the budget nor the bucket of its category. The assistant links and unlinks an expense on request, after confirmation.

One account can serve several goals. In the goal dialog, each chosen account that can be shared (an asset account in a currency, without sub-accounts) is held as "Whole account" or as "Part of the account", with the amount to set aside when the goal is saved. A goal over a part of an account counts only what was set aside for it: its card states that amount, holds Set aside and Release, and names the other goals of the account. Setting aside moves no money: it assigns a part of the balance to the goal, at most what the account has available. After a withdrawal that leaves the balance under what the goals hold, the card states the amount above the balance; Release brings it back. A yield of a shared account raises what the account has available, not a goal. An account is held whole or by parts across the goals, never both.

"Schedule {amount} a month", under the what-if of the card, opens the schedule form on a saving of that amount into the goal's account. For a shared account the schedule names the goal: each realized occurrence sets its amount aside for it, and undoing the occurrence takes it back. The assistant sets aside and releases an amount on request, after confirmation.

The tools. get_budgets_and_goals with kind goals lists each goal with its target, current value, progress, due date and, for a shared account, what it holds and what the account has available.

manage_budget_or_goal writes goals; action names the operation.

- create_goal: name, amount (the target), due_on (the target date) and account_ids, the balance accounts that count toward it. counts_as_savings sends the deposits to the bucket that takes savings. allocated says the account_ids are shared accounts held in part: the goal then counts only what is set aside for it.
- update_goal: goal_id and what changes among name, amount, due_on, account_ids, counts_as_savings and allocated.
- delete_goal: goal_id; the accounts and their transactions stay, and the deletion is not undone.
- allocate: goal_id, one account in account_ids and amount; a positive amount sets that part of the balance aside for the goal, at most what the account has available, and a negative amount releases it. No money moves.
- link_expense: goal_id and transaction_id state that the goal paid that expense, which then counts against neither its budget nor its bucket. unlink_expense reverts it.
