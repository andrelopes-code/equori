# Planning coherence: one rule for money set aside, across budgets, buckets, goals and the contribution plan

- Status: delivered (commits 34357be4 to the commit of this line; section 13 records what delivery settled)
- Date: 2026-11-17
- Phase: P7 Planning, amendments A249 to A258; portfolio rule CN20; scenarios S567 to S590
- Amends: `2026-10-27-budget-plan-design.md` (A129), `2026-11-15-income-buckets-design.md` (A230, A233, A234), `2026-11-16-income-buckets-hardening-design.md` (A235), `2026-11-17-goal-savings-design.md` (A239), `2026-11-17-income-split-versions-design.md` (A243), `2026-11-15-planning-tabs-design.md` (A2), `2026-11-12-contribution-plan-design.md`

## 1. Problem

The planning tools answer separate questions: the agenda (when money moves), budgets (how much a category may spend), the income split (which share of the income each bucket takes), goals (how far a balance is from a target) and the contribution plan (which assets a contribution buys). The tools stay separate. Their joints hold twelve defects, found by reading the code against twelve scenarios.

| # | Defect | Evidence |
|---|---|---|
| 1 | The kind of a schedule, not the destination of the money, decides what counts as savings. | `plan.go:294-309` counts kind `savings` only; `month-close.ts:77` drops kind `transfer` only; `bucket_savings.go` counts by account. |
| 2 | A bucket's verdict has no carry, so a non-monthly expense misses the target in the month it is paid. | `buckets.go` reads no `Carried`; A234 counts a goal withdrawal as a negative deposit. |
| 3 | An expense paid directly from a goal account does not reduce the goals bucket; the same expense after a withdrawal to checking does. | `countedInflows` counts asset and liability postings only. |
| 4 | Investment income credited to a savings account counts in the income received and never as money set aside. | `bucketMonth` sums every income category; A233 leaves yields out of the inflows. |
| 5 | The amount set aside each month lives in five places with no link: savings schedules, the savings target, the share of the savings bucket, the contribution amount (CN11) and the monthly amount of a goal. | Specs A129, A187, A231, CN11; `goal-plan.ts`. |
| 6 | A goal holds whole accounts; an account in two goals counts its full balance in each. | `planning_goal_account`, primary key `(goal_id, account_id)`. |
| 7 | Earlier installments reduce the amount to distribute and appear in no row of the split table. | A129 `unassigned`; non-goal of the income buckets spec. |
| 8 | A bucket has two targets in one month, and no screen names the base of either. | Plan: `reference × share`; Track: `received × share` (A233). |
| 9 | The contribution plan reads neither the goals nor the month's plan. | `web/src/features/portfolio/contribution-plan` imports nothing of planning. |
| 10 | One word names several concepts. | pt-BR "plano", "meta", "aporte", "poupança"; eight wordings for a remainder. |
| 11 | No screen shows the chain from the income to its destinations. | Four entry points: `/planning`, `/goals`, `/portfolio/contribution-plan`, `/categories`. |
| 12 | A235 describes the unallocated income as income that stayed in accounts. With an installment purchase the figure is an accrual figure and the description is false. | A235; accrual view (`02-ubiquitous-language.md`). |

## 2. Goals, non-goals, anti-goals

Goals:

- G1. One function classifies a movement between accounts. The plan, the bucket history, the agenda and the tools read it.
- G2. A month that follows its plan misses no target: accumulated budget balance and expenses paid by a goal do not count against a ceiling.
- G3. One account serves several goals by amount.
- G4. A screen that asks for a monthly amount offers the amount the month already plans.
- G5. Each figure of a split table sums with its siblings to the stated total.
- G6. One term per concept in both languages.

Non-goals:

