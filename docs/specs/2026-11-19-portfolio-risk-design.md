# Portfolio risk history

- Date: 2026-11-19
- Status: approved on 2026-11-19 (the owner delegated the decisions to the planning session)
- Module: `portfolio`; rules RK1 to RK14; scenarios S648 to S653
- Method sources: Dietz (1968), *Pension Funds: Measuring Investment Performance*; Bacon (2008), *Practical Portfolio Performance Measurement and Attribution*, chapter 2 (modified Dietz) and chapter 4 (volatility, drawdown); GIPS 2020, CFA Institute (three-year ex-post standard deviation of monthly returns); Menchero and Davis (2011), *Risk Contribution Is Exposure Times Volatility Times Correlation*, Journal of Performance Measurement (ex-post variance decomposition); Getmansky, Lo and Makarov (2004), Journal of Financial Economics 74 (smoothed prices understate volatility)

## Intent

The reader holds investments for years and asks how much the portfolio swings, how deep it fell, which class carries the swing and whether the classes move together. No screen answers it. `GET /reports/return` measures one period; `GET /reports/net-worth/days` holds 62 days and every flow counts as a gain there.

This spec adds a monthly history of the portfolio and of each class since the first posting: the monthly return, the volatility of the last 36 months, the drawdown, the correlation between classes and the share of the volatility each class carries.

## Goals, non-goals, anti-goals

Goals:

- G1. A monthly return per class and for the portfolio, independent of deposits and withdrawals, for every month since the first posting of the portfolio.
- G2. On each month: the annualized volatility of the 36 months that end there, the drawdown, and the number of months the volatility rests on.
- G3. Over the last 36 months: the correlation of each pair of classes and the share of the portfolio's variance each class carries beside its share of the value.
- G4. A month whose value is not known is shown as such, with its reason, and never interpolated.

Non-goals:

- A forecast of risk (value at risk, a model of the covariance of each security). It needs prices adjusted for corporate events (`docs/specs/2026-11-18-fund-report-design.md`, non-goals).
- Daily volatility. A daily series counts the drop of a security on its ex-date and its income on the payment date as two moves; a month joins both when they fall in it (RK12).
- A risk-adjusted ratio (Sharpe, Sortino). It needs a risk-free series per region; a later delivery.
- Accounts outside the brokerage trees (savings, reserves).

Anti-goals:

- A month with a stale or missing price drawn as a month without movement.
- A grade, a colour or a word that calls a volatility high or low.
- The volatility of a class priced by accrual presented as its risk without saying the price is an accrual.

## Rules

**RK1 Portfolio and classes.** The portfolio is every account of the brokerage trees of the book (the accounts that `GET /reports/return` without `account_id` measures). An account holds one instrument (`docs/domain/02-ubiquitous-language.md`); its class is the type of that instrument (`marketdata` instrument type, the key of `GET /reports/allocation?by=type`): `currency` for cash, `stock`, `etf`, `reit`, `depositary_receipt`, `fixed_income`, `fund`, `crypto`, `option`, `future`.

