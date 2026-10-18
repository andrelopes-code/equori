# Web Investments and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the investment, price, currency and report screens of the web track, Home valuation in the base currency, and the five read endpoints they need (B1–B5).

**Architecture:** Five backend tasks come first: B1 in `ledger`, B2 and B3 in `marketdata`, B4 and B5 in `reporting` beside `getBalanceSeries`. The web part adds `web/src/features/{prices,investments,currencies,reports}/`; they consume `features/accounts` and `features/transactions` through `index.ts`, and `investments` consumes `prices`. Integer and string arithmetic (rates, quantities, gains, basis points) lands in one task before the screens; the price line shared by Home, planning and investments lives in `web/src/ui/`.

**Tech Stack:** Go 1.27, sqlc, oapi-codegen; the web stack of sub-project 1 unchanged (React 19.3.1, TanStack Router 1.170.41, TanStack Query 5.104.1, Slotted `0.1.0-beta.2`, Vitest 5.0.5, Testing Library). `BigInt` is a language built-in. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-18-web-investments-reports-design.md` (V1–V32, Routes, Phone ergonomics, Data, Problem codes, Backend gaps, Tests). Inherited: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md`, `2026-10-18-web-cards-design.md`, `2026-10-18-web-import-classification-design.md`, `2026-10-18-web-planning-design.md`.

**Start condition:** every task of `docs/superpowers/plans/2026-10-18-web-cards.md`, `2026-10-18-web-import-classification.md` and `2026-10-18-web-planning.md` is committed. Task 16 relies on `web/src/app/transaction-route.tsx` passing `extensions` (import plan Task 7); Task 19 relies on `web/src/features/cards/card-overview-page.tsx` and `web/src/testing/card-api.ts`; Task 22 relies on `web/src/features/planning/{basis-points.ts,committed-cards.tsx,goal-card.tsx}`.

## Global Constraints

- Every Global Constraint of `docs/superpowers/plans/2026-10-17-web-ledger.md` and `docs/superpowers/plans/2026-10-18-web-cards.md` applies (Slotted docs read before each screen, O1 one component per file with `react/no-multi-comp`, kebab-case file names, O6 no literal JSX text, pt-BR test strings with `localStorage.clear()` and `writeLocale("pt-BR")` in `beforeEach`).
- V1: `features/{prices,investments,currencies,reports}` import `@/features/accounts`, `@/features/transactions` and, for `investments` only, `@/features/prices`; `accounts`, `transactions`, `cards` and `planning` import none of them. Entry points from those features are typed route links (I19).
- O7 and V4: no `Number` arithmetic on rates, quantities or percents beyond integer addition and subtraction; rounding is half to even on `BigInt`.
- V5: every client preview carries the catalog label `common.estimated` ("estimado"); after submit the form navigates to `/transactions/$id` and renders server values.
- V30: positions, realized results, income events and B4 queries set `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: "always"`.
- Routed forms persist drafts in `sessionStorage` under the keys of the spec's Data section through the helpers of `web/src/features/transactions/draft-storage.ts` (exported through `transactions/index.ts` when absent); a restored draft is validated field by field and discarded when invalid.
- Fixture: `06-scenarios.md` 6.1 with Today 2026-11-01 unless a test states another date; every test passes `today` to `renderApp` or `apitest.Today`.
- Responsive check: each screen test runs at 360, 768 and 1280 through `setViewport`; it asserts the phone arrangement the task names at 360, the desktop arrangement at 1280, and at 768 the 1280 arrangement unless the task states otherwise. The commit body records the manual pass (360/768/1280 px in devtools, no horizontal scroll, pinned footers above the safe area).
- Backend: every query on user data filters by `user_id` (ADR 003); each endpoint on user data has an apitest where another user does not see the owner's accounts. Commit scopes: `ledger` (Task 1), `marketdata` (Tasks 2–3), `reporting` (Tasks 4–5), `web` otherwise.
- Verification: backend tasks run the focused `go test` then `make check`; web tasks run the focused `pnpm vitest run` then `make web-check`. The pre-commit hook runs `make check`: `git commit ... >/dev/null 2>&1; echo $?`, on failure `make check 2>&1 | tail -40`.
- Execution runs in slices of at most three tasks; each slice ends by writing `.claude/progress/current.md`.

## Review Focus

1. A position without `market_value` stays out of the three overview stat-cards (market value, cost basis, gain); the sums cover priced positions only and the row shows "Sem cotação". Test: Task 11, `excludes unpriced positions from the totals`.
2. A position with `cost_basis` 0 (bonus shares) shows its gain and no return percent; no division by zero. Test: Task 6, `gainOf` row `zero cost basis`.
3. A quantity typed with more decimals than the instrument `scale` (`1,5` for MXRF11, scale 0) shows a field error and posts nothing. Test: Task 13, `rejects decimals beyond the scale`.
4. A report URL with `from` after `to`, a malformed month or a range above the endpoint limit normalizes to the default period and never sends a request that returns 400. Test: Task 23, `normalizes an invalid period`.
5. A parent category with postings of its own and children with postings shows own plus subtree in its row and lists its own amount as a child row "(direto)". Test: Task 24, `parent with own postings`.

## Spec ambiguities resolved

| Topic | Resolution |
|---|---|
| B1 base-currency items | With `value_in`, an item whose instrument equals `value_in` carries `value` = `balance` and `prices: []`; a zero balance in another instrument carries `value` 0 and `prices: []` (as `ValuedBalance` skips zero totals). Without `value_in` the response is unchanged. |
| B2, B3 isolation | Prices and feeds are instance-wide (A59, A60); the apitest asserts a second user receives the same body. |
| B3 `latest_date` | `LatestSourceDate` returns the sentinel `1970-01-01` when a source has no price; the handler then omits `latest_date`. |
| B4, B5 owner | `reporting` (tag `reporting`, paths under `/reports`); `reporting` reads `ledger_*` tables with `SELECT` only (ADR 002). B4 month-end balances come from `reporting_account_day`, so the apitest calls `h.Dispatch()` before reading. |
| B4 figures | `assets` = sum of valued asset balances; `liabilities` = negated sum of valued liability balances (a positive magnitude); `net_worth` = `assets` − `liabilities`; `missing` = sorted unique instrument codes. `to` after the current month → 400 field `to`. |
| B5 order and shape | `months` ascending `YYYY-MM`; `totals[i]` aligns with `months[i]`, zero-filled; items ordered by `class`, then `category_id`; only accounts with postings in range appear. |
| Rate display | `formatRate(rate, locale, minFraction)` pads to `minFraction` decimals and keeps longer ones: 4 for a currency pair (`5,5000`), 2 for a security (`9,36`, average cost `10,0827`). |
| `formatQuantity` locale | Signature `formatQuantity(money, scale, locale)`; grouping follows `locale`. |
| Basis points | `bpToPercent` and `formatBp` move from `features/planning/basis-points.ts` to `web/src/i18n/decimal.ts`; planning imports them from there. `ratioBp(n, d)` = round half to even of `n × 10000 ÷ d`, `undefined` when `d ≤ 0`. |
| Price line | `web/src/ui/price-line.tsx` renders `<instrument>/<quote> <rate> · cotação de <date>` with the V7 tag; `ui/` is shared, so Home and planning use it without importing `prices`. |
| V9 partial failure | When the child `createAccount` fails, the dialog shows the problem and a retry that posts only the child. |
| Report default period | `/reports/net-worth` and `/reports/cash-flow`: last 12 months; `/reports/categories`: this month. Presets end at the current month. |
| Currency routes | `/transactions/new/exchange` and `/transactions/new/foreign-purchase` are siblings of `/transactions/new` in `app/router.tsx`. |
| Sell all | Fills `quantity` with the position quantity at the trade date; a date change refetches positions. |

## File Structure