- A change of the accrual view. An installment purchase counts in full on its purchase date.
- A sub-account as the split of an account between goals. `ledger/app/account.go` (`checkParentEmpty`) rejects a parent with postings, the bank connection maps an external account to a leaf, and reconciliation checks leaves.
- A share in percent of an account per goal. A deposit meant for one goal would raise every goal of the account.
- One position of a security shared between goals. A goal holds a holding account whole.
- A cap on the expenses linked to a goal.
- A change of `last_month` and `average` of the plan rows, or of any report, by a linked expense.
- A bucket per transaction (hardening spec, non-goal).
- The phone. `/planning`, `/goals` and `/portfolio/contribution-plan` are desktop-only (ADR 027).

Anti-goals:

- A deposit, a withdrawal or an expense counted twice against the income.
- A figure of a closed month that changes without a write that names it, except the restatement of section 9.
- A second ledger: an allocation never changes a balance, and no figure of the ledger reads it.
- Two figures of one screen that disagree.

## 3. Glossary (A249)

Each concept holds one term in code, specs, API descriptions and both catalogs. `docs/domain/02-ubiquitous-language.md` gains these rows.

| Concept | en | pt-BR |
|---|---|---|
| A target balance over accounts by a date | goal | meta |
| The amount a bucket must keep to | target | alvo |
| Money moved or allocated to a goal | deposit | depósito |
| Money that buys assets by the contribution plan | contribution | aporte |
| The Plan view of the budgets of a month | month plan | plano do mês |
| Reference income without a destination | to distribute | a distribuir |
| A category that no bucket holds | outside the split | fora da divisão |
| Income minus expenses over income (reports) | savings rate | taxa de poupança |
| Money moved into the savings set (buckets) | set aside | guardado |
| Movements into the savings set that schedules plan | scheduled savings | poupança agendada |

A catalog text that uses a term outside its row changes in the slice of its screen. Code identifiers keep `savings` and `target`.

## 4. Rules

### A250 Account sets

Every asset and liability account of a book belongs to exactly one set.

- **Goal set**: the accounts held whole by the goals with `counts_as_savings` false, and their sub-accounts (A239).
- **Savings set**: the asset accounts of kind `savings`, `reserve` and `brokerage` outside the goal set, and the accounts held whole only by goals with `counts_as_savings` true, with their sub-accounts (A233, A239).
- **Spending set**: every other asset and liability account.

An account held by a goal through an allocation (A255) keeps the set of its own kind.

### A251 Real movement into a set

This rule replaces the source rule of A233 and A234. For a held set H (the goal set or the savings set) and a non-voided transaction with a posting in H, the amount counted is the negated sum of its postings in:

- asset and liability accounts outside H whose instrument is the base currency (unchanged);
- expense categories, except the ones with `system_role` `realized_losses`, `adjustments` or `opening_balances`;
- income categories, except the ones with `system_role` `yield` or `realized_gains`.

A salary credited to a savings account counts as a deposit. An expense paid from a goal account counts as a withdrawal, as the same expense after a move to checking does. A yield, a realized gain and a realized loss count nothing.

### A252 Income to split

`received(M)` of A233 leaves out each income posting with `system_role` `yield` or `realized_gains` whose transaction has no posting in an account of the spending set. `retained(M)` is the sum left out. The history carries `retained` in each month. A yield credited to a checking account stays in `received`.

Retained income enters neither the income nor the money set aside, so the targets of Track do not rise with it.

### A253 Planned movement

This rule amends A129. For each occurrence of M with state `expected` or `realized` whose schedule has kind `savings` or `transfer`, `from` is the set of the schedule's account and `to` the set of its counterpart. A schedule with a goal (A255) takes as `to` the goal set, or the savings set when the goal counts as savings.

| Figure | Definition |
|---|---|
| `savings` | Sum of the amounts with `to` in the savings set and `from` outside it, minus the amounts with `from` in the savings set and `to` outside it. |
| `goal_deposits` | The same sum over the goal set. |
| `savings_brokerage` | The part of `savings` whose counterpart is an account of kind `brokerage`. |
| `goal_deposits_brokerage` | The part of `goal_deposits` whose counterpart is an account of kind `brokerage`. |
| `unassigned` | `reference − installments − savings − goal_deposits − planned`. |

