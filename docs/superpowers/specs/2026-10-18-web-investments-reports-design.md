# Web track, sub-project 5: Investments and reports

- Date: 2026-10-18
- Branch: `feat/web-ledger`
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (K1–K7, O1–O8, theme, navigation, data, error and i18n policy), `2026-10-18-web-cards-design.md` (C1–C23), `2026-10-18-web-import-classification-design.md` (I1–I34) and `2026-10-18-web-planning-design.md` (P1–P30). This spec states only what differs from them or adds to them.
- Domain: `docs/domain/02-ubiquitous-language.md` (Net worth, Accrual view), `03-domain-flows.md` F9, scenarios S16, S17, S21, S22, S30 (accrual rows) and S64–S67 of `06-scenarios.md`, P8 amendments A58–A72 (`docs/superpowers/plans/2026-10-17-p8-currencies-investments.md`).

## Intent

The owner sees holdings per brokerage at average cost and market value, records trades and investment income, maintains instruments and prices, records currency exchanges and foreign purchases, and reads net worth and income and expense reports. Home values foreign-currency and security balances in the base currency. Commands exist in the HTTP API (tags `ledger`, `portfolio`, `marketdata`); the only report endpoint is `getBalanceSeries`. This sub-project adds the client and five backend gaps (B1–B5).

## Scope

In scope: scenarios S16, S17, S21, S22, S64–S67 and the accrual rows of S30; brokerage and holding creation; instrument definition; manual price entry and CSV price import; feed status; transaction detail panels for trades, investment income and foreign amounts; Home valuation.

Out of scope:

| Item | Owner |
|---|---|
| Cash view of category spending (S30 cash rows), statement analytics, export (SC6) | backend P9 |
| Correction of a transaction with `trade` or `investment_income` | not in the domain: A69 returns 409 `investment_transaction`; void and record again (V12) |
| Amortization income | not in P8 (F9) |
| Instrument edit or delete; price delete | no endpoint; code, type, scale and quote currency are immutable (A59) |
| Triggering a feed run | no endpoint; feeds run at start and every 6 hours (A62) |
| Holiday calendars (`listHolidays`) | not needed by any screen |

## Decisions

