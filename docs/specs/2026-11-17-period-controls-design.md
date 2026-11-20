# Period and month controls

`PeriodControl` and `MonthControl` (`web/src/ui/navigation`) step a period with two arrows around its label. Today the label takes the width of its text, so the arrows move at each step; no part of the control states whether the period on screen holds today; and the return to the current month takes the popover and one of its choices.

The approved mock is the contract of the form: `docs/specs/assets/2026-11-17-period-controls-mock/` (owner, 2026-11-17, concept B, no change). `design.css` moves to `steady-label.module.css` and `period-label.module.css` without edits.

## 1. Scope

- Both controls keep their props, their popovers and their steps. No operation is added.
- Out of scope: the statement step of a card (`statement-step.tsx`), the popover contents, a glyph in the trigger (`period-triggers.test.tsx`).

## 2. Decisions

| ID | Decision |
|---|---|
| PC1 | Order of the jobs, confirmed by the owner on 2026-11-17: step month by month with the arrows in place, read the period and whether it is the current one, return to the current month in one action, jump to a distant month, presets and free range. |
| PC2 | The label keeps the width of the widest text a step reaches. A month reserves the twelve month titles of its year. A quarter or a run of days reserves, for each of the twelve months, the label of a run from day 28 to day 28 of that month, in the years of its two ends. A year and "all" reserve nothing. Digits are tabular. |
| PC3 | A mark, a 6 px accent dot before the label, is visible when the period holds today (`from <= today <= to`; for `MonthControl`, the month of today). The mark and the text form one group, centred in the trigger; without the mark, the text alone is centred (owner, 2026-11-20: a mark out of the flow left the group off centre; 2026-11-17: the reserved box of a hidden mark pushed the text off centre). The label reserves the widest text plus the mark and its gap, so the trigger keeps one width with or without the mark. The trigger's accessible name then ends with the words "current period". |
| PC4 | A button "Today" follows the group. `PeriodControl`: it sets the month of today and is disabled when the period holds today. `MonthControl`: it sets the month of today, is disabled on that month, and is not drawn when `max` is before the month of today. |
| PC5 | A run of days with an end outside the year of today writes its years with two digits ("28/12/25 – 26/01/26"). With four digits the control measures 398 px and breaks the action row of a 390 px phone (376 px of content). Amends the label rule of `periodLabel`. |
| PC6 | Own element: the steady label and the mark. Families read: `button` (its label takes the width of its text and holds no reserved width). |

## 3. Derivation

- `period-presets.ts`: `periodWidest(from, to, today, locale)` and `monthTitles(year, locale)` (PC2); `holdsToday(from, to, today)` (PC3); `periodLabel` (PC5).
- `i18n/format.ts`: `formatDateShortYear(iso, locale)`, `Intl` with a two-digit year.

## 4. Cross-cutting questions

- R1: Does not apply: no regional value; month names and date order come from `Intl`.
- R2: Does not apply: no region-dependent behavior.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: `period.today` ("Today" / "Hoje"), `period.current` ("{label}, current period" / "{label}, período atual").
- R6: Month titles, day and month, and dates with a two-digit year, each through `Intl` with the active tag.
- C1: Does not apply: no amount.
- C2: Does not apply: no amount.
- C3: Does not apply: no amount.
- C4: Does not apply: no amount.
- T1: Today comes from `useToday()`, the calendar date the application already uses.
- T2: Does not apply: no business day.
- B1: Does not apply: no table.
- B2: Does not apply: no operation.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: no external data.
- D5: Does not apply: no diagnostic field.
- S1: Does not apply: no operation.
- S2: `PeriodControl` is on the phone routes `/transactions` and `/accounts/$id`; the mock draws it at 390 px. `MonthControl` is on no phone route.
- S3: The articles `transactions_and_postings.md`, `reports.md` and `budgets.md` state the Today button.
- S4: Does not apply: no data for the assistant.

## 5. Tests

- `period-presets.test.ts`: `periodWidest` by kind, `holdsToday` at both ends, the two-digit years of PC5.
- `month-control.test.tsx` and `period-control.test.tsx`: the reserved texts on the label, the Today button (sets, disabled, absent past `max`), the accessible name of PC3.
- `shoot.mjs --label built` and `compare.mjs` against the mock at 1440 px and 390 px.
