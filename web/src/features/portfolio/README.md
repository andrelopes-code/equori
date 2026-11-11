# portfolio: positions, return, allocation and tax year of investments

## Routes (`web/src/app/router.tsx`)

- `/portfolio`: `PortfolioPage` (`pages/portfolio-page.tsx`), search validated by `validatePortfolioSearch` (`model/portfolio-search.ts`).
- `/portfolio/year`: `PortfolioYearPage` (`pages/portfolio-year-page.tsx`), search validated by `validateYearSearch` (`pages/year-search.ts`).

Other entry components exported by `index.ts`: `AssetsAllocation`, `AccountYield`, `AccountYieldSection`.

Guide topic (`navigation-map.json`): `investments`.

## Endpoints (`api.ts`, under `/api/v1`)

- `GET /reports/allocation`
- `GET /accounts/{id}/balance`
- `GET /reports/return`
- `GET /realized-results`
- `GET /income-events`

## Folders

- `pages/`: the two routed pages, their tests and the tax year search.
- `model/`: search, holdings, shares, labels, return summary, axis, accounts, yield and year figures used by several folders.
- `holdings/`: holdings section, grid, columns, cells and column state.
- `allocation/`: allocation table, assets allocation, share bar and where-money section.
- `summary/`: portfolio header, summary and income hook.
- `notices/`: problem, missing price and quote warning notices.
- `return/`: return panel, period, view, bars, method, yield group list and options hook.
- `return-money/`: money panel, money figures and growth bar.
- `account-yield/`: account yield, its section, hook and measured tops.
- `income-events/`: income events tab, table and charts.
- `realized-results/`: realized results tab and sales table.
- `year-totals/`: figure grid and totals table shared by the two tax year tabs.
