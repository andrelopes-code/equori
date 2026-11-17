# Income buckets hardening: visible leftovers, visible gaps, one-category moves

Amends `docs/specs/2026-11-15-income-buckets-design.md` (A229 to A234). The method of a month is the version of A240 (`docs/specs/2026-11-17-income-split-versions-design.md`, section 9). Commit `bcf11e7b` changed A233 so that the bucket that takes savings counts transfers into savings accounts. This spec closes the gaps that change left open.

## 1. Intent

The data of one book (book 3, months 2026-06 to 2026-11) and the code show four gaps.

- **G1.** Income that is neither spent nor moved to a bucket counts nowhere. In 2026-11, 2,113 of 2,836 received sit in no figure.
- **G2.** An open expense category outside the method counts in `outside_spent` with no notice. `web/src` reads neither `outside_planned` nor `outside_spent` outside a test fixture. A category created under a root with no bucket is invisible.
- **G3.** The assistant moves one category by sending the whole method through `save_buckets`. A wrong list removes every bucket.
- **G4.** No test covers a brokerage account with sub-accounts or an account in a non-base instrument, both present in book 3 (`Nu Invest` with `Caixa`, `WRLD11`).

## 2. Goals, non-goals, anti-goals

Goals:

- The buckets, the spending outside the split and one new figure sum to the income received in every month.
- The Plan view and the assistant name each open expense category outside the method.
- The assistant moves one category between buckets in one call.
- Each rule of A233 for brokerage accounts has a test.

Non-goals:

- A bucket assignment per transaction. A subcategory placed in a bucket serves the same purpose at category granularity. The feature returns to the backlog when a book keeps more than three exceptions of one category in a month.
- A separate figure for withdrawals from goal accounts. A234 keeps counting them against the goals bucket.
- A change of share, target or kept rule of any bucket.

Anti-goals:

- Two figures that disagree on one screen.
- A category outside the method that no screen or tool names.
- A tool action that removes data on a partial input.

## 3. Domain amendments

### A235 Unallocated income

`unallocated(M) = received(M) - spent(M) - goals(M) - savings(M)`.

- `received(M)` and `spent(M)`: the sums of A233, `spent` over every expense category, own postings.
- `goals(M)`: the amount of A234, subtracted only when the method of M (A240) holds a bucket that takes goals.
- `savings(M)`: the amount of A233, subtracted only when the method of M holds a bucket that takes savings.
- A month without a split subtracts neither.
- The value is an integer of minor units of the base currency and can be negative.

The real amounts of the buckets, `outside(M)` and `unallocated(M)` sum to `received(M)`. A positive value is income that stayed in accounts outside the savings and goal accounts. A negative value is spending paid from balances: a goal withdrawal counts in `goals(M)` with its sign and does not enter `unallocated(M)` a second time.

Book 3, 2026-09: received 2,880, spent 4,249, goals -1,582, savings 0, so `unallocated` is 213.

The history of A233 carries `unallocated` in each month. The plan of a month does not: its figures are forward-looking.

### A236 Categories outside the method

A category is **outside** when it is an open expense category with no `system_role`, and neither it nor any ancestor sits in a bucket of the method of the plan's month (A240). The plan of M carries the list when M has a split: `outside_category_ids`, in category name order, empty when none is outside. A month without a split has no list.

The category with `system_role` `uncategorized_expense` is not listed. Its spending already shows in `outside_spent`. A closed category is not listed.

`save_buckets` previews the list that results from the call, as one row "Outside the split".

### A237 Moving one category

`manage_budget_or_goal` gains the action `move_category`, with inputs `category_id` and `bucket`.

- `bucket` is a bucket name of the method of the current month (A240), ignoring case, or the text `none`.
- A name places the category in that bucket and removes it from any other.
- `none` removes the placement. The category then follows its nearest ancestor in a bucket, or is outside.
- The action reads the method of the current month, applies the one change and saves through the service operation of `saveBudgetBuckets` with `from` equal to the current month (A240, implicit writes). Each bucket continues the bucket of the same name, as `save_buckets` does (A241). Every validation of A229 applies.
- An unknown bucket name is a 422 on `bucket`. A category that is not an expense category of the book is a 422 on `category_id`.
- The preview shows the bucket before and after for the category, and the count of categories outside the split after the change.
- A current month without a split makes the action a 422 on `bucket`: the action does not create a method.

