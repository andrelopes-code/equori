# Investments: tax classes, fixed income accrual, performance and goals

Status: draft

## 1. Intent

Today an investment enters the ledger as a quantity of an instrument held in a `brokerage` child account. Its value is `quantity × price`, read at query time with a price that a feed or the owner stored. Yield on a reserve enters as one "Yield" transaction per reconciliation. Dividends, JCP, interest and coupons enter through `POST /investment-income`.

Four things are missing for a household that holds fixed income, funds and securities abroad:

1. A security of type `fixed_income` or `fund` has no subtype, so a CRI, a CRA, an LCI, a Tesouro bond and a CDB share one tax class and one income treatment.
2. A fixed income position has no price unless the owner types one. Nothing accrues it toward maturity.
3. No read model says how an investment performed, how a portfolio is allocated, or what the net worth is (P9).
4. A goal that holds investments estimates its completion with a yearly return the owner types. Nothing offers the return the goal's own accounts achieved.

Work is delivered in the order of section 4. Each part is a vertical slice with its own scenarios.

## 2. Goals, non-goals, anti-goals

| ID | Goal |
|---|---|
| G1 | The tax class and the income treatment of a security derive from its type, its subtype and its exchange, through the owner's `Jurisdiction` (D1). |
| G2 | A fixed income security with indexer, rate and maturity gets a daily price computed from an index series, as a price with source `accrual`. |
| G3 | The return of an account tree over a period is computed from ledger postings and stored prices, as a money-weighted annual rate in basis points. |
| G4 | The net worth and the allocation by instrument type, currency and institution at a date are read from valued balances. |
| G5 | `Goal` returns the money-weighted return of its accounts over the last 12 months when the history allows one; the goals page offers it as the yearly return of the what-if. |
| G6 | Every regional input (index series, tax rule, subtype list) is an extension point under ADR 016. |

| ID | Non-goal |
|---|---|
| NG1 | Come-cotas, and any other withholding that is not a response to an income event or a redemption. |
| NG2 | Tax reports and the monthly exemption rules for realized gains (later feature of D1). |
| NG3 | A net-of-tax value of a fixed income position. Accrual produces a gross value. |
| NG4 | Intraday prices, order books, or any order entry (vision, 1.10). |
| NG5 | Benchmarks (comparing a portfolio with CDI or an index fund). |
| NG6 | A second jurisdiction beyond the test implementation that X10 requires. |
| NG7 | Private pension (PGBL, VGBL) as a distinct type. It is a `fund` with a subtype until a rule needs more. |

| ID | Anti-goal: the work fails if |
|---|---|
| AG1 | A tax class or a treatment is chosen by a `switch` on a region code outside the `br` implementation. |
| AG2 | Any amount, quantity or price is a `float64` in a response, a table or a stored value (ADR 005). The performance solver may use floating point internally; its result is rounded to an integer of basis points before it leaves the function. |
| AG3 | Adding a subtype, an index or a source needs an edit to a `CHECK (x IN (...))` or to a module core (ADR 016, AG-R4). |
| AG4 | The goal's return is shown as a fact when the history is shorter than three months or holds no external flow. |
| AG5 | A change to the existing scenarios S61, S67, S119, S120, S121 or to the portfolio scenarios, except where this document amends the rule they test. |

## 3. Constraints

- ADR 002: Reporting and Planning read Ledger, Market data and Portfolio only through their public API. A new read goes through a port declared by the consumer.
- ADR 005: money is an integer of minor units; a rate is `money.Rate`, an exact decimal with at most 12 decimals. Dates are calendar dates.
- ADR 016, X1 to X10: an extension point is an interface declared by the consuming module, one package per implementation under `internal/<module>/internal/<point>/<id>/`, a registry built by a constructor, an identifier matching `^[a-z0-9_]{2,40}$`, a column holding it with that `CHECK`, and two implementations (one may be a test implementation).
- Root `CLAUDE.md`: a behavior change starts with a failing test; a schema change is a new goose migration; a new operation in `api/openapi.yaml` has an entry in `internal/server/tool_exposure_test.go`; every business table has `user_id`, but `marketdata_*` tables are instance-wide like `marketdata_instrument`.
- Existing facts this design builds on: `Jurisdiction` in `internal/portfolio/internal/domain/jurisdiction.go` (`TaxClass(instrumentType, exchange)`, `Treatment(incomeType)`, `IncomeTypes()`); price `Source` in `internal/marketdata/internal/feed/feed.go` (`ID`, `Codes`, `Fetch`) with the sources `bcb_ptax`, `b3_cotahist` and `ecb`; price priority `manual` 1, `csv` 2, feeds 3 (A60); `ValuedBalance` in Ledger (A65) and its `Parts` (A121); `GET /positions`, `/realized-results`, `/income-events` in Portfolio.

