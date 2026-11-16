# Income buckets: splitting the reference income by method

- Status: proposed
- Date: 2026-11-15
- Phase: P7 Planning, amendments A229 to A234, scenarios S438 to S447

## 1. Intent

Many people plan a month by a split of the income into a few broad buckets instead of a budget per category: 50/30/20 (needs, wants, savings), 50/15/35, or six buckets such as fixed costs, comfort, goals, pleasures, financial freedom and knowledge. The budget plan (`docs/specs/2026-10-27-budget-plan-design.md`) left this out (its non-goal "Category groups of the needs, wants and savings kind"). The only grouping is the category tree, so a person with such a method rebuilds the tree or computes each bucket by hand, and nothing compares a month's spending with the bucket's share.

This change adds a **bucket method** to the book. A bucket is a named share of the reference income that a set of expense categories, and optionally the month's savings, draw from. The Plan view states each bucket's target, planned amount and spent amount in one table, and the plan table groups its rows by bucket. This amendment replaces the non-goal of the budget plan spec, section 2.

## 2. Goals, non-goals, anti-goals

Goals:

- G1. A person sets a method in one dialog: start from a preset or from scratch, name each bucket, give its share, and place each expense category in a bucket.
- G2. Any number of buckets from 1 to 10 and any shares that sum to 100 %: no method is fixed in code.
- G3. For any month, the Plan view states per bucket the target, the planned amount and the spent amount, and the difference in words.
- G4. While the plan is edited, each bucket's planned amount and target follow the draft.

Non-goals:

- Changes to Track, to the budget detail page or to the budget form.
- A budget per bucket. Budgets stay per category; a bucket sums them.
- Installments of earlier purchases in a bucket. Accrual counted them in the month of the purchase, in that month's bucket.
- Income categories in a bucket.
- A method per month. One method per book applies to every month.
- The phone. Planning is desktop-only (ADR 027, S3).

Anti-goals:

- A category counted in two buckets, or a planned amount counted twice (the counted rule of A129 holds).
- Bucket targets whose sum differs from the reference by one minor unit or more.
- Two savings targets that disagree on one screen.
- A bucket method written without an explicit save.

## 3. Domain amendments

### A229 Bucket method

A book has at most one bucket method. A method holds 1 to 10 buckets in order. A bucket holds:

- `name`: 1 to 40 characters after trimming; two buckets of one method never share a name, ignoring case;
- `share`: basis points, 0 to 10000. The shares of a method sum to exactly 10000;
- `takes_savings`: true for at most one bucket. That bucket also draws the month's `savings` (A129);
- `categories`: expense categories of the book. A category sits in at most one bucket of the method.

A category **resolves** to the bucket of the nearest category, itself or an ancestor, that sits in a bucket. A category that resolves to none is **outside** the method. Deleting or merging away a category removes it from its bucket and nothing else.

Saving a method replaces the stored one in one transaction. Saving an empty list removes the method.

### A230 Bucket figures of a month

For a book with a method and a month M, each bucket carries:

| Figure | Definition |
|---|---|
| `target` | `reference × share / 10000`, split over the buckets with the largest-remainder method of A132, so the targets sum exactly to `reference`. Absent without `reference`. |
| `planned` | Sum of `planned` of the counted rows (A129) whose category resolves to the bucket; plus `savings` for the bucket that takes savings. |
| `spent` | Sum of the accrual totals in M of the expense categories, own postings only, that resolve to the bucket; plus, for the bucket that takes savings, what the month left (A233). |

The plan also carries `outside_planned` and `outside_spent`: the same sums over the categories outside the method. A budget on a category covers its subtree (A129), so its `planned` counts in the bucket of the budget's category, while the `spent` of each subcategory counts in the bucket its own category resolves to.

### A233 Real amount and history

What a month left is the income received in it (`received_income` of A129) less the accrual total of every expense category: the rule of the savings rate indicator (`internal/reporting/app/indicator_months.go`). It replaces the realized savings occurrences, which a book that saves by transfers without a savings schedule never fills. The bucket that takes savings adds it to its own categories' spending, so the real amounts of the buckets and the spending outside the split sum to the income received.

The history of a month M covers M and the five months before it. Each month holds `received`, the real amount of each bucket in method order and `outside`. A month's target of a bucket splits `received` by share with the largest-remainder method of A230; the plan of a single month keeps the reference as its base. A bucket **kept** its target when its real amount is at most the target, or at least the target for the bucket that takes savings.

### A234 Floor buckets and the goals bucket

