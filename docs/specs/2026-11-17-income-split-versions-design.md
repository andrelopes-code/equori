# Versions of the income split

Amends `docs/specs/2026-11-15-income-buckets-design.md` (A229, A230, A231, A233). Section 9 states how `docs/specs/2026-11-16-income-buckets-hardening-design.md` (A235 to A237), not implemented at the date of this spec, reads this one.

## 1. Problem

A229 keeps one bucket method per book and applies it to every month. A save deletes every bucket row and inserts the new ones. The code and the specs show seven defects of one class: a rule that changes over time is stored without the month it starts in.

| # | Defect | Effect |
|---|---|---|
| 1 | The shares have no start month. | A share changed in November restates the target and the verdict of October. |
| 2 | The categories of a bucket have no start month. | A category moved to another bucket moves its spending of every past month. |
| 3 | Removing the method deletes every row. | The history of every past month disappears. |
| 4 | A save issues new bucket ids. | No reader can follow one bucket across two saves (A239 records the limit). |
| 5 | The categories screen saves the method without a month. | A move made today restates every past month without a statement of it. |
| 6 | The Track view states a real amount per bucket and no list of what composes it. | A figure cannot be checked against its transactions. |
| 7 | No screen states when the method changed or what changed. | A change of the verdict of a month has no visible cause. |

## 2. Goals

- G1. A month keeps the method that was in force in it. A change of the method starts in a month the owner names and leaves the earlier months as they are.
- G2. The categories of each bucket belong to the version, so a category sits in one bucket in one period and in another bucket in the next.
- G3. No write changes a closed month unless its request names that month.
- G4. The Track view lists the entries that sum to the real amount of a bucket of a month.
- G5. One screen lists the versions of the method and what changed between two consecutive versions.

Non-goals:

- A bucket per transaction (hardening spec, non-goal). A subcategory in its own bucket serves it.
- Versions of the category tree, of the kind of an account, of the accounts of a goal and of `counts_as_savings` (section 7).
- The phone. Planning is desktop-only (ADR 027).

## 3. Rules

### A240 Versions of the method

A book holds versions of its bucket method. A version holds `from`, the first day of a month, and zero to ten buckets checked by A229. A book holds at most one version per `from`.

- **Method of a month.** The method of a month M is the version with the greatest `from` at or before M. Without one, it is the version with the smallest `from`: the first version also covers every month before it. A version without buckets means M has no split.
- **Save.** A save names `from`; without it, `from` is the current month of `platform/clock`. `from` is at most today + 12 months. The save replaces the version of that `from`, or adds it. Every other version stays. This follows A130, which stores a budget amount from a month on.
- **Delete.** Deleting the version of a `from` leaves its months to the version before it, or to the next one when it was the first.
- **Normal form.** After a save or a delete, a version without buckets that has no version before it is deleted, until the first version holds buckets or no version is left. A save without buckets on a book without versions stores nothing.
- **Readers.** The plan of M (A230), the savings target (A231), the history (A233), `keepBucketTarget` of a plan save of M and every tool read the method of M. `getBudgetBuckets` reads the method of its `month`, by default the current month.
- **Implicit writes.** The categories screen saves with `from` equal to the current month: the method of the current month, changed by the move of one category, becomes the version of the current month.

The first version covers the months before it because a book that sets up the split in one month reads its earlier months through that same split from the first day, as A233 did. An owner who used another rule before states it by saving a version with an earlier `from`.

### A241 Identity of a bucket

A bucket holds an `id` that stays across versions and across saves.

- A bucket of a save may carry `id`. It continues the bucket with that `id` of any version of the book.
- A bucket without `id` is a new bucket and receives a new `id`.
- An `id` that no version of the book holds, or that two buckets of the save share, is rejected with the validation problem on `buckets[i].id`.
- The name, the share, the measure and the categories of a bucket belong to the version. Two versions may give one `id` different values of each.

### A242 History across versions

The history of M (A233) reads each month of its window through the method of that month.

