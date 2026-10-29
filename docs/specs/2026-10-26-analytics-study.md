# Analytics study: metrics, visualization and dashboard

Status: draft, input to the analytics design.

Scope: the overview (`/overview`), the reports page (`/reports`) and the charts of other screens. Question: which financial indicators the product should show, to which kind of user, with which encoding, and whether the overview should be user-configurable.

Method: every claim below cites a source that was read. A claim read only through another document is marked SECONDARY. Sources that could not be read are listed in section 6 and support no claim. Code references point to the repository at commit `580091a` plus the working tree of 2026-10-26.

## 1. Financial indicators

### 1.1 Frameworks of financial well-being

| Framework | Dimensions | Output | Source |
|---|---|---|---|
| CFPB Financial Well-Being Scale (United States, 2015) | control over day-to-day finances; capacity to absorb a financial shock; freedom to make choices; on track to meet financial goals | score from 10 survey items; scoring tables differ for ages 18–61 and 62+ | [CFPB guide](https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf), p.7, p.9, p.14 |
| I-SFB, Índice de Saúde Financeira do Brasileiro (FEBRABAN with Banco Central do Brasil, 2021) | habilidade, comportamento, segurança, liberdade, plus "base financeira" for the Brazilian context | score 0–100; 2020 national mean 57; 69.4% of respondents spend as much as or more than they earn; 21.9% could pay a large unexpected expense | [launch presentation](https://static.poder360.com.br/2021/07/apresentacao-indice-de-saude-financeira.pdf), slides 10, 13, 16, 22–23 |
| Financial Health Network, 8 indicators (United States) | spend less than income; pay bills on time; sufficient liquid savings; sufficient long-term savings; manageable debt; prime credit score; appropriate insurance; plan ahead | score 0–100 | SECONDARY: [Nedbank 2023 report](https://personal.nedbank.co.za/content/dam/nedbank/pdfs/nedfin-health-monitor-report-2023.pdf), Figure 1 |

The I-SFB states that it adapts the CFPB scale and the CFSI (now Financial Health Network) score (slides 5–6). The three frameworks share four topics: meeting current obligations, absorbing a shock, progress toward goals, freedom of choice. They measure by survey answers and define no monetary threshold.

### 1.2 Ratios with benchmarks

Greninger, Hampton, Kitt and Achacoso (1996), [Financial Services Review 5(1)](https://openjournals.libs.uga.edu/fsr/article/download/3790/3237/10814), ran a Delphi study with 156 financial planners and educators in the United States. The panel agreed on benchmarks for 20 of 22 ratios (abstract, p.57). The authors state the use of the benchmarks: "the primary function of ratios should be to act as indicators or red flags" (p.66).

Definitions (p.61): liquid assets are cash, checking, savings, money market accounts and short-maturity deposits. Monthly expenses include fixed and variable living expenses, debt repayment, taxes and allocations for irregular expenses.

| Ratio | Formula | Panel median | Profile it serves |
|---|---|---|---|
| Liquidity | liquid assets ÷ monthly expenses | 3 months; profile minimum 2.5 months | any household |
| Savings | savings ÷ gross income | 10% | any earner; the panel did not settle a definition of savings (p.64) |
| Expense ratio | total expenses ÷ after-tax income | reasonable 80%, danger 90% | any household; preferred by 40% of the panel among insolvency ratios (p.66) |
| Nonmortgage debt service | nonmortgage debt payments ÷ after-tax income | reasonable 10% (Table 2: 15%), danger 20% | holders of consumer credit |
| Total debt service | total debt payments ÷ after-tax income | reasonable 35%, danger 45% | holders of a mortgage |
| Housing cost, renter | rent, insurance, utilities ÷ gross income | 30% | renters |
| Housing cost, owner | principal, interest, taxes, insurance, fees, utilities, maintenance ÷ gross income | 35% | owners |
| Net worth growth | % change in net worth ÷ inflation rate | 2 | accumulation stage |
| Investment assets share | net investment assets ÷ net worth | 50% | accumulation stage |

The paper gives no benchmark per life stage or profile and states that "benchmarks must always be considered in a broad context including factors such as life cycle, family type, financial status, economic environment, and personal objectives and goals" (p.59).

### 1.3 Regional variation

| Indicator | Values by region | Source |
|---|---|---|
| Housing cost | United States panel: 30% renter, 35% owner of gross income. European Union: overburden above 40% of disposable income, net of allowances, principal excluded | Greninger 1996 p.65; [Eurostat glossary](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:Housing_cost_overburden_rate) |
| Debt service | Canada, insured mortgage: 39% gross, 44% total. United States: "Different loan products and lenders will have different DTI limits." | [CMHC](https://www.cmhc-schl.gc.ca/en/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/calculating-gds-tds); [CFPB DTI](https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-why-is-the-43-debt-to-income-ratio-important-en-1791/) |
| Emergency fund | Greninger: 2.5–3 months. CFPB guide: "The amount you need to have in an emergency savings fund depends on your situation." FHN via Nedbank: 3 months | Greninger 1996 p.61; [CFPB emergency fund guide](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/) |
| Tax burden | United States only; thresholds depend on the income tax structure | Greninger 1996 p.65 |

No Brazilian numeric threshold for debt service, housing cost or reserve was found in the sources read.

## 2. Visualization

| ID | Finding | Source |
|---|---|---|
| V1 | Accuracy of elementary judgments, best to worst: position on a common scale, length, angle and slope, area | Cleveland and McGill 1986, [Science copy](https://vis.arc.vt.edu/%7Enpolys/projects/safas/science.pdf) |
| V2 | Bars are read by position, pies by angle | same |
| V3 | In a stacked bar only the bottom segment and the total sit on a common scale; other segments are read by length | same |
| V4 | Area is estimated through side length; comparing squares gives the largest error | [Heer and Bostock 2010](https://homes.cs.washington.edu/~jheer/files/2010-MTurk-CHI.pdf) |
| V5 | Angle is the least important cue in pie and donut charts; a donut is as accurate as a pie | [Skau and Kosara 2016](https://kosara.net/publications/Skau-EuroVis-2016), abstract |
| V6 | Superimposed dual-axis charts were least accurate and slowest (15 participants) | SECONDARY: [Datawrapper on Isenberg et al. 2011](https://www.datawrapper.de/blog/dualaxis) |
| V7 | Charts need 3:1 contrast for required visual information; printed labels and values satisfy the requirement | [WCAG 2.2 SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| V8 | Color is not the only means of distinguishing visual elements | [WCAG 2.2 SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) |
| V9 | Up to 8% of men and 0.5% of women of Northern European ancestry have red-green color blindness | [Wong 2011](https://www.nature.com/articles/nmeth.1618) |
| V10 | In a company study (1,145 users, no clear control), a stacked bar gave the strongest impression of overspending; a rate-of-spend visual needed explanation | [Common Cents Lab and Branch](https://case-studies.advanced-hindsight.com/case-studies/SUoXS5Ob/learning-from-the-lab-building-better-spending-vi) |
| V11 | In a qualitative study of payment-app users, bar charts of three months of spending were useful; participants asked for percentages and month-to-month comparison | [arXiv 2401.09937](https://arxiv.org/pdf/2401.09937) |

No peer-reviewed controlled study of personal-finance dashboard layouts or net worth charts was found.

## 3. Dashboard and customization

| ID | Finding | Source |
|---|---|---|
| D1 | A dashboard is "consolidated and arranged on a single screen so the information can be monitored at a glance" | [Few, Dashboard Confusion](https://www.perceptualedge.com/articles/ie/dashboard_confusion.pdf) |
| D2 | Non-quantitative items, such as imminent due dates, are legitimate dashboard content | same |
| D3 | Car-like gauges are counterproductive when another mechanism reads better | same |
| D4 | 42 dashboard design patterns in 8 groups, from 144 dashboards including personal informatics and finance; screen space trades against interaction effort | [Bach et al. 2022](https://ar5iv.labs.arxiv.org/html/2205.00757) |
| C1 | Fewer than 5% of Microsoft Word users changed any setting | [Spool 2011](https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/) |
| C2 | Lack of time was the main barrier to customizing (63% of 51 users); customization happens at triggers such as repeated work or a system change | [Mackay 1991](https://www.lri.fr/~mackay/pdffiles/CHI91.Triggers.pdf) |
| C3 | Short surface customizations of a dashboard (global filters, hiding a visualization, switching graph type) improved speed, accuracy and reported cognitive load; some customizations worsened them | [University of Manchester, IUI 2025](https://research.manchester.ac.uk/en/publications/the-effects-of-customisation-on-the-usability-of-visual-analytics/) |
| C4 | User-controlled (adaptable) menus were preferred over system-controlled (adaptive) menus; menus, not dashboards | [Findlater and McGrenere 2004](https://www.cs.ubc.ca/labs/edapt/papers/findlater2004.pdf) |

No source read reports the share of users who customize a dashboard layout.

## 4. Other products

From official documentation only.

| Product | Dashboard | Reports and metrics | Source |
|---|---|---|---|
| Actual Budget | "fully customizable", several dashboards; widgets: cash flow, net worth, spending analysis, summary, calendar, text, custom reports, crossover point | custom reports as table, bar, line, area, donut; net worth as trend line or stacked by account; Crossover Point from expenses, income, return and safe withdrawal rate | [reports](https://actualbudget.org/docs/reports/), [custom reports](https://actualbudget.org/docs/reports/custom-reports) |
| Firefly III | no dashboard documentation | six report types: default financial, audit, expense/revenue, budget, category, tag | [reports](https://docs.firefly-iii.org/how-to/firefly-iii/finances/reports/) |
| YNAB | not documented in pages read | Income vs. Spending; Spending Trends as bars; Age of Money: mean age of the money spent in the last ten outflows | [Age of Money](https://support.ynab.com/en_us/age-of-money-H1ZS84W1s), [Spending Trends](https://support.ynab.com/en_us/spending-trends-H1inlhzAc) |
| Organizze | not documented in pages read | projections "com base no seu saldo, faturas e compromissos" | [home page](https://www.organizze.com.br/) |

Monarch Money and Mobills documentation could not be read (section 6). No product documentation read defines a savings rate.

## 5. equori today

### 5.1 Overview and reports

`docs/web-roadmap.md` (removed; last version at commit `0327214c`) §7 and §12. The overview draws one block per question: net worth with change against the previous month; month income, spending and moved amount with forecast to month end; top spending categories; upcoming occurrences; cards; budgets; goals; attention list. Desktop figures add the committed amount of the month (`web/src/features/overview/desktop-figures.tsx`). The reports page has three tabs: net worth over time, category totals with period comparison, account flows.

### 5.2 Indicators against stored data

| Indicator (section 1) | Inputs in the API | Shown today |
|---|---|---|
| Liquidity in months | `listBalances` for kinds `checking`, `savings`, `cash`, `wallet`, `reserve`; `getCategoryTotals` of class `expense` | no |
| Savings ratio | `getCategoryTotals` of classes `income` and `expense`, accrual or cash view | no; income and spending of one month only |
| Expense ratio | same as savings ratio | no |
| Committed share of income | `getCommitted`; income occurrences from `listOccurrences` | committed amount only |
| Debt balance and trend | liability kinds `credit_card`, `loan`, `payable` through `getNetWorth`, `getBalanceSeries` | liabilities total at one date |
| Debt service | card payments in the cash view (S149, S150); loan payments are transfers to `loan` accounts | no |
| Cost of credit | `charges` part of `getStatementAnalytics` for cards; loan interest not separated | card statements only |
| Net worth growth | month-end series of `getNetWorth` | `/reports` net worth tab; no inflation reference |
| Investment share, return, allocation | `getAllocation`, `getReturn` | `/portfolio` only |
| Housing cost | no housing attribute on categories | no |
| Fixed versus discretionary spending | no attribute on categories (`api/openapi.yaml`, `db/migrations`) | no |

### 5.3 Charts against section 2

The Slotted `Chart` gives every chart a table view with the same numbers and a generated text summary (`@slotted/react` 0.1.0-beta.16, `dist/docs/chart.md`, Rules), which serves V7.

| File | Encoding | Task | Against section 2 |
|---|---|---|---|
| bars in `overview/spending-chart.tsx`, `reports/categories-tab.tsx`, `reports/flows-tab.tsx`, `cards/analysis-view.tsx`, `cards/statements-chart.tsx` | bar, grouped | compare magnitudes | consistent (V1) |
| lines in `overview/balance-chart-block.tsx`, `accounts/balance-chart.tsx`, `reports/net-worth-tab.tsx` | line | trend | consistent (V1) |
| `planning/budget-spending-chart.tsx` | donut with legend values | compare spending across categories | angle for a comparison task (V1, V5) |
| `categories/category-charts.tsx` | stacked bars per month; 100% stacked composition | one subcategory across months | segments above the first read by length (V3) |
| `portfolio/portfolio-allocation.tsx` | pie | part of a whole, few groups | angle; values in the table view |

## 6. Limits and sources not read

| Source | Reason |
|---|---|
| Cleveland and McGill 1984 (JASA) | not retrievable; the 1986 paper by the same authors is used |
| Few, *Information Dashboard Design* (book) | not online; the article "Dashboard Confusion" is used |
| Sarikaya et al. 2018, Huang et al. 2015, Isenberg et al. 2011, Skau and Kosara 2016 full text | access denied; abstracts or secondary descriptions only |
| Financial Health Network, OECD/INFE, MaPS (United Kingdom) | HTTP 403 or 404 |
| DeVaney 1993/1994, Lytton, Garman and Porter 1991 | not retrieved; cited through Greninger 1996 |
| FEBRABAN I-SFB full questionnaire and weights; Banco Central do Brasil report | not published on the pages read; HTTP 404 |
| Monarch Money, Mobills, Organizze help centers | HTTP 403 or 404 |

The evidence on personal-finance charts (V10, V11) comes from one company study and one qualitative study. The benchmarks of section 1.2 come from one United States panel of 1996.