A bucket marked `at_least` keeps its target when its real amount reaches it; any other bucket keeps it at or below it, and the bucket that takes savings is always a floor. At most one bucket `takes_goals`, never the one that takes savings. Its real amount adds, per month, what went into the goals' accounts and their sub-accounts from the book's other asset and liability accounts in the base currency: the negated sum of those accounts' postings in the non-voided transactions that touch a goal account. Yields and price changes post from income or nothing and do not count; a withdrawal counts against its month. With a goals bucket, the bucket that takes savings subtracts that amount, so one deposit counts once. Migration 00102 adds `at_least` and `takes_goals` with a check and a unique partial index; archive version 18 writes both as false into older bucket rows.

### A231 Savings target under a method

When a bucket takes savings, the plan's savings target (A188) is that bucket's share. The stored `savings_target_bp` is kept and applies again once no bucket takes savings: a plan save under a savings bucket ignores the target it carries and keeps the stored one, since the screen and the assistant send back the share they read.

### A232 Presets

The dialog offers three starting points. They are texts of the screen, not stored values; choosing one replaces the buckets of the draft and keeps the categories of each bucket whose name stays.

| Preset | Buckets (share, takes savings) |
|---|---|
| 50/30/20 | Needs 50 %, Wants 30 %, Savings 20 % (savings) |
| Six buckets | Fixed costs 30 %, Comfort 15 %, Goals 15 %, Pleasures 10 %, Financial freedom 25 % (savings), Knowledge 5 % |
| From scratch | One bucket "Essentials" 100 % |

## 4. Data and API

Migration `00101_planning_bucket.sql`:

```sql
CREATE TABLE planning_bucket (
    id            uuid    NOT NULL PRIMARY KEY DEFAULT uuidv7(),
    books_id      bigint  NOT NULL REFERENCES identity_books (id) ON DELETE CASCADE,
    position      integer NOT NULL CHECK (position BETWEEN 0 AND 9),
    name          text    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    share_bp      integer NOT NULL CHECK (share_bp BETWEEN 0 AND 10000),
    takes_savings boolean NOT NULL DEFAULT false,
    UNIQUE (books_id, position),
    UNIQUE (books_id, id)
);

CREATE UNIQUE INDEX planning_bucket_name ON planning_bucket (books_id, lower(name));
CREATE UNIQUE INDEX planning_bucket_savings ON planning_bucket (books_id) WHERE takes_savings;

CREATE TABLE planning_bucket_category (
    books_id    bigint NOT NULL,
    category_id uuid   NOT NULL,
    bucket_id   uuid   NOT NULL,
    PRIMARY KEY (books_id, category_id),
    FOREIGN KEY (books_id, bucket_id) REFERENCES planning_bucket (books_id, id) ON DELETE CASCADE,
    FOREIGN KEY (books_id, category_id) REFERENCES ledger_account (books_id, id) ON DELETE CASCADE
);
```

The sum of 10000 and the expense class of a category are checked by the application: a deferred check across rows adds no protection the single save path lacks. Both tables are facts of the archive; `ArchiveVersion` becomes 17 with step `addBuckets`, which carries version 16 tables over unchanged.

Operations, tag `planning`:

- `GET /budget-buckets/history?month=YYYY-MM` (`getBudgetBucketHistory`), `x-book-role: read`, returns `BudgetBucketHistory`: `currency`, the method's `buckets`, and `months`, each with `month`, `received`, `outside` and `buckets` of `{ id, real }` (A233). `get_budgets_and_goals` covers it through the kind `split`, which adds each bucket's target and whether it kept it.
- `GET /budget-buckets` (`getBudgetBuckets`), `x-book-role: read`, returns `BudgetBuckets`: the method in order with each bucket's `id`, `name`, `share_bp`, `takes_savings` and `category_ids`, and an empty list without one. The categories screen reads it, since it reads no month.
- `PUT /budget-buckets` (`saveBudgetBuckets`), `x-book-role: write`, takes `BudgetBucketsInput` and returns 204. Field errors are 422 with the existing validation problem, the field named `buckets[i].name`, `buckets[i].share_bp`, `buckets[i].category_ids` or `buckets`.
- `GET /budget-plan` gains the method:

```yaml
BudgetPlan:
  properties:
    buckets:                  # absent without a method
      items:
        required: [id, name, share_bp, takes_savings, category_ids, planned, spent]
        properties:
          id: { type: string, format: uuid }
          name: { type: string }
          share_bp: { type: integer }
          takes_savings: { type: boolean }
          category_ids: { type: array, items: { type: string, format: uuid } }
          target: Money       # absent with reference
          planned: Money
          spent: Money
    outside_planned: Money    # present with buckets
    outside_spent: Money      # present with buckets
BudgetBucketsInput:
  required: [buckets]
  properties:
    buckets:
      maxItems: 10
      items:
        required: [name, share_bp, takes_savings, category_ids]
```

`getBudgetPlan` keeps its tool, `get_budgets_and_goals` kind `plan`, which now lists the buckets. `saveBudgetBuckets` is covered by `manage_budget_or_goal` through a new action `save_buckets`, previewed like `save_plan`; an empty list previews a destructive removal that names the stored buckets. `getBudgetBuckets` is covered by `get_budgets_and_goals`, whose kind `plan` lists the same buckets.