```
api/openapi.yaml                                        B1 param, B2–B5 operations and schemas
db/queries/marketdata/price.sql                         LatestChosenPrices
db/queries/reporting/{net_worth.sql,category_report.sql}
internal/ledger/internal/app/currency.go, internal/ledger/internal/adapter/httpapi/server.go
internal/ledger/balances_test.go
internal/marketdata/{price.go,feeds.go,prices_test.go,feeds_test.go}
internal/marketdata/internal/adapter/httpapi/{server.go,prices.go}
internal/reporting/{reporting.go,valuer.go,net_worth_test.go,net_worth_bench_test.go,category_report_test.go}
internal/reporting/internal/app/{net_worth.go,category_report.go,series.go}
internal/reporting/internal/adapter/{postgres/repository.go,httpapi/server.go,httpapi/convert.go}
internal/server/server.go
web/src/i18n/{decimal.ts,decimal.test.ts,format.ts,format.test.ts,catalog.en.ts,catalog.pt-BR.ts}
web/src/ui/{price-line.tsx,price-age.ts,price-age.test.ts}
web/src/testing/{investment-api.ts,report-api.ts}
web/src/app/{router.tsx,transaction-route.tsx,shell/destinations.tsx,routes-responsive.test.tsx}
web/src/features/prices/        index.ts, api.ts, prices-page, feed-status, instrument-rows, instrument-form-page,
                                price-dialog, price-import-dialog, pair-page, pair-chart, pair-table
web/src/features/investments/   index.ts, api.ts, gain.ts, investments-page, portfolio-stats, brokerage-section,
                                holding-row, brokerage-dialog, holding-dialog, trade-form-page, trade-preview,
                                income-form-page, income-preview, holding-page, holding-chart, holding-history,
                                investment-transaction-panel, results-page, realized-list, income-event-list
web/src/features/currencies/    index.ts, api.ts, exchange-form-page, foreign-purchase-form-page, currency-panel
web/src/features/reports/       index.ts, api.ts, report-period.ts, category-rollup.ts, cash-flow.ts, period-picker,
                                reports-page, net-worth-page, category-report-page, category-rows, cash-flow-page
```

---

### Task 1: B1, `GET /balances?value_in=`

**Files:**
- Modify: `api/openapi.yaml` (`listBalances` gains `value_in`, the `getAccountBalance` parameter definition with pattern `^[A-Z]{3}$`)
- Modify: `internal/ledger/internal/app/currency.go`, `internal/ledger/internal/adapter/httpapi/server.go` (`ListBalances`, line 223)
- Test: `internal/ledger/balances_test.go`

**Interfaces:**
- Produces: `app.ValuedBalance { Balance Balance; Conversion *Conversion }` (nil when no conversion path); `(*Service).ValuedBalancesAt(ctx context.Context, userID int64, date time.Time, basis Basis, in money.Currency) ([]ValuedBalance, error)` built on `BalancesAt`; `ErrPriceMissing` from `s.prices.Convert` leaves `Conversion` nil; other errors return. Handler maps prices as `GetAccountBalance` does (lines 202–208).

- [ ] **Step 1: Write the failing test `TestListBalancesValueIn`** (`apitest.Today("2026-11-01")`): S17 exchange and prices as in `TestS17CurrencyExchange` (`currency_test.go:103`); in the same harness the S64 setup of `newInvestFixture` with buy 150 at `"10.05"` fees 490 on 2026-10-05, sell 50 at `"10.80"` fees 210 on 2026-10-20, price MXRF11/BRL `"9.36"` on 2026-10-29, and a PETR4 buy of 10 at `"30"` with no PETR4 price. `GET /api/v1/balances?date=2026-11-01&value_in=BRL` → 200; Wise USD: `balance` 100000 USD, `value` 550000 BRL, `prices` one item `{USD, BRL, 2026-10-30, "5.5", manual}`; XP MXRF11: `balance` 100 MXRF11, `value` 93600 BRL, `prices[0].value` `"9.36"`; XP PETR4: no `value` key, no `prices` key; Nubank checking: `value` = `balance`, `prices` `[]`. Without `value_in`: no item has `value`. `value_in=brl` → `h.ExpectProblem(r, 400, "invalid_request", "value_in")`; `value_in=XYZ` → 422 `validation_failed` field `value_in`. `h.Login("other@example.com")` → no item `account_id` equals an owner account id.
- [ ] **Step 2: Run** `make db-up && go test ./internal/ledger/ -run TestListBalancesValueIn -count=1` → FAIL (`value` absent).
- [ ] **Step 3: Contract.** Add the parameter; `make gen`.
- [ ] **Step 4: Implement** `ValuedBalancesAt` (the `value_in` check of `ValuedBalance`, line 197) and the handler branch.
- [ ] **Step 5: Run** → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(ledger): value every balance in a currency"`.

### Task 2: B2, `GET /prices/latest`

**Files:**
- Modify: `api/openapi.yaml` (path `/prices/latest` `get`, `operationId: listLatestPrices`, required `date`, 200 `PriceList`, 400)
- Modify: `db/queries/marketdata/price.sql`, `internal/marketdata/price.go`, `internal/marketdata/internal/adapter/httpapi/{server.go,prices.go}`
- Test: `internal/marketdata/prices_test.go`

**Interfaces:**
- Produces: `(*Module).LatestPrices(ctx context.Context, date time.Time) ([]Price, error)`, added to the httpapi `Service` interface; items ordered by `instrument`, then `quote_instrument`.

- [ ] **Step 1: Write the failing test `TestLatestPricesS17S64`:** define MXRF11; `RecordPrices` USD/BRL `5.4950` `bcb_ptax` on 2026-10-30 and `5.4000` `bcb_ptax` on 2026-10-20; manual USD/BRL `5.5000` on 2026-10-30; manual MXRF11/BRL `9.36` on 2026-10-29 and `9.50` on 2026-11-03. `GET /api/v1/prices/latest?date=2026-11-01` → `[{MXRF11, BRL, 2026-10-29, "9.36", manual}, {USD, BRL, 2026-10-30, "5.5", manual}]`; `date=2026-10-25` → `[{USD, BRL, 2026-10-20, "5.4", bcb_ptax}]`; no `date` → 400 `invalid_request` field `date`; a second user receives the same body.
- [ ] **Step 2: Run** `go test ./internal/marketdata/ -run TestLatestPricesS17S64 -count=1` → FAIL (404).
- [ ] **Step 3: Query.** `-- name: LatestChosenPrices :many` `SELECT DISTINCT ON (instrument, quote_instrument) * FROM marketdata_price WHERE date <= @date ORDER BY instrument, quote_instrument, date DESC, priority, recorded_at DESC;` `make gen`.
- [ ] **Step 4: Implement** `LatestPrices` (rows through `toPrice`) and handler `ListLatestPrices` (`toPriceAPI`).
- [ ] **Step 5: Run** → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(marketdata): list the latest chosen price of every pair"`.

### Task 3: B3, `GET /price-feeds`

**Files:**
- Modify: `api/openapi.yaml` (path `/price-feeds` `get`, `operationId: listPriceFeeds`; `PriceFeedList { items: PriceFeed[] }`, `PriceFeed { source: bcb_ptax|b3_cotahist, enabled: boolean, latest_date?: date }`)
- Modify: `internal/marketdata/feeds.go`, `internal/marketdata/internal/adapter/httpapi/{server.go,prices.go}`
- Test: `internal/marketdata/feeds_test.go`

**Interfaces:**
- Produces: `marketdata.FeedStatus { Source string; Enabled bool; Latest *time.Time }`; `(*Module).FeedStatus(ctx context.Context) ([]FeedStatus, error)` from `m.feeds.PTAX`, `m.feeds.COTAHIST` and `LatestSourceDate` with a null instrument; order `bcb_ptax`, `b3_cotahist`.

- [ ] **Step 1: Write the failing test `TestPriceFeedStatus`:** harness with `apitest.PriceFeeds(true, false, <ptax test server URL>, "")` (the test server of the existing feed tests in this file); `RecordPrices` one `bcb_ptax` price on 2026-10-30 → `GET /api/v1/price-feeds` → `[{source: "bcb_ptax", enabled: true, latest_date: "2026-10-30"}, {source: "b3_cotahist", enabled: false}]` with no `latest_date` key on the second; a harness without the option → both `enabled: false`, no `latest_date`; a second user receives the same body.
- [ ] **Step 2: Run** `go test ./internal/marketdata/ -run TestPriceFeedStatus -count=1` → FAIL.
- [ ] **Step 3: Contract** and `make gen`. **Step 4: Implement** `FeedStatus` and handler `ListPriceFeeds`.
- [ ] **Step 5: Run** → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(marketdata): report the status of the price feeds"`.

### Task 4: B4, `GET /reports/net-worth`

