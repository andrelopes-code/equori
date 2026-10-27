# Calculators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the calculators section of the design: twelve calculators under `/calculators`, each with its method explained, standalone or filled from equori data, plus the index history and two read operations they need.

**Architecture:** `marketdata` fetches each enabled index for 20 years and exposes `GET /indexes` and `GET /indexes/{id}/rates`. Every method is a pure TypeScript function in `web/src/features/calculators/`, tested by table; each calculator is one screen component under one route `/calculators/$id` whose inputs live in the address.

**Tech Stack:** Go 1.27 (stdlib, pgx, sqlc, oapi-codegen strict server), PostgreSQL, React + TypeScript + Vite, `@slotted/react` 0.1.0-beta.16, TanStack Query and Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-calculators-design.md` (evidence: `docs/superpowers/specs/2026-10-26-tools-study.md`). Read both before Task 1.

## Global Constraints

- Every rule of `CLAUDE.md` and `web/CLAUDE.md` applies. Read `web/CLAUDE.md` and run the Slotted `compose-screen` skill before Task 2; every Slotted finding follows the feedback protocol of `web/CLAUDE.md`.
- The section is "calculators" in code, routes, catalogs and commits. "Tool" means only ADR 012.
- Amounts: integer minor units. Every returned amount and every period balance is rounded by `roundHalfEven` (Task 2). Rates: fractions in floating point.
- Rate solver: bisection, stop when |error| < 0.000001 × target or after 200 iterations; no solution returns `null`.
- Fields without a sourced default start empty: target months (`reserve`), withdrawal rate (`independence`), expected return and volatility (`compound` range).
- No judgment color, tone or icon on any result (design §2).
- Amounts through `useMoneyFormat()`; privacy masks amounts, never rates or months.
- Catalog keys start with `calc.`; files `web/src/i18n/catalog-calculators.en.ts` and `catalog-calculators.pt-BR.ts`, spread into `catalogEn` and `catalogPtBR` like `catalog-reports.*`.
- Scenario ID: S157 (S151–S156 are taken).
- Commits: Conventional Commits, scope `marketdata`, `web` or `docs`, no tool or assistant names, no `Co-Authored-By`.
- Go tests need the test database: run `make db-test-up` once per session before any `go test`. Never pass `-tags eval` or `-tags live`.
- Execution slices: at most three tasks per slice, then write `.claude/progress/current.md` (user `CLAUDE.md`, "Execution slice protocol").

## Review Focus

1. A rate field holding `0` must not divide by zero: M2 and M3 at j = 0 return p·n and q₀/n. Test: case "zero rate" of `compound-math.test.ts` (Task 3) and `annuity.test.ts` (Task 6).
2. An instance without index feeds shows every calculator with fixed-rate inputs and no index option, never an error. Test: "works without indexes" in `compound-calculator.test.tsx` (Task 3).
3. A hand-edited address (`?months=abc`, `?months=-3`, `?months=99999`) shows the field empty and no result, never a crash. Test: "drops invalid search values" in `calculator-search.test.ts` (Task 2).
4. Installments whose total is at or below the cash price give "no interest", not a failed solve. Test: case "no interest" of `credit-math.test.ts` (Task 7).
5. A debt plan whose budget only covers interest never loops: 1200 months, then "not closed". Test: case "budget equals interest" of `debt-math.test.ts` (Task 9).

---

### Task 0: Preconditions

**Files:** none.

- [ ] **Step 1: Check the working tree**

Run: `git status --porcelain`
Expected: no modified tracked file under `web/src/app/`, `web/src/i18n/`, `internal/marketdata/`, `api/openapi.yaml`. On 2026-10-26 the settings redesign had `web/src/app/router.tsx`, `web/src/app/shell/*` and both `catalog.*.ts` modified. If any of them is still modified, STOP and ask the owner to commit that work.

- [ ] **Step 2: Check the analytics dependency**

Run: `grep -n "operationId: getIndicators" api/openapi.yaml`
Expected: one line. Without it, Tasks 1–9 and 11 run; Task 10 waits until `docs/superpowers/plans/2026-10-26-analytics-indicators.md` delivers the operation. Record this in the checkpoint.

- [ ] **Step 3: Start the test database**

Run: `make db-test-up`
Expected: exit 0.

---

### Task 1: Index history and index operations

**Files:**
- Modify: `internal/marketdata/internal/index/index.go`, `internal/marketdata/internal/index/brsgs/brsgs.go`, `internal/marketdata/indexes.go`, `db/queries/marketdata/index.sql`, `internal/marketdata/internal/domain/price.go`, `internal/marketdata/marketdata.go`, `internal/marketdata/internal/adapter/httpapi/` (new `indexes.go`), `internal/marketdata/internal/adapter/toolapi/market.go`, `api/openapi.yaml`, `internal/server/tool_exposure_test.go`, `internal/server/testdata/tools.json`, `docs/operations/price-feeds.md`, `docs/domain/06-scenarios.md`
- Test: `internal/marketdata/indexes_test.go` (modify `TestIndexFeeds`), new `internal/marketdata/index_api_test.go`, `internal/marketdata/market_tool_test.go`

**Interfaces:**
- Produces (Go): `index.Source.Period() string`; constants `index.PeriodDay = "day"`, `index.PeriodMonth = "month"`; `marketdata.IndexSummary{ID, Period string; First, Last time.Time}`; `marketdata.IndexRate{Date time.Time; Rate string}`; `(*Module).Indexes(ctx) ([]IndexSummary, error)`; `(*Module).IndexRates(ctx, id string, from, to time.Time) ([]IndexRate, error)`; `domain.MaxIndexRange = 7320`.
- Produces (HTTP): `GET /indexes` → `IndexList{items: Index[]}`, `Index{id, period: "day"|"month", first: date, last: date}`; `GET /indexes/{id}/rates?from&to` → `IndexRateList{items: IndexRate[]}`, `IndexRate{date, rate}`. Both tag `marketdata`, operationIds `listIndexes`, `listIndexRates`, responses 200, 400, 401, 404 (rates only), 422.

- [ ] **Step 1: Append S157 to `docs/domain/06-scenarios.md` after S150**

```markdown
### S157 Index history for calculators

| Step | Expected |
|---|---|
| `br_cdi` and `br_ipca` enabled, today 2026-03-15, no security follows them, one feed tick | CDI requested from 2006-03-15 in windows of at most 1,826 days; IPCA from 2006-03-15 |
| `GET /indexes` | `cdi` with period `day`, `ipca` with period `month`, each with its first and last stored date |
| `GET /indexes/ipca/rates?from=2026-01-01&to=2026-02-28` | the two stored months, oldest first, rates as decimal fractions |
| `GET /indexes/selic/rates?...` | 404 `not_found` |
| range of 7,321 days | 422 `validation_failed` on `to` |
```

- [ ] **Step 2: Write the failing test `TestS157IndexHistory` in `internal/marketdata/index_api_test.go`**

Reuse `sgsServer` and `indexURLs` of `indexes_test.go`, with the `cdiWeek` and IPCA fixtures of `TestIndexFeeds`. With `apitest.Today("2026-03-15")` and both feeds, call `h.App.Marketdata.TickFeeds`, then assert: the first CDI request has `dataInicial=15%2F03%2F2006`; no CDI request spans more than 1,826 days; `GET /api/v1/indexes` returns exactly `[{id:"cdi",period:"day",...},{id:"ipca",period:"month",...}]` with `first` and `last` equal to the stored extremes; the ipca rates call of Step 1 returns `[{date:"2026-01-01",rate:"0.004200000000"},{date:"2026-02-01",rate:"-0.003000000000"}]`; the 404 and 422 cases of Step 1 check the status before decoding.

- [ ] **Step 3: Run it to verify it fails**

Run: `go test ./internal/marketdata/ -run TestS157 -count=1`
Expected: FAIL (no request at the first tick; 404 on `/api/v1/indexes`).

- [ ] **Step 4: Change the fetch start and declare periods**

In `indexes.go`: `const indexHistoryYears = 20`; `tickIndex` no longer returns when `issued.N == 0`; its start is the earlier of `today.AddDate(-indexHistoryYears, 0, 0)` and `issued.IssuedOn` when `issued.N > 0`; the latest-stored rule stays. `Period()` returns `PeriodDay` for `CDI` and `PeriodMonth` for `IPCA`. Update `TestIndexFeeds`: the block "No security follows an index: nothing is fetched" becomes "An enabled index is fetched from 20 years before today", and its `dataInicial` assertion follows the new start. The commit body names design §6, "History", as the amendment.

- [ ] **Step 5: Add the queries and the operations**

`index.sql`: `IndexRange :one` (min date, max date, count of an index) and `ListIndexRatesBetween :many` (`date >= @from_date AND date <= @to_date ORDER BY date`). Run `make gen`. `Indexes` lists the enabled sources in `m.feeds.Indexes` order with at least one rate. `IndexRates` of an id outside the enabled sources returns a new sentinel `domain.ErrUnknownIndex`, mapped to 404 `not_found` with detail "unknown index" in `httpapi/server.go`; range validation reuses the `invalid("to", ...)` rule of prices with `MaxIndexRange`. Add both operations to `api/openapi.yaml` (schemas with `additionalProperties: false` where they are requests; `rate` a string), regenerate, add `"listIndexes": "get_market_data"` and `"listIndexRates": "get_market_data"` to `exposure`.

- [ ] **Step 6: Extend the tool**

`getMarketDataView` gains `indexes` and `index_rates`; `getMarketDataIn` gains `Index string` (`json:"index,omitzero" jsonschema:"for index_rates: index id from the indexes view"`), `from` and `to` documented for `index_rates` too. Test `TestGetMarketDataToolIndexes` in `market_tool_test.go` calls both views through `apitest.Tool` and asserts the items of Step 2. Run `go test ./internal/server/ -run TestToolCatalog -update`, then without `-update`.

- [ ] **Step 7: Update `docs/operations/price-feeds.md`**

Line of `EQUORI_INDEX_FEEDS`: "An enabled index is fetched from 20 years before today, or from the earliest issue date of a security that follows it when that is earlier. The calculators read the stored rates (`GET /indexes`)."

- [ ] **Step 8: Run the package tests**

Run: `go test ./internal/marketdata/ ./internal/server/ -count=1`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add internal/marketdata db/queries/marketdata api/openapi.yaml internal/server docs/operations/price-feeds.md docs/domain/06-scenarios.md web/src/api/schema.gen.ts
git commit -m "feat(marketdata): fetch index history and list index rates"
```

---

### Task 2: Calculators section, shared parts and search state

**Files:**
- Create in `web/src/features/calculators/`: `index.ts`, `calculators.ts`, `calculators-page.tsx`, `calculator-page.tsx`, `calculator-frame.tsx`, `method-section.tsx`, `filled-note.tsx`, `calculator-search.ts`, `round.ts`, `solve.ts`, `api.ts`, `index-rates.ts`, `calculators.module.css`
- Create: `web/src/ui/rate-input.tsx`, `web/src/i18n/catalog-calculators.en.ts`, `web/src/i18n/catalog-calculators.pt-BR.ts`
- Modify: `web/src/app/router.tsx`, `web/src/app/shell/destinations.ts`, `web/src/app/shell/shell-icon.tsx`, `web/src/navigation/navigation-map.json`, `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`
- Test: `round.test.ts`, `solve.test.ts`, `calculator-search.test.ts`, `index-rates.test.ts`, `calculators-page.test.tsx` (all in the feature folder); `web/src/testing/calculator-api.ts` (fake routes)

**Interfaces:**
- Produces:
  - `type CalculatorId = "compound" | "rates" | "correction" | "fixed-income" | "financing" | "cash-or-installments" | "credit-cost" | "debt-payoff" | "reserve" | "recurring-cost" | "independence" | "own-or-rent"`; `type CalculatorGroup = "invest" | "credit" | "plan"`; `calculators: readonly { id: CalculatorId; group: CalculatorGroup }[]` in the order of design §5.
  - `roundHalfEven(x: number): number` (integer result; ties to even; `-0` returns `0`).
  - `bisect(f: (x: number) => number, lo: number, hi: number, target: number): number | null` (Global Constraints tolerance).
  - `validateCalculatorSearch(raw: Record<string, unknown>): Record<string, string>`; `readMinor(v?: string): number | null` (integer minor units, 0 ≤ v ≤ 10^15); `readRate(v?: string): number | null` (percent text, −99.99 to 1000, returned as fraction); `readInt(v: string | undefined, min: number, max: number): number | null`; `readMonth(v?: string): string | null` (`YYYY-MM`); `readDate(v?: string): string | null`.
  - `useCalculatorSearch(): [Record<string, string>, (patch: Record<string, string | undefined>) => void]` (replace navigation, no history entry per keystroke).
  - `indexesQuery(api)`, `indexRatesQuery(api, id, from, to)` in `api.ts`.
  - `type IndexRate = { date: string; rate: number }`; `trailingDaily(rates: IndexRate[]): number | null`; `trailingMonthly(rates: IndexRate[]): number | null`; `accumulated(rates: IndexRate[]): number`; `percentOfDaily(rates: IndexRate[], multiplier: number): number` (1.1 = 110% of the index) in `index-rates.ts` (design §4, "Trailing 12 months"; `null` with fewer than 12 months of data).
  - `<CalculatorFrame id title question>` with slots for inputs, results and `<MethodSection steps formula assumptions limits sources />`; `sources: { title: string; url: string }[]`.
  - `<FilledNote origin onRefill />`; `<RateInput value onChange period? />` (percent text, optional period select month/year).

- [ ] **Step 1: Write the failing unit tests**

`round.test.ts`: `[[0.5,0],[1.5,2],[2.5,2],[-2.5,-2],[112682.5,112682],[112682.51,112683]]`.
`solve.test.ts`: `bisect(x => x * x, 0, 10, 2)` within 0.000001 × 2 of √2; a target outside the range returns `null`.
`calculator-search.test.ts` "drops invalid search values": `validateCalculatorSearch({months: "abc", amount: "100000", x: 5})` → `{months: "abc", amount: "100000"}` (strings ≤ 64 chars kept, others dropped); `readInt("abc",1,1200)`, `readInt("-3",1,1200)`, `readInt("99999",1,1200)` → `null`; `readRate("1")` → `0.01`; `readMinor("12.5")` → `null`.
`index-rates.test.ts`: the 12 IPCA 2020 rates of design §8 give `accumulated` = 0.04517342 within 1e-8; `trailingMonthly` of 11 months → `null`; daily rates of 0.0004 on each of 252 dates within one year → `trailingDaily` = 1.0004^252 − 1 within 1e-12; `percentOfDaily(rates, 1.1)` = 1.00044^252 − 1.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `round.ts`, `solve.ts`, `calculator-search.ts`, `index-rates.ts`, `api.ts`**

- [ ] **Step 4: Run them to verify they pass**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 5: Write the failing screen test `calculators-page.test.tsx`**

`renderApp("/calculators")` with `calculatorApiRoutes()`: the heading is `catalogEn["calc.title"]`; three groups named `calc.group.invest`, `calc.group.credit`, `calc.group.plan`; twelve links whose names are the `calc.<id>.title` keys and whose `href` is `/calculators/<id>`. `renderApp("/calculators/nope")` shows the not-found screen. The navigation shows the destination `nav.calculators`.

- [ ] **Step 6: Run it to verify it fails**

Run: `cd web && pnpm vitest run src/features/calculators/calculators-page.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Add routes, destination, icon, navigation map entry and catalogs**

Routes `calculators` and `calculators/$id` under `authedRoute`, the second with `validateSearch: validateCalculatorSearch`; an unknown id throws `notFound()`. Destination after `reports`: `{ key: "calculators", to: "/calculators", label: "nav.calculators", icon: "calculator", phone: "more" }`. Icon `calculator`: a stroke path in the style of the existing `PATHS`. `navigation-map.json` entries for `/calculators` and `/calculators/$id` with topics `["calculators"]` and tasks "simulate an investment", "compare cash and installments", "plan the payoff of debts". `calculator-page.tsx` maps each id to its component; until a calculator's task lands, its id renders the frame with the method section only.

- [ ] **Step 8: Run the feature tests and the navigation and route tests**

Run: `cd web && pnpm vitest run src/features/calculators src/navigation src/app`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src
git commit -m "feat(web): add the calculators section"
```

---

### Task 3: Compound interest calculator

**Files:**
- Create: `web/src/features/calculators/compound-math.ts`, `rate-math.ts`, `compound-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `compound-math.test.ts`, `rate-math.test.ts`, `compound-calculator.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`roundHalfEven`, `bisect`, `useCalculatorSearch`, `read*`, `indexesQuery`, `indexRatesQuery`, `trailingDaily`, `trailingMonthly`, `percentOfDaily`, `CalculatorFrame`, `MethodSection`, `FilledNote`, `RateInput`).
- Produces: `monthlyToAnnual(j)`, `annualToMonthly(r)`, `realRate(nominal, inflation)` in `rate-math.ts`; `futureValue(q0, j, n)`, `depositsValue(p, j, n)`, `depositForTarget(target, q0, j, n): number | null`, `balances(q0, p, j, n): { month: number; balance: number; deposited: number }[]` in `compound-math.ts`, all amounts minor units.

- [ ] **Step 1: Write the failing math tests**

`rate-math.test.ts`: `monthlyToAnnual(0.01)` = 0.126825 within 1e-6; `annualToMonthly(0.12)` = 0.009489 within 1e-6; `realRate(0.10, 0.04)` = 0.057692 within 1e-6.
`compound-math.test.ts`: `futureValue(100000, 0.01, 12)` = 112683; `depositsValue(10000, 0.005, 12)` = 123972; "zero rate": `depositsValue(10000, 0, 12)` = 120000 and `futureValue(100000, 0, 12)` = 100000; `depositForTarget(123972, 0, 0.005, 12)` = 10000; `depositForTarget` of a target below `futureValue(q0)` → 0; `balances(100000, 10000, 0.01, 12)` has 12 rows, row 12 `balance` = `futureValue(100000,0.01,12) + depositsValue(10000,0.01,12)` ± 12 (monthly rounding), `deposited` = 220000.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/compound-math.test.ts src/features/calculators/rate-math.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both files**

`balances` deposits at the start of each month (BCB, design §5), then applies interest, rounding the balance each month.

- [ ] **Step 4: Run them to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Write the failing screen test**

`compound-calculator.test.tsx`: at `/calculators/compound?initial=100000&deposit=0&months=12&rate=12.682503` the result "Final amount" reads `fmt.money(112683)` in the base currency of the fake settings; with `inflation=4` the real amount is shown; with `delay=12` the delayed amount and the difference are shown; mode `target` with `target=123972&initial=0&months=12&rate=6.167781` shows a deposit of 100.00; "works without indexes": with `GET /api/v1/indexes` returning `{items: []}` the rate source shows no index option and no error; with a `cdi` index fixture the percent-of-index option fills the annual rate and shows `FilledNote`; privacy on masks every amount and leaves the rate.

- [ ] **Step 6: Run it to verify it fails**

Run: `cd web && pnpm vitest run src/features/calculators/compound-calculator.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Implement `compound-calculator.tsx` and its catalog keys**

Inputs, results and chart of design §5 (`compound`), chart of balance and deposited by month through the Slotted `Chart` (line). Method section: steps, formulas M1, M2, M5, M6 with symbols, assumptions (deposit at month start, constant rate, no tax or fee), limits (E1, E2 in one sentence each), sources: BCB CALFW0502 and CALFW0202, McKenzie and Liersch 2011, Stango and Zinman 2009.

- [ ] **Step 8: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src
git commit -m "feat(web): add the compound interest calculator"
```

---

### Task 4: Range of outcomes in the compound calculator

**Files:**
- Create: `web/src/features/calculators/simulation.ts`
- Modify: `compound-calculator.tsx`, both calculator catalogs
- Test: `simulation.test.ts`, `compound-calculator.test.tsx`

**Interfaces:**
- Produces: `simulate(input: { initial: number; deposit: number; months: number; annualRate: number; annualVolatility: number; paths?: number; seed?: number }): { p10: number; p50: number; p90: number }` (defaults `paths` 2000, `seed` 1; amounts minor units).

- [ ] **Step 1: Write the failing tests**

`simulation.test.ts`: volatility 0 gives p10 = p50 = p90 = the row-12 balance of `balances` at `annualToMonthly(annualRate)` ± 12; volatility 0.2 gives p10 < p50 < p90; two calls with the same input return equal results; a different `seed` returns a different p10. Screen test: with `volatility=20` the three percentiles appear with their labels; without it, they do not.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/simulation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `simulation.ts`**

Design §5, "Simulation": a seeded 32-bit generator and a normal sampler (Box–Muller); deposit at month start, then return of the month, balance rounded each month; percentiles by nearest rank on the sorted final balances.

- [ ] **Step 4: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): show the range of outcomes of an investment"
```

---

### Task 5: Rate converter and correction by index

**Files:**
- Create: `web/src/features/calculators/rates-calculator.tsx`, `correction-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `rates-calculator.test.tsx`, `correction-calculator.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`accumulated`, `trailingDaily`, `trailingMonthly`, `percentOfDaily`, queries), Task 3 (`rate-math.ts`).

- [ ] **Step 1: Write the failing screen tests**

Rates: `?rate=1&period=month` shows 12.6825% a year; `?rate=10&period=year&inflation=4` shows real 5.7692%; with a `cdi` fixture, `percent=110` shows the annual rate from `percentOfDaily`.
Correction: with an `ipca` fixture of the 12 months of 2020, `?index=ipca&amount=100000&from=2020-01&to=2020-12` shows 104517 and 4.5173%; `from` after `to` shows the message `calc.correction.order` and no result; a month outside the stored range shows `calc.correction.range` naming the first and last stored months; privacy masks both amounts.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/rates-calculator.test.tsx src/features/calculators/correction-calculator.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement both screens**

Correction reads `indexRatesQuery(id, first day of from, last day of to)` and applies `accumulated` (both months included, design §5). Method sources: BCB Calculadora do Cidadão, "Correção de valores"; the index source named by its id.

- [ ] **Step 4: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): convert rates and correct amounts by an index"
```

---

### Task 6: Financing calculator, Price and SAC

**Files:**
- Create: `web/src/features/calculators/annuity.ts`, `financing-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `annuity.test.ts`, `financing-calculator.test.tsx`

**Interfaces:**
- Produces: `type AmortizationRow = { month: number; installment: number; interest: number; amortization: number; balance: number }`; `priceInstallment(q0, j, n): number`; `priceSchedule(q0, j, n): AmortizationRow[]`; `sacSchedule(q0, j, n): AmortizationRow[]`; `solvePrice(input: { amount?: number; rate?: number; months?: number; installment?: number }): { amount: number; rate: number; months: number; installment: number } | null` (exactly one field absent); `prepay(q0, j, n, month, extra): { balance: number; keepInstallment: { months: number; interest: number; last: number }; keepTerm: { installment: number; interest: number }; without: { interest: number } } | null`.

- [ ] **Step 1: Write the failing math tests**

Values of design §8: `priceInstallment(1000000, 0.01, 12)` = 88849; `priceSchedule` last row installment 88847, balance 0, total interest 66186; `sacSchedule(1200000, 0.01, 12)` first installment 112000, last 101000, total interest 78000; `prepay(1000000, 0.01, 12, 6, 200000)` = balance 314920, keepInstallment {months 4, interest 7420, last 55793}, keepTerm {installment 54339, interest 11113}, without {interest 18172}; "zero rate": `priceInstallment(120000, 0, 12)` = 10000; `solvePrice({amount: 1000000, months: 12, installment: 88849})?.rate` within 0.000001 of 0.01; `solvePrice({amount: 1000000, rate: 0.01, installment: 10000})` → `null` (installment below interest); an extra above the balance → `prepay` returns balance 0 and zero months.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/annuity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `annuity.ts`**

Rounding of design §5 (`financing`): the installment or amortization is rounded once; each month's interest is rounded; the last row closes the balance. Months solve by the smallest n whose installment does not exceed the given one.

- [ ] **Step 4: Write the failing screen test, then implement `financing-calculator.tsx`**

`?amount=1000000&rate=1&period=month&months=12` shows both systems side by side (installment first and last, total paid, total interest), a table per system with 12 rows; `prepayMonth=6&prepayAmount=200000` shows the three prepayment results; `solve=rate&installment=88849` shows 1.0000% a month. Method: M3, M4, the rounding rule, sources BCB CALFW0402.

- [ ] **Step 5: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat(web): compare Price and SAC financing with prepayment"
```

---

### Task 7: Cash or installments, and the effective cost of credit

**Files:**
- Create: `web/src/features/calculators/credit-math.ts`, `cash-or-installments-calculator.tsx`, `credit-cost-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `credit-math.test.ts`, `cash-or-installments-calculator.test.tsx`, `credit-cost-calculator.test.tsx`

**Interfaces:**
- Produces: `impliedRate(cash: number, count: number, installment: number, firstNow: boolean): number | "no_interest" | null`; `presentValue(count, installment, j, firstNow): number`; `monthlyDates(first: string, count: number): string[]` (T02); `effectiveAnnualCost(released: number, fees: number, releaseDate: string, flows: { date: string; amount: number }[]): number | null`.

- [ ] **Step 1: Write the failing math tests**

`impliedRate(100000, 10, 11000, false)` = 0.01771543 within 1e-8; `presentValue(10, 11000, 0.01, false)` = 104184; "no interest": `impliedRate(100000, 10, 10000, false)` and `impliedRate(100000, 10, 9000, false)` → `"no_interest"`; `monthlyDates("2026-01-31", 3)` = `["2026-01-31","2026-02-28","2026-03-31"]`; `effectiveAnnualCost(1000000, 20000, "2026-01-10", monthlyDates("2026-02-10", 12).map(d => ({date: d, amount: 88849})))` rounded to 2 decimals = 0.1714, without fees 0.1274.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/credit-math.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `credit-math.ts`**

CET by CMN 4.881 art. 4 with day counts from `releaseDate`, base 365; displayed with 2 decimals by `roundHalfEven` on the percent × 100.

- [ ] **Step 4: Write the failing screen tests, then implement both screens**

Cash or installments: the case of Step 1 shows 1.7715% a month, 23.4572% a year, present value 1,041.84 at 1% a month, and the difference 41.84 stated as "the cash price is lower by"; "no interest" shows `calc.cash.noInterest`; with a `cdi` fixture the comparison rate can come from a percent of the index with `FilledNote`. Credit cost: the case of Step 1 shows 17.14% and a table of 12 flows with their days. Method sources: CMN 4.881 (link of the study), Stango and Zinman 2009; the Brazilian name "CET" appears in the explanation only for region `BR`, through a `switch` in `credit-cost-calculator.tsx`.

- [ ] **Step 5: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat(web): compare cash and installments and compute the cost of credit"
```

---

### Task 8: Fixed income after tax

**Files:**
- Create: `web/src/features/calculators/fixed-income-region.ts`, `fixed-income-math.ts`, `fixed-income-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs, `docs/contributing/regions.md` (row in "Web files")
- Test: `fixed-income-region.test.ts`, `fixed-income-math.test.ts`, `fixed-income-calculator.test.tsx`

**Interfaces:**
- Produces: `type FixedIncomeRules = { taxBp(days: number): number; minimumDays: number; checkedOn: string; sources: { title: string; url: string }[] }`; `fixedIncomeRules(region: string): FixedIncomeRules | null`; `fixedIncome(input: { amount: number; annualRate: number; days: number; taxBp: number }): { gross: number; tax: number; net: number; netAnnualRate: number }`; `equivalentTaxable(exemptRate, taxBp)`, `equivalentExempt(taxableRate, taxBp)`.

- [ ] **Step 1: Write the failing tests**

Region: `fixedIncomeRules("BR")!.taxBp` at 180, 181, 360, 361, 720, 721 days = 2250, 2000, 2000, 1750, 1750, 1500; `minimumDays` 30; `checkedOn` "2026-10-26"; `fixedIncomeRules("DE")` → `null`. Math: `fixedIncome({amount: 1000000, annualRate: 0.12, days: 400, taxBp: 1750})` = gross 132238, tax 23142, net 109096; `equivalentTaxable(0.10, 1750)` = 0.121212 within 1e-6; `equivalentExempt(0.121212, 1750)` within 1e-6 of 0.10. Screen: region `BR`, `days=20` shows `calc.fixedIncome.iof` and no result; region `DE` asks for the tax rate (`calc.fixedIncome.taxRate`) and applies it; exempt mode shows tax 0.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/fixed-income`
Expected: FAIL.

- [ ] **Step 3: Implement the three files and the regions row**

`fixed-income-region.ts` is a `switch` on the region; case `BR` holds design §7 with its sources (Lei 11.033/2004 at Planalto; Ato Declaratório CN 67/2025 through the PwC note) and the 252-day note key. The region comes from the profile locale of `useAppLocaleState()`. Row in `docs/contributing/regions.md`, table "Web files": `web/src/features/calculators/fixed-income-region.ts` | `fixedIncomeRules`: a `switch` on the region that returns the tax on fixed-income yield; a region without a case asks for the rate | `fixed-income-region.test.ts`.

- [ ] **Step 4: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src docs/contributing/regions.md
git commit -m "feat(web): compute fixed income after tax by region"
```

---

### Task 9: Debt payoff plan

**Files:**
- Create: `web/src/features/calculators/debt-math.ts`, `debt-payoff-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `debt-math.test.ts`, `debt-payoff-calculator.test.tsx`

**Interfaces:**
- Produces: `type Debt = { name: string; balance: number; rate: number; minimum: number }`; `payoffPlan(debts: Debt[], budget: number, order: "avalanche" | "snowball"): { months: number; interest: number; closed: { name: string; month: number }[] } | "below_minimums" | "not_closed"`.

- [ ] **Step 1: Write the failing tests**

The case of design §8 (card 100000 at 0.03 min 5000; loan 300000 at 0.01 min 10000; store 50000 at 0.02 min 2500; budget 30000): avalanche `{months: 17, interest: 52780, closed: [card 7, store 9, loan 17]}`; snowball `{months: 17, interest: 55652, closed: [store 4, card 9, loan 17]}`. A budget of 17000 → `"below_minimums"`. "budget equals interest": one debt 100000 at 0.01 min 1000, budget 1000 → `"not_closed"`. Screen: rows prefilled from `GET /api/v1/balances` for liability accounts of kind `loan` and `credit_card` with an amount owed, rate and minimum empty, each with `FilledNote`; with rates and minimums entered, two columns show months, interest and the closing month of each debt, and the interest difference; privacy masks amounts.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && pnpm vitest run src/features/calculators/debt`
Expected: FAIL.

- [ ] **Step 3: Implement both files**

Rules of design §5 (`debt-payoff`) in that order: interest, minimums, extra in the order's sequence. Rows live in the address as `debts` = JSON of at most 20 rows; an invalid value drops the rows. Method sources: Gal and McShane 2012 through the Kellogg summary.

- [ ] **Step 4: Run the feature tests**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): plan the payoff of debts in two orders"
```

---

### Task 10: Reserve and independence

Runs after `getIndicators` exists (Task 0, Step 2).

**Files:**
- Create: `web/src/features/calculators/plan-math.ts`, `reserve-calculator.tsx`, `independence-calculator.tsx`
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `plan-math.test.ts`, `reserve-calculator.test.tsx`, `independence-calculator.test.tsx`

**Interfaces:**
- Consumes: the indicators query of the analytics plan (its `api.ts` export through `@/features/overview` or `@/features/reports` index, whichever that plan exports); `futureValue`, `depositsValue`, `annualToMonthly` (Task 3).
- Produces: `reserve(balance, expense, targetMonths: number | null, months: number | null): { covered: number | null; gap: number | null; monthly: number | null }`; `independenceTarget(monthlyExpense, withdrawalRate): number`; `monthsToTarget(current, deposit, monthlyRate, target): number | null` (≤ 1200).

- [ ] **Step 1: Write the failing tests**

`reserve(1200000, 400000, 6, 12)` = covered 3.0, gap 1200000, monthly 100000; target `null` → gap and monthly `null`; expense 0 → covered `null`. `independenceTarget(500000, 0.04)` = 150000000; `monthsToTarget(0, 0, 0.005, 1)` → `null`; `monthsToTarget(target, 0, j, target)` = 0. Screens: reserve fills liquid balance and mean monthly expense from the indicators fixture with `FilledNote`, target months empty, no target result until entered; independence shows target only after a withdrawal rate is entered, and its explanation names W1 to W3 with the United States caveat.

- [ ] **Step 2: Run them to verify they fail, implement, run them to verify they pass**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: FAIL, then PASS after `plan-math.ts` and both screens.

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): size the reserve and the investments that pay expenses"
```

---

### Task 11: Recurring cost and own or rent

**Files:**
- Create: `web/src/features/calculators/recurring-cost-calculator.tsx`, `own-or-rent-calculator.tsx`; add `recurringCost` and `ownershipCost` to `plan-math.ts` (create the file when Task 10 waits)
- Modify: `calculator-page.tsx`, both calculator catalogs
- Test: `plan-math.test.ts`, `recurring-cost-calculator.test.tsx`, `own-or-rent-calculator.test.tsx`

**Interfaces:**
- Produces: `recurringCost(amount, perYear: 1 | 12, years, annualRate: number | null): { total: number; futureValue: number | null }`; `ownershipCost(input: { price: number; riskFree: number; propertyTax: number; deductibleTax: number; mortgage: number; maintenance: number; appreciation: number; riskPremium: number }): { total: number; components: Record<"forgone" | "propertyTax" | "deduction" | "maintenance" | "appreciation" | "riskPremium", number> }`.

- [ ] **Step 1: Write the failing tests**

`recurringCost(5000, 12, 1, null)` = total 60000, futureValue `null`; with rate 0 the future value equals the total; with 0.12 it equals `depositsValue(5000, annualToMonthly(0.12), 12)`. `ownershipCost({price: 50000000, riskFree: 0.10, propertyTax: 0.01, deductibleTax: 0, mortgage: 0.11, maintenance: 0.015, appreciation: 0.04, riskPremium: 0.02})` total 5250000, deduction 0, appreciation −2000000. Screens: recurring cost lists the schedules of `GET /api/v1/schedules` as a source and fills the amount with `FilledNote`; own or rent shows the six components, the annual rent and the difference, and its explanation gives the formula of study §3.5 with each symbol.

- [ ] **Step 2: Run them to verify they fail, implement, run them to verify they pass**

Run: `cd web && pnpm vitest run src/features/calculators`
Expected: FAIL, then PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): compute the cost of recurring expenses and of owning a home"
```

---

### Task 12: Verification

**Files:** none, unless a check fails.

- [ ] **Step 1: Run the full check**

Run: `make check`
Expected: exit 0. A failure is fixed in the task that owns the file, in a new commit.

- [ ] **Step 2: Phone and desktop pass on the production build**

Run `make run-prod`; open `/calculators/compound` and `/calculators/financing` at 390 px and 1280 px through one Playwright script that closes the browser in `finally` (user `CLAUDE.md`, "Browser processes"); at most four screenshots. Expected: inputs, results and explanation in that order, no horizontal scroll.

- [ ] **Step 3: Write the checkpoint**

Overwrite `.claude/progress/current.md` with the fields of the user `CLAUDE.md`, including whether Task 10 ran.
