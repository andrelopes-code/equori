# Page spacing

Owner request of 2026-11-17: the distance between the blocks of a page differs from screen to screen (`--slotted-space-4` on `/categories`, `--slotted-space-8` on `/portfolio`, `--slotted-space-4` on `/reports`). The owner approved `--slotted-space-6` between blocks and `--slotted-space-8` between titled sections. The app's root size is 14 px, so the steps draw 14 px and 21 px.

## Roles

A block is a direct child of the page's column: a card, a row of figures, a bar of controls, a notice, a table, a section.

| Role                                   | Token                       | From 600 px                  | Below 600 px                  |
| -------------------------------------- | --------------------------- | ---------------------------- | ----------------------------- |
| Between two blocks                     | `--equori-page-block-gap`   | `--slotted-space-6` (1rem)   | `--slotted-space-5` (0.75rem) |
| Above a titled section with no surface | `--equori-page-section-gap` | `--slotted-space-8` (1.5rem) | `--slotted-space-6` (1rem)    |

A section with `ground="surface"` is drawn as a panel with an edge, like a card, so it takes the block gap. A section with no surface is separated by space and its label alone, so it takes the section gap.

## Rules

- PS1. `web/src/app/app.css` declares the two tokens. No other file sets their values.
- PS2. `PageStack` (`web/src/ui/page-layout/page-stack.tsx`) is the column of a page's blocks. It spaces its children by the block gap and puts the section gap above a section with no surface that follows another block.
- PS3. The blocks of a `PageBody` stand in a `PageStack`. A `Stack` as a direct child of `PageBody` is an ESLint error (`no-restricted-syntax`), rule O19 of `docs/contributing/web.md`.
- PS4. A grid of peer blocks (`FigureGrid`, a `Grid` of cards on a page) takes the block gap.
- PS5. A page whose column is not a list of blocks keeps its own layout and reads the tokens where it stacks blocks: a form (the form tokens of the theme), a session panel, a split of navigation and article, a workspace that fills the view.

## Out of scope

- The space inside a block (web.md, "Inner space").
- The space inside a form (`--slotted-form-field-gap`, `--slotted-form-section-gap`).
- A token in Slotted: the `page` family publishes no gap between blocks; the finding is reported in `andrelopes-code/slotted` and the tokens stay in the app until the library holds them.

## Cross-cutting questions

- R1. Does not apply: the change holds no regional value.
- R2. Does not apply: no regional behavior.
- R3. Does not apply: no value set.
- R4. Does not apply: no extension point.
- R5. Does not apply: no text is added.
- R6. Does not apply: no number or date is written.
- C1. Does not apply: no amount.
- C2. Does not apply: no amount.
- C3. Does not apply: no amount.
- C4. Does not apply: no currency is displayed by the change.
- T1. Does not apply: no date.
- T2. Does not apply: no calendar.
- B1. Does not apply: no table.
- B2. Does not apply: no operation.
- B3. Does not apply: no setting.
- D1. Does not apply: no table.
- D2. Does not apply: no schema change.
- D3. Does not apply: no fact changes.
- D4. Does not apply: no data is written.
- D5. Does not apply: no diagnostic field.
- S1. Does not apply: no operation.
- S2. The tokens step down below 600 px (table above); every migrated page is a phone screen already.
- S3. Does not apply: the change alters distances, not what a user can do.
- S4. Does not apply: no data.
- X1. Does not apply: no scenario. The check of PS3 is the ESLint rule; `page-stack.test.tsx` covers PS2's contract (the element and its children).
- X2. Does not apply: R1, R2, C2 and C3 do not apply.
