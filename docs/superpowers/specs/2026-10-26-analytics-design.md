# Analytics design: indicators, overview layout, chart encodings

Status: draft, awaiting owner approval.

Evidence: `docs/superpowers/specs/2026-10-26-analytics-study.md` (cited below as "study §n" and by finding ID: V for visualization, D for dashboard, C for customization).

## 1. Intent

The overview answers the four questions shared by the CFPB scale, the I-SFB and the Financial Health Network indicators (study §1.1): whether current obligations are met, whether a shock can be absorbed, whether goals progress, and how much income is free. Today it answers the first and the third only in amounts of one month (study §5.2). This design adds indicators that answer all four as ratios over time, keeps the overview a fixed default layout with a local hide control, and replaces the encodings that study §5.3 found against the perception evidence.

## 2. Goals, non-goals, anti-goals

Goals:

| ID | Goal |
|---|---|
| AG1 | One operation returns the indicators of section 4 for a month, with a 12-month series per indicator. The web and the assistant read the same numbers. |
| AG2 | The overview shows the indicators in one block; `/reports` shows their series in a new tab. |
| AG3 | The owner hides an overview block from the block itself and shows every hidden block again from the page. |
| AG4 | Comparison charts use position or length (V1, V2, V5). |

Non-goals: reference thresholds or benchmarks; personal targets per indicator (goals over accounts already exist); housing cost ratio and fixed versus discretionary spending (no stored attribute, study §5.2); a dashboard builder, several dashboards, free resizing; a survey-based well-being score.

Anti-goals:

- A label, color or icon that judges an indicator good or bad. The only thresholds found come from one United States panel of 1996 (study §1.2, §1.3), and no region has a sourced value.
- An indicator shown as a number when its inputs are insufficient. Such an indicator shows its reason instead.
- An overview figure that differs from the `/reports` figure of the same indicator and month.
- Color as the only cue for a direction or a series (V8, V9).

## 3. Constraints

- Module rules of ADR 002. `reporting` reads other modules' tables with `SELECT` only and may import the root package of another module, as `planning` imports `ledger` (`internal/planning/planning.go`).
- Every query filters by `user_id` (ADR 003). A new operation follows ADR 007 and has an entry in `internal/server/tool_exposure_test.go`.
- Money stays integer with an instrument (ADR 005, web O7). Ratios are basis points, as `formatSignedBasisPoints` (`web/src/i18n/format.ts`) already formats.
- Privacy mode masks amounts and leaves percentages unmasked (ADR 018, Consequences). Indicator ratios follow that rule; indicator amounts go through `useMoneyFormat()`.
- Regions: this design introduces no region-dependent value. The list of liquid account kinds is a property of the account model (`docs/domain/02-ubiquitous-language.md`, Account kind), not of a region.

## 4. Indicators

### 4.1 Common definitions

| Term | Definition |
|---|---|
| Month `m` | The calendar month requested, `YYYY-MM`. When `m` is the current month, its figures run to today. |
| Trailing window of `m` | The up to 12 complete calendar months before `m`, starting no earlier than the month of the user's first posting. |
| Income of a month | Total of the categories of class `income` in the cash view of `getCategoryTotals` (A77), in the base currency. |
| Expense of a month | Same, class `expense`. |
| Mean monthly income, mean monthly expense | Income or expense of the trailing window divided by its number of months. |
| Liquid accounts | Accounts of class `asset` and kind `checking`, `savings`, `cash`, `wallet` or `reserve`, without the flag of 4.3. A closed asset account holds a zero balance (`closeAccount`, A74), so closed accounts need no filter. Kind `benefit` is excluded: its balance pays only the expenses the benefit covers. |
| First posting month | The month of the earliest booked date among the user's postings that are not voided. |
| Base categories | Categories whose instrument is the base currency. Income and expense sum only these, as the overview spending block does. |
| Liquid balance at a date | Sum of the balances of the liquid accounts at that date, valued in the base currency as `getNetWorth` values assets. |

Cash view, decision: Greninger 1996 defines monthly expenses to include "debt/credit repayment" (study §1.2), which is the cash view. All indicators use it, so the four figures share one basis. The overview month block keeps its current computation (`web/src/features/overview/month-flows.ts`). The indicators block states "cash basis" in its description.

Minimum history: a trailing value needs at least 3 complete months in the trailing window. With fewer, the indicator returns the reason `insufficient_history`.

### 4.2 Indicators

| ID | Indicator | Formula | Null with reason | Study |
|---|---|---|---|---|
| I1 | Savings rate of the month | (income − expense) ÷ income of `m`, basis points, truncated toward zero | `no_income` when income ≤ 0 | §1.1 FHN "spend less than income"; §1.2 savings ratio |
| I2 | Trailing savings rate | (income − expense) ÷ income over the trailing window | `no_income`, `insufficient_history` | same |
| I3 | Liquidity ratio | liquid balance at the end of `m` (today for the current month) ÷ mean monthly expense; basis points, 10000 = one month of expenses | `no_expense`, `insufficient_history` | §1.2 liquidity; §1.1 CFPB "absorb a shock" |
| I4 | Committed share | total of `planning` `Committed` for `m` ÷ mean monthly income | `no_income`, `insufficient_history` | §1.1 CFPB "control"; vision G2 |
| I5 | Debt service share | debt service of `m` ÷ mean monthly income | `no_income`, `insufficient_history` | §1.2 debt service |
| I6 | Liabilities | liabilities of `getNetWorth` at the end of `m` | none | §1.2 net worth; S129 |