**Files:**
- Modify: `api/openapi.yaml` (path `/reports/net-worth` `get`, tag `reporting`, `operationId: getNetWorth`, `from`/`to` pattern `^\d{4}-(0[1-9]|1[0-2])$`; `NetWorthSeries { items: NetWorthPoint[] }` `maxItems: 120`; `NetWorthPoint { date, assets: Money, liabilities: Money, net_worth: Money, missing: string[] }`, all required)
- Create: `db/queries/reporting/net_worth.sql`, `internal/reporting/internal/app/net_worth.go`, `internal/reporting/valuer.go`
- Modify: `internal/reporting/reporting.go` (`New` gains `prices *marketdata.Module`), `internal/reporting/internal/adapter/postgres/repository.go`, `internal/reporting/internal/adapter/httpapi/{server.go,convert.go}`, `internal/server/server.go:80`
- Test: `internal/reporting/net_worth_test.go`, `internal/reporting/net_worth_bench_test.go`

**Interfaces:**
- Produces: `app.Valuer interface { Value(ctx context.Context, units int64, instrument, in money.Currency, date time.Time) (value int64, ok bool, err error) }`; `valuer` in `valuer.go` builds the amount with the instrument scale from `marketdata.Module.Instrument` (as `AmountOf` in `internal/ledger/internal/app/instrument.go`), calls `Convert`, and maps `marketdata.ErrPriceMissing` to `ok == false`.
- Produces: `app.NetWorthPoint { Date time.Time; Assets, Liabilities, NetWorth money.Money; Missing []money.Currency }`; `(*Service).NetWorth(ctx context.Context, userID int64, from, to string) ([]NetWorthPoint, error)`; field errors `from` (after `to`), `to` (above 120 months or after the current month). Point dates: last day of each month; today for the current month.

- [ ] **Step 1: Write the failing test `TestNetWorthS17`** (`apitest.Today("2026-11-01")`): Nubank checking with `h.Record("2026-10-01", Posting(checking, 1000000), Posting(salary, -1000000))`; Wise USD; the S17 exchange of 2026-10-14; Loan (`liability`, `loan`) with `h.Record("2026-10-02", Posting(checking, 100000), Posting(loan, -100000))`; USD/BRL `bcb_ptax` 5.4950 and manual 5.5000 on 2026-10-30; `h.Dispatch()`. `GET /api/v1/reports/net-worth?from=2026-10&to=2026-11` → two points: `{date: "2026-10-31", assets: 1098700 BRL, liabilities: 100000, net_worth: 998700, missing: []}` (checking 548700 + Wise 550000) and the same figures on `"2026-11-01"`. Rows: **no USD price** (fresh harness, same postings) → assets 548700, `missing: ["USD"]`; `from=2026-11&to=2026-10` → 400 field `from`; `from=2016-10&to=2026-10` (121 months) → 400 field `to`; `from=2016-11&to=2026-10` → 200 with 120 items; `to=2026-12` → 400 field `to`; another user → every point has assets 0 and liabilities 0.
- [ ] **Step 2: Run** `go test ./internal/reporting/ -run TestNetWorthS17 -count=1` → FAIL (404).
- [ ] **Step 3: Queries** (`make gen` after):

```sql
-- name: MonthEndBalances :many
SELECT m.date::date AS date, a.account_class, a.instrument, sum(coalesce(last.balance_booked, 0))::bigint AS total
FROM unnest(@dates::date[]) AS m(date)
CROSS JOIN ledger_account a
LEFT JOIN LATERAL (
    SELECT r.balance_booked FROM reporting_account_day r
    WHERE r.user_id = @user_id AND r.account_id = a.id AND r.date <= m.date
    ORDER BY r.date DESC LIMIT 1
) last ON true
WHERE a.user_id = @user_id AND a.account_class IN ('asset', 'liability')
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
```

plus `-- name: BaseCurrency :one` reading `base_currency` of the ledger settings table of `db/migrations/00004_ledger.sql` for `@user_id`.
- [ ] **Step 4: Implement** `NetWorth` (rows in the base currency add their total; others go through `Valuer.Value`; `ok == false` adds the instrument to `missing`), the handler `GetNetWorth`, and the wiring.
- [ ] **Step 5: Benchmark** `BenchmarkNetWorth12Months` (N05): seed the reference dataset as `BenchmarkRebuildAll` does, run `RebuildAll`, then time `app.Service.NetWorth` for `2025-11`…`2026-10` per iteration and report `b.ReportMetric(p95, "p95-ms")`. Run `go test ./internal/reporting/ -run '^$' -bench BenchmarkNetWorth12Months -benchtime 50x` → `p95-ms` below 200; the commit body records the value.
- [ ] **Step 6: Run** the test → PASS; `make check` → exit 0.
- [ ] **Step 7: Commit** `git commit -m "feat(reporting): add the monthly net worth series"`.

### Task 5: B5, `GET /reports/categories`

**Files:**
- Modify: `api/openapi.yaml` (path `/reports/categories` `get`, tag `reporting`, `operationId: getCategoryReport`, summary "Category totals per month, accrual view (transaction date)."; `CategoryReport { months: string[], items: CategoryReportItem[] }`, `CategoryReportItem { category_id: uuid, class: income|expense, totals: Money[] }`)
- Create: `db/queries/reporting/category_report.sql`, `internal/reporting/internal/app/category_report.go`
- Modify: `internal/reporting/internal/adapter/postgres/repository.go`, `internal/reporting/internal/adapter/httpapi/{server.go,convert.go}`
- Test: `internal/reporting/category_report_test.go`

**Interfaces:**
- Produces: `app.CategoryRow { CategoryID uuid.UUID; Class string; Totals []money.Money }`; `(*Service).CategoryReport(ctx context.Context, userID int64, from, to string) (months []string, rows []CategoryRow, err error)`; field errors `from` (after `to`), `to` (above 24 months). Expense totals = sum of weights; income totals = negated sum.

- [ ] **Step 1: Write the failing test `TestCategoryReportS30S22`** (`apitest.Today("2026-11-01")`): Itaú Visa through `h.Card("Itaú Visa", 3, 10, "next")`; Food, Supermarket (`parent_id` Food), Electronics; card purchase Supermarket 23000 on 2026-10-14; installment purchase Electronics 100000 in 3 on 2026-10-20. `GET /api/v1/reports/categories?from=2026-10&to=2026-11` → `months: ["2026-10","2026-11"]`; Supermarket `{class: "expense", totals: [23000, 0]}`; Electronics `[100000, 0]`; no Food item. **S22**: the income of `TestS22InvestmentIncome` (`internal/ledger/income_test.go:48`) adds Dividends `{class: "income", totals: [1000, 0]}` and JCP `[4500, 0]`. Voiding the Supermarket purchase removes its item. `from=2026-11&to=2026-10` → 400 field `from`; 25 months → 400 field `to`; another user → `items: []`.
- [ ] **Step 2: Run** `go test ./internal/reporting/ -run TestCategoryReportS30S22 -count=1` → FAIL.
- [ ] **Step 3: Query** (`make gen` after):

```sql
-- name: CategoryMonthTotals :many
SELECT p.account_id AS category_id, a.account_class, date_trunc('month', t.date)::date AS month, sum(p.weight)::bigint AS total
FROM ledger_posting p
JOIN ledger_transaction t ON t.id = p.transaction_id AND t.user_id = @user_id AND t.voided_at IS NULL
JOIN ledger_account a ON a.id = p.account_id AND a.user_id = @user_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.account_class IN ('income', 'expense')
  AND t.date >= @from_date AND t.date < @to_date
GROUP BY 1, 2, 3 ORDER BY 2, 1, 3;
```

- [ ] **Step 4: Implement** `CategoryReport` (base currency from `BaseCurrency`, zero-filled totals per month) and handler `GetCategoryReport`.
- [ ] **Step 5: Run** → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(reporting): add category totals per month"`.

### Task 6: Decimal arithmetic, quantity format, gains, price age and problem messages

**Files:**
- Create: `web/src/i18n/{decimal.ts,decimal.test.ts}`, `web/src/ui/{price-age.ts,price-age.test.ts}`, `web/src/features/investments/{gain.ts,gain.test.ts}`
- Modify: `web/src/i18n/{format.ts,format.test.ts,catalog.en.ts,catalog.pt-BR.ts}`, `web/src/features/planning/basis-points.ts` (re-export from `@/i18n/decimal`, then delete once planning imports the new path), planning importers of it