- Amounts are valued as `expected_income` (A72).
- A230: the bucket that takes savings adds `savings` to its planned amount; the bucket that takes goals adds `goal_deposits`.
- A188 keeps reading `savings`.
- `Schedule` gains the read-only field `moves`, `{ from, to }` with values `spending`, `savings` and `goals`, present for the kinds `savings` and `transfer`.
- A2 (planning tabs): a row of the agenda counts in the close, the outflows, what is still to pay and the running balance as an outflow when `moves.from` is `spending` and `moves.to` is not, as an inflow in the opposite case, and not at all when both are equal or neither is `spending`.

### A254 Verdict of a bucket

This rule amends A233 and A234. Each bucket of a month of the history carries, beside `real`:

| Figure | Definition |
|---|---|
| `goal_paid` | Sum of the expense postings booked in M, in categories that resolve to the bucket, of the transactions a goal pays (A256). |
| `covered` | For each counted budget (A129) with `rollover` true whose category resolves to the bucket: `min(max(carried, 0), spent)`, with `spent` the spending of M, less `goal_paid`, of the categories of the budget's subtree that resolve to the bucket. The sum over those budgets. |
| `deposited`, `withdrawn` | For the bucket that takes goals: the sums of the positive and of the negative amounts of A251 and A255 in M. |

- A ceiling bucket kept its target when `real − goal_paid − covered` is at most the target.
- The bucket that takes goals kept its target when `deposited` is at least the target. A goal is built to be spent, so a withdrawal does not miss its floor.
- The bucket that takes savings and a bucket marked `at_least` keep the rule of A234 on `real`.
- `real` is unchanged, so the sum of A235 holds.

### A255 Allocation of an account to goals