## 5. The Plan view

- **Buckets section** (Plan), a `Section` "Income split" between the reference panel and the plan table. It answers how much of each bucket the plan covers. With a method, its body is a framed `Table` with the caption "Income split", one row per bucket in method order and a last row "Outside the split" when its planned amount is above zero. Columns: Bucket, Share, Target, Planned and Status. Every amount ends on one vertical line. Status is one line of words: "{amount} to plan" while the planned amount is at most the target, "{amount} over" in the danger tone otherwise, "{amount} above" in the text tone for a floor bucket (A234); a dash without a target. The savings bucket carries the words "with savings" after its name and the goals bucket "with goal deposits", in the muted tone. What was spent belongs to Track.
- **Without a method**, the same place holds one line, "Split the income into buckets: 50/30/20, six buckets or your own.", and the button **Set up split**.
- **Section action**: the button **Edit split**, or **Set up split** without a method, opens the dialog. It shows in past months too, since the method is not per month.
- **Allocation bar**: with a method, its segments are the buckets by planned amount, not the root categories; the unassigned rest stays as today.
- **Plan table**: with a method, rows are grouped by bucket in method order, then "Outside the split". A group row shows the sums of its counted rows, as a root group does; the buckets section carries the targets. A line shows its full category path, since a bucket mixes roots. Without a method, the root-category grouping stays.
- **Savings target**: with a bucket that takes savings, the savings target field is read-only and its description reads "Set by the {bucket} bucket." (A231).
- **Dialog "Income split"**, three parts in one scrolling body:
  1. Starting point: a select of the three presets of A232; it is applied only on choice.
  2. Buckets: one row per bucket with name, percentage with one decimal, a select of how it counts ("Spend up to the target", "Use at least the target", "Keep the month's leftover", "Deposit into goals"; the last two move to the new bucket from the one that held them) and a remove button; the button **Add bucket** stops at 10. Under the rows, the total in percent; when it differs from 100 %, the line "The shares sum to {total}; they must sum to 100 %." in the danger tone, and **Save** is disabled.
  3. Categories, in two panes. The left pane lists the buckets as toggle buttons, each with its name, the number of open expense categories that draw from it and its share, and a last entry "Without a bucket" with the number of top-level categories outside the split, in the danger tone above zero. The right pane checks the categories of the chosen bucket, every open expense category in tree order: checked when it draws from the bucket by its own choice; checked and fixed, with the tag "follows {parent}", when it draws from it through its parent; unchecked with the name of its bucket as a tag otherwise. A click on an own category takes it out (a top-level one outside the split, a subcategory back to its parent); a click on another bucket's category brings it in, by following its parent when the parent already draws from the bucket. With "Without a bucket" chosen, the pane lists those categories and says to check them in a bucket.
  - **Save** writes the method; **Remove split** (shown when a method exists) saves an empty list after the alert below; the toast reports the removal.
- **Track section.** At the top of Track, when a method exists, a surface `Section` "Income split" answers whether each bucket kept to its target, from the history of A233. Its description is the income received; its body opens with the verdict of the month ("In October, 2 of 6 buckets missed their target." / "In October, every bucket kept to its target." / "No income came in October: the targets depend on it."). Under it, one row per bucket of 3.5rem: the name over "target {share}" ("target {share} · what is left" for the savings bucket, "at least {share}" for a floor, "at least {share} · deposits" for the goals bucket); a gauge, an own element with the target mark at two thirds of the track, filled by the real amount up to one and a half targets, hatched in the danger tone when the target is missed; the status in words ("{amount} left", "{amount} over" for a ceiling; "{amount} saved", "{amount} short" for the savings; "{amount} reached", "{amount} to go" for a floor) over "{real} · {share} of income"; and a strip of six squares, one per month of the history, kept, missed or without income, the name of the month on screen in the text colour, each named for a screen reader. A line states the spending outside the split when above zero; a legend names the squares and the mark. Nothing draws without a method. The `outside_spent` of the plan stays in the API for the assistant.
- **Budgets of Track.** Under the income split, one surface `Section` "Budgets" holds the month over every budget as one strip of four figures (spent, left or over, committed, overspent), each with its note, then one `Table` edge to edge: a group row per top category with "{spent} of {room}", then one line per budget with its name, a bar and its share, "{spent} of {planned}", its status in words with the Overspent or Near tag, and its actions. An `Accordion` closed by default follows: "Spending without a budget · {total}" holds the list of the categories no budget covers; "Where the spending went" holds the chart.
- **Categories screen.** The header action **Income split** opens the same dialog. With a method, the category tree gains the column **Bucket** after the name: the bucket of the category itself, the parent's bucket in the muted tone with "(from the parent)", or "Outside the split"; an income category shows none. The category form gains the field **Bucket** for an expense category: the buckets plus "Same as the parent category" for a subcategory or "Outside the split" for a top-level one. The category saves first; its bucket then saves through `PUT /budget-buckets` with the method read from `GET /budget-buckets`, and a failure of that second write is a toast that names it, since the category already stands.
- **Dialog safeguards.** **Remove split** shows an alert that states what it erases, with **Remove split** and **Keep split**; nothing is written before the second choice. The categories part counts the top-level categories left outside the split ("3 categories outside the split").
- Figures through `useMoneyFormat()` and `formatBasisPoints`; under privacy mode the amounts are masked and the shares stay visible (ADR 018).