**Interfaces:**
- Produces in `decimal.ts`: `parseRate(text: string): string | null` (one `,` or `.` separator, no grouping, > 0, ≤ 12 decimals, canonical `.`); `formatRate(rate: string, locale: Locale, minFraction: number): string`; `multiplyRate(amount: number, scale: number, rate: string, targetScale: number): number`; `divideToRate(a: number, b: number, decimals: number): string` (`a` and `b` at the same scale, `b > 0`); `ratioBp(n: number, d: number): number | undefined`; `applyBp(amount: number, bp: number): number` (half to even of `amount × bp ÷ 10000`); `bpToPercent`, `formatBp` (moved, signatures unchanged).
- Produces in `format.ts`: `formatQuantity(money: Money, scale: number, locale: Locale): string`.
- Produces in `ui/price-age.ts`: `isOldPrice(priceDate: string, date: string): boolean` (more than 7 days before `date`).
- Produces in `gain.ts` (`Position = components["schemas"]["Position"]`): `gainOf(p: Position): { gain: Money; returnBp?: number } | undefined`; `portfolioTotals(ps: Position[]): { marketValue: Money; costBasis: Money; gain: Money }` over positions with `market_value`.
- Catalog: `problem.investment_transaction`, `problem.later_sale_exists`, `problem.instrument_exists`, `problem.currency_unsupported`, `problem.price_missing`, `problem.request_too_large` (the last two when absent) with the spec's en messages; pt-BR "Operações e proventos não podem ser corrigidos. Anule e registre novamente.", "Existe uma venda posterior deste ativo. Anule essa venda primeiro.", "Já existe um instrumento com este código.", "O instrumento desta conta não pode ser usado aqui.", "Nenhuma cotação registrada converte este valor.", "O arquivo é grande demais."; `common.estimated` "estimado", `prices.priceOf` "cotação de {date}", `prices.oldPrice` "Cotação antiga", `prices.noPrice` "Sem cotação".

- [ ] **Step 1: Write the failing tests.**
  - `decimal.test.ts`: `parseRate("5,4830")` → `"5.4830"`; `("10.05")` → `"10.05"`; `("0")`, `("-1")`, `("1.2.3")`, `("1.234,5")`, `("abc")`, 13 decimals → `null`. `multiplyRate(150, 0, "10.05", 2)` → `150750` (S21 gross 1,507.50); `(10000, 2, "5.4830", 2)` → `54830` (S16); `(999, 2, "5.5", 2)` → `5494` (54.945 → 54.94). `applyBp(54830, 350)` → `1919` (S16 IOF 19.19); `applyBp(4500, 1500)` → `675` (S22). `divideToRate(548300, 100000, 4)` → `"5.4830"` (S17); `(-1, 3, 2)` → `"-0.33"`. `ratioBp(-7227, 100827)` → `-717`; `(5, 0)` → `undefined`. `formatRate("5.5", "pt-BR", 4)` → `"5,5000"`; `("10.0827", "en", 2)` → `"10.0827"`; `("9.36", "pt-BR", 2)` → `"9,36"`.
  - `format.test.ts`: `formatQuantity({amount: 100, currency: "MXRF11"}, 0, "pt-BR")` → `"100"`; `({amount: 123456, ...}, 0, "en")` → `"123,456"`; `({amount: 50000000, currency: "BTC"}, 8, "pt-BR")` → `"0,5"`; same in `"en"` → `"0.5"`.
  - `price-age.test.ts`: `isOldPrice("2026-10-25", "2026-11-01")` → `false` (7 days); `("2026-10-24", "2026-11-01")` → `true` (8 days).
  - `gain.test.ts`: S64 position (quantity 100, cost 100827, market 93600) → gain `-7227`, `returnBp` `-717`; no `market_value` → `undefined`; **zero cost basis** (cost 0, market 5000) → gain `5000`, no `returnBp`; `portfolioTotals` of the S64 position plus an unpriced PETR4 (cost 30000) → market 93600, cost 100827, gain −7227.
  - Planning tests of `basis-points` move to `decimal.test.ts` unchanged.

```ts
// Half to even division; d > 0n.
function divHalfEven(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  const twice = 2n * (r < 0n ? -r : r);
  if (twice < d) return q;
  const away = n < 0n ? q - 1n : q + 1n;
  if (twice > d) return away;
  return q % 2n === 0n ? q : away;
}

export function multiplyRate(amount: number, scale: number, rate: string, targetScale: number): number {
  const [int, frac = ""] = rate.split(".");
  const product = BigInt(amount) * BigInt(int + frac);
  const exp = targetScale - scale - frac.length;
  return Number(exp >= 0 ? product * 10n ** BigInt(exp) : divHalfEven(product, 10n ** BigInt(-exp)));
}
```

  `divideToRate` = `divHalfEven(BigInt(a) * 10n ** BigInt(decimals), BigInt(b))` formatted with `decimals` places and a leading `-` for negatives; `ratioBp` = `divHalfEven(BigInt(n) * 10000n, BigInt(d))`; `applyBp` = `divHalfEven(BigInt(amount) * BigInt(bp), 10000n)`.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/i18n src/ui/price-age.test.ts src/features/investments/gain.test.ts src/features/planning` → FAIL.
- [ ] **Step 3: Implement** the functions and catalog entries; planning imports `bpToPercent`/`formatBp` from `@/i18n/decimal` and `basis-points.ts` with its test is removed.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add rate, quantity and gain arithmetic"`.

### Task 7: Prices data layer and `/prices`

**Files:**
- Create: `web/src/features/prices/{index.ts,api.ts,prices-page.tsx,prices-page.test.tsx,feed-status.tsx,instrument-rows.tsx}`, `web/src/ui/price-line.tsx`, `web/src/testing/investment-api.ts`
- Modify: `web/src/app/router.tsx`, `web/src/features/setup/settings-page.tsx` (section linking `/prices`), catalogs

**Interfaces:**
- Consumes: `formatRate`, `isOldPrice`, `formatDate`.
- Produces in `prices/api.ts`: `priceKeys = { all: ["prices"], instruments(type?), instrument(code), pair(code, quote, from, to), latest(date), feeds }` (spec Data table); `instrumentsQuery(api, type?)`, `instrumentQuery(api, code)`, `pricesQuery(api, code, quote, from, to)`, `latestPricesQuery(api, date)`, `priceFeedsQuery(api)`.
- Produces: `PriceLine({ price, date, minFraction }: { price: Price; date: string; minFraction: number })` renders `USD/BRL 5,5000 · cotação de 30/10/2026` and the warning `Tag` "Cotação antiga" when `isOldPrice(price.date, date)`.
- Produces in `testing/investment-api.ts`: ids `xpID`, `xpCashID`, `mxrf11ID`, `petr4ID`, `wiseID`, `dividendsID`, `jcpID`, `travelID`; `investmentAccounts` (accounts of 6.1 plus these); `instruments` (BRL scale 2, USD scale 2, MXRF11 `fii` scale 0, PETR4 `stock` scale 0); `s64Position` (quantity 100, `cost_basis` 100827, `average_cost` `"10.0827"`, `market_value` 93600, `prices: [MXRF11/BRL "9.36" 2026-10-29 manual]`); `investmentRoutes(over?)` = `sharedRoutes` + these routes.
- Produces: route `/_authed/prices` (search `{ type?: InstrumentType }`); `PricesPage` exported from `prices/index.ts`.

- [ ] **Step 1: Write the failing tests.**
  - Requests `GET /price-feeds` and `GET /prices/latest?date=2026-11-01`; feeds list `bcb_ptax` enabled with "30/10/2026" and `b3_cotahist` disabled.
  - Instrument rows: MXRF11 with rate `9,36` and "cotação de 29/10/2026"; USD with `5,5000`; an instrument without a latest price shows "Sem cotação"; a price of 2026-10-20 shows "Cotação antiga". Filter `type=fii` requests `GET /instruments?type=fii`. Rows link `/prices/MXRF11`.
  - Settings page shows a link to `/prices`.
  - Responsive 360/768/1280: at 360 feeds render as one line "Feeds: 1 ativo, última 30/10/2026" that expands, and each row has two lines (code and rate; name and price date); at 1280 a `Table`.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/prices/prices-page.test.tsx src/features/setup` → FAIL.
- [ ] **Step 3: Implement** (`Page`, `PageHeader` with actions define instrument, record price, import CSV, `Collapsible`, `Table`, `List`, `Tag`, `Select` for type, `Skeleton`, `QueryError`).
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the prices page with feed status"`.

### Task 8: Instrument definition