- The history holds `methods`: the versions that are the method of at least one month of the window, by `from` ascending. The field `buckets` of A233 is removed.
- Each month holds `from`, the `from` of its method, absent when the month has no split, and `buckets`, the real amount of each bucket of its method in method order.
- `outside` and the target of a bucket of a month use the method of that month.
- A month without a split holds no bucket; its `outside` is the whole spending of the month.

### A243 Entries of a bucket

`getBudgetBucketEntries` returns, for a month M and a bucket of the method of M, the entries that sum to the real amount of that bucket in M (A233). Without `bucket`, it returns the entries of `outside`.

| Kind | One entry per | Amount | Date |
|---|---|---|---|
| `expense` | Non-voided own posting of an expense category that resolves to the bucket, booked in M. | The posting weight, in the base currency. | The booked date. |
| `savings` | Transaction of M counted by A233 for the bucket that takes savings, with a non-zero amount. | The amount A233 counts: its postings in the source accounts, negated. | The transaction date. |
| `goals` | Transaction of M counted by A234 for the bucket that takes goals, with a non-zero amount. | As `savings`, over the goal set. | The transaction date. |

- Each entry holds `transaction_id`, `date`, `description`, `amount` and `kind`. An `expense` entry also holds `category_id` and, when the transaction has one, `payee`.
- The entries come by date descending, then by `transaction_id` descending. The list has no pages: one month bounds it, and `total` is the sum of the whole list.
- `total` equals the real amount of the bucket in the history of M, or `outside` of M.
- A `bucket` that the method of M does not hold returns the `not_found` problem.

## 4. Data and API

- **Migration 00111.** Table `planning_bucket_method` (`books_id`, `effective_from`), primary key on both, `effective_from` on the first day of a month. `planning_bucket` and `planning_bucket_category` gain `effective_from` and reference the version; `planning_bucket` gains `lineage_id`, the `id` of A241. Every uniqueness of A229 (position, name, the savings bucket, the goals bucket, a category in one bucket) becomes a uniqueness per version. A book with buckets receives one version whose `effective_from` is the month, in UTC, of the UUIDv7 timestamp of its earliest bucket row; each row keeps its id as `lineage_id`. Down keeps the version with the greatest `effective_from` of each book.
- **Archive.** `planning_bucket_method` is a fact. `ArchiveVersion` becomes 24 with the step `addBucketVersions`, which writes the same version into a version 23 archive: `effective_from` from the UUIDv7 timestamp of the smallest bucket id, or `1970-01-01` when that id is not a UUIDv7.
- **Operations.**
  - `saveBudgetBuckets` (`PUT /budget-buckets`, `write`): `BudgetBucketsInput` adds `from` (`YYYY-MM`, optional); `BudgetBucketInput` adds `id` (optional).
  - `getBudgetBuckets` (`GET /budget-buckets`, `read`): adds the query `month` (optional); `BudgetBuckets` adds `from` (absent without a split).
  - `getBudgetBucketVersions` (`GET /budget-buckets/versions`, `read`): `BudgetBucketVersions` with `versions`, each `from` and `buckets`, by `from` ascending.
  - `deleteBudgetBucketVersion` (`DELETE /budget-buckets/versions/{from}`, `write`): 204; `not_found` without that version.
  - `getBudgetBucketHistory`: `BudgetBucketHistory` replaces `buckets` by `methods`; `BudgetBucketMonth` adds `from` (optional).
  - `getBudgetBucketEntries` (`GET /budget-buckets/entries?month=YYYY-MM&bucket=<id>`, `read`): `BudgetBucketEntries` with `currency`, `total` and `entries` (A243).
