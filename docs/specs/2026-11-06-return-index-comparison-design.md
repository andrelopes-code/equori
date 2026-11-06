# Return compared with an index

Amends `docs/specs/2026-10-23-investments-design.md` (NG5, section 4.3). Amendment A208.

## Intent

The return report (`GET /reports/return`) gives the money-weighted annual return of an account tree. It does not state whether a savings account sold as "100% of CDI" paid 100% of CDI. This design adds two figures to the report:

- the time-weighted return of the period: the growth of one unit of money held in the tree for the whole period, independent of the size and timing of deposits and withdrawals (GIPS, CFA Institute);
- the percent of a daily index that would produce the same growth over the same days: the figure a fixed income contract states (`110% of CDI`).

## Goals

| ID | Goal |
|---|---|
| G1 | The report returns the time-weighted return of the period. |
| G2 | The report compares that return with a daily index: the index's own growth and the equivalent percent of the index. |
| G3 | The return screen lists savings and reserve accounts, so a savings account can be measured on its own. |

## Non-goals

| ID | Non-goal |
|---|---|
| N1 | A return net of taxes (income tax, IOF). Yield is gross (investments design NG3). |
| N2 | A return adjusted for inflation. |
| N3 | Comparison with a monthly index. A monthly rate covers days outside a period that starts or ends inside the month. |
| N4 | Annualizing the time-weighted return. The equivalent percent is the comparable figure across periods. |
| N5 | A comparison on the trailing return of a goal (S130). |

## Rules

**R1 Time-weighted return.** The period `(from − 1, to]` splits at each date with an external flow (the flows of section 4.3, in `value_in`). `V(d)` is the valued balance of the tree at the end of day `d`, the day's flows included. `F(d)` is the sum of the flows of day `d`. A subperiod ends at each flow date and at `to`; its return is `r = (V(end) − F(end) − V(start)) / V(start)`. A flow therefore earns from the next day, the convention of a CDI deposit. `period_bp` is `(Π(1 + r) − 1) × 10000`, rounded half to even. A subperiod with `V(start) = 0` and zero gain contributes 1. A subperiod with `V(start) ≤ 0` and a nonzero gain, or a factor `1 + r ≤ 0`, leaves `period_bp` absent.

**R2 Index.** The query parameter `index` names an enabled index with stored rates (`^[a-z0-9_]{2,40}$`). Without it, the index is the default of the book's region (`defaultBenchmark` in `internal/portfolio/region_defaults.go`): `cdi` for `BR`, none for any other region. A named index that is not enabled or has no rate is 400 `invalid_request` on `index`; a named index whose period is not `day` is 400 `invalid_request` on `index`. A default index that is not enabled or has no rate leaves `benchmark` absent.

**R3 Window.** `until` is the date of the last rate of the index in `[from, to]`. Rates are dated on the business day they apply to, as in the accrual (section 4.2). With no rate in `[from, to]`, `benchmark` is absent. `benchmark.return_bp` is R1 over `(from − 1, until]`.

**R4 Index growth.** `benchmark.index_bp` is `(Π(1 + rate_d) − 1) × 10000` over the rates dated in `[from, until]`, rounded half to even.

**R5 Equivalent percent.** `benchmark.percent_bp` is `p × 10000` for the `p` that solves `Π(1 + p × rate_d) = 1 + return` over the same rates, rounded half to even: 10000 is 100% of the index. The product grows with `p` when every rate is positive, so bisection over `p ∈ [−10, 10]` finds the one solution. `percent_bp` is absent when a rate is not positive, when `benchmark.return_bp` is absent, or when no `p` in the interval solves the equation. The solver uses floating point; the result leaves as an integer (AG2).

**R6 Contract.** `GET /reports/return` takes `index` and returns `period_bp` (integer, optional) and `benchmark` (optional: `index`, `until`, `index_bp`, and the optional `return_bp` and `percent_bp`). The tool view `return` of `get_portfolio` returns the same two fields with the default index; a tool schema has no null (ADR 012 T4), so an undefined value and a zero value are both absent there.

**R7 Screen.** The account list of the return screen adds the asset accounts of kind `savings` and `reserve` after the investment accounts, sorted by label. Under the annual rate, the screen shows the period return and, when `benchmark` is present, the index growth and the equivalent percent with the window `from`–`until`.

## Region-dependent values

| Value | Extension point |
|---|---|
| The default benchmark index | `defaultBenchmark` in `internal/portfolio/region_defaults.go`, row "Benchmark index" of `docs/contributing/regions.md` |

## Scenarios

- **S302** A savings account of 10,000,000.00 that receives each business day the CDI of the day on its balance, over the six CDI days 2026-01-02 to 2026-01-09: `benchmark` has `index` `cdi`, `until` 2026-01-09, `index_bp` 33 and `percent_bp` 10000; `period_bp` 33.
- **S303** The same account receives a deposit of 10,000,000.00 from checking on 2026-01-06 and keeps receiving the CDI of the day on its balance: `percent_bp` stays 10000; `period_bp` 33. With `to` 2026-01-12, after the last stored rate, `until` is 2026-01-09.
- **S304** `index=ipca` (a monthly index) is 400 `invalid_request` on `index`; `index=sofr` with no enabled source is 400 `invalid_request` on `index`.