| ID | Decision |
|---|---|
| V1 | New features `web/src/features/{investments,prices,currencies,reports}/`, each with `index.ts` and `api.ts` (O1, O2). They import `features/accounts` and `features/transactions` through `index.ts`; neither imports them. `investments` imports `prices` for instrument and price lookups. |
| V2 | The bottom bar keeps five controls (SC-05). Side navigation and the More sheet gain Investments (`/investments`) and Reports (`/reports`), each active for every path under it. Prices has no destination: the Investments page-header and a Settings section link to `/prices`. |
| V3 | `/accounts/$id` redirects in `beforeLoad` (C2 pattern): a `brokerage` parent to `/investments?brokerage=<id>`; a `brokerage` child whose instrument is not a currency to `/investments/$id`. A brokerage parent holds several instruments, so its `getAccountBalance` returns 422 `mixed_instruments`. |
| V4 | Instrument arithmetic is integer and string only (O7). `i18n/decimal.ts` exports `parseRate` (locale decimal comma or point → canonical `Rate` string, > 0, ≤ 12 decimals), `formatRate`, `multiplyRate(amount, scale, rate, targetScale)` with BigInt and half to even (A68 rounding), and `divideToRate(a, b, decimals)`. Quantity input uses the instrument `scale` from `getInstrument`. |
| V5 | Client previews (gross, cash effect, IOF, implied rate, JCP withholding) are labelled "estimated"; the returned `Transaction` is authoritative and the form navigates to its detail. |
| V6 | Unrealized gain = `market_value` − `cost_basis` on integers; absent when `market_value` is absent. Gain shows in the positive tone; a loss shows a minus sign in the neutral tone (foundation tones). Return percent = gain ÷ `cost_basis` in basis points, rendered with two decimals by string conversion (P25). |
| V7 | Price age: each valued amount shows "price of <date>" from `prices[0].date`. A price dated more than 7 days before the requested date renders a warning tag "Old price". A position without `market_value` renders a "No price" tag linking to `/prices/$code`. |
| V8 | Overview date: `/investments?date=` defaults to today; a date-picker allows a past date (positions are dated, A71). |
| V9 | New brokerage is a dialog on the overview: name (1–120) and institution; it posts `createAccount` twice: the parent `{class: asset, kind: brokerage, currency: base}` and the child "<name> cash" with `parent_id`. |
| V10 | New holding is a dialog per brokerage: instrument picker (`listInstruments`, non-currency, `quote_currency` = parent currency, A63) with a "Define instrument" link; it posts `createAccount {name: instrument code, class: asset, kind: brokerage, currency: code, parent_id}` and navigates to the trade form with the holding preselected. |
| V11 | Trade form defaults: side from the search param, date today, cash account = the single base-currency child of the brokerage (a select when several). Sell shows the held quantity from `listPositions?date=<trade date>` and a "Sell all" control that fills it. `taxes` and `taxes_category_id` show only for sell (A68 rejects `taxes` on buy). |
| V12 | `TransactionPage` hides Correct when `trade` or `investment_income` is present. `InvestmentTransactionPanel` (investments, I2 `extensions`) renders the detail (side, quantity, unit price, gross, fees, taxes, cost; or type, gross, withheld) and the action "Void and record again": the void dialog, then the trade or income form prefilled from the voided detail, draft key `investments.rerecord.<id>`. |
| V13 | Income form: `income_type` segmented-control (Dividend, JCP, Interest, Coupon); `withheld` is empty by default and the body omits it, so the server applies 0 or 15 % for `jcp` (A70); the preview shows that default. `category_id` defaults to the last category used for the same `income_type` (localStorage `investments.income-category.<type>`). |
| V14 | Exchange and foreign purchase are routed forms of `features/currencies`. Entry points: a "More types" menu in the `/transactions/new` page-header, an "Exchange" action on the detail of an account whose instrument is a non-base currency, and a "Foreign purchase" action on `/cards/$accountId` (typed route links, I19 pattern). |
| V15 | Exchange form: from and to account pickers of open balance accounts whose instruments are two different currencies, one of them the base (A67); amounts in each instrument scale; optional fee in the base currency; implied rate = base amount ÷ foreign amount (V4, 4 decimals) shown live. |
| V16 | Foreign purchase form: account picker of open card and balance accounts in the base currency; `original` currency-field with a select of non-base currency instruments; `rate` (V4); IOF percent input defaulting to 3.50 %, sent as `iof_rate_bp` only when changed; statement select (C15) only for a card account. Preview: amount, IOF and total. |
| V17 | `CurrencyPanel` (currencies, I2 `extensions`) renders, for a transaction with a posting carrying `original` or with postings in two currencies, the original amount, the rate and the weights. Correction of such a transaction opens the Advanced postings editor with `original` and `weight` shown read-only and resubmitted unchanged. |
| V18 | Home calls `listBalances?date=<today>&value_in=<base>` (B1). Group totals sum `value` for items in another instrument; an item without `value` stays in `excluded` and the existing note links to `/prices`. A non-base row shows the native balance on the first line and "≈ <value>" with the price date on the second. |
| V19 | Home gains group `investments` (kind `brokerage`) between reserves and cards: one row per brokerage parent with the sum of its children's `value`; children are not listed. The row opens `/investments?brokerage=<id>`. |
| V20 | `/accounts/$id` of a non-base currency account adds the valued balance from `getAccountBalance?value_in=<base>` with its price line. |
| V21 | Instrument form defaults: `scale` 0 for `stock`, `fii`, `etf`, `bdr`; 2 for `fixed_income`; 6 for `fund`; 8 for `crypto`; `quote_currency` the base currency; `exchange` `B3` switch shown for the first four types, on by default. Code input uppercases. Instruments and prices are instance-wide (A59, A60); the form states this. |
| V22 | Manual price is a dialog: pair (instrument, quote defaulting to its `quote_currency`, or the base currency for a currency), date (today), value (V4). A manual price replaces a manual price of the same date and wins over every source (A60); the dialog states this. |
| V23 | CSV import is a dialog with the `upload` family; the client rejects files above 10 MiB. A 422 with `field` `line N` renders as a form-level message "Line N: <message>". Success shows a toast with `recorded`. |
| V24 | Price history of a pair: `listPrices` window defaults to the last 90 days, presets 30 days, 90 days, 1 year (366 days, the A60 limit). Chart is a line `chart`; the table shows date, value and a `source` tag. |
| V25 | Holding chart: line `chart` of the chosen price over one year (`listPrices`) with a second constant series at `average_cost`. Positions are not multiplied by prices client-side. |
| V26 | Report periods are month ranges in the search params `from` and `to` (`YYYY-MM`); presets: this month, last 3, 6, 12 months, year to date; a custom range uses two month selects; at most 24 months (B5) and 120 months (B4). |
| V27 | Category report: rows from B5 rolled up client-side over the category tree (`parent_id`); a parent shows the sum of its subtree; expandable rows. Class segmented-control Expense / Income. A leaf row links to `/transactions?account_id=<category>&from=&to=`. |
| V28 | Cash flow: per month, income total, expense total and net = income − expense from the same B5 query; a grouped bar `chart`; a stat-card of savings rate = net ÷ income in basis points (two decimals), absent when income is 0. Transfers, trades and exchanges between balance accounts never count (B5 reads only income and expense accounts). |
| V29 | Net worth: line `chart` of `net_worth` per point (B4) with assets and liabilities in a table; a point with `missing` instruments shows a warning marker and lists them with links to `/prices`. |
| V30 | Positions, realized results, income events and net worth are derived after commit (A71, outbox). Their queries use `staleTime: 0` and refetch on mount and window focus (P30 pattern). |
| V31 | Results page holds `year` (default the current year) and `tab` (`realized`, `income`) in the search params; realized results group by `month` with month totals and a `tax_class` tag; income events group by `tax_treatment` with gross and withheld totals. |
| V32 | `format.ts` gains `formatQuantity(money, scale)`: integer part grouped by locale, trailing zeros removed (100 MXRF11, 0.5 BTC). |

