# Income split dialog

Amends section 5 of `docs/specs/2026-11-15-income-buckets-design.md` (the dialog) and the field Valid from of A240 (`docs/specs/2026-11-17-income-split-versions-design.md`). No rule of the split changes: only the dialog that edits it.

The approved mock is the contract of the layout: `docs/superpowers/mocks/2026-11-17-income-split-dialog-design-mock/` (local, `design.html`, `design.css`, `mock.json`, `shots/approved-*.png`), approved by the owner on 2026-11-17.

## 1. Problem

Measured on the dialog of 2026-11-17 with six buckets and 64 expense categories:

| # | Defect | Effect |
|---|---|---|
| 1 | The checklist lists every category for the chosen bucket: 64 rows, 2 980 px of content. | The bucket of a category is found by scrolling, one bucket at a time. |
| 2 | Moving a category takes two steps: choose the bucket, then find the row. | The owner named this component as the main defect. |
| 3 | The name and the share of a bucket appear twice: in its row and in the bucket chooser. | Two places state one value. |
| 4 | The three fields of a bucket have no label and the share has no unit. | A row does not say what each field is. |
| 5 | Start from is a full-width select above the buckets. | An action that replaces the buckets has the weight of a field. |
| 6 | The categories stand in a framed pane inside the dialog panel. | A surface inside a surface. |

## 2. Questions the dialog answers

The owner confirmed this order on 2026-11-17.

1. How much of the income goes to each bucket, and do the shares sum to 100%?
2. Which bucket does each category draw from, and is any category in no bucket?
3. From which month does the change apply?

## 3. Rules

### A249 Buckets block

- A bar states the split: one segment per bucket, in order, its width proportional to the share. While the shares sum to less than 100%, the missing share is a hatched segment at the end.
- A bucket holds a number, its position in the split, and a colour of the data palette (`--slotted-data-1` to `8`), repeated after eight buckets. The number identifies the bucket in its row, in the bar order and in the matrix; the colour never stands alone.
- The sum is written beside the title: "100% distributed", or the sum with the missing or the exceeding share, in the danger tone. A share that is not a number is stated in words.
- The buckets are rows of a table with headed columns: bucket, share (the unit inside the field), how the target counts, the number of categories that draw from it, remove.
- The measures keep their meaning (A234) and take short labels: spending ceiling, minimum to use, month's savings, goal deposits.
- Add bucket stands below the rows, disabled at ten buckets, with the limit written beside it.
- Use a model is a menu beside the title. It applies a preset of A232 as the select did.

### A250 Categories matrix

- One row per top-level expense category of `expenseBranches`, one column per bucket and a last column "Without a bucket", separated by a rule.
- A row is a radio group. The mark of the chosen column is the number of the bucket on its colour. An empty cell is a dot; under the pointer it previews the bucket.
- A click on a column of a top-level row gives the category that bucket, or leaves it outside the split.
- A category with subcategories opens and closes by a click on its name or on the mark beside it. A subcategory row holds a column per bucket. A subcategory that follows its parent draws the outline of the parent's bucket; a click on another column gives it its own bucket; a click on the parent's column returns it to following the parent (`toggleChoice`).
- A closed or open top-level row writes `+N` in each other column that holds N of its subcategories.
- The status beside the title states the top-level categories in no bucket, in the danger tone, or that every category has a bucket.
- With more than six buckets, or in a dialog narrower than 42rem, a column shows the number of the bucket without its name.
- A legend below the matrix names the three marks.

### A251 Valid from and End split

- Valid from (A240) is a select in the footer, beside Save split. The text after it states the end of the period: "on", "to {month}", "every month", "every month up to {month}". Below 50rem of dialog width the text is not drawn.
- End split is a ghost button in the danger tone at the end of the body. Its confirmation is unchanged.

### A252 Book without buckets

While the draft holds no bucket, the body shows the three presets of A232 as choices, each with its bar and its bucket names. A choice applies the preset. The footer holds no Valid from until the book has a version.

### A253 Width

The dialog sets `--slotted-dialog-measure-xl` to 62rem: six bucket columns of 6rem stand beside the category names.

## 4. Client derivations

| Value | Rule | Test |
|---|---|---|
| Bar segments | `share_bp` of each bucket; rest is `10000 - sum` when positive | `split-bar.test.ts` |
| Sum state | whole, missing with the difference, over with the difference, invalid | `split-bar.test.ts` |
| Matrix rows | effective bucket of each category, whether it follows its parent, subcategories per other column | `category-matrix.test.ts` |
| Choice after a click | `pickChoice` over `toggleChoice` and `effectiveChoice` | `category-matrix.test.ts` |

## 5. Cross-cutting questions

- R1. Does not apply: no value varies by country.
- R2. Does not apply: no regional behavior.
- R3. Does not apply: no value set.
- R4. Does not apply: no extension point.
- R5. New catalog keys in `catalog-budget-plan.en.ts` and `.pt-BR.ts`: the sum texts, the column headings, the model menu, the limit, the presets block, the matrix labels, the status and the legend. The four measure labels and the four period texts change in both languages.
- R6. A share and the sum are written by `useShareText` through `numberFormatter` of the active tag; a month by `useMonthNames`.
- C1. Does not apply: the dialog stores and computes no amount.
- C2. Does not apply: no sum of amounts.
- C3. Does not apply: no amount.
- C4. Does not apply: no amount on screen.
- T1. The months of Valid from come from `useToday` and the versions, unchanged.
- T2. Does not apply: no business day.
- B1. Does not apply: no table.
- B2. Does not apply: no operation.
- B3. Does not apply: no setting.
- D1. Does not apply: no table.
- D2. Does not apply: no schema change.
- D3. Does not apply: the save of a version is unchanged.
- D4. Does not apply: no bank, file or model data.
- D5. Does not apply: no diagnostic field.
- S1. Does not apply: no operation.
- S2. No: planning is desktop-only (ADR 027, S3 and S7). The dialog is designed at 1440 px and at 640 px, the narrowest width the route serves.
- S3. Yes: `internal/assistant/guide/articles/income_split.md` describes the new dialog in the same commit as the screen.
- S4. No: the tools of the split are unchanged.
- X1. None: no rule of the domain changes.
- X2. Does not apply.

## 6. Tests

- `bucket-split.test.tsx`: the sum text replaces the total line (A249); the dialog opened from "Place them" states the categories without a bucket in the status (A250), since the checklist hint leaves with the checklist.
- `categories-split.test.tsx`: the dialog states one category without a bucket in the status; a subcategory that follows its parent is a checked radio of the parent's bucket; a click on a bucket column moves a category (A250).
- New: a click on a matrix column sends the category in that bucket; a preset chosen in a book without buckets fills the draft (A252).