## 4. Parts, in delivery order

### 4.1 Subtype and tax class (G1, G6)

**Instrument subtype.** `marketdata_instrument` gains a nullable `subtype` with `CHECK (subtype IS NULL OR subtype ~ '^[a-z0-9_]{2,40}$')`. `InstrumentInput` and `Instrument` carry `subtype` as `type: string, pattern: "^[a-z0-9_]{2,40}$"`. `GET /instrument-subtypes?type=` lists the subtypes the active jurisdiction knows for a type (X8). A subtype outside that list is accepted and falls back to the class of its type, so a contributor adds a subtype without editing a core.

**Jurisdiction.** The interface changes to:

```go
TaxClass(instrumentType, subtype, exchange string) string
Treatment(incomeType, taxClass string) string
Subtypes(instrumentType string) []string
```

`br` maps, for an individual owner:

| Type | Subtype | Tax class | Treatment of `interest` and `coupon` |
|---|---|---|---|
| `fixed_income` | `cdb`, `rdb`, `tesouro` | `fixed_income` | `exclusive` |
| `fixed_income` | `lci`, `lca`, `cri`, `cra`, `debenture_incentivada` | `fixed_income_exempt` | `exempt` |
| `fund` | `fixed_income_fund`, `multimarket` | `fund` | `exclusive` |
| `fund` | `equity_fund` | `fund_equity` | `exclusive` |

The rows reproduce the rules in force at the date of this document; the implementer verifies each against the Receita Federal text before merging and cites it in the commit body. The existing treatments for `dividend` and `jcp` stay.

**Test implementation.** A `_test.go` jurisdiction with another subtype list proves X10, as `jurisdiction_test.go` does for income types.

**Scenarios.** S122: a CRI coupon recorded through `POST /investment-income` reads `exempt` in `GET /income-events`; a CDB coupon reads `exclusive`; an instrument without subtype keeps today's class and treatment (regression of the existing portfolio scenarios).

### 4.2 Fixed income accrual (G2, G6)

**Terms.** A table `marketdata_fixed_income_terms` holds, per instrument of type `fixed_income`: `issued_on date`, `matures_on date`, `index_id text NULL` (X7 pattern), `percent_of_index_bp int` (10000 is 100% of the index, default 10000), `spread_bp int` (annual, default 0), `day_count text` (`bus252` or `act365`), `face_value bigint` (minor units of the quote currency, the price at `issued_on`). A constraint refuses `matures_on <= issued_on`. `PUT /instruments/{code}/terms` and `GET` read and write it; a type other than `fixed_income` is a 422.

