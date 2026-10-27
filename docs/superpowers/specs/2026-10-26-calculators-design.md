# Calculators design

Status: draft, awaiting owner approval.

Evidence: `docs/superpowers/specs/2026-10-26-tools-study.md`, cited as "study §n" and by its IDs (E, M, W, C, K).

## 1. Intent

A section of the web interface holds calculators: screens that take inputs, apply one published method and return the result with the method explained. Two needs drive it. People underestimate the rate implied by a payment stream and the growth of savings (E1, E2), and a calculator that shows both changes decisions (E2). The ledger already holds the figures many calculators ask for (balances, expenses, schedules, index rates), so a calculator can start from the person's own numbers.

Term: this document and the code call the section "calculators". "Tool" keeps its meaning of ADR 012, an operation of a language model agent.

## 2. Goals, non-goals, anti-goals

Goals:

| ID | Goal |
|---|---|
| CG1 | Twelve calculators of section 5, reachable from `/calculators`, grouped as Invest, Credit and debt, Plan. |
| CG2 | Each calculator explains its method on the same screen: purpose, steps in words, formula, assumptions, limits and sources with links. |
| CG3 | A data-connected calculator fills inputs from equori; every filled input stays editable and names its origin. |
| CG4 | Each method is a pure function with table tests whose expected values come from the formulas of study §3. |
| CG5 | The inputs of a calculator live in the address, so a result can be reopened and shared as a link. |

Non-goals: assistant tools for calculators; saving a calculation as a record; budget shares against a split (study §3.7: no evaluation found, no group attribute on categories); salary net of payroll taxes (study §3.6: rules changed in 2026, high maintenance); IOF below 30 days (annex not read, study §7); a Brazilian withdrawal rate (study §3.4: none found).

Anti-goals:

- A default for a value the person must choose without a sourced basis: target months of reserve, withdrawal rate, expected return, volatility. These fields start empty.
- A label, color or icon that judges a result good or bad (K3). A comparison of two computed numbers states which is lower and by how much.
- A regional value outside the code of its region (K2, web O10).
- A result shown without the assumptions it depends on.

## 3. Constraints

- Computation runs in the browser, in TypeScript, as the goal what-if does (study §4). No new HTTP operation computes a calculator.
- Amounts are integer minor units of the base currency (web O7). A method may compute in floating point; every amount it returns, and the balance of every period, is rounded half to even to a minor unit. A projection is labelled an estimate (K1).
- Rates are fractions in floating point (0.01 = 1%). A displayed rate shows up to 4 decimals; a CET shows 2 decimals, rounded half to even (CMN 4.881, art. 4, sole paragraph).
- Amounts are written through `useMoneyFormat()` (web O9). Privacy mode masks amounts, filled or computed; rates and months stay visible (ADR 018).
- Every text comes from the catalogs `web/src/i18n/catalog-calculators.en.ts` and `catalog-calculators.pt-BR.ts` (web O6).
- A rate solver stops when the error on the target amount is below 0.000001 of it (study M2, M3), or after 200 iterations, and then reports no solution.
- Months are added by calendar month; a missing day resolves to the last day of the month (vision T02).

## 4. Common behavior