**Files:**
- Create: `web/src/features/prices/{instrument-form-page.tsx,instrument-form-page.test.tsx}`
- Modify: `prices/api.ts` (`useDefineInstrument`), `prices/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Produces: `useDefineInstrument()` → `POST /instruments`, `onSuccess` invalidates `["prices", "instruments"]` and navigates to `/prices/$code`; route `/_authed/prices/instruments/new`; draft `prices.instrument.new`.

- [ ] **Step 1: Write the failing tests.** V21 defaults: type `stock` → scale `0`, B3 switch on; `fixed_income` → `2`, switch hidden; `fund` → `6`; `crypto` → `8`; quote currency `BRL`. Code `mxrf11` renders `MXRF11` and posts `{"code":"MXRF11","type":"fii","scale":0,"name":"Maxi Renda","quote_currency":"BRL","exchange":"B3"}`; turning the switch off omits `exchange`. The instance-wide note (A59) renders. **`instrument_exists`** 409 renders its message. Responsive 360/768/1280: footer pinned at 360 (`data-pinned="true"`), inline at 1280.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/prices/instrument-form-page.test.tsx` → FAIL; implement (`Form`, `Select`, `NumberField`, `Switch`, `TextField`); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): define an instrument"`.

### Task 9: Price pair page and manual price

**Files:**
- Create: `web/src/features/prices/{pair-page.tsx,pair-page.test.tsx,pair-chart.tsx,pair-table.tsx,price-dialog.tsx}`
- Modify: `prices/api.ts` (`useRecordPrice`), `prices/index.ts`, `prices/prices-page.tsx` (record price action), `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `transactionMutated` from `@/features/transactions`, `parseRate`.
- Produces: `useRecordPrice()` → `POST /prices` `{ instrument, quote_instrument, date, value }`, `onSuccess` invalidates `priceKeys.all` and calls `transactionMutated(queryClient, [])`; `PriceDialog({ instrument?, open, onOpenChange })`; route `/_authed/prices/$code` (search `{ quote?: string; range?: "30d" | "90d" | "1y" }`).

- [ ] **Step 1: Write the failing tests.**
  - `/prices/MXRF11` requests `GET /instruments/MXRF11` and `GET /prices?instrument=MXRF11&quote_instrument=BRL&from=2026-08-03&to=2026-11-01` (90 days); range `1y` → `from=2025-11-01` (366 days inclusive); `30d` → `from=2026-10-02`. `/prices/USD` defaults quote to `BRL` (base currency). The table renders date, `9,36` and a `manual` tag; the chart receives one point per price.
  - Dialog: date `2026-11-01`, value `9,40` posts `{"instrument":"MXRF11","quote_instrument":"BRL","date":"2026-11-01","value":"9.40"}`; value `abc` shows a field error; the A60 note renders; after success the pair and `["prices","latest"]` queries refetch.
  - Responsive 360/768/1280: at 360 the chart is 200 px high and the dialog is a bottom `Drawer`; at 1280 a `Dialog`.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/prices/pair-page.test.tsx` → FAIL; implement (`chart` line, `SegmentedControl` for range, `Table`, `Dialog`/`Drawer`, `DatePicker`); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show price history and record a manual price"`.

### Task 10: CSV price import

**Files:**
- Create: `web/src/features/prices/{price-import-dialog.tsx,price-import-dialog.test.tsx}`
- Modify: `prices/api.ts` (`useImportPrices`), `prices/prices-page.tsx`, catalogs

**Interfaces:**
- Produces: `useImportPrices()` → multipart `POST /prices/import` field `file`; `onSuccess` as `useRecordPrice`.

- [ ] **Step 1: Write the failing tests.** A 120-byte `precos.csv` posts multipart with field `file`; 200 `{recorded: 3}` shows the toast "3 cotações registradas"; a 422 `errors: [{ field: "line 4", message: "unknown instrument" }]` renders the form-level message "Linha 4: unknown instrument"; a file of 10 MiB + 1 byte is rejected client-side with `problem.request_too_large` and `fetch.calls` holds no import; a 413 renders the same message. Responsive 360/768/1280: bottom `Drawer` at 360, `Dialog` at 1280.
- [ ] **Step 2–4:** Run → FAIL; implement (`upload` family, `Toast`, `InlineMessage`); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): import prices from a CSV file"`.

### Task 11: Investments data layer, overview, navigation and redirects

**Files:**
- Create: `web/src/features/investments/{index.ts,api.ts,investments-page.tsx,investments-page.test.tsx,portfolio-stats.tsx,brokerage-section.tsx,holding-row.tsx}`
- Modify: `web/src/app/router.tsx`, `web/src/app/shell/destinations.tsx` (side navigation and More sheet), catalogs

**Interfaces:**
- Consumes: `accountsQuery`, `balancesQuery` from `@/features/accounts`; `transactionKeys`; `latestPricesQuery`; `gainOf`, `portfolioTotals`, `formatQuantity`, `formatRate`, `PriceLine`.
- Produces in `investments/api.ts`: `investmentKeys = { all: [...transactionKeys.all, "investments"], positions(date), realized(year), income(year) }`; `positionsQuery(api, date)`, `realizedQuery(api, year)`, `incomeEventsQuery(api, year)` with the V30 options.
- Produces: route `/_authed/investments` (search `{ date?: string; brokerage?: string }`); `InvestmentsPage`. `accounts/$id` `beforeLoad` (V3): kind `brokerage` without `parent_id` → `redirect({ to: "/investments", search: { brokerage: id } })`; kind `brokerage` with `parent_id` whose instrument type is not `currency` → `redirect({ to: "/investments/$accountId", params: { accountId: id } })`.

- [ ] **Step 1: Write the failing tests.**
  - **S64**: requests `GET /positions?date=2026-11-01`; the XP section row MXRF11 renders quantity `100`, average cost `10,0827`, price `9,36` with "cotação de 29/10/2026", market value `R$ 936,00`, cost basis `R$ 1.008,27`, gain `-R$ 72,27` in the neutral tone and `-7,17%`; XP cash renders its balance from `GET /balances?date=2026-11-01`.
  - **excludes unpriced positions from the totals**: S64 plus PETR4 (cost 30000, no `market_value`) → stat-cards market value `R$ 936,00`, cost basis `R$ 1.008,27`, gain `-R$ 72,27`; the PETR4 row shows "Sem cotação" linking `/prices/PETR4`.
  - A position with quantity 0 sits in the collapsed "Encerradas" section; `?brokerage=<xpID>` renders only XP; `?date=2026-10-15` requests `positions?date=2026-10-15`; a price older than 7 days before the overview date shows "Cotação antiga".
  - Router: `/accounts/<xpID>` → `/investments?brokerage=<xpID>`; `/accounts/<mxrf11ID>` → `/investments/<mxrf11ID>`; `/accounts/<xpCashID>` stays; `/investments` and `/investments/results` mark the Investments side-navigation destination active; the bottom bar holds five controls.
  - Responsive 360/768/1280: at 360 the stat-cards sit in one row container, the date-picker sits in the "Ações de investimentos" action-sheet with prices and results, each row has two lines (code and market value; quantity × price and gain), brokerage sections are collapsible; at 1280 rows render in a `Table`.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/investments/investments-page.test.tsx src/app` → FAIL.
- [ ] **Step 3: Implement** (`Page` `wide`, `StatCard`, `Section`, `Collapsible`, `Table`, `List`, `Tag`, `DatePicker`, `ActionSheet`).
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the investments overview"`.

### Task 12: New brokerage and new holding

**Files:**
- Create: `web/src/features/investments/{brokerage-dialog.tsx,holding-dialog.tsx,account-dialogs.test.tsx}`
- Modify: `investments/investments-page.tsx`, `investments/brokerage-section.tsx`, catalogs

**Interfaces:**
- Consumes: `useCreateAccount` from `@/features/accounts` (export added when absent), `instrumentsQuery`.
- Produces: `BrokerageDialog`, `HoldingDialog({ brokerage })`; both invalidate the foundation accounts keys.

- [ ] **Step 1: Write the failing tests.**
  - V9: name `Rico` and institution post first `{"name":"Rico","class":"asset","kind":"brokerage","currency":"BRL","institution_id":"<id>"}`, then `{"name":"Rico cash","class":"asset","kind":"brokerage","currency":"BRL","parent_id":"<new id>","institution_id":"<id>"}`; a name of 121 characters disables submit; a 422 on the second call shows the problem and the retry posts only the child.
  - V10: the picker lists MXRF11 and PETR4 (non-currency, `quote_currency` `BRL`) and a "Definir instrumento" link to `/prices/instruments/new`; choosing MXRF11 posts `{"name":"MXRF11","class":"asset","kind":"brokerage","currency":"MXRF11","parent_id":"<xpID>"}` and navigates to `/investments/trade?account_id=<new id>&side=buy`.
  - Responsive 360/768/1280: bottom `Drawer`s at 360, `Dialog`s at 1280.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): create brokerages and holdings"`.