**Index series.** A table `marketdata_index_rate (index_id, date, rate numeric(20,12), source)` holds the rate of an index per period (refined from cumulative levels: a percent of an index applies to each period's rate, see the plan of I2). `bus252` is accepted with the `cdi` index only. An extension point `IndexSource` is declared by Market data with `ID() string`, `Fetch(ctx, from, to) ([]Level, error)`. Implementations: `br_cdi` (BCB SGS daily CDI series), `br_ipca` (BCB SGS monthly IPCA series), and a test implementation. The implementer verifies the SGS series codes against the BCB documentation. The sources are enabled by environment variable and validated at startup (X6).

**Price.** For each `fixed_income` instrument with terms, a job in the existing price refresh computes the price of every business day from `issued_on` to today as `face_value × index factor × (1 + spread)^(time) ` with the day count of the terms, rounds half to even to the instrument's scale, and stores it as a `Price` with source `accrual` and priority 3. A price of a higher priority (`manual`, `csv`) still wins (A60). After `matures_on` the last price repeats.

**Rounding and exactness.** The factor is a decimal of 12 places. The accrual uses the `money` package's exact arithmetic; no `float64` (AG2).

**Scenarios.** S123: a CDB at 110% of CDI with a face of 1,000.00 bought on 2026-01-02 has the accrual price of a fixture CDI series at 2026-06-30, stored with source `accrual`; a manual price for the same day replaces it in `GET /positions`. S124: a zero-coupon Tesouro IPCA+ with spread 600 bp over a fixture IPCA series. S125: terms on a `stock` are refused.

### 4.3 Return, allocation and net worth (G3, G4)

**Money-weighted return.** Portfolio, which already holds the Ledger and Market data ports (the first plan placed it in Reporting; `docs/superpowers/plans/2026-10-23-investments-i3-return.md` records the move), reads from Ledger: for an account tree and a period, the external flows, the opening value and the closing value, all valued in a currency.

- The tree is the account and its sub-accounts.
- An external flow is a posting on a tree account whose transaction has a posting on an asset or liability account outside the tree. Income, expense, tax and realized-result postings are internal: they are performance.
- Each flow is valued in the target currency at the stored price of its transaction date (`Convert`).
- Opening and closing values come from `ValuedBalance` at the day before the start and at the end.

`GET /reports/return?account_id=&from=&to=&value_in=` returns `{annual_bp, flows, opening, closing}` where `annual_bp` is the internal rate of return of the dated flows and the closing value, annualized, rounded half to even to an integer of basis points. It returns 422 `return_undefined` when the opening value and the flows are all zero, or when the solver does not converge. The solver may use floating point internally (AG2). A period longer than 366 days is a 400.

**Allocation.** `GET /reports/allocation?date=&by=type|currency|institution&value_in=` returns the valued balance of every open asset account grouped by the dimension, with the share in basis points that sums to 10000 (the last group takes the rounding remainder), at the base currency by default.

**Net worth.** `GET /reports/net-worth?date=&value_in=` returns assets, liabilities and their difference, valued. Liabilities include card statements owed and loans.

**Scenarios.** S126: a brokerage with one contribution, one dividend and a price change returns a hand-computed rate. S127: a period with no flow and a zero opening is `return_undefined`. S128: allocation by type of a fixture with cash, a stock and a fund sums to 10000. S129: net worth equals the sum of `GET /balances` valued, minus liabilities.

### 4.4 Goals consume the return (G5)

`Goal` gains `trailing_return`: `{ period_months, annual_bp }`, absent unless the goal's accounts have at least three months of history and at least one external flow in the last 12 months (AG4). The service calls the return of 4.3 for the union of the goal's accounts, over the last 12 months or since the earliest opening if shorter, valued in the goal currency.

The goals page shows "Last 12 months: x%" beside the yearly return control and adds a button "Use this return" that sets the control to the nearest half point. The control keeps starting at zero.

**Scenario.** S130: a goal over the brokerage of S126 returns `trailing_return` equal to the return of its account; a goal over one checking account with no history returns none.

## 5. Order and slicing

| Slice | Content | Depends on |
|---|---|---|
| I1 | 4.1: migration, jurisdiction change, endpoint, scenario S122 | none |
| I2 | 4.2: terms and index tables, `IndexSource`, accrual job, S123 to S125 | I1 (subtype `tesouro`, `cdb`) |
| I3 | 4.3: return endpoint, S126, S127 | none |
| I4 | 4.3: allocation and net worth, S128, S129 | none |
| I5 | 4.4: goal field and page, S130 | I3 |

I1, I3 and I4 are independent. I2 and I3 can run in parallel after I1.

## 6. Left to the builder

- The exact solver for the internal rate of return (Newton with a bracketed fallback is expected) and its convergence limit.
- The index factor storage details, as long as the factor is exact to 12 decimals.
- The SGS series codes and the lag of a published IPCA month.
- The names of the new problem codes, which follow ADR 004 and each get a test through the HTTP API.
- The subtype labels in the web catalogs.

## 7. Open points

- Whether the exempt treatment of `cri` and `cra` holds for an owner that is not an individual: `br` assumes an individual, as D1 does for the other rows.
- Whether the IPCA accrual uses the published month or an estimate for the current month. This document assumes the last published level, repeated until the next one is published.
