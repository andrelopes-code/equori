# Form standard

Goal: every form of `web/` follows `docs/contributing/forms.md` (F1 to F12). Slotted carries the general rules and the layout primitives (issues #19 to #22).

Evidence of the defects (screenshots at 1440 px, 2026-10-29): fields span 1120 px; a day-of-month select and a one-digit interval are 555 px wide; one form mixes control heights of 80, 60 and 34 px; unrelated fields are paired in two columns; choice sets carry no question; topics are separated by the same 1rem as fields.

## Slices

1. Standard and primitives
   1. `docs/contributing/forms.md`; Slotted issues #19 (guideline), #20 (field width), #21 (form column and aside), #22 (section gap token).
   2. `ui/form-layout.tsx`, `ui/form-section.tsx`, `ui/form-row.tsx`, `ui/field-width.module.css`, each a workaround citing its issue.
   3. `web/CLAUDE.md` points to the guide.
2. Transaction entry: `transaction-form`, `income-form`, `trade-form`, `exchange-form`, `foreign-form`, the new-transaction page and the correction page.
3. Planning: `schedule-form-page`, `recurrence-fields`, `budget-form-page`.
4. Categories and accounts: `rule-editor`, `account-form`, `new-account-screen`, `edit-account-screen`, `import-page`.
5. Card dialogs: pay, refund, dispute, installment purchase, finance, facts, credit limit, plan drawer.
6. Account, instrument, planning and goal dialogs: close, assertion, unlock, link drawer, sync start, record price, terms (2), occurrence, pause, end, goal.
7. Necessity: every `Field` the backend requires sets `required`; `FieldDefaultsProvider necessity="optional"` at the application root (F7). Runs last, so no required field reads "(optional)" in between.
8. Slotted: FM-18 to FM-24 in `tools/agent-docs/content/guidelines/forms.md` (`Fixes #19`).
9. Slotted: `Field width` (#20), `FormAside` (#21), `--slotted-form-section-gap` (#22), React and Angular, each with the test its Acceptance names.

Each form slice: screenshot before and after at 1440 px and 390 px, the feature's tests, lint, typecheck, one commit.
