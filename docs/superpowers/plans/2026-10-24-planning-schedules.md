# Planning: schedules and occurrences (web roadmap item 5)

Spec: `docs/web-roadmap.md` section 5; contract: `api/openapi.yaml` tag `planning`.
Scenarios: S27, S28, S29, S62. No backend change.

## Slice 1 — `feat(web): add the planning agenda with occurrence actions`

- Route `/planning` (tabs in the search: agenda, schedules, subscriptions) in the shell
  destinations and `navigation/navigation-map.json`.
- Agenda of one month (`ui/month-control`): occurrences of the month grouped by day, overdue
  occurrences of the last 365 days first in their own group; filters state, schedule,
  account, kind; month totals of expected inflow and outflow; a month calendar beside the
  list from 1024 px.
- `planning/occurrence-actions.tsx`: realize (transactions of the schedule's account within
  ±`grace_days`, closest amount first), unrealize, skip with an optional reason, move.
  Used by the agenda and by the scheduled tab of `/accounts/$id`.

## Slice 2 — `feat(web): add the schedule list and detail with terms, pauses and end`

- Schedules tab: by kind, account, counterpart, current amount, recurrence in words, next
  occurrence, end date; create form with the recurrence builder and the advanced fields.
- Route `/planning/schedules/$id`: terms history, change terms, pauses, end dialog,
  occurrences of the schedule.

## Slice 3 — `feat(web): add subscriptions and realized occurrences on transactions`

- Subscriptions tab: monthly and yearly cost, price history from the terms, pause and end.
- Transaction detail: occurrences realized by the transaction, when the contract allows it.
- `docs/web-roadmap.md`: item 5 delivered.

## Verification

Each behaviour starts with a failing vitest test; `pnpm vitest run <files>` and
`pnpm typecheck` per slice; `make check` once after slice 3; one Playwright smoke of the
agenda.
