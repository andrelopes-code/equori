# overview

The month-at-a-glance screen: balance, spending, budgets, goals, cards, upcoming items and indicators.

## Route

- `/` (`web/src/app/router.tsx`), optional search parameter `month` (`YYYY-MM`). Renders `OverviewPage`.
- Guide topics: `getting_started`, `reports` (`web/src/navigation/navigation-map.json`).

## Entry components

- `pages/overview-page.tsx`: composes every block of the screen.
- `index.ts`: exports `OverviewPage` and the helpers other features import.

## Endpoints (`api.ts`)

- `GET /reports/net-worth`
- `GET /reports/indicators`
- `GET /transactions` (uncategorized count, any-transaction check)

## Folders

- `pages/`: the page and its test.
- `overview-block/`: the frame (block, link, rows) every block uses.
- `figure/`: the figure widget and its help.
- `meter/`: the meter head and line used by budgets and goals.
- `attention/`: items that need attention.
- `balance-chart/`: balance chart, annotations and rows.
- `budgets/`: budget block and alerts.
- `cards/`: card statements block.
- `goals/`: goals block.
- `desktop-figure/`: the desktop figure.
- `net-worth-figure/`: the net worth figure.
- `month-flow-figure/`: the month flow figure.
- `indicators/`: indicator figures, help and ratios.
- `spending-pace/`: the spending pace figure and its calculation.
- `spending/`: spending block, chart and top categories.
- `upcoming/`: upcoming items block.
- `first-steps/`: first steps block and its dismissal.
- `model/`: forecast, net worth, month flows, open statements and the base hooks.