## Routes

| Route | Content | Actions |
|---|---|---|
| `/investments?date=&brokerage=` | stat-cards: market value, cost basis, unrealized gain (V6) over positions with a price; one section per brokerage parent (filtered by `brokerage`): holdings rows from `listPositions` (instrument code and name, `formatQuantity`, `average_cost`, price with V7 tag, `market_value`, gain), cash children balances; zero-quantity holdings in a collapsed "Closed" section | new brokerage (V9); new holding (V10); buy; sell; record income; open holding; prices; results |
| `/investments/$accountId` | header: instrument, brokerage; description-list: quantity, cost basis, average cost, price (V7), market value, gain and return (V6); chart V25; history from `listTransactions?account_id=` (infinite): date, side or income type tag, quantity, unit price, cash amount | buy; sell; record income; open transaction |
| `/investments/trade?account_id=&side=` | form V11: brokerage, holding, cash account, side, date, quantity, unit price, fees, taxes (sell), description; Advanced: taxes category; preview V5: gross, cash effect | `recordTrade` |
| `/investments/income?account_id=` | form V13: brokerage, holding, cash account, type, date, gross, withheld, income category, description; Advanced: withheld category; preview: net to cash | `recordInvestmentIncome` |
| `/investments/results?year=&tab=` | V31 from `listRealizedResults`, `listIncomeEvents`; rows link to the transaction | change year |
| `/prices` | feed status from B3 (source, enabled, latest date); instruments from `listInstruments` with the latest chosen price from B2 and V7 tag; filter by `type` | define instrument; record price (V22); import CSV (V23); open pair |
| `/prices/instruments/new` | form V21 | `defineInstrument`; navigates to `/prices/$code` |
| `/prices/$code?quote=&range=` | `getInstrument`; V24 chart and table | record price (V22) |
| `/transactions/new/exchange` | form V15 | `exchangeCurrency` |
| `/transactions/new/foreign-purchase` | form V16 | `recordForeignPurchase` |
| `/transactions/$id` (existing) | V12 and V17 panels | void and record again |
| `/reports` | stat-cards: net worth today (last B4 point), income, expense and net of the current month (B5); net worth sparkline over 12 months; links to the three reports | open report |
| `/reports/net-worth?from=&to=` | V29 | change period |
| `/reports/categories?from=&to=&class=` | V27; totals row per month | change period or class; open transactions |
| `/reports/cash-flow?from=&to=` | V28; table: month, income, expense, net | change period |
| `/` (existing) | V18, V19 | open investments |