### Task 13: Trade form

**Files:**
- Create: `web/src/features/investments/{trade-form-page.tsx,trade-form-page.test.tsx,trade-preview.tsx}`
- Modify: `investments/api.ts` (`useRecordTrade`), `investments/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `multiplyRate`, `parseRate`, `parseAmount`, `positionsQuery`, `instrumentQuery`, `AmountField` from `@/features/transactions`.
- Produces: `useRecordTrade()` → `POST /trades` `{ account_id, cash_account_id, side, date, quantity, unit_price, fees?, taxes?, taxes_category_id?, description? }`, `onSuccess` → `transactionMutated(queryClient, [account_id, cash_account_id])` and navigation to `/transactions/$id`; route `/_authed/investments/trade` (search `{ account_id?: string; side?: "buy" | "sell" }`); draft `investments.trade.new`. Preview: gross = `multiplyRate(quantity, scale, unit_price, 2)`; cash = −(gross + fees) for buy, gross − fees − taxes for sell.

- [ ] **Step 1: Write the failing tests.**
  - **S21 buy** (`today` 2026-10-05): `?account_id=<mxrf11ID>&side=buy` preselects XP and XP cash; quantity `150`, unit price `10,05`, fees `4,90` → preview "estimado" gross `R$ 1.507,50`, cash `-R$ 1.512,40`; submit posts exactly `{"account_id":"<mxrf11ID>","cash_account_id":"<xpCashID>","side":"buy","date":"2026-10-05","quantity":{"amount":150,"currency":"MXRF11"},"unit_price":"10.05","fees":{"amount":490,"currency":"BRL"}}`; taxes fields are absent for buy. Navigating back to `/investments` refetches positions and renders quantity `150` from the second response.
  - **S21 sell** (`today` 2026-10-20): held quantity `150` from `positions?date=2026-10-20`; "Vender tudo" fills `150`; quantity `50`, price `10,80`, fees `2,10` → cash `R$ 537,90`; taxes and taxes category render.
  - **rejects decimals beyond the scale**: quantity `1,5` for MXRF11 shows a field error and `fetch.calls` holds no `POST /trades`.
  - A 422 `errors: [{ field: "quantity" }]` attaches to quantity; **`currency_unsupported`** with field `cash_account_id` attaches to the cash account select; **`later_sale_exists`** 409 renders its message.
  - Responsive 360/768/1280: at 360 side is a full-width `SegmentedControl` first in the form, quantity has `inputmode="numeric"` (scale 0; `decimal` for scale 8), the preview sits in the pinned footer above submit; at 1280 the preview is inline.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/investments/trade-form-page.test.tsx` → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): record a buy or a sell"`.

### Task 14: Investment income form

**Files:**
- Create: `web/src/features/investments/{income-form-page.tsx,income-form-page.test.tsx,income-preview.tsx}`
- Modify: `investments/api.ts` (`useRecordIncome`), `investments/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Produces: `useRecordIncome()` → `POST /investment-income` `{ account_id, cash_account_id, income_type, date, gross, withheld?, category_id, withheld_category_id?, description? }`, `onSuccess` as `useRecordTrade`; route `/_authed/investments/income` (search `{ account_id?: string }`); draft `investments.income.new`; localStorage `investments.income-category.<type>` holds the last category id (reads and writes in `try`/`catch`). Preview withheld: entered value, else `applyBp(gross, 1500)` for `jcp` and 0 otherwise; net = gross − withheld.

- [ ] **Step 1: Write the failing tests.**
  - **S22 dividend** (`today` 2026-10-26): type Dividendo, gross `10,00`, category Dividends → body `{"account_id":"<mxrf11ID>","cash_account_id":"<xpCashID>","income_type":"dividend","date":"2026-10-26","gross":{"amount":1000,"currency":"BRL"},"category_id":"<dividendsID>"}`; the stored category for `dividend` equals `dividendsID` and a remount preselects it.
  - **S22 JCP**: gross `45,00`, category JCP, withheld empty → body has no `withheld` key; preview withheld `R$ 6,75`, net `R$ 38,25` labelled "estimado".
  - **`currency_unsupported`** with field `account_id` attaches to the holding select.
  - Responsive 360/768/1280: type `SegmentedControl` full width at 360, preview in the pinned footer; inline at 1280.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): record investment income"`.

### Task 15: Holding detail

**Files:**
- Create: `web/src/features/investments/{holding-page.tsx,holding-page.test.tsx,holding-chart.tsx,holding-history.tsx}`
- Modify: `investments/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `positionsQuery`, `pricesQuery`, `transactionsQuery` (infinite, `account_id`) from `@/features/transactions` (export added when absent).
- Produces: route `/_authed/investments/$accountId`; `HoldingPage`.

- [ ] **Step 1: Write the failing tests.**
  - S64 description-list: quantity `100`, cost basis `R$ 1.008,27`, average cost `10,0827`, price `9,36` with its price line, market value `R$ 936,00`, gain `-R$ 72,27`, return `-7,17%`.
  - Chart: requests `GET /prices?instrument=MXRF11&quote_instrument=BRL&from=2025-11-01&to=2026-11-01`; two series, the second constant at `10.0827` (V25); no client multiplication of positions.
  - History: buy row with tag "Compra", quantity `150`, unit price `10,05`, cash `-R$ 1.512,40`; income row with tag "Dividendo"; rows link `/transactions/<id>`; a second page loads through `next_cursor`.
  - Responsive 360/768/1280: at 360 the chart is 200 px, buy/sell/income sit in a sticky footer of three buttons, history rows have two lines (date and cash; tag and quantity); at 1280 actions are page-header buttons.
- [ ] **Step 2–4:** Run → FAIL; implement (`DescriptionList`, `chart`, `List`, `ActionBar`); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show a holding with its price chart and history"`.

### Task 16: Investment transaction panel and record again

**Files:**
- Create: `web/src/features/investments/{investment-transaction-panel.tsx,investment-transaction-panel.test.tsx}`
- Modify: `web/src/features/transactions/transaction-page.tsx` (Correct hidden when `trade` or `investment_income` is present), `web/src/app/transaction-route.tsx` (append `InvestmentTransactionPanel`), `investments/trade-form-page.tsx`, `investments/income-form-page.tsx` (search `rerecord?: string`), `investments/index.ts`, catalogs

**Interfaces:**
- Consumes: `useVoidTransaction` and `VoidDialog` from `@/features/transactions` (exports added when absent).
- Produces: `InvestmentTransactionPanel({ transaction })` renders nothing without `trade` and `investment_income`; "Anular e registrar novamente" opens the void dialog, then navigates to `/investments/trade?rerecord=<id>` or `/investments/income?rerecord=<id>`, which prefill from the voided detail under draft `investments.rerecord.<id>`.

- [ ] **Step 1: Write the failing tests.**
  - **S21 detail**: a sale with `trade` renders side "Venda", quantity `50`, unit price `10,80`, gross `R$ 540,00`, fees `R$ 2,10`, cost `R$ 504,13`; Correct is absent; a plain transaction still shows Correct.
  - Income detail renders type, gross `R$ 45,00`, withheld `R$ 6,75`.
  - Record again: void posts `POST /transactions/<id>/void`; the trade form then shows quantity `50`, price `10,80`, fees `2,10`; the draft key `investments.rerecord.<id>` exists in `sessionStorage`.
  - **`investment_transaction`** 409 on `correctTransaction` (`/transactions/<id>/correct` opened directly) renders its message; **`later_sale_exists`** 409 on void renders its message.
  - Responsive 360/768/1280: the void dialog is a bottom `Drawer` at 360, a `Dialog` at 1280.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/investments/investment-transaction-panel.test.tsx src/features/transactions/transaction-page.test.tsx` → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show trade and income details and record them again"`.

### Task 17: Results

