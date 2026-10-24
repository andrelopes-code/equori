# Portfolio (web roadmap item 10)

Spec: the task prompt of 2026-10-24; contract: `listPositions`, `getAllocation`, `getReturn`; scenarios S126 to S128.

Region-dependent values and their extension points: none introduced. Currency and base currency come from the record or from settings; number, percent and date formats come from `Intl` through `tagOf`; instrument types read `instruments.type.*` with the raw code as fallback; the default return period is the 12 months ending at the valuation date.

## Slice 1: `feat(web): add the portfolio positions`
- Route `/portfolio`, destination in `destinations.ts`, entry in `navigation-map.json`.
- Header with the valuation date (`date` search parameter, default today).
- Positions of every account at the date, grouped by account or by instrument, with the share of the total.
- Texts in `catalog-portfolio.*.ts`, spread into the two catalogs.

## Slice 2: `feat(web): add allocation and return to the portfolio`
- Valuation currency selector (`value_in`) for allocation and return.
- Allocation by `type`, `currency` or `institution`: pie chart and table.
- Return of an account over a period of at most 366 days.
- Roadmap item 10 and the Summary row marked Delivered.
