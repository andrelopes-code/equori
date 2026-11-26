# Ending a budget from a month

Status: draft, 2026-11-26.

## Intent

A budget stops from a month on, and the months before it keep their amounts. Today a budget has no end: an amount of zero stays in force, and the only way out is `DELETE /budgets/{id}`, which removes every month (S144). The owner deleted a budget of 428.00 from 2026-11, set to zero from 2026-12, and lost November with it.

## Goals

- G1. A budget ends from a month M. From M on it is not in force: it leaves Track, the overview, the attention list, the plan and the assistant's month view. Months before M are unchanged.
- G2. A budget resumes after its end through a new amount, from the budget's line, the plan or the assistant.
- G3. The delete dialog states that every month goes, including past ones, and names the end as the way to stop from a month.

## Non-goals

- Deleting one version of a budget. The end covers the case that led here.
- Hiding a budget whose amount in force is zero. Zero keeps its meaning: a limit of zero that counts in the plan, marks spending as overspent and keeps the budgets of subcategories out of the count (`CountedBudget`, A129).
- Ending a budget in a past month.

## Anti-goals

- A second rule for "in force" beside the domain's. Every reader asks `Budget.InForce`, or its one mirror in `web/`.
- A version that reads as an amount of zero to a consumer that knows the end.

## Approaches

1. **End version (chosen).** An amount version with `ended = true`. The budget's history stays one effective-dated list: an end and a resume are versions like any other, and rollover, the plan and the progress walk read one list.
2. **`ends_from` column on `planning_budget`.** One end per budget. A resume clears the column and loses the gap from the history: a rollover walk across the gap would carry through months without a budget.
3. **Zero means ended.** Removes the limit of zero, and changes the count of the plan for every book that holds one today.

Owner choice of 2026-11-26: the option that holds best for the application. Approach 1 holds history, rollover and resume in one structure.

## Rules

### Storage

- E1. `planning_budget_amount` gains `ended boolean NOT NULL DEFAULT false` and `CHECK (NOT ended OR amount = 0)`, in a new goose migration.
- E2. An end version is never the first version of a budget. `domain` enforces it; the database does not.

### Domain (`internal/planning/domain/budget.go`)

- E3. `BudgetAmount` gains `Ended bool`.
- E4. `Budget.InForce(month) bool` is exported: true when a version starts at or before the month and the latest such version is not an end. `planned` returns ok false in a month where the budget is not in force. `CountedBudget`, `planTree` and every caller of `planned` follow with no change of their own.
- E5. `Budget.Progress` walks from the first version. A month where the budget is not in force carries nothing: the carried amount of the first month after an end is 0. `Progress(month)` of a month not in force returns ok false.
- E6. `Budget.End(month)` is a pure function that returns the budget with the end and the versions it removes:
  - month after the first version's month, or a validation error on `month`;
  - a version starting at month is replaced by the end; versions after month are removed;
  - when the budget is already not in force at month and no version follows, it returns the budget unchanged and nothing removed.

### Use cases (`internal/planning/app`)

- E7. `Service.EndBudget(ctx, booksID, id, month)`: month from the current month (`platform/clock`) to `horizon`, else 422 on `month`; lock the budget, apply `End`, delete the versions from month on, insert the end, in one transaction.
- E8. `BudgetProgress` of a month after an end returns 422 on `month` with the message "is after the end of the budget". A month before the first version keeps its message.
- E9. `AddBudgetAmount` is unchanged: an amount after the latest version, which may be an end, resumes the budget.
- E10. `SaveBudgetPlan`: on a category whose budget is not in force in M, an amount of zero creates no version and an amount above zero upserts the version of M, which resumes the budget. A budget in force keeps today's rule: the version of M is replaced, zero included.
- E11. A plan row exists for a budget in force in M. A budget not in force in M is treated as a category without a budget (the three-month spending rule of the plan spec, line 57); its row, when present, carries `next_change` when a later version exists.

### HTTP (`internal/planning/openapi.yaml`)

- E12. `POST /budgets/{id}/end`, `operationId: endBudget`, `x-book-role: write`. Body `{ "month": "YYYY-MM" }`, pattern of `getBudgetProgress`. Responses: 200 with `Budget`, 400, 401, 403, 404, 422. No new `Problem.code`.
- E13. Each item of `Budget.amounts` in a response carries `ended` (boolean, required). The input of `addBudgetAmount` does not accept it. An end version carries an amount of zero in the budget's currency.

### Web (`web/src/features/planning`)

- E14. `model/budget-month.ts`: `inForce(budget, month)` mirrors E4 and replaces `startsBy` in `budgets-tab.tsx`, `overview/budgets/budgets-block.tsx` and `overview/attention/use-attention.ts`. `startsBy` is deleted.
- E15. `unbudgeted(entries, budgets, totals, month)` counts as budgeted only a budget in force in the month. Spending of a category whose budget ended appears under the spending no budget covers. This also covers a budget whose first version starts after the month, which today hides that spending.
- E16. The row menu of a budget in Track offers "Encerrar a partir de {mês}" when the shown month is the current month or later and is after the first version's month. It opens `end-budget-dialog.tsx` in `budget-dialogs/`:
  - title: "Encerrar o orçamento de {name} a partir de {mês}?";
  - description: the months before {mês} keep their amounts;
  - when later versions exist, one line per removed version with its month and amount;
  - when the budget has rollover and the carried amount of the month is above zero, a line: "O saldo acumulado de {valor} não passa para {mês}.";
  - confirm: "Encerrar orçamento".