## Phone ergonomics

Section 2 of the foundation spec applies. Specific rules:

- Investments overview: stat-cards render as one row of three compact values; the date-picker sits in an action-sheet "Investments actions" with prices and results. A holding row shows instrument and market value on the first line, quantity × price and gain on the second (LP-01); brokerage sections are collapsible.
- Holding detail: chart height 200 px; buy, sell and record income sit in a sticky footer of three buttons; history rows show date and cash amount on the first line, side tag and quantity on the second.
- Trade and income forms: side is a full-width segmented-control at the top; quantity uses `inputmode="decimal"` (numeric when `scale` is 0); the preview sits in the pinned footer above the submit button.
- Results: tabs become a segmented-control; month groups use sticky headers.
- Prices: feed status collapses into one line "Feeds: <n> enabled, latest <date>" that expands; instrument rows show code and latest price on the first line, name and price date on the second. Manual price and import open as bottom drawers.
- Exchange and foreign purchase: the implied rate and the preview sit in the pinned footer.
- Reports: period presets render as a horizontally scrolling tag row under the page-header; charts are 200 px high; the category report shows one total per category for the period (no month columns) and expands children inline; cash-flow table rows show month and net on the first line, income and expense on the second.

## Data

Keys, nested under `transactionKeys.all` so the existing `transactionMutated` invalidates them (C5 pattern), except `priceKeys`:

| Key | Query |
|---|---|
| `investmentKeys.positions(date)` = `[...transactionKeys.all, "investments", "positions", date]` | `listPositions` |
| `[..., "investments", "realized", year]`, `[..., "investments", "income", year]` | `listRealizedResults`, `listIncomeEvents` |
| `reportKeys.netWorth(from, to)`, `reportKeys.categories(from, to)` under `[...transactionKeys.all, "reports"]` | B4, B5 |
| `priceKeys.all = ["prices"]`: `["prices", "instruments", type]`, `["prices", "instrument", code]`, `["prices", "pair", code, quote, from, to]`, `["prices", "latest", date]`, `["prices", "feeds"]` | `listInstruments`, `getInstrument`, `listPrices`, B2, B3 |

Invalidation:

| Mutation | Invalidates |
|---|---|
| `recordTrade`, `recordInvestmentIncome`, `exchangeCurrency`, `recordForeignPurchase` | `transactionMutated` |
| `createAccount` of V9 and V10 | the accounts keys of the foundation |
| `recordPrice`, `importPrices` | `priceKeys.all` and `transactionMutated`, because valued balances, positions, net worth, committed amounts and goals read prices |
| `defineInstrument` | `["prices", "instruments"]` |

Routed forms persist drafts under `investments.trade.new`, `investments.income.new`, `investments.rerecord.<id>`, `currencies.exchange.new`, `currencies.foreign-purchase.new` and `prices.instrument.new`. Field errors attach by `field`; `quantity` (above the held quantity, A68) attaches to the quantity input.

## Problem codes

New catalog entries (`problem.<code>`, en and pt-BR); `price_missing`, `currency_unsupported` and `request_too_large` are added when the P and I catalogs do not yet hold them:

| Code | Status | Operation | en message |
|---|---|---|---|
| `investment_transaction` | 409 | `correctTransaction` | Trades and investment income cannot be corrected. Void and record again. |
| `later_sale_exists` | 409 | `recordTrade`, `voidTransaction`, `createTransaction`, `correctTransaction` | A later sale of this holding exists. Void that sale first. |
| `instrument_exists` | 409 | `defineInstrument` | An instrument with this code already exists. |
| `currency_unsupported` | 422 | `recordTrade`, `recordInvestmentIncome`, `exchangeCurrency`, `recordForeignPurchase` | This account's instrument cannot be used here. |
| `price_missing` | 422 | `getAccountBalance` with `value_in` | No stored price converts this amount. |
| `request_too_large` | 413 | `importPrices` | The file is too large. |

`currency_unsupported` attaches to the `field` it names (`cash_account_id`, `to_account_id`, `account_id`). Existing entries reused: `validation_failed`, `invalid_request`, `not_found`, `mixed_instruments`, `transaction_voided`. Each new code gets a web test rendering its message.

## Backend gaps

Delivered first, each with an apitest through `internal/apitest`, the OpenAPI contract and `make gen`; every query on user data filters by `user_id` (ADR 003) and an apitest shows another user's accounts are absent.

| ID | Endpoint | Reason | apitest |
|---|---|---|---|
| B1 | `GET /balances?value_in=` adds `value` and `prices` per item (A65 rules); an item without a conversion path omits `value` and the response stays 200 | Home values every balance in one call (V18) | S17 with Today 2026-11-01: Wise USD `value` 5,500.00 BRL with the `manual` 5.5000 price; S64: XP MXRF11 `value` 936.00; an instrument without prices has no `value`; malformed `value_in` → 400 |
| B2 | `GET /prices/latest?date=` → `PriceList` with the chosen price on or before `date` of each pair that has prices (A60) | the prices page shows every latest price in one call | S17 prices: USD/BRL 5.5000 `manual` on 2026-10-30, not the `bcb_ptax` 5.4950; S64: MXRF11/BRL 9.36 |
| B3 | `GET /price-feeds` → `{items: [{source: bcb_ptax \| b3_cotahist, enabled, latest_date?}]}` from `EQUORI_PRICE_FEEDS` and the latest price date of each source | feed status exists only in logs (A62) | `bcb_ptax` enabled with a price on 2026-10-30 → `latest_date` 2026-10-30; `b3_cotahist` not configured → `enabled` false |
| B4 | `GET /reports/net-worth?from=YYYY-MM&to=YYYY-MM` (≤ 120 months) → `{items: [{date, assets, liabilities, net_worth, missing: [instrument]}]}`: one point at each month end (today for the current month), balance-sheet accounts valued in the base currency by A61; an unvaluable balance is excluded and its instrument listed in `missing` | net worth over time (2.10 Net worth); A65 moved the series to P9, pulled forward here | S17 point 2026-10 includes Wise USD at 5,500.00; without USD prices the point lists `USD` in `missing`; `from` after `to` → 400 |
| B5 | `GET /reports/categories?from=YYYY-MM&to=YYYY-MM` (≤ 24 months) → `{months: [...], items: [{category_id, class, totals: [Money]}]}`: per income and expense account with postings, base-currency weights per month by transaction date (accrual view), voided transactions excluded; expense totals as weights, income totals negated | category report and cash flow (V27, V28) | S30 accrual rows: 2026-10 Food › Supermarket 230.00, Electronics 1,000.00; 2026-11 has neither; S22 adds Dividends 10.00 and JCP 45.00 in 2026-10 |

## Tests

Flow tests use the fake fetch (K5), the fixture of `06-scenarios.md` 6.1, Today 2026-11-01, and assert the exact request body and the rendered values. Each test name carries its scenario ID.