## 6. Cross-cutting questions

- R1: Does not apply: no value varies by country. The preset names are catalog texts.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: Every text of sections 3 (A232) and 5 has a catalog key with pt-BR and en text, listed in the plan. pt-BR names the bucket "pote".
- R6: Amounts through `useMoneyFormat()`; shares through `formatBasisPoints`; the month through `Intl` of the active tag.
- C1: `target`, `planned`, `spent` and the outside sums are integers of minor units of the base currency; shares are integer basis points.
- C2: Every sum holds the base currency. Savings occurrences in another currency are valued at today's prices as `savings` (A72), and the plan's `prices` names them.
- C3: Budgets are in the base currency only (A54); postings of categories are accrual totals in the base currency, as `last_month` reads them.
- C4: The currency comes from the plan's `currency`, which comes from settings.
- T1: M is a calendar month of the book; "today" comes from `platform/clock`, as in A129.
- T2: Does not apply: no business days and no due date.
- B1: Both tables hold `books_id`; every query filters by it; schema tests reject a row without a book, a second savings bucket, a duplicate name and a category of another book.
- B2: `saveBudgetBuckets` needs `write`; HTTP tests cover `owner`, `write`, `read` (403) and no membership.
- B3: The method is a book setting, stored in the book's tables.
- D1: Both tables are facts; archive version 17.
- D2: Migration `00101_planning_bucket.sql`.
- D3: Does not apply: no recorded fact changes; a method is configuration.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: `getBudgetBuckets` gets the entry `get_budgets_and_goals` and `saveBudgetBuckets` the entry `manage_budget_or_goal` in `internal/server/tool_exposure_test.go`. No new `Problem.code`.
- S2: Does not apply: Planning is desktop-only (ADR 027, S3).
- S3: The guide article `budgets.md` gains one paragraph on the income split.
- S4: The assistant reads the buckets through `get_budgets_and_goals` kind `plan` and writes them through `manage_budget_or_goal` action `save_buckets`.
- X1: S438 to S447, section 7.
- X2: Does not apply: R1, R2, C2 and C3 add no regional value; C2's conversion is the one A72 already tests.

## 7. Scenarios

- S438. A book saves a method of three buckets 5000, 3000, 2000 with categories; the plan of the month lists them in order with `share_bp` and `category_ids`.
- S439. Shares summing to 9999, a duplicate name ignoring case, two buckets taking savings, a category in two buckets, an income category or a category of another book: each is a 422 on its field, and nothing is stored.
- S440. With reference 1000.01 and shares 3333, 3333, 3334, the floors are 333.30, 333.30 and 333.40, and the unit left goes to the largest remainder: targets 333.30, 333.30 and 333.41 (sum 1000.01).
- S441. A budget on a root category in bucket A, a subcategory placed in bucket B: the budget's planned amount counts in A; the subcategory's spending of M counts in B; a category outside any bucket counts in the outside sums.
- S442. The bucket that takes savings has `planned` including `savings`, `spent` including the realized savings of M, and the plan's savings target equals its share.
- S443. Saving an empty list removes the method: the plan has no `buckets`, and the savings target is the stored one again.
- S444. With a stored savings target of 1000 and a savings bucket of 2500, a plan save that carries 2500 keeps 1000; removing the split returns the target to 1000.
- S445. `GET /budget-buckets` returns an empty list without a method and the method in order after a save; a reader can read it.
- S446. The history of 2026-11 lists 2026-06 to 2026-11; in October, with 5,000.00 received, 1,200.00 on a category of Needs, 300.00 on a subcategory placed in Fun and 100.00 outside, Needs holds 1,200.00, Fun 300.00, Freedom 3,400.00 and outside 100.00; a book without a method gets six months and no buckets.
- S447. In October, with 5,000.00 of salary and a 9.00 yield received, 1,000.00 on Needs, 300.00 on a category of Learn (`at_least`) and 800.00 moved from checking into the account of a goal, the goals bucket holds 800.00 and Freedom 2,909.00; the yield into the goal account is not a deposit.