Debt service of a month: principal paid into accounts of class `liability` and kind `loan`, from balance accounts, plus the cash-view total of the category with system role `interest` (`docs/domain/05-domain-model.md`, `systemRole`). The roles `fees` and `taxes` are left out: they hold account fees and taxes that are not debt payments. In S20 an installment of 1,250.00 gives 900.00 of principal and 350.00 of interest: debt service 1,250.00. Known limit: the principal share of a financed card statement (S149) is distributed to its purchase categories by the cash view and is not counted as principal; its interest is counted through the `interest` role.

Series: each indicator also returns the 12 values for the months `m − 11` to `m`. Each value is computed by the rules above for that month, with its own trailing window.

### 4.3 Exclusion from liquidity

A ledger account attribute `excluded_from_liquidity` (boolean, default false) removes a liquid account from I3, for example a `reserve` that holds a deposit without daily liquidity (vision A11). The account edit screen shows it only for the liquid kinds. It changes only I3. The column changes the exported table `ledger_account`, so it comes with `archive_version` 2 and its archive step (ADR 021, V2).

### 4.4 Operation

`GET /reports/indicators?month=YYYY-MM`, owned by `reporting`, tag of `reporting`. The response carries the base currency and 12 month entries, oldest first; the last entry is `m`. Each entry carries the amounts of its month (income, expense, committed, debt service, liquid balance, liabilities, and the mean monthly income and expense when the trailing window has at least 3 months) and the five ratios. A ratio is an object with either `bp` (integer basis points) or `reason`. A month after the current month is rejected with a problem (ADR 004). The operation is a read-only tool of the assistant.

`reporting` reads `Committed` through the root package of `planning`. All other inputs come from `ledger` tables and from existing `reporting` queries.

## 5. Overview

### 5.1 Indicators block

New block placed after net worth in the default order. It shows I1 with I2 beside it, I3, I4 and I5. I5 shows only when I6 is above zero or debt service of `m` is above zero. Each figure shows:

- the value: percent for I1, I2, I4, I5; months with one decimal for I3;
- a sparkline of the 12-month series, whose generated description states the direction in words (V8);
- one line that defines the figure in plain words and names its inputs (V10);
- the reason in words when the value is null.

The block header links to the indicators tab of `/reports`. No figure carries a judgment color, a delta tone or a threshold.

### 5.2 Hide

| Rule | Detail |
|---|---|
| Controls | Each hideable block header has a menu with "Hide block". The page header has "Show hidden blocks (n)" while n > 0, which shows every hidden block again. Placing the control on the block follows C2 and C3. |
| Hideable | The blocks drawn through `OverviewBlock`: net worth, month flows, spending, upcoming, cards, budgets, goals, indicators. |
| Fixed | The attention list cannot be hidden: it holds exceptions, and hiding a block that holds exceptions degrades the outcome (C3). The desk figures and the balance chart have no block header and stay. |
| Reorder | Out of scope: the desk grid places blocks in slots of fixed width (`web/src/features/overview/overview-page.module.css`), so a moved block changes width. |
| Storage | Per browser in `localStorage`, as ADR 018 P1 stores the privacy preference, under key `equori.overview.hidden`, a JSON array of block ids. A value that cannot be read yields no hidden block. An id unknown to the current build is dropped. |
| Phone | The phone layout applies the same hidden set and keeps the attention list first (`docs/web-roadmap.md` §7). |

## 6. Reports

New tab "Indicators" on `/reports`, state in the address like the other tabs. It shows one line chart per indicator over the 12 months ending at the chosen month, one value axis each, with no shared or dual axis (V6). The I1 chart draws I2 as a dashed reference series. The chart's table view gives the text equivalent (study §5.3).

## 7. Chart encodings

| File | Change | Evidence |
|---|---|---|
| `web/src/features/planning/budget-spending-chart.tsx` | Donut becomes horizontal bars sorted by spent, the share printed in each category label, the total in the chart description | V1, V2, V5, V7 |
| `web/src/features/categories/category-charts.tsx`, composition chart | 100% stacked single bar becomes horizontal bars sorted by amount, the share printed in each category label | V3, V11 |
| `web/src/features/categories/category-charts.tsx`, monthly trend | Stays stacked: the total sits on the common baseline (V3). The description states that the legend shows one series alone, which places it on the baseline | V3 |
| `web/src/features/portfolio/portfolio-allocation.tsx` | No change: part of a whole with few groups, values in the table view | study §5.3 |

## 8. Acceptance

Each indicator rule of section 4 gets a numbered scenario in `docs/domain/06-scenarios.md` after S150, with exact figures, and a test through `internal/apitest` that carries its ID. Required cases: I1 to I6 on one dataset; each null reason; a trailing window shorter than 12 months; the S20 loan installment as debt service; a `benefit` account and an account with `excluded_from_liquidity` left out of I3; a foreign-currency liquid account valued in the base currency; another user's data absent. Web tests cover the block with privacy on (ADR 018 P6), the layout fallbacks of 5.2, and the attention list without a hide control.

## 9. Left to the builder

Names of fields and types; SQL and how 23 months of totals are read for the series; the migration of `excluded_from_liquidity`; block and tab layout through the Slotted `compose-screen` rules; texts of the catalogs in both languages; the order of the commits.
