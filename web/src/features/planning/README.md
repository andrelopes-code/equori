# planning: schedules, occurrences and budgets

## Routes (`web/src/app/router.tsx`)

- `/planning`: `PlanningPage` (`pages/planning-page.tsx`), tabs chosen by the search validated in `model/planning-search.ts`.
- `/planning/schedules/new`: `ScheduleFormPage`.
- `/planning/schedules/$id`: `SchedulePage`.
- `/planning/budgets/new`: `BudgetFormPage`.
- `/planning/budgets/$id`: `BudgetPage`.

Guide topics (`navigation-map.json`): `schedules_and_occurrences`, `budgets`.

## Endpoints (`api.ts`, under `/api/v1`)

- `/schedules`, `/schedules/{id}`, `/schedules/{id}/{end,pauses,terms}`
- `/occurrences`, `/occurrences/{id}/{realize,unrealize,skip,move,reopen}`
- `/budgets`, `/budgets/{id}`, `/budgets/{id}/{amounts,progress}`, `/budget-plan`
- `/calendars`, `/calendars/{name}/holidays`, `/commitments`, `/transactions`
- `/accounts/{id}/projection`, `/goals`, `/goals/{id}`

## Folders

- `pages/`: the five routed components and the tests of the pages.
- `model/`: agenda, schedule words, budget month, calendar and search functions used by several folders.
- `agenda/`: the agenda tab: its summary, filters, pending and done tables, calendar with marks, running balance, and the month close functions.
- `summary/`: the band of figures each tab opens with.
- `occurrences/`: occurrence actions, realize and edit dialogs, amount variance, realized list.
- `schedules/`: the schedules tab and its rows.
- `subscriptions/`: the subscriptions tab, its rows and actions.
- `schedule-detail/`: schedule menu, the occurrences table of the schedule page, and the end, pause, rename, start, terms and matching dialogs.
- `schedule-fields/`: recurrence and matching fields shared by the form and the dialogs.
- `schedule-form/`: schedule form sections, draft and start hooks.
- `terms-suggestion/`: terms suggestion banner and its rule.
- `recurring-share/`: recurring share notice and its rule.
- `budgets/`: budgets area and tab, card, summary, spending chart, unbudgeted list.
- `budget-dialogs/`: budget amount and delete dialogs.
- `budget-plan/`: budget plan tab, editor, table, reference panel, draft and math.