- A link between a goal and an account is **whole** (today's rule) or **allocated**. `planning_goal_account` gains `allocated`, false by default.
- An allocated link takes an asset account without children whose instrument is a currency. An account holds whole links or allocated links, never both: the other case is a 422 on `account_ids` or on `allocated_account_ids`.
- An allocation holds a goal, an allocated account of that goal, `booked_on`, a signed amount other than zero in the account's currency and, optionally, the occurrence that created it.
- `allocated(goal, account)` is the sum of the allocations with `booked_on` at or before today. `available(account)` is the booked balance minus the allocations of every goal.
- `current` of a goal (A55) is the sum of the balances of its whole accounts with their sub-accounts, plus `allocated` of each allocated account, valued as today.
- An allocation above `available`, or one that brings `allocated(goal, account)` below zero, is a 422 on `amount`.
- An account is **over-allocated** when `available` is below zero, which a withdrawal can cause. The goals of that account carry `over_allocated`, the negated `available`. No write is blocked.
- A yield of an allocated account raises `available`, not a goal. The trailing return of a goal reads its whole accounts only.
- **Schedule.** A schedule of kind `savings` or `transfer` may name `goal_id`, a goal that holds the schedule's counterpart as an allocated account. Realizing an occurrence of that schedule adds an allocation of the realized amount on the realized date; unrealizing or reopening it deletes that allocation. One occurrence holds at most one allocation.
- **Buckets.** An allocation of M on an account in the base currency is a movement from the set of its account into the goal set, or into the savings set when the goal counts as savings. A movement inside one set counts nothing. The bucket that takes the destination adds the amount; the bucket that takes the origin subtracts it. An origin in the spending set subtracts from no bucket.
- **Entries (A243).** An allocation is an entry of kind `goals` or `savings` without `transaction_id`; its description is the goal's name.
- A goal lists the other goals that hold one of its accounts in `shared_with`.

### A256 Goal that pays expenses

- A goal **pays** a transaction when a stored link names both, or when the transaction holds an expense posting and a posting in an account that exactly one goal holds whole, sub-accounts included (a direct payment).
- A link takes a non-voided transaction of the book with at least one expense posting; any other is a 422 on `transaction_id`. A transaction holds at most one link; a new link replaces it.
- `spent` of a goal is the sum of the expense postings of the transactions it pays.
- A linked expense stays in `real`, in `spent(M)` of A235 and in every report.

### A257 Effect of a paid expense

- A254 reads `goal_paid`.
- A54: `spent` of a budget leaves out the expense postings of the transactions a goal pays. `BudgetProgress` carries `goal_paid`, the amount left out. `available` and `carried` follow.
- The deposit counted in its own month (A234, A255), so the money counts once against the income.

### A258 Rows outside the buckets and stated bases

- The split table of the Plan gains one row per figure that no bucket takes and that is above zero: `installments` ("Earlier installments"), `savings` without a bucket that takes savings, `goal_deposits` without a bucket that takes goals. The targets sum to the reference; the planned amounts, these rows and `unassigned` sum to the reference.
- Each row of the Track section writes its base: "target {amount} · {share} of {received}". When `received` differs from the reference of the plan of M, one line states both amounts.
- A235 keeps its formula. Its description becomes: the income of the month minus the expenses by transaction date and the money set aside. The screen text states the accrual base. A positive value is not stated as money left in accounts.

### CN20 Contribution amount from the month plan

- Under the amount field of the contribution plan, when `savings_brokerage + goal_deposits_brokerage` of the current month is above zero, one line states both figures and the action **Use {amount}** fills the field with their sum. The stored amount (CN11) changes only on save.
- A member whose account a goal holds carries the tag "reserved for {goal}". An `instrument` member carries it when a goal holds one of its holding accounts.
- Both are derivations of the screen from `GET /budget-plan` and `GET /goals`. The module `portfolio` gains no dependency.

## 5. Data and API

Migration numbers are the next free ones at implementation; on 2026-11-17 the latest is 00113 and `ArchiveVersion` is 26.

- **Migration A (allocations).** `planning_goal_account` gains `allocated boolean NOT NULL DEFAULT false`. `planning_schedule` gains `goal_id uuid NULL`, referencing the goal with `ON DELETE SET NULL`. New table:

```sql
CREATE TABLE planning_goal_allocation (
    id            uuid   NOT NULL PRIMARY KEY DEFAULT uuidv7(),
    books_id      bigint NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    goal_id       uuid   NOT NULL,
    account_id    uuid   NOT NULL,
    booked_on     date   NOT NULL,
    amount        bigint NOT NULL CHECK (amount <> 0),
    occurrence_id uuid   NULL,
    FOREIGN KEY (goal_id, account_id)
        REFERENCES planning_goal_account (goal_id, account_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX planning_goal_allocation_occurrence
    ON planning_goal_allocation (books_id, occurrence_id) WHERE occurrence_id IS NOT NULL;
```

- **Migration B (paid expenses).**

```sql
CREATE TABLE planning_goal_expense (
    books_id       bigint NOT NULL,
    transaction_id uuid   NOT NULL,
    goal_id        uuid   NOT NULL,
    PRIMARY KEY (books_id, transaction_id),
    FOREIGN KEY (books_id, goal_id) REFERENCES planning_goal (books_id, id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, transaction_id)
        REFERENCES ledger_transaction (books_id, id) ON DELETE CASCADE
);
```

- **Archive.** Both tables are facts. Each migration raises `ArchiveVersion` by one, with a step that writes `allocated` false and no `goal_id` into older rows.
- **Operations**, tag `planning`:

| Operation | Role | Body or query | Response |
|---|---|---|---|
| `POST /goals/{id}/allocations` (`createGoalAllocation`) | `write` | `account_id`, `amount`, `booked_on` (default today) | The goal |
| `GET /goals/{id}/allocations` (`listGoalAllocations`) | `read` | none | Allocations, latest first |
| `DELETE /goals/{id}/allocations/{allocation_id}` (`deleteGoalAllocation`) | `write` | none | 204; 422 on `allocation_id` for one created by an occurrence |
| `PUT /goals/{id}/expenses/{transaction_id}` (`linkGoalExpense`) | `write` | none | 204 |
| `DELETE /goals/{id}/expenses/{transaction_id}` (`unlinkGoalExpense`) | `write` | none | 204; `not_found` without that link |
| `GET /goals/{id}/expenses` (`listGoalExpenses`) | `read` | none | Transactions the goal pays, each with `amount` and `direct` |

- **Changed schemas.**
  - `Goal`: `allocated_accounts` (`account_id`, `allocated`, `available`), `over_allocated` (optional), `shared_with` (goal ids), `spent`. `GoalInput` and `GoalPatch`: `allocated_account_ids`.
  - `Schedule`: `moves` (read-only), `goal_id`. `ScheduleInput`: `goal_id`.
  - `BudgetPlan`: `goal_deposits`, `savings_brokerage`, `goal_deposits_brokerage`.
  - `BudgetBucketMonth`: `retained`; each bucket `goal_paid`, `covered`, and for the bucket that takes goals `deposited` and `withdrawn`.
  - `BudgetProgress`: `goal_paid`.
  - `BudgetBucketEntry`: `transaction_id` optional.
- **Ledger.** `OwnCategoryPostings` (income split versions spec) serves A252 and A256. `TransactionFacts` carries the class and `system_role` of each posting's account for A251. No table of the ledger changes.
- **Tools.**
  - `get_budgets_and_goals`: kind `plan` adds `goal_deposits`; kind `split` adds `retained`, `goal_paid`, `covered`, `deposited` and `withdrawn`; kind `goals` adds `allocated_accounts`, `over_allocated`, `shared_with` and `spent`.
  - `manage_budget_or_goal`: actions `allocate` (goal, account, signed amount), `link_expense` and `unlink_expense` (goal, transaction), each previewed.
  - `listGoalAllocations` and `listGoalExpenses` are covered by `get_budgets_and_goals` kind `goals`; `deleteGoalAllocation` is excluded: the assistant reverses an allocation with a negative `allocate`.
  - `TestToolCatalog` keeps the catalog under its ceiling (A247).

## 6. Web

Every text has a catalog key with pt-BR and en text, in the terms of A249. Amounts go through `useMoneyFormat()`.

- **Plan.** The split table draws the rows of A258 after the buckets. The rows "Scheduled savings" and "Goal deposits" link to `/portfolio/contribution-plan` and `/goals`.
- **Track.**
  - A first row of the section "Income split" draws the month as one strip that sums to `received`: spent in the buckets, set aside, goal deposits, outside the split, unallocated. "Set aside" links to the contribution plan and "goal deposits" to the goals.
  - A row of a ceiling bucket writes, when above zero, "{covered} paid from accumulated balance" and "{goal_paid} paid by goals".
  - The row of the goals bucket writes "{deposited} deposited" and, above zero, "{withdrawn} withdrawn".
  - One line states `retained` above zero: "{amount} of yields stayed in the investments and is outside the split."
  - Each row writes its base (A258).
- **Agenda.** `month-close.ts` reads `moves` (A253) in place of the kind.
- **Goals.**
  - The dialog offers, per account, "Whole account" or "Part of the account" with the amount to set aside now.
  - The card of a goal with an allocated account holds the actions **Set aside** and **Release**, the line "{allocated} of {account}" and, when over-allocated, "{amount} above the balance of {account}".
  - The card states "{account} is also held by {goal}" for each goal of `shared_with`.
  - The what-if of the card holds the action **Schedule {amount} a month**, which opens the schedule form with kind `savings`, the goal's account as counterpart, the amount and, for an allocated account, `goal_id`.
  - The card states "Spent {amount}" above zero and lists the expenses the goal pays. After a withdrawal above the expenses linked since it, one line asks which expenses the goal paid and opens a picker of the expense transactions since the withdrawal.
- **Transaction.** The detail of a transaction with an expense posting holds the action **Paid by a goal** (a select of the goals, and "No goal"). On the phone the action is left out (ADR 027, S9).
- **Budgets.** The budget card and the budget page write "{goal_paid} paid by goals" above zero. The budget form states, under the rollover field: "A yearly expense: a budget whose balance carries over. Money kept apart in an account: a goal."
- **Contribution plan.** The line and the tags of CN20.

## 7. Cross-cutting questions

- R1: Does not apply: no value varies by country. The sets read account kinds and system roles, which no region changes.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: `moves` values and entry kinds name the three sets of A250 and do not grow with regions.
- R4: Does not apply: no extension point.
- R5: The texts of sections 3 and 6, each with a catalog key in pt-BR and en, listed in the plan.
- R6: Amounts through `useMoneyFormat()`; shares through `formatBasisPoints`; dates and months through `Intl` of the active tag.
- C1: Allocation amounts, `goal_deposits`, `retained`, `goal_paid`, `covered`, `deposited`, `withdrawn`, `spent` of a goal and `available` are integers of minor units with their currency.
- C2: The figures of A251 to A254 hold the base currency, as A233. An allocation holds the currency of its account; `current` of a goal values it in the goal's currency at today's prices (A72), and a missing price is stated as A72 states it.
- C3: An asset or liability account in another instrument is not a counterpart of A251 (unchanged). An expense or income posting in another currency counts by its weight in the base currency.
- C4: The currency comes from the plan, the history, the goal or the account of the response.
- T1: The month of a movement is the calendar month of its transaction date; the month of an allocation is the month of `booked_on`; "today" comes from `platform/clock`.
- T2: Does not apply: no business day and no due date.
- B1: `planning_goal_allocation` and `planning_goal_expense` hold `books_id`; every query filters by it; a schema test rejects a row without a book, an allocation of zero, a second allocation of one occurrence and a second link of one transaction.
- B2: The roles of section 5. An HTTP test covers `owner`, `write`, `read` and no membership for each operation.
- B3: Does not apply: no setting is added.
- D1: Both tables are facts; `ArchiveVersion` rises by one per migration.
- D2: Two goose migrations.
- D3: No transaction changes. The allocation an occurrence creates is an automatic decision; unrealizing the occurrence undoes it. The restatement of section 9 is stated in the release notes and in the guide.
- D4: Does not apply: no data from a bank, a file or a model. The direct payment of A256 is a rule without doubt: exactly one goal holds the account whole.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: Six operations, with the entries of section 5 in `tool_exposure_test.go`. No new `Problem.code`: every rejection is `validation_failed` or `not_found`.
- S2: Does not appear on a phone, except that the action of the transaction detail is left out there.
- S3: `budgets.md`, `income_split.md`, `goals.md`, `schedules_and_occurrences.md`, `contribution_plan.md` and `transactions_and_postings.md` change in the commits of their screens.
- S4: The assistant reads the figures through `get_budgets_and_goals` and writes through `manage_budget_or_goal`.
- X1: S567 to S590.
- X2: R1 and R2 do not apply. S590 runs with a base currency other than the account's.

## 8. Scenarios

- S567. A schedule of kind `transfer` of 1,000.00 from checking into a brokerage account: the plan holds `savings` 1,000.00, the bucket that takes savings plans it, and `moves` is `spending` to `savings`.
- S568. A schedule of kind `savings` of 500.00 into the account of a goal: `goal_deposits` 500.00, `savings` 0.00; the bucket that takes goals plans 500.00. With `counts_as_savings` true, the figures swap.
- S569. A schedule from a savings account to checking of 300.00 lowers `savings` by 300.00; a schedule between two savings accounts counts nothing and has `moves` `savings` to `savings`.
- S570. `unassigned` equals `reference − installments − savings − goal_deposits − planned`.
- S571. An expense of 5,000.00 paid from a goal account lowers the goal set by 5,000.00 in the history, as a withdrawal of 5,000.00 to checking does.
- S572. A salary of 5,000.00 credited to a savings account counts 5,000.00 in `received` and 5,000.00 in the bucket that takes savings.
- S573. A yield of 300.00 credited to a brokerage account: `retained` 300.00, `received` without it, no deposit. The same yield credited to checking stays in `received`.
- S574. A realized loss posted from a brokerage account counts no withdrawal.
- S575. A rollover budget of 200.00 a month with 2,200.00 carried and 2,400.00 spent in January: `covered` 2,200.00; the bucket counts 200.00 against its target and kept it.
- S576. A carried amount below zero covers nothing.
- S577. The bucket that takes goals, with 500.00 deposited and 5,000.00 withdrawn in July: `deposited` 500.00, `withdrawn` 5,000.00, `real` -4,500.00, target kept when the target is at most 500.00.
- S578. A savings account of 30,000.00 allocated to two goals with 20,000.00 and 5,000.00: the goals hold `current` 20,000.00 and 5,000.00, and `available` is 5,000.00.
- S579. An allocation of 6,000.00 over an `available` of 5,000.00 is a 422 on `amount`; a release that brings a goal below zero is a 422 on `amount`.
- S580. A withdrawal of 10,000.00 from that account: both goals carry `over_allocated` 5,000.00 and keep their `current`.
- S581. An account with a whole link and an allocated link is a 422; an allocated link on a brokerage account with holdings is a 422.
- S582. A schedule with `goal_id`: realizing its occurrence of 500.00 adds an allocation of 500.00; unrealizing deletes it; realizing twice keeps one.
- S583. An allocation of 500.00 on a savings account to a goal: the goals bucket holds 500.00 and the savings bucket -500.00 in the month; on a checking account the goals bucket holds 500.00 and no bucket loses it; the entries of the goals bucket list it without a transaction.
- S584. A linked expense of 5,000.00 in a ceiling bucket: `real` holds it, `goal_paid` is 5,000.00, the bucket kept its target; the budget of its category holds `goal_paid` 5,000.00 and `spent` without it; the goal holds `spent` 5,000.00.
- S585. A second link of one transaction replaces the first; a link of a voided transaction or of one without an expense posting is a 422 on `transaction_id`.
- S586. An expense paid from an account one goal holds whole is paid by that goal with `direct` true; from an account two goals hold, by none.
- S587. With installments of 800.00 and no bucket that takes goals, the plan's buckets, the rows of A258 and `unassigned` sum to the reference.
- S588. `shared_with` names the other goal of an account two goals hold whole.
- S589. Each operation of section 5 answers `write` and rejects `read` where it writes, answers `read` where it reads, and rejects an access without membership.
- S590. A book with base currency USD and a goal over an allocated BRL account: `current` values the allocation at today's rate; the allocation counts in no bucket figure (A255).

## 9. Restatement of closed months

A251 to A254 change the figures of months already closed for a book that holds one of these cases: a schedule of kind `transfer` into a savings or goal account, a schedule of kind `savings` into a goal account, an expense paid from a held account, an income credited to a held account, a rollover budget, a withdrawal from a goal. No stored row changes: the figures are computed on read. The guide article `income_split.md` states the four rules in the release that ships them.

## 10. Delivery order

Each row is a set of vertical slices with its own plan.

| Order | Content | Depends on |
|---|---|---|
| 1 | A249 glossary and catalog texts | none |
| 2 | A250 to A253: sets, real and planned movement, `moves`, agenda | 1 |
| 3 | A254: `covered`, `deposited`, `withdrawn` | 2 |
| 4 | A256, A257: goal that pays expenses | 3 |
| 5 | A258, CN20, the schedule action of the goal card, the strip of Track | 2 |
| 6 | A255: allocations | 2 |

## 11. Evidence

- YNAB: a transfer into an account outside the budget takes a category and one between budget accounts takes none; a target states an amount and moves no money. `support.ynab.com` (Account Types; How to Use Targets).
- Monarch: a transfer linked to a goal counts in the budget and a market change does not; a linked expense counts in the goal's spending and leaves the budget unchanged; one account funds several goals by allocated amounts, with an alert on over-allocation. `help.monarch.com` (Using Save Up Goals; Introducing Goals 3.0; Moving Funds In and Out of Goals).
- Simplifi: the month reads income minus bills, planned spending and goal contributions. `support.simplifi.quicken.com` (Understanding your Spending Plan).
- Early Retirement Now, "You want to know our savings rate? Which one?": reinvested income enters both the numerator and the denominator, or neither.
- CRS, "Introduction to U.S. Economy: Personal Saving": the saving rate has an income-minus-outlays measure and a flow-of-funds measure.

## 12. Left to the plan

- The file split inside `internal/planning` and `web/src/features`, under ADR 033 and `web/CLAUDE.md`.
- The cost of `covered` over the six months of the history, measured before the slice of A254 is planned.
- The catalog keys of R5.

## 13. Settled at delivery

- **Migrations.** 00117 (`planning_goal_expense`) and 00118 (`allocated`, `planning_schedule.goal_id`, `planning_goal_allocation`); `ArchiveVersion` 28. `planning_goal_allocation.occurrence_id` references `planning_occurrence` with `ON DELETE CASCADE`.
- **A251, C3.** A category posting counts when the instrument of the category is the base currency; a category in another instrument counts nothing.
- **A254.** The bucket that takes goals is judged on `deposited` whether or not it is marked `at_least`. A budget whose subtree spans several buckets covers them in method order, up to its carried balance.
- **A255.** `createGoalAllocation` answers 200 with the goal. `GoalInput.account_ids` is optional: a goal holds at least one account across `account_ids` and `allocated_account_ids`, and an empty pair is a 422 on `account_ids`. `Goal.over_allocated` sums the negated negative `available` amounts of the goal's accounts in the target currency. A future-dated allocation reserves its amount at once and counts in `current` from its date. Deleting an allocation whose removal brings the goal below zero is a 422 on `allocation_id`. The goal of a schedule is set at creation.
- **A256.** `spent` of a goal and the amounts of `listGoalExpenses` are in the base currency. An expense category with `system_role` `realized_losses`, `adjustments` or `opening_balances` is no expense a goal pays. A stored link wins over a direct payment. `Goal` carries `unexplained_withdrawal` (`amount`, `since`): the latest withdrawal of the last 12 months from the accounts the goal holds whole into another balance account, less the expenses linked on or after it; the card asks which expenses the goal paid while it is present.
- **Tools.** `manage_budget_or_goal` gains `link_expense`, `unlink_expense`, `allocate` and the flag `allocated` (the `account_ids` of a goal are held by amount). `deleteGoalAllocation` stays a screen operation.
- **Web.** The split table of the Plan also draws what is left to distribute as its last row. The Track strip leaves out a part at zero, except the unallocated income, and writes a part below zero in the legend without a segment. Without a withdrawal to explain, the panel of a goal offers the expenses of the last 60 days.
- **Track texts (owner review of 2026-11-23).** The line of A258 that states the received income and the reference is the section's description, and the text of the targets is left out: each row states its base. The lines under the buckets are removed. The legend of the strip carries their figures: "Outside the split" opens its entries and replaces **See entries** (A243), the retained yields (A252) are its last term, without a segment, and the legend is one column per figure: name, amount, and one line with the share of the income, "by purchase date" (A235) or "above the income" for the unallocated income, and "in the investments" for the retained yields. No help tip.
- **Texts (A249).** en "To distribute", "Earlier installments", "Scheduled savings", "Set aside"; pt-BR "A distribuir", "Parcelas anteriores", "Poupança agendada", "Guardado", "alvo" for the target of a bucket and "depósitos" for money moved to goals.
- **Not measured.** The cost of `covered` is one ledger read per rollover budget over the months since its first amount; no timing was taken on a large book.