### A238 Brokerage rules under test

A233 and A234 stay as written. The rule of the set of savings accounts applies to every account of kind `brokerage` that is not a goal account, at any depth below an institution account, in any instrument. The postings that count are the postings in base-currency asset and liability accounts outside the set.

## 4. Data and API

- **Schema.** No migration. No table changes. The archive version stays (D1, D2).
- **`api/openapi.yaml`.** The sources are `internal/planning/openapi.yaml`.
  - `BudgetBucketMonth` adds `unallocated: Money`, required.
  - `BudgetPlan` adds `outside_category_ids: array of ID`, present with `buckets`.
  - The contract validator rejects a `description` beside a `$ref` (error "extra sibling fields: [description]", verified on 2026-11-16). A property that is a `$ref` carries its description in the parent schema.
  - The description of `getBudgetBucketHistory` states the sum of A235.
- **Tools.** `get_budgets_and_goals` kind `split` adds `unallocated` to each month. Kind `plan` adds `outside_categories`, a list of `{ id, name }`. `manage_budget_or_goal` adds the action `move_category`. `internal/server/testdata/tools.json` is regenerated by the update path the plan finds. The tool catalog stays under its ceiling of 72,000 bytes (A247).
- **Code.**
  - `internal/planning/app/bucket_history.go`: `BucketMonth.Unallocated`, set in `bucketMonth` and reduced in `addInflows` only for a bucket that takes the amount.
  - `internal/planning/app/plan_types.go` and `buckets.go`: `Plan.OutsideCategories`.
  - `internal/planning/httpapi/buckets.go`: both fields in the views.
  - `internal/planning/toolapi/buckets.go`: both fields and the action.
- **Guide.** `internal/assistant/guide/articles/income_split.md` states the unallocated figure, the notice and the action.

## 5. Interface

Planning is desktop-only (A233 spec, section 6, S2).

- **Track.** After the line `track.outside`, one line in `Text size="sm" tone="muted"`, drawn when `unallocated` is not zero.
  - Positive: "{amount} stayed in the accounts in {month}, outside every bucket."
  - Negative: "{amount} was paid from balances in {month}, beyond the income received." The amount is the absolute value.
- **Plan.** Below the income split table, one line in the same style when `outside_category_ids` is not empty: "{count} categories are outside the split." The singular text names "1 category". The line carries one action, "Place them", that opens the split dialog of A229 with the outside categories listed first.
- Each text is one line. The wording is shortened by design when a translation does not fit. No icon marks the notices. The tone carries the risk.
- **Catalog keys,** pt-BR and en: `track.unallocated`, `track.unallocatedNegative`, `buckets.outsideOne`, `buckets.outsideMany`, `buckets.outsideAction`. pt-BR names the bucket "pote".
- The track model `trackMonth` returns `unallocated` per month. The component stays below 150 lines.

## 6. Cross-cutting questions

- R1: Does not apply: no value varies by country.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: no value set grows with regions.
- R4: Does not apply: no extension point.
- R5: The five keys of section 5 have pt-BR and en text, listed in the plan.
- R6: Amounts through `useMoneyFormat()`; the month through `Intl` of the active tag; counts as plain integers in the text.
- C1: `unallocated` is an integer of minor units of the base currency.
- C2: Every sum holds the base currency. Accounts in another instrument do not count as sources (A233), and their conversion is outside this feature.
- C3: A233 already sets the behavior for an account whose instrument is not the base: it is not a source.
- C4: The currency comes from the history's `currency`, which comes from settings.
- T1: M is a calendar month of the book; "today" comes from `platform/clock`.
- T2: Does not apply: no business days and no due date.
- B1: Does not apply: no table is added.
- B2: No operation is added to `api/openapi.yaml`. `move_category` reuses `saveBudgetBuckets`, which needs `write`. A tool test covers a token with the read scope: the action is absent from its tool list.
- B3: Does not apply: no setting is added.
- D1: Does not apply: no table is added; the archive version stays.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes; a method is configuration.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: `getBudgetBucketHistory` and `getBudgetPlan` keep their tool entries in `internal/server/tool_exposure_test.go`. `move_category` adds no operation. No new `Problem.code`; the 422 fields of A237 use the existing validation code.
- S2: Does not apply: Planning is desktop-only (ADR 027).
- S3: The guide article `income_split.md` (at most 6,000 bytes, A245) changes in the commit of each slice that changes what a screen shows or a tool does.
- S4: The assistant reads `unallocated` and `outside_categories` through `get_budgets_and_goals`, and moves a category through `manage_budget_or_goal`.
- X1: S530 to S536, section 8.
- X2: Does not apply: no regional value; the base currency rule is the one S448 and S446 already test.