**Files:**
- Create: `web/src/features/investments/{results-page.tsx,results-page.test.tsx,realized-list.tsx,income-event-list.tsx}`
- Modify: `investments/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `realizedQuery`, `incomeEventsQuery`.
- Produces: route `/_authed/investments/results` (search `{ year?: number; tab?: "realized" | "income" }`, default the year of `today`, `realized`).

- [ ] **Step 1: Write the failing tests.**
  - **S64 results**: `GET /realized-results?year=2026`; group "outubro de 2026" with the sale result `R$ 33,77`, month total `R$ 33,77` and the `tax_class` tag; the row links `/transactions/<sale id>`.
  - **S65**: tab `income` requests `GET /income-events?year=2026`; group `exempt` lists the dividend `R$ 10,00` withheld `R$ 0,00`; group `exclusive` the JCP `R$ 45,00` withheld `R$ 6,75`; group totals render gross and withheld.
  - Changing year to 2025 updates `?year=2025` and the request.
  - Responsive 360/768/1280: at 360 tabs are a `SegmentedControl` and month headers are sticky; at 1280 `Tabs`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show realized results and income events"`.

### Task 18: Currency exchange

**Files:**
- Create: `web/src/features/currencies/{index.ts,api.ts,exchange-form-page.tsx,exchange-form-page.test.tsx}`
- Modify: `web/src/app/router.tsx`, `web/src/features/transactions/new-transaction-page.tsx` ("Mais tipos" menu with typed links), `web/src/features/accounts/account-page.tsx` (Exchange action for a non-base currency account), catalogs

**Interfaces:**
- Consumes: `divideToRate`, `AmountField`, `accountsQuery`.
- Produces: `currencyInstrumentsQuery(api)` in `currencies/api.ts` → `GET /instruments?type=currency` under key `["prices", "instruments", "currency"]` (equal to `priceKeys.instruments("currency")`, so price invalidation applies; `@/features/prices` is not imported). `useExchangeCurrency()` → `POST /exchanges` `{ from_account_id, to_account_id, date, from_amount, to_amount, fee? }`, `onSuccess` → `transactionMutated(queryClient, [from, to])` and navigation to `/transactions/$id`; route `/_authed/transactions/new/exchange` (search `{ account_id?: string }`); draft `currencies.exchange.new`.

- [ ] **Step 1: Write the failing tests.**
  - **S17** (`today` 2026-10-14): from Nubank checking, to Wise USD, amounts `5.483,00` and `1.000,00`, fee `30,00` → implied rate `5,4830` live; body exactly `{"from_account_id":"<checkingID>","to_account_id":"<wiseID>","date":"2026-10-14","from_amount":{"amount":548300,"currency":"BRL"},"to_amount":{"amount":100000,"currency":"USD"},"fee":{"amount":3000,"currency":"BRL"}}`.
  - The to picker excludes accounts in the same currency as from and pairs without the base currency (A67); **`currency_unsupported`** with field `to_account_id` attaches there.
  - Entry points: `/transactions/new` "Mais tipos" links `/transactions/new/exchange` and `/transactions/new/foreign-purchase`; `/accounts/<wiseID>` shows "Câmbio" linking `/transactions/new/exchange?account_id=<wiseID>`; `/accounts/<checkingID>` does not.
  - Responsive 360/768/1280: implied rate in the pinned footer at 360; inline at 1280.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS together with `src/features/transactions/new-transaction-page.test.tsx` and `src/features/accounts/account-page.test.tsx`; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): record a currency exchange"`.

### Task 19: Foreign purchase

**Files:**
- Create: `web/src/features/currencies/{foreign-purchase-form-page.tsx,foreign-purchase-form-page.test.tsx}`
- Modify: `currencies/api.ts`, `currencies/index.ts`, `web/src/app/router.tsx`, `web/src/features/cards/card-overview-page.tsx` ("Compra no exterior" typed link), catalogs

**Interfaces:**
- Consumes: `multiplyRate`, `parseRate`, `applyBp`, `currencyInstrumentsQuery` (Task 18). `@/features/cards` is not imported: the statement `Select` (C15) reads `GET /accounts/{id}/statements` through `cardStatementsQuery(api, accountId)` in `currencies/api.ts` under `[...transactionKeys.all, "currencies", "statements", accountId]`.
- Produces: `useRecordForeignPurchase()` → `POST /foreign-purchases` `{ account_id, category_id, date, original, rate, iof_rate_bp?, statement?, description? }`; route `/_authed/transactions/new/foreign-purchase` (search `{ account_id?: string }`); draft `currencies.foreign-purchase.new`. Preview: amount = `multiplyRate(original, scale, rate, 2)`; IOF = `applyBp(amount, iof_bp)` with 350 bp default; total = amount + IOF.

- [ ] **Step 1: Write the failing tests.**
  - **S16** (`today` 2026-10-22, `cardRoutes()`): Itaú Visa, Travel, original `100,00` USD, rate `5,4830`, statement `2026-11` → preview `R$ 548,30`, IOF `R$ 19,19`, total `R$ 567,49` ("estimado"); body exactly `{"account_id":"<cardID>","category_id":"<travelID>","date":"2026-10-22","original":{"amount":10000,"currency":"USD"},"rate":"5.4830","statement":"2026-11"}` with no `iof_rate_bp`; IOF changed to `6,38` posts `"iof_rate_bp":638`.
  - A checking account hides the statement select and posts no `statement`; **`currency_unsupported`** with field `account_id` attaches to the account picker; `/cards/<cardID>` links `/transactions/new/foreign-purchase?account_id=<cardID>`.
  - Responsive 360/768/1280: preview in the pinned footer at 360; inline at 1280.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS together with `src/features/cards/card-overview-page.test.tsx`; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): record a foreign purchase"`.

### Task 20: Currency panel and correction of foreign amounts

**Files:**
- Create: `web/src/features/currencies/{currency-panel.tsx,currency-panel.test.tsx}`
- Modify: `web/src/app/transaction-route.tsx` (append `CurrencyPanel`), `web/src/features/transactions/{postings-editor.tsx,correct-transaction-form.tsx}` (read-only `original` and `weight`), `currencies/index.ts`, catalogs

**Interfaces:**
- Produces: `CurrencyPanel({ transaction })` renders when a posting carries `original` or postings use two currencies: original amount, rate (`divideToRate(weight, original, 4)` when no `rate` is stored), and per-posting weights; nothing otherwise. The postings editor shows `original` and `weight` as text and resubmits them unchanged.

- [ ] **Step 1: Write the failing tests.**
  - **S16 panel**: a card posting with `original: {amount: 10000, currency: "USD"}` and weight 54830 renders `US$ 100,00` at `5,4830`.
  - S17 exchange (BRL and USD postings) renders weights `R$ 5.483,00` for the Wise posting.
  - Correction: opening Correct on the S16 transaction opens Advanced postings with `original` and `weight` read-only; saving with a new description posts postings whose `original` and `weight` equal the stored ones.
  - A single-currency transaction renders no panel.
  - Responsive 360/768/1280: panel rows render as a two-line `List` at 360, a `DescriptionList` at 1280.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/currencies/currency-panel.test.tsx src/features/transactions` → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show foreign amounts and keep them on correction"`.

### Task 21: Home and account valuation

**Files:**
- Modify: `web/src/features/accounts/{api.ts,balance-groups.ts,balance-groups.test.ts,balances.tsx,home-page.tsx,home-page.test.tsx,account-page.tsx,account-page.test.tsx}`, catalogs

**Interfaces:**
- Consumes: B1, `PriceLine`.
- Produces: `balancesQuery(api, date, basis, valueIn?)` adds `value_in` and its key segment; `groupBalances` reads `value` for items whose currency differs from the base, keeps items without `value` in `excluded`, and adds group `investments` (order `available`, `reserves`, `investments`, `cards`, `loans`) with one item per brokerage parent summing its children's `value`; `balanceQuery(api, id, date, basis, valueIn?)`.

- [ ] **Step 1: Write the failing tests.**
  - `balance-groups.test.ts`: Wise USD with `value` 550000 adds 550000 to `available`; an item without `value` raises `excluded` to 1; XP children (cash 48760, MXRF11 `value` 93600) yield one `investments` item XP with 142360 and no child items.
  - **S17 Home**: requests `GET /balances?date=2026-11-01&value_in=BRL`; Wise USD renders `US$ 1.000,00` on the first line and `≈ R$ 5.500,00` with "cotação de 30/10/2026" on the second; the available total includes 550000. The XP row opens `/investments?brokerage=<xpID>`.
  - V20: `/accounts/<wiseID>` requests `balance?date=2026-11-01&value_in=BRL` and renders `≈ R$ 5.500,00` with the price line; **`price_missing`** 422 renders its message in place of the valued line.
  - Responsive 360/768/1280: the two-line row holds at all widths; the investments group sits between reserves and cards in DOM order.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/accounts` → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): value foreign and security balances on home"`.