**RK2 Months.** The months run from the month of the first posting of the portfolio to the last month whose last day is on or before `to` (default: today in the book's time zone). The value at the start of the first month is zero. Every month since the first posting is kept: the cost is one valuation of the portfolio per month.

**RK3 Valuation.** The value of a class at the end of a month is the sum of the own balances of its accounts on the last day of the month, valued in `value_in` (default: the base currency) with the chosen price on or before that day, as `GET /reports/allocation` values a date. A balance whose conversion has no price makes the class month `missing`. A balance of a security whose chosen price is dated before the first day of the month makes the class month `stale`: the price did not move in the month, so the value did not either. A balance in the currency `value_in` needs no price. A conversion of a currency to another uses the same rule. The portfolio month is `missing` or `stale` when a class month is; `missing` wins.

**RK4 Flows.** The flows of a security class are the external flows of its accounts taken as one tree (`TreeExternalFlows`, investments design 4.3 and BC15), valued in `value_in` on their date. The flows of the portfolio are the external flows of the brokerage trees. The flows of the class `currency` are, date by date, the flows of the portfolio less the flows of the security classes. A purchase paid from the cash of the brokerage is then an outflow of `currency` and an inflow of the security's class of the same amount, internal to the portfolio. An income of a security paid into the cash of the brokerage is a withdrawal of the security's class (BC15) and money the cash receives from it: the return of the security holds the income, and the portfolio counts it once. The tree of a security class needs no rule for sub-accounts: the ledger keeps a sub-account of a security in the same instrument, so it is in the same class, and only a cash account holds securities below it. A flow whose conversion has no price makes the class month and the portfolio month `missing`.

**RK5 Monthly return (modified Dietz).** For a class over a span that starts at the end of month `a` and ends at the end of month `b`: `gain = V(b) − V(a) − ΣF`, `base = V(a) + Σ w × F` with `w = (L − d) / L`, where `L` is the number of days of the span and `d` the days from its start to the flow's date (a flow earns from the next day, return comparison R1). `return = gain / base`. With `V(a) = 0`, `V(b) = 0` and no flow, the month is `nothing_held`. With `base ≤ 0` otherwise, the month is `no_base`. The portfolio's gain and base are the sums over the classes (RK4), so the portfolio return equals the sum of `base_c / Σ base × return_c` over the classes.

**RK6 Spans.** A span runs from one known month end to the next. A month after a `stale` or `missing` month carries the span since the last known month end, and `span_months` states its length. A span of more than one month enters the drawdown and leaves the volatility.

**RK7 Volatility.** On each month, `volatility_bp` is the sample standard deviation (n − 1) of the one-month returns of the 36 months that end there, times √12, in basis points. It needs at least 12 such returns; `volatility_months` is their number. A value below 36 months is marked on screen as a short sample (GIPS 2020 states 36).

**RK8 Drawdown.** An index starts at 1 and multiplies by `1 + return` at each span. A `nothing_held` month multiplies by 1. A `no_base` month ends the run; the index and its peak start again at 1 after it. `drawdown_bp` of a month is `index / peak − 1`, with the peak the highest index since the start of the run; `max_drawdown_bp` is the lowest drawdown of the series.

**RK9 Correlation.** For each pair of classes, the Pearson correlation of their one-month returns over the months of the last 36 that both hold, in basis points of 1. It needs at least 12 common months; otherwise the pair is absent.

**RK10 Share of the risk.** Over the months of the last 36 with a one-month portfolio return, the contribution of a class in a month is `gain_c / Σ base`. `risk_share_bp` is `cov(contribution_c, return_p) / var(return_p)` in basis points; the shares sum to 10000 apart from rounding. It needs at least 12 months and a positive variance. `weight_bp` is the class's share of the portfolio value at the last known month end, by the allocation rule (`domain.Allocate`). A class whose risk share exceeds its weight swings more than its size.

**RK11 Accrual.** `accrual_bp` is the share of the class's value at the last known month end valued with a price of source `accrual`. Accrual prices rise by a rate every day and leave the volatility near zero by construction (Getmansky, Lo and Makarov 2004); the screen states it beside every class with `accrual_bp` above zero.

**RK12 Income dates.** An income enters the return on its payment date, the date of its transaction (`portfolio_income_event.date`). The ex-date is not recorded. A month joins the drop of the ex-date and the payment when both fall in it, the usual case of a real estate fund (record date at the end of a month, payment in the next, ex-date on its first business day). A stock whose ex-date and payment fall in different months moves the income by those months; the volatility of the class then counts one extra move of the size of the income.

**RK13 Rounding.** The arithmetic runs in floating point and every figure leaves as an integer of basis points rounded half to even (investments design AG2).

**RK14 Contract.** `GET /reports/risk` takes `to` (date, optional) and `value_in` (optional), role `read`, and returns `value_in`, `from` and `to` (the first and last month ends), `window_months` (36), `portfolio` and `classes` (each a `RiskSeries`: `key`, `months`, the optional `volatility_bp`, `volatility_months`, `max_drawdown_bp`, `weight_bp`, `risk_share_bp`, `accrual_bp`), and `correlations` (`a`, `b`, `correlation_bp`, `months`). A month holds `month` (its last day), `state` (`known`, `stale`, `missing`, `nothing_held`, `no_base`) and, when known, `return_bp`, `span_months`, `drawdown_bp`, `volatility_bp`, `volatility_months`. The summary fields of a series are those of its last month with a volatility, and `max_drawdown_bp`. Classes are ordered by `weight_bp`, largest first, then by key. 400 `invalid_request` when `value_in` is not three capital letters; a code of that form without a price leaves its months `missing`. A book without a brokerage returns empty `months`, `classes` and `correlations`.

## Screen

A section "Risco ao longo do tempo" on the portfolio page (`/portfolio`), below the return:

- A line chart of the volatility of the portfolio and of each class by month; a month without volatility leaves a gap.
- A line chart of the drawdown of the portfolio by month, with the deepest point written under it with its month.
- A table of the classes: weight, share of the risk, volatility, the deepest fall, and the note of accrual (RK11).
- A table of the correlation of each pair (RK9).
- A neutral sentence when months are `stale` or `missing`: how many and in which classes.
- A neutral sentence when the last volatility rests on fewer than 36 months.

## Cross-cutting questions

- R1: The month length and 36 months of window are not regional. The classes come from the instrument types of `marketdata`, which are not regional. The currency is `value_in` or the base currency of the book.
- R2: Every region gets the same rules; nothing depends on a region.
- R3: `state` is a closed set of this spec that does not grow with regions; class keys are instrument types, already a `pattern` in `api/openapi.yaml`.
- R4: Does not apply: no extension point.
- R5: Catalog keys under `portfolio.risk.*` in `catalog-portfolio.*` with pt-BR and en text: section title and description, chart labels, table headers, state sentences, the accrual note.
- R6: Percents through `numberFormatter` with the active tag; months through `formatReferenceMonth`.
- C1: Values and flows are integers of minor units with their currency (`money.Money`); the returns leave as basis points (RK13). No amount is stored.
- C2: Every value and flow is converted to `value_in` on its date by the existing conversion; a missing rate makes the month `missing` (RK3, RK4) and the screen counts it.
- C3: A security or cash in another currency counts in `value_in`, so its volatility includes the exchange rate; S652 values a security in `BRL` in `USD`.
- C4: The screen writes no amount; the currency name comes from the response.
- T1: Month ends are calendar dates; "today" comes from `platform/clock` in the book's time zone.
- T2: Does not apply: no business day is counted; a month end on a holiday takes the chosen price on or before it.
- B1: Does not apply: no table.
- B2: `GET /reports/risk` needs `read`; an HTTP test reads it as a reader and refuses a request without a session.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: Does not apply: the report records nothing.
- D4: Does not apply: no data from a bank, a file or a model.
- D5: Does not apply: the diagnostic file gains no field.
- S1: `getRisk` is new; `internal/server/tool_exposure_test.go` names the tool view `risk` of `get_portfolio`. No new `Problem.code`; `invalid_request` on `value_in` has an HTTP test (S653).
- S2: Does not appear on a phone: `/portfolio` is a desk route (ADR 027).
- S3: `internal/assistant/guide/articles/investments.md` describes the section in the commit of the screen.
- S4: The assistant reads the summary through `get_portfolio` view `risk`: the series summaries and the correlations, without the months.
- X1: S648 monthly returns, flows, income, stale span, drawdown and accrual (RK3 to RK6, RK8, RK11); S649 and S651 volatility and its 12-month floor, correlation and risk share (RK7, RK9, RK10); S650 a missing month and its span (RK3, RK6); S652 values in another currency (C3); S653 an invalid `value_in`, an empty book and the roles (B2).
- X2: S652 values the report in `USD`, a currency other than the security's; nothing depends on a region.