- E17. The budget page lists an end version as "Encerrado" in place of an amount.
- E18. The amount dialog prefills from the latest version that is not an end.
- E19. `budget.deleteHint` becomes: "Apaga o orçamento de todos os meses, inclusive os anteriores. Para deixar de orçar a partir de um mês, use Encerrar. A categoria e as transações ficam." The en catalog carries the same text.

### Assistant (`internal/planning/toolapi`)

- E20. `manage_budget_or_goal` gains the action `end_budget`: `budget_id`, `month`. Its preview lists the months kept, the versions removed and a carried amount dropped. The preview is destructive when it removes a version or drops a carried amount.
- E21. `get_budgets_and_goals` lists the budgets in force in the month through `Budget.InForce`, which replaces the inline check of `toolapi/budgets.go`.

### Export (`internal/reporting`)

- E22. `ArchiveVersion` becomes 37. The step `addBudgetEnded` sets `ended` to false on every row of `planning_budget_amount`. An archive of version 37 restores an end version.

### Guide

- E23. `internal/assistant/guide/articles/budgets.md` describes the end, the resume and the scope of a delete, and lists `end_budget` among the actions.

## Scenarios

IDs follow S743. Each has a test through `internal/apitest` that carries its ID.

- S744 End a budget. Ajuda familiar 428.00 from 2026-11, today 2026-11-26. `POST /budgets/{id}/end` with 2026-12 returns 200 with two versions, the second `ended`. Progress 2026-11: planned 428.00. Progress 2026-12: 422 on `month`. The list still holds the budget.
- S745 The end removes later versions. Food 1,800.00 from 2026-11 and 1,500.00 from 2027-01; end from 2026-12 leaves two versions, 2026-11 and the end.
- S746 Resume after an end. S744, then `POST /budgets/{id}/amounts` 300.00 from 2027-02: progress 2027-02 planned 300.00, carried 0.00; progress 2027-01: 422.
- S747 Rollover stops at the end. Rollover budget 500.00 from 2026-11 with 200.00 spent in 2026-11; end from 2026-12, resume 500.00 from 2027-01: progress 2027-01 carried 0.00.
- S748 An ended parent stops covering its children. Food 1,000.00 and Food › Delivery 200.00 from 2026-11; end Food from 2026-12: the plan of 2026-12 counts Delivery, the plan of 2026-11 does not.
- S749 The plan resumes an ended budget. S744: saving the plan of 2026-12 with 0.00 creates no version; with 350.00 it replaces the end with 350.00.
- S750 Validation and access. A month before the current one, the month of the first version and a month after the horizon return 422 on `month`. Another book's budget is 404. A member with the read role gets 403.
- S751 Assistant. Food 1,800.00 from 2026-11 with rollover, 500.00 spent in 2026-11 and 1,500.00 from 2027-01: `end_budget` from 2026-12 previews, as destructive, the budget, its last day 2026-11-30, the removed version of 2027-01 and the carried 1,300.00, then ends the budget. An end that removes and drops nothing is not destructive.
- S752 Export. Family help 428.00 from 2026-10 ended from 2026-11, exported and imported into another instance, keeps the end version of 2026-11.

Schema test: a row with `ended` true and an amount of 100 is rejected.

## Cross-cutting questions

- R1. Does not apply: the feature holds no regional value.
- R2. Does not apply: no region-dependent behavior.
- R3. Does not apply: no value set.
- R4. Does not apply: no extension point.
- R5. New keys, each in pt-BR and en: the menu action, the dialog title, description, removed-version line, carried line and confirm, the "Encerrado" label on the budget page, the changed `budget.deleteHint`, and the assistant action label of `end_budget`.
- R6. The month in the action and the dialog, and the amounts of removed versions and of the carried balance, are written through the existing month formatter and `useMoneyFormat()`.
- C1. No new stored amount. The end version stores 0 in minor units.
- C2. Does not apply: no sum across currencies.
- C3. A budget's currency is the base currency (A54); unchanged.
- C4. Amounts in the dialog come from the budget and its progress through `useMoneyFormat()`.
- T1. The current month comes from `platform/clock`; versions are first days of months (`MonthOf`).
- T2. Does not apply: no business days.
- B1. Does not apply: no new table; `planning_budget_amount` keeps `books_id` and its filters.
- B2. `endBudget` needs `write`. HTTP tests cover write, read (403) and no membership (S750).
- B3. Does not apply: no setting.
- D1. A changed exported table: `ArchiveVersion` 37 with its step (E22).
- D2. New goose migration (E1).
- D3. A budget is a plan, not a recorded fact. The versions removed by an end are not restorable; the dialog and the assistant preview list them before the write.
- D4. Does not apply: no bank, file or model data.
- D5. Does not apply: no diagnostic field.
- S1. `endBudget` gets an entry in `internal/server/tool_exposure_test.go` covered by `manage_budget_or_goal`. No new `Problem.code`.
- S2. Budgets is a desk screen under ADR 027; no phone layout.
- S3. `budgets.md` changes in the commit of the screen (E23).
- S4. Yes: `end_budget` and the in-force listing (E20, E21).
- X1. S744 to S752.
- X2. Does not apply: R1, R2, C2 and C3 hold no new behavior.

## Left to the builder

- The vertical slices and their order.
- The Go type of the end in the repository layer and the sqlc queries for deleting versions from a month on.
- How `oapi-codegen` keeps `ended` out of the input of `addBudgetAmount`, a separate response schema included.
- The layout of the dialog inside the existing `budget-dialogs/` pattern.