| Scenario | Web flow test |
|---|---|
| S16 | foreign purchase posts `{account_id: Itaú Visa, category_id: Travel, date: "2026-10-22", original: {amount: 10000, currency: "USD"}, rate: "5.4830", statement: "2026-11"}` without `iof_rate_bp`; preview renders 548.30, IOF 19.19, total 567.49; the detail panel renders 100.00 USD at 5.4830 |
| S17 | exchange posts `{from_account_id: Nubank checking, to_account_id: Wise USD, date: "2026-10-14", from_amount: {amount: 548300, currency: "BRL"}, to_amount: {amount: 100000, currency: "USD"}, fee: {amount: 3000, currency: "BRL"}}` with implied rate 5.4830; Home renders Wise USD 1,000.00 USD and ≈ 5,500.00 with price date 2026-10-30, included in the available total |
| S21 | buy posts `{account_id: XP MXRF11, cash_account_id: XP cash, side: "buy", date: "2026-10-05", quantity: {amount: 150, currency: "MXRF11"}, unit_price: "10.05", fees: {amount: 490, currency: "BRL"}}` with preview gross 1,507.50 and cash −1,512.40; sell of 50 at "10.80" with fees 210 previews cash +537.90; the detail panel renders cost 504.13; Correct is absent; `investment_transaction` and `later_sale_exists` render their messages |
| S22 | dividend posts `{income_type: "dividend", date: "2026-10-26", gross: {amount: 1000, currency: "BRL"}, category_id: Dividends, …}`; JCP gross 45.00 posts no `withheld` and previews withheld 6.75 and net 38.25 |
| S64 | overview renders XP MXRF11: quantity 100, average cost 10.0827, price 9.36 of 2026-10-29, market value 936.00, cost basis 1,008.27, gain −72.27; results 2026 render 33.77 in October 2026 |
| S65 | income tab renders the dividend 10.00 `exempt` withheld 0.00 and the JCP 45.00 `exclusive` withheld 6.75 |
| S66 | planning overview committed card for 2026-12 renders 54.94 and the USD/BRL 5.5000 price line |
| S67 | goal card "Trip" renders current 1,500.00 USD, remaining 500.00 USD, 75.00 % and the price line |
| S30 | category report 2026-10 to 2026-11, class Expense, renders Food 230.00 (Supermarket 230.00 expanded) and Electronics 1,000.00 in October and nothing in November |

Unit tests: `parseRate`, `multiplyRate` half to even (1,507.50; 54.945 → 54.94), `divideToRate` (V4); `formatQuantity` for scales 0 and 8 in both locales; gain and return (V6) including absent market value; old-price rule at 7 and 8 days (V7); category roll-up (V27); savings rate with income 0 (V28); Home grouping with B1 values and the `investments` group (V18, V19). Router tests: `/accounts/$id` redirects of V3; `/investments/*` and `/reports/*` mark their side-navigation destination active (V2).

## Verification

- `make check` passes on the branch head.
- B1–B5 each have the apitest of the Backend gaps table.
- `rg -n "S(1[67]|2[12]|30|6[4-7])" web/src/features` lists a flow test for each scenario of the Tests table.
- Each route of the Routes table renders at 360, 768 and 1280 px with no horizontal scroll.

## Open risks

| Risk | Check |
|---|---|
| Positions and results lag a trade (V30); the overview opened in the same instant shows the previous position | refetch on focus and mount; S21 test renders the new quantity from the second response |
| B4 converts every balance-sheet account at up to 120 month ends per request | apitest asserts the 120-month bound; the N05 benchmark (p95 below 200 ms for report endpoints) gains a 12-month B4 case |
| Client previews (V5) diverge from server rounding | `multiplyRate` tests reuse the A68 and A66 figures; the detail renders the server values |
| Instruments and prices are instance-wide (A59, A60): a price recorded by one user values every user's balances | V21 and V22 state it in the form; accepted for a self-hosted single-household instance |
| B4 and B5 pull part of backend P9 forward; P9 later adds the cash view | B5 names its basis as accrual in the contract summary, so a later `basis` parameter defaults to it |