## 7. Delivery

One session, four slices, one commit each, in this order. Each slice starts with the failing test of its scenarios.

1. **Unallocated income** (A235): app, API, tool, web, guide, S530 to S531.
2. **Outside categories** (A236): app, API, tool, web, guide, S532 to S533.
3. **Move one category** (A237): tool, guide, S534.
4. **Brokerage tests** (A238): tests only, S535 to S536.

Each commit cites A233 and its scenarios in the body. A slice ends with `make gen` clean, `go test ./internal/planning/... ./internal/server/... ./internal/assistant/...`, the web tests of `features/planning` and `i18n`, and the pre-commit hook.

The plan reads these files before it writes a task:

- `internal/planning/app/{bucket_history,buckets,plan_types,bucket_goals,bucket_savings}.go`
- `internal/planning/{httpapi,toolapi}/buckets.go` and `internal/planning/toolapi` tests of the plan tool
- `internal/planning/{buckets_test,bucket_tool_test}.go` for the fixture and the `bucketHistoryView` type
- `internal/server/{tool_exposure_test.go,testdata/tools.json}` for the regeneration path
- `web/src/features/planning/income-split/{bucket-track,plan-buckets,income-split-action,bucket-dialog,bucket-checklist}.tsx`, `bucket-history.ts`, the subfolders `versions/` and `entries/`, and their tests
- `web/src/i18n/catalog-budget-plan.{en,pt-BR}.ts`
- `internal/apitest` for the shape of a brokerage trade and a unit account

## 8. Scenarios

- S530. October: 5,000.00 received, 3,000.00 on Needs, 800.00 moved from checking into a savings account. `unallocated` is 1,200.00. November: nothing received, 200.00 withdrawn from the savings account into checking. `unallocated` is 200.00.
- S531. In every month of a history with a savings bucket, a goals bucket and spending outside the split, the real amounts, `outside` and `unallocated` sum to `received`. A month with a goal withdrawal of 1,582.00, 4,249.00 spent and 2,880.00 received has `unallocated` 213.00.
- S532. A new root expense category with no bucket appears in `outside_category_ids`. After a bucket takes it, the list no longer holds it. A subcategory of a placed root is not listed.
- S533. A closed category and the `uncategorized_expense` category are not listed. A month without a split has no `outside_category_ids`. A category placed from 2026-11 on is outside in the plan of 2026-10. A reader can read the field.
- S534. `move_category` places a category in the named bucket and removes it from the previous one. A subcategory placement overrides its root. `none` returns the category to its ancestor's bucket. An unknown bucket name and an income category are each a 422 and store nothing. A current month without a split gives a 422 on `bucket`. The move stores the version of the current month and leaves the earlier version as it was. A read token has no such action.
- S535. A deposit of 1,000.00 from checking into the `Caixa` sub-account of a brokerage institution counts 1,000.00 in the savings bucket. A withdrawal of 300.00 back to checking counts -300.00. A move between `Caixa` and the institution account counts 0.
- S536. A purchase of units of an instrument in a non-base unit account, paid from `Caixa`, counts 0. The same purchase paid from checking counts its cost in base currency.
- Web: the Track line is drawn for a positive and a negative value and is absent at zero. The Plan line is drawn for one and for several categories and is absent at zero. The action opens the dialog with the outside categories first.