| Rule | Detail |
|---|---|
| Routes | `/calculators` lists the calculators by group, each with its title and one line on the question it answers. `/calculators/$id` shows one. |
| Destination | Key `calculators`, icon `calculator`, phone `more`, placed after `reports`. |
| Layout | Inputs, then results, then the section "How it is calculated". Below 600 px the same order, one column. |
| Explanation | "How it is calculated" holds: what the calculator answers; the steps in words; the formula with each symbol defined; assumptions; limits; sources, each a link with its title. A term defined in study §3 is defined once, at first use, in one sentence. |
| Address | Inputs are search parameters validated by the route's `validateSearch`. An invalid value is dropped and the field shows empty. |
| Filled inputs | A filled input shows "From your data: <origin>" below it, and a control to fill it again. Editing it removes the note. |
| Index data | Inputs that read an index list only the indexes returned by `GET /indexes`. With none, the index options are absent and the "How it is calculated" section states that the instance fetches no index (`docs/operations/price-feeds.md`). |
| Trailing 12 months | Of a daily index: product of (1 + rate) over the dates after the last stored date minus one year, up to it, minus 1. Of a monthly index: product over the last 12 stored months, minus 1. The origin note names the period. |
| Index basis | A rate over a daily index takes a basis, address key `basis` (`<rateKey>Basis` in a rate source). `expected`, the default for an index with a market survey's path: ADR 026 E6 to E9, over the calculator's horizon. `current`, the default otherwise: the last stored rate replaces each rate of the trailing 12 months, so the year keeps its count of stored days (252 business days for the CDI, 365 calendar days for an actual/360 index). `trailing`: the stored rates of the trailing 12 months. A monthly index always takes its trailing 12 months. The origin note names the basis and the date. Amendment of 2026-10-27: the trailing basis follows a change of the policy rate a year late; a constant rate misstates a long projection in a cycle of cuts or rises (ADR 026). |
| Empty and invalid | Results show only when every required input is valid. A method that finds no solution states why in words (section 5). |

## 5. Calculators

Group Invest:

| ID | Question | Inputs | Results | Method | Data |
|---|---|---|---|---|---|
| `compound` | How much will an investment reach? | initial amount; monthly deposit; months; annual rate, or a percent of a daily index; annual inflation (optional); delay in months (default 12); annual volatility (optional); mode "final amount" or "deposit for a target" with the target; withdrawal term (optional, empty by default) | final amount; total deposited; interest; final amount in today's money when inflation is set; final amount when starting after the delay, and the difference; with volatility, the 10th, 50th and 90th percentile of the final amount; chart of balance and deposits by month; monthly income of the final amount after the term: the one that keeps its purchasing power (its nominal value without inflation), in today's money and in money of the term's end, and with a withdrawal term the one that spends it over that term; a statement when inflation reaches the rate | M1, M2 (deposit at the start of each month, BCB), M5; deposit for a target solves M2 for p with the initial amount; real value by M6; range by simulation (below); income W withdrawn at the end of each month and raised each month by the monthly inflation g (0 without inflation): W = F · (j − g), none when g ≥ j; over a withdrawal term of n months W = F · (j − g) / (1 − ((1 + g) / (1 + j))^n), F · (1 + j) / n when j = g; today's money divides by (1 + annual inflation)^(months / 12) | trailing 12 months of a daily index for the percent; of a monthly index for inflation |
| `rates` | What is this rate per month, per year, or after inflation? | rate and its period; inflation (optional); percent of a daily index (optional) | monthly and annual equivalents; real rate; annual rate of the percent of the index | M5, M6; percent of a daily index: product of (1 + percent × daily rate) over the trailing 12 months, minus 1 | trailing 12 months of indexes |
| `correction` | What is an amount from one month worth in another? | amount; index; start month; end month | corrected amount; accumulated factor and percent; months used | M7: factor = product of (1 + rate) of every month from the start month to the end month, both included; a daily index takes the days of those months | `GET /indexes/{id}/rates` |
| `fixed-income` | What remains after tax, and which exempt rate matches a taxable one? | amount; annual gross rate, or a percent of a daily index; days held; taxable or exempt | gross yield; tax; net yield; net annual rate; equivalent rate of the other kind | yield = amount × ((1 + r)^(days/365) − 1); tax by the region rule (section 7); equivalent: r_e = r_t × (1 − t), r_t = r_e / (1 − t) | trailing 12 months of a daily index |

Group Credit and debt:

