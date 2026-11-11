# reports: net worth, categories, flows and indicators

## Route (`web/src/app/router.tsx`)

- `/reports`: `ReportsPage` (`pages/reports-page.tsx`), search validated by `validateReportsSearch` (`model/reports-search.ts`).
- Tabs rendered by the page: `NetWorthTab`, `CategoriesTab`, `FlowsTab`, `IndicatorsTab`.

Guide topic (`navigation-map.json`): `reports`.

## Endpoints (`api.ts`, under `/api/v1`)

- `GET /reports/categories/{id}/cash-payments`
- `GET /reports/net-worth/days`

## Folders

- `pages/`: the routed page, its tests, the period label and the indicator month.
- `model/`: report period, change, search, net worth months and indicator series used by several folders.
- `report-controls/`: period controls, compare switch and report select.
- `categories/`: categories tab, category rows, cash payments table and report link.
- `flows/`: flows tab and flow rows.
- `indicators/`: indicators tab and its skeleton.
- `indicator-board/`: indicator board, its rows and the range strip.
- `indicator-audit/`: indicator audit and its table.
- `indicator-verdict/`: verdict card, verdict rule, verdict text and month ledger.
- `indicator-charts/`: flows, rate and reserve charts and their rows.
- `net-worth/`: net worth tab, table and valuation currency.
- `net-worth-growth/`: growth cards, growth rule and its hook.
- `net-worth-month/`: month card, entry table, entry totals and net worth days.
- `net-worth-forecast/`: day chart, forecast tooltip, forecast entries and day moves, rows and hook.
