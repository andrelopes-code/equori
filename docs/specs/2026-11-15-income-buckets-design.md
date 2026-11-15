# Income buckets: splitting the reference income by method

- Status: proposed
- Date: 2026-11-15
- Phase: P7 Planning, amendments A229 to A232, scenarios S438 to S443

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
| `spent` | Sum of the accrual totals in M of the expense categories, own postings only, that resolve to the bucket; plus the realized savings occurrences of M, valued as `savings`, for the bucket that takes savings. |

The plan also carries `outside_planned` and `outside_spent`: the same sums over the categories outside the method. A budget on a category covers its subtree (A129), so its `planned` counts in the bucket of the budget's category, while the `spent` of each subcategory counts in the bucket its own category resolves to.

### A231 Savings target under a method

When a bucket takes savings, the plan's savings target (A188) is that bucket's share. The stored `savings_target_bp` is kept and applies again once no bucket takes savings.

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

`getBudgetPlan` keeps its tool, `get_budgets_and_goals` kind `plan`, which now lists the buckets. `saveBudgetBuckets` is covered by `manage_budget_or_goal` through a new action `save_buckets`, previewed like `save_plan`.

## 5. The Plan view

- **Buckets section**, a `Section` "Income split" between the reference panel and the plan table. With a method, its body is a framed `Table` with the caption "Income split", one row per bucket in method order and a last row "Outside the split" when its planned or spent amount is above zero. Columns: Bucket, Share, Target, Planned, Spent in {month}, and Status. Every amount ends on one vertical line. Status is one line of words: "{amount} left" when planned and spent are at most the target, "{amount} over" in the danger tone otherwise, using the larger of planned and spent; a dash without a target. The savings bucket carries the word "with savings" after its name, in the muted tone.
- **Without a method**, the same place holds one line, "Split the income into buckets: 50/30/20, six buckets or your own.", and the button **Set up split**.
- **Section action**: the button **Edit split**, or **Set up split** without a method, opens the dialog. It shows in past months too, since the method is not per month.
- **Allocation bar**: with a method, its segments are the buckets by planned amount, not the root categories; the unassigned rest stays as today.
- **Plan table**: with a method, rows are grouped by bucket in method order, then "Outside the split". A group row shows the sums of its counted rows, as a root group does; the buckets section carries the targets. A line shows its full category path, since a bucket mixes roots. Without a method, the root-category grouping stays.
- **Savings target**: with a bucket that takes savings, the savings target field is read-only and its description reads "Set by the {bucket} bucket." (A231).
- **Dialog "Income split"**, three parts in one scrolling body:
  1. Starting point: a select of the three presets of A232; it is applied only on choice.
  2. Buckets: one row per bucket with name, percentage with one decimal, the radio "takes savings" and a remove button; the button **Add bucket** stops at 10. Under the rows, the total in percent; when it differs from 100 %, the line "The shares sum to {total}; they must sum to 100 %." in the danger tone, and **Save** is disabled.
  3. Categories: the root expense categories in tree order, each with a select of the buckets plus "Outside the split". A root with subcategories has a disclosure that lists them, each with the same options plus "Same as {root}", the default.
  - **Save** writes the method; **Remove split** (shown when a method exists) saves an empty list; the toast reports the removal.
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
- S1: `saveBudgetBuckets` gets the entry `manage_budget_or_goal` in `internal/server/tool_exposure_test.go`. No new `Problem.code`.
- S2: Does not apply: Planning is desktop-only (ADR 027, S3).
- S3: The guide article `budgets.md` gains one paragraph on the income split.
- S4: The assistant reads the buckets through `get_budgets_and_goals` kind `plan` and writes them through `manage_budget_or_goal` action `save_buckets`.
- X1: S438 to S443, section 7.
- X2: Does not apply: R1, R2, C2 and C3 add no regional value; C2's conversion is the one A72 already tests.

## 7. Scenarios

- S438. A book saves a method of three buckets 5000, 3000, 2000 with categories; the plan of the month lists them in order with `share_bp` and `category_ids`.
- S439. Shares summing to 9999, a duplicate name ignoring case, two buckets taking savings, a category in two buckets, an income category or a category of another book: each is a 422 on its field, and nothing is stored.
- S440. With reference 1000.01 and shares 3333, 3333, 3334, the floors are 333.30, 333.30 and 333.40, and the unit left goes to the largest remainder: targets 333.30, 333.30 and 333.41 (sum 1000.01).
- S441. A budget on a root category in bucket A, a subcategory placed in bucket B: the budget's planned amount counts in A; the subcategory's spending of M counts in B; a category outside any bucket counts in the outside sums.
- S442. The bucket that takes savings has `planned` including `savings`, `spent` including the realized savings of M, and the plan's savings target equals its share.
- S443. Saving an empty list removes the method: the plan has no `buckets`, and the savings target is the stored one again.