| ID | Question | Inputs | Results | Method | Data |
|---|---|---|---|---|---|
| `financing` | What does a loan cost, in Price and in SAC, and what does a prepayment change? | amount; rate and its period; months; solve for one of amount, rate, months, installment (Price); prepayment: month and amount (optional) | for each system: first and last installment, total paid, total interest, table by month (installment, interest, amortization, balance); prepayment: remaining interest without it, keeping the installment (months left), keeping the term (new installment) | Price: M3, installment rounded once, last installment closes the balance; SAC: M4, amortization rounded once, last one closes the balance; prepayment recomputes from the balance after that month's installment | none |
| `cash-or-installments` | Is the cash price or the installment plan cheaper? | cash price; number of installments; installment amount; first installment now or in one month; comparison rate: monthly, annual or a percent of a daily index | implied monthly and annual rate; present value of the installments at the comparison rate; difference to the cash price | implied rate solves cash = Σ p/(1 + j)^k; total of installments at or below the cash price: no interest, rate 0 or negative shown as a discount; present value at the comparison rate | trailing 12 months of a daily index |
| `credit-cost` | What is the effective annual cost of a credit offer? | amount released; fees paid upfront; installment amount; number; release date; first due date | effective annual cost, 2 decimals; monthly equivalent; total paid; table of flows with days from release | CMN 4.881 art. 4: FC₀ = Σ FCⱼ/(1 + c)^((dⱼ − d₀)/365); FC₀ is the amount less upfront fees; due dates monthly from the first | none |
| `debt-payoff` | In what order should debts be paid, and when do they end? | debts: name, balance, monthly rate, minimum payment; total monthly budget | for avalanche and snowball side by side: months to the last payment, total interest, month each debt closes; the difference in interest | each month, every open debt accrues interest = balance × rate, rounded; every open debt receives its minimum, capped at its balance; the rest of the budget goes to open debts in the order's sequence, each capped at its balance. Avalanche: highest rate first, ties by smaller balance. Snowball: smaller balance first, ties by higher rate. A budget below the sum of minimums: no plan, stated. Not closed after 1200 months: stated | balances of accounts of kind `loan` and `credit_card` (liability), each a row with rate and minimum empty |

Group Plan:

| ID | Question | Inputs | Results | Method | Data |
|---|---|---|---|---|---|
| `reserve` | How many months of expenses do liquid balances cover? | liquid balance; mean monthly expense; target months (empty by default); months to reach it | months covered, one decimal; gap to the target; monthly amount to close the gap in the chosen months | months = balance ÷ expense; gap = max(target × expense − balance, 0); monthly = gap ÷ months, rounded up to a minor unit | liquid balance and mean monthly expense of `GET /reports/indicators` (analytics design §4) |
| `recurring-cost` | What does a recurring expense cost over the years? | amount per occurrence; per month or per year; years; annual rate (optional) | total paid; future value of the same payments at the rate; difference | total = amount × occurrences; future value by M2 with deposits at the start of each period and the rate of that period (M5) | a schedule of the planning module fills the amount |
| `independence` | How large must investments be to pay the expenses, and when are they reached? | monthly expense; withdrawal rate (empty by default); current investments; monthly deposit; annual real return | target = monthly expense × 12 ÷ withdrawal rate; months to the target; month reached | months: smallest n for which M1 of current plus M2 of the deposit reaches the target at the monthly real rate; not reached in 1200 months: stated. The explanation states W1 to W3 and that they rest on United States history | mean monthly expense from `GET /reports/indicators`; current investments from the net worth of `GET /reports/net-worth` at today |
| `own-or-rent` | Does owning cost less per year than renting? | price; annual rent; forgone interest rate; property tax rate; deductible tax rate (default 0); mortgage rate; maintenance rate; expected appreciation; risk premium | annual cost of owning and its six components; annual rent; difference | study §3.5 | none |

Simulation of `compound` (E4): 2,000 paths of monthly returns. Each month's return is exp(μ + σ·z) − 1 with σ = annual volatility ÷ √12, μ = ln(1 + annual rate) ÷ 12 − σ²/2 and z standard normal. The generator is seeded with a fixed seed, so the same inputs give the same percentiles. The explanation states that returns are assumed independent and log-normal, that the range is not a forecast, and E4. Volatility 0 gives three equal percentiles, equal to the final amount of M2.

## 6. Index data

| Rule | Detail |
|---|---|
| History | An enabled index (ADR 025) is fetched from the earlier of today minus 20 years and the earliest issue date of a security that follows it. Fetching no longer waits for a security. |
| `GET /indexes` | Tag `marketdata`, `listIndexes`. Items: `id`, `period` (`day` or `month`), `first` and `last` stored dates. Only enabled indexes with at least one stored rate. |
| `GET /indexes/{id}/rates?from&to` | `listIndexRates`. Items: `date`, `rate` as a decimal string fraction, oldest first. A range above 7,320 days is 422 on `to`; an unknown or disabled index is 404 `not_found`. |
| Tool | The assistant tool `get_market_data` gains the views `indexes` and `index_rates`. |
| Period | Each index source declares its period: `br_cdi` `day`, `br_ipca` `month`. |