### Task 22: Price lines on planning cards

**Files:**
- Modify: `web/src/features/planning/{committed-cards.tsx,goal-card.tsx,planning-page.test.tsx,goals-page.test.tsx}`

**Interfaces:**
- Consumes: `PriceLine` (`minFraction` 4 for currency pairs).

- [ ] **Step 1: Write the failing tests.**
  - **S66**: the planning overview committed card for 2026-12 renders `R$ 54,94` and `USD/BRL 5,5000 · cotação de 30/10/2026`.
  - **S67**: goal card "Trip" renders current `US$ 1.500,00`, remaining `US$ 500,00`, `75,00%` and the same price line.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/planning` → FAIL (the "avaliado a" lines differ); replace them with `PriceLine`; run → PASS; `make web-check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show price lines on committed and goal cards"`.

### Task 23: Reports data layer, hub, navigation and net worth

**Files:**
- Create: `web/src/features/reports/{index.ts,api.ts,report-period.ts,report-period.test.ts,period-picker.tsx,reports-page.tsx,reports-page.test.tsx,net-worth-page.tsx,net-worth-page.test.tsx}`, `web/src/testing/report-api.ts`
- Modify: `web/src/app/router.tsx`, `web/src/app/shell/destinations.tsx`, catalogs

**Interfaces:**
- Produces in `reports/api.ts`: `reportKeys = { all: [...transactionKeys.all, "reports"], netWorth(from, to), categories(from, to) }`; `netWorthQuery(api, from, to)` (V30 options), `categoryReportQuery(api, from, to)`.
- Produces in `report-period.ts`: `type Preset = "month" | "3m" | "6m" | "12m" | "ytd"`; `presetRange(preset: Preset, today: string): { from: string; to: string }`; `normalizePeriod(search: { from?: string; to?: string }, fallback: Preset, today: string, max: number): { from: string; to: string }`; `monthsOf(from: string, to: string): string[]`.
- Produces in `testing/report-api.ts`: category accounts Food, Supermarket (`parent_id` Food), Electronics, Salary, Dividends; `netWorthPoint(date, net)`; `reportRoutes(over?)`.
- Produces: routes `/_authed/reports`, `/_authed/reports/net-worth` (search `{ from?: string; to?: string }`, validated by `normalizePeriod` with fallback `12m`, max 120).

- [ ] **Step 1: Write the failing tests.**
  - `report-period.test.ts`: `presetRange("3m", "2026-11-01")` → `{from: "2026-09", to: "2026-11"}`; `"ytd"` → `2026-01`…`2026-11`; `"month"` → `2026-11`…`2026-11`; **normalizes an invalid period**: `{from: "2026-11", to: "2026-10"}`, `{from: "2026-13"}` and a 25-month range with max 24 → the fallback range; `monthsOf("2026-10", "2026-11")` → `["2026-10", "2026-11"]`.
  - Hub: stat-cards net worth (last B4 point) and income, expense and net of 2026-11 from `GET /reports/categories?from=2026-11&to=2026-11`; sparkline over `net-worth?from=2025-12&to=2026-11`; links to the three reports.
  - Net worth: `?from=2026-10&to=2026-11` requests that range; the table renders assets, liabilities and net per point; a point with `missing: ["USD"]` shows a warning marker and a link to `/prices/USD`; `/reports/net-worth?from=2026-11&to=2026-10` requests `from=2025-12&to=2026-11`.
  - Navigation: `/reports` and `/reports/net-worth` mark the Reports side-navigation destination active; the bottom bar holds five controls.
  - Responsive 360/768/1280: at 360 presets render as a horizontally scrolling tag row under the page header and charts are 200 px; at 1280 a `SegmentedControl` of presets.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/reports src/app` → FAIL; implement (`chart` line and sparkline, `StatCard`, `Table`, `Select` for custom months); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the reports hub and the net worth report"`.

### Task 24: Category report

**Files:**
- Create: `web/src/features/reports/{category-rollup.ts,category-rollup.test.ts,category-report-page.tsx,category-report-page.test.tsx,category-rows.tsx}`
- Modify: `reports/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Produces: `rollUp(categories: Account[], items: CategoryReportItem[], cls: "income" | "expense"): RollupRow[]` with `RollupRow { id: string; name: string; totals: number[]; total: number; own?: number[]; children: RollupRow[] }`, rows sorted by name, ancestors without postings created from `parent_id`; route `/_authed/reports/categories` (search `{ from?, to?, class?: "expense" | "income" }`, fallback `month`, max 24).

- [ ] **Step 1: Write the failing tests.**
  - `category-rollup.test.ts`: S30 items → root Food totals `[23000, 0]` with child Supermarket `[23000, 0]`, root Electronics `[100000, 0]`; **parent with own postings**: Food own `[500, 0]` plus Supermarket `[23000, 0]` → Food `[23500, 0]`, `own` `[500, 0]`; class `income` keeps only income items.
  - **S30**: `/reports/categories?from=2026-10&to=2026-11&class=expense` renders Food `R$ 230,00` (expanding shows Supermarket `R$ 230,00`) and Electronics `R$ 1.000,00` in outubro and nothing in novembro; the totals row per month renders `R$ 1.230,00` and `R$ 0,00`; Supermarket links `/transactions?account_id=<supermarketID>&from=2026-10-01&to=2026-11-30`; Food renders the "(direto)" child when `own` is set.
  - Responsive 360/768/1280: at 360 one total per category for the period with inline expansion (no month columns); at 1280 one column per month.
- [ ] **Step 2–4:** Run → FAIL; implement (`Table` with expandable rows, `List`, `SegmentedControl` for class); run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the category report"`.

### Task 25: Cash flow

**Files:**
- Create: `web/src/features/reports/{cash-flow.ts,cash-flow.test.ts,cash-flow-page.tsx,cash-flow-page.test.tsx}`
- Modify: `reports/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `categoryReportQuery`, `ratioBp`, `formatBp`.
- Produces: `cashFlow(months: string[], items: CategoryReportItem[]): { month: string; income: number; expense: number; net: number }[]`; `savingsRateBp(rows): number | undefined` = `ratioBp(Σnet, Σincome)`; route `/_authed/reports/cash-flow` (fallback `12m`, max 24).

- [ ] **Step 1: Write the failing tests.**
  - `cash-flow.test.ts`: October income 1000 + 4500 (S22) and expense 123000 (S30) → `{income: 5500, expense: 123000, net: -117500}`; savings rate with income 0 → `undefined`; income 500000 and expense 350000 → `3000` bp.
  - Page: `?from=2026-10&to=2026-11` renders the grouped bar chart with two series, the table month, income, expense, net; the savings-rate stat-card renders `30,00%` for the 3000 bp fixture and is absent when income is 0.
  - Responsive 360/768/1280: at 360 table rows have two lines (month and net; income and expense) and the chart is 200 px; at 1280 a `Table`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add the cash flow report"`.

### Task 26: Responsive verification of the investment, price, currency and report routes

**Files:**
- Modify: `web/src/app/routes-responsive.test.tsx`

- [ ] **Step 1: Extend the test** with every route of the spec's Routes table (`/investments`, `/investments/<mxrf11ID>`, `/investments/trade`, `/investments/income`, `/investments/results`, `/prices`, `/prices/instruments/new`, `/prices/MXRF11`, `/transactions/new/exchange`, `/transactions/new/foreign-purchase`, `/reports`, `/reports/net-worth`, `/reports/categories`, `/reports/cash-flow`, `/transactions/<trade id>`, `/`) using `investmentRoutes()` and `reportRoutes()`. Per width 360/768/1280: the navigation assertions of sub-project 1 Task 19, the page header title, no `result-state` error, the bottom bar holds five controls (V2).
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/app/routes-responsive.test.tsx` → PASS (a failure is a defect of the owning screen task, fixed there with its own failing test).
- [ ] **Step 3: Scenario coverage.** `rg -n "S(1[67]|2[12]|30|6[4-7])" web/src/features` lists S16, S17, S21, S22, S30, S64, S65, S66, S67; `rg -n "S17|S64|S30|S22" internal/ledger internal/marketdata internal/reporting` lists the B1–B5 tests.
- [ ] **Step 4: Manual pass.** `make db-up`, `make dev`, `make web-dev`; each route at 360, 768 and 1280 px in devtools: no horizontal scroll, pinned footers above the safe area. Record the result in the commit body.
- [ ] **Step 5: Gates.** `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "test(web): verify investment and report routes at three widths"`.