- **Ledger.** `ledger.OwnCategoryPostings` returns the non-voided own postings of the categories of a class booked in a period, each with its transaction id, category, booked date, weight, description and payee name.
- **Tools.** `manage_budget_or_goal`: `save_buckets` reads the start of the version from its input `month`, the current month when absent, and continues the bucket of the method of that month that holds the same name, ignoring case; the tool catalog has no room for two new inputs. `get_budgets_and_goals`: kind `split` reads each month through its method, adds `from` to each month and returns the list `versions` (`from` and each bucket's name and share); kind `plan` adds `buckets_from`.

## 5. Web

All texts have a catalog key with pt-BR and en text (R5). Amounts go through `useMoneyFormat()`; months and dates through `Intl` of the active tag (R6).

- **Edit dialog.** With a method stored, the dialog holds the field **Valid from** with up to three choices, without repeats: the start of the version in force in the month on screen ("From the start" for the first version), the month on screen, and the current month. The month on screen is the default; the categories screen uses the current month. One line under the field states the period: "Valid from {month} on." or "Valid from {month} to {month}." **Remove split** becomes **End split**: it saves a version without buckets from the chosen month, and its confirmation states that the earlier months keep their split.
- **Versions dialog.** The button **History** in the header of the split section of Plan and of Track opens a dialog that lists the versions, the latest first. Each version states its start, the share of each bucket, and its changes against the version before: a share that changed ("Fixed costs 50% → 55%"), a category that moved ("Streaming: Comfort → Fixed costs"), a bucket added, a bucket removed, the split ended. **Edit** opens the edit dialog on that version. **Delete** asks for confirmation and states which version its months return to.
- **Track.** The rows are the buckets of the method of the month on screen. A cell of the strip of a month in which the bucket did not exist is blank and says so. A month in which a version starts carries a mark and the text "The split changed in {month}."; the section states "Split in force since {month}." Each row is a button that opens the entries of its bucket; the line of the spending outside the split holds the button **See entries**.
- **Entries drawer.** A drawer on the inline end holds the name of the bucket and the month, the real amount, the target and the difference in words, a month choice over the months of the window in which the bucket exists, and the entries grouped by category with the subtotal of each group, the largest first. The entries of kind `savings` and `goals` form one group each. An entry states its date, its payee or description and its amount, and links to its transaction. Without entries, the drawer says that nothing counted in the month.

## 6. Cross-cutting questions

- R1: Does not apply: no value varies by country.
- R2: Does not apply: the feature has no regional value.
- R3: Does not apply: `kind` of an entry (`expense`, `savings`, `goals`) names the three sources of A233 and A234 and does not grow with regions.
- R4: Does not apply: no extension point.
- R5: The keys of section 5, listed in the plan with pt-BR and en text.
- R6: Amounts through `useMoneyFormat()`; shares through `formatBasisPoints`; months and dates through `Intl` of the active tag.
- C1: The amount of an entry and `total` are integers of minor units in the base currency.
- C2: Every sum holds the base currency: a posting weight is in the base currency, and A233 counts only source accounts in the base currency.
- C3: An account in another instrument is not a source (A233); an expense posting in another currency counts by its weight, as the totals of A230 do.
- C4: The currency comes from `currency` of the response, which comes from settings.
- T1: `from` and M are calendar months of the book; the default `from` comes from `platform/clock`.
- T2: Does not apply: no business day and no due date.
- B1: `planning_bucket_method` holds `books_id`; every query filters by it; a schema test rejects a version without a book.
- B2: `getBudgetBucketVersions` and `getBudgetBucketEntries` need `read`; `deleteBudgetBucketVersion` needs `write`. An HTTP test covers each role and an access without membership.
- B3: Does not apply: a version is data of the book, not a setting.
- D1: `planning_bucket_method` is a fact; archive version 24 (`addBucketVersions`).
- D2: Migration 00111.
- D3: Does not apply: a method is configuration. Its change is traceable from this change on: each version stays stored with its start month.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: Three operations are added. `getBudgetBucketVersions` is covered by `get_budgets_and_goals`; `deleteBudgetBucketVersion` and `getBudgetBucketEntries` are excluded: the assistant corrects a version through `save_buckets` with `from`, and reads the transactions of a category through the ledger tools. No new `Problem.code`.
- S2: Does not apply: Planning is desktop-only (ADR 027).
- S3: `internal/assistant/guide/articles/budgets.md` changes in the commits that change the screens.
- S4: The assistant reads the version of each month and the list of versions through `get_budgets_and_goals` and writes a version through `manage_budget_or_goal`.
- X1: S540 to S551.
- X2: Does not apply: R1, R2 add no regional value; the conversion of C3 is the posting weight that A72 already tests.

## 7. Audit of the same class

Each row is a value the split reads in its present state for every month.

| Value | Decision | Reason |
|---|---|---|
| Shares, measure and name of a bucket | Versioned (A240). | Defect 1. |
| Categories of a bucket | Versioned (A240). | Defect 2. |
| End of the split | A version without buckets (A240). | Defect 3. |
| Bucket id | Stable (A241). | Defect 4. |
| Writes without a month | Start in the current month (A240). | Defect 5. |
| Parent of a category | Not versioned. | The category tree has one state for every report of the application. A subcategory placed in a bucket by itself does not follow its parent. |
| Merge or deletion of a category | Not versioned. | The ledger moves the postings of every month to the target category; the split follows the ledger. |
| Kind of an account, accounts of a goal, `counts_as_savings` (A239) | Not versioned. | Each states what an account is, not a rule of a period; the ledger keeps no history of them. |
| Reference of the plan (source, fixed amount) | Not versioned. | The verdict of a closed month reads the income received (A233), not the reference. The plan of a past month is not saved (A130). |
| Savings target of the reference (A187) | Versioned through the bucket that takes savings (A231, A240). | The plan of M reads the share of the method of M. |

## 8. Scenarios

- S540. A book saves a method from 2026-09 and another from 2026-11 with other shares; the plan of 2026-10 holds the shares of the first and the plan of 2026-11 the shares of the second.
- S541. A book with one version from 2026-11 reads that version in 2026-06.
- S542. A save without `from` on 2026-11-17 stores the version of 2026-11; the version of 2026-09 stays.
- S543. A category sits in Needs from 2026-09 and in Fun from 2026-11; 100.00 spent on it in October counts in Needs in the history, and 40.00 spent in November counts in Fun.
- S544. A save without buckets from 2026-11 ends the split: the plan of 2026-11 holds no bucket and the plan of 2026-10 holds the buckets of 2026-09.
- S545. Deleting the version of 2026-11 returns 2026-11 to the version of 2026-09; deleting an absent version returns `not_found`.
- S546. Deleting the only version with buckets, with a version without buckets after it, leaves the book without versions.
- S547. A bucket saved with the `id` of a bucket of the earlier version keeps that `id`; a bucket without `id` receives a new one; an `id` unknown to the book returns the validation problem on `buckets[0].id`.
- S548. The history of 2026-11 over versions of 2026-09 and 2026-11 holds both in `methods`; each month holds the `from` of its method and the real amounts in the order of that method.
- S549. The entries of a bucket in October list each posting of its categories with date, description, payee and amount, the latest first, and `total` equals the real amount of the history; the entries without `bucket` sum to `outside`.
- S550. The entries of the bucket that takes savings list the 3,400.00 moved into the savings account as one entry of kind `savings`.
- S551. `getBudgetBucketVersions` and `getBudgetBucketEntries` answer a member with `read`; `deleteBudgetBucketVersion` rejects `read` and answers `write`; each rejects an access without membership. The entries of a bucket outside the method of the month return `not_found`.

## 9. Hardening spec

`docs/specs/2026-11-16-income-buckets-hardening-design.md` is implemented after this spec and reads it as follows.

- A235: `unallocated` of a month subtracts the goals and the savings amounts only when the method of that month holds the bucket that takes them.
- A236: the categories outside the method of the plan of M are the ones outside the method of M.
- A237: `move_category` reads the method of the current month and saves it with `from` equal to the current month (A240, implicit writes).