## 7. Fixed-income tax by region

An extension point in `web/src/features/calculators/fixed-income-region.ts`: `fixedIncomeRules(region)` returns the rule of the region or `null`. With `null`, the calculator asks for the tax rate on the yield and applies it. Case `BR` (study §3.6):

- taxable yield withholds 22.5% up to 180 days, 20% from 181 to 360, 17.5% from 361 to 720, 15% above 720 (Lei 11.033/2004, art. 1, in force after the expiry of MP 1.303/2025);
- exempt: no tax;
- below 30 days: no result; the screen states that IOF applies and is not computed;
- a note in the explanation states that Brazilian contracts quote rates on 252 business days, so a contract figure differs from the 365-day figure.

The rule lists its sources and the date it was checked, 2026-10-26. `docs/contributing/regions.md` gets a row for this extension point.

## 8. Acceptance

- Each method has table tests with the values below; each screen has a test that enters inputs and reads the results, with privacy on for one data-connected screen.
- Scenario S157 in `docs/domain/06-scenarios.md`: history fetch, `listIndexes`, `listIndexRates` and the 404 and 422 problems, through `internal/apitest`.
- Reference values (minor units of a 2-decimal currency):

| Case | Expected |
|---|---|
| M1: 100000 at 1% for 12 months | 112683 |
| M2: 10000 a month at 0.5% for 12 months | 123972 |
| Price: 1000000 at 1% for 12 | installment 88849, last 88847, interest 66186 |
| SAC: 1200000 at 1% for 12 | first 112000, last 101000, interest 78000 |
| Prepayment of 200000 after installment 6 of the Price case | balance 314920; keep installment: 4 months, interest 7420; keep term: installment 54339, interest 11113; without: interest 18172 |
| Cash 100000 against 10 × 11000 from one month | 1.771543% a month, 23.4572% a year; present value at 1% a month 104184 |
| CET: 1000000 released 2026-01-10, fee 20000, 12 × 88849 from 2026-02-10 | 17.14%; without the fee 12.74% |
| M5: 1% a month | 12.6825% a year |
| M6: 10% nominal, 4% inflation | 5.7692% |
| Income of 1000000 at 1% a month, inflation 0.5% a month | 5000 a month; over 360 months 6006 |
| IPCA 2020-01 to 2020-12 (SGS 433) | factor 1.04517342 |
| Fixed income BR: 1000000 at 12% for 400 days, taxable | yield 132238, tax 23142, net 109096 |
| Equivalent of 10% exempt at 17.5% | 12.1212% |
| Debt payoff: 100000 at 3% min 5000; 300000 at 1% min 10000; 50000 at 2% min 2500; budget 30000 | avalanche 17 months, interest 52780; snowball 17 months, interest 55652 |
| Own or rent: 50000000, rates 10%, 1%, τ 0, 11%, 1.5%, 4%, 2% | annual cost 5250000 |
| Reserve: 1200000 liquid, 400000 expense, target 6, 12 months | 3.0 months, gap 1200000, 100000 a month |
| Independence: 500000 monthly expense, 4% | target 150000000 |

## 9. Calls made without the owner

- Computation in the browser, not on the server: results update while typing, and no calculator needs an HTTP operation.
- Twelve calculators; budget shares, payroll and IOF below 30 days are out (section 2).
- Section name "calculators", to keep "tool" for ADR 012.
- Index history of 20 years, the SGS limit of 10 years per request handled by the existing 5-year window.
- Fixed-income days on a 365-day basis, with the 252-day note for Brazil.
- `reserve` and `independence` read the analytics indicators operation; they follow the analytics plan.

## 10. Left to the builder

Component structure within the files of the plan; chart encodings through the `dataviz` skill and the Slotted `Chart`; wording of the catalogs in both languages within section 4; the random generator and the normal sampler.
