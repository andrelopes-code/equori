# portfolio: positions, return, allocation and tax year of investments

## Routes (`web/src/app/router.tsx`)

- `/portfolio`: `PortfolioPage` (`pages/portfolio-page.tsx`), search validated by `validatePortfolioSearch` (`model/portfolio-search.ts`).
- `/portfolio/results`: `PortfolioResultsPage` (`pages/portfolio-results-page.tsx`), search validated by `validateResultsSearch` (`results/results-search.ts`).
- `/portfolio/positions`: `PortfolioPositionsPage` (`pages/portfolio-positions-page.tsx`), search validated by `validatePortfolioSearch`.
- `/portfolio/year`: `PortfolioYearPage` (`pages/portfolio-year-page.tsx`), search validated by `validateYearSearch` (`pages/year-search.ts`).

Other entry components exported by `index.ts`: `AssetsAllocation`, `AccountYield`, `AccountYieldSection`.

Guide topic (`navigation-map.json`): `investments`.

## Endpoints (`api.ts`, under `/api/v1`)

- `GET /reports/allocation`
- `GET /accounts/{id}/balance`
- `GET /reports/return`
- `GET /reports/attribution`
- `GET /realized-results`
- `GET /income-events`

## Folders

- `pages/`: the routed pages, their tests, the hook the summary and positions pages share (`use-portfolio-view.ts`) and the tax year search.
- `area-header/`: the header and the tabs of the five routes of the area, the valuation currency select and the valuation date input.
- `results/`: the search of the results route.
- `model/`: search, holdings, shares, labels, return summary, axis, accounts, yield and year figures used by several folders.
- `holdings/`: holdings section, grid, columns, cells and column state.
- `allocation/`: allocation table, assets allocation, share bar and where-money section.
- `summary/`: portfolio summary, total result figure and income hook.
- `notices/`: problem, missing price and quote warning notices.
- `return/`: return panel, period, view, bars, method, yield group list and options hook.
- `collapsible-section/`: the surface section a click on its header minimizes to its first lines (`peek-body`), with the choice kept per browser (fixed income, attribution); `contained` keeps a press on a header control from toggling it.
- `attribution/`: result of each holding in a year ("Rendimento por ativo"): section, year view, rows, totals and their pure functions.
- `return-money/`: origin of the closing balance: its list, its bar (`origin-parts`) and the money figures.
- `account-yield/`: account yield, its section, hook and measured tops.
- `income-events/`: income events tab, table and charts.
- `realized-results/`: realized results tab and sales table.
- `year-totals/`: figure grid and totals table shared by the two tax year tabs.
