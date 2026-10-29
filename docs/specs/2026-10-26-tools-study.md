# Tools study: calculators and simulators

Status: draft, input to the tools design.

Scope: a tools section of the web interface. A tool is a screen that takes inputs, applies one published method and returns a result with the method stated. A standalone tool takes every input from the person. A data-connected tool fills some inputs from the ledger, the planning module or market data, and the person can override them.

Method: every claim cites a source that was read. A claim read only through another document or through a search excerpt is marked SECONDARY. Sources that could not be read are listed in section 7 and support no claim. A formula marked DERIVED follows from the definitions of compound interest and needs no external source. Code references point to the working tree of 2026-10-26.

## 1. Evidence that tools of this kind change decisions

| ID | Finding | Source |
|---|---|---|
| E1 | Exponential growth bias explains two patterns: households underestimate the interest rate implied by a loan's payment stream, and underestimate the future value of an investment. More-biased households borrow more, save less and prefer shorter maturities. | Stango and Zinman 2009, *Journal of Finance* 64(6), 2807–2849, abstract. SECONDARY |
| E2 | Most participants expected savings to grow linearly over 40 years. Showing exponential growth before the saving decision increased the amount saved; teaching the formula alone is not the recommended intervention. | McKenzie and Liersch 2011, *Journal of Marketing Research* 48(SPL), S1–S13, abstract. SECONDARY |
| E3 | In data on 6,000 debt-settlement clients, closing accounts, independent of their balances, predicted elimination of all debt. The authors recommend telling consumers both the interest-minimizing order and the motivational effect of closing small accounts. | Gal and McShane 2012, *Journal of Marketing Research* 49; [Kellogg summary](https://www.kellogg.northwestern.edu/news_articles/2012/snowball-approach.aspx) |
| E4 | Withdrawals in retirement widen the range of money-weighted returns; a projection with one fixed return understates that range. | Pfau 2016, *Journal of Financial Planning*, July. SECONDARY |

## 2. Reference implementations

| Product | Tools | Method published | Source |
|---|---|---|---|
| Banco Central do Brasil, Calculadora do Cidadão | regular deposits; fixed-installment financing; future value of a capital; correction of values by price index, TR, savings, Selic, CDI and Taxa Legal | yes, one page per tool | [index](https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp) |
| SEC, Investor.gov | compound interest: initial amount, monthly contribution (negative for withdrawals), years, annual rate, a range of rates, compounding frequency | inputs only | [calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator) |
| Tesouro Direto | "Meu título ideal": a simulator of government bonds | not read | [simulator](https://www.tesourodireto.com.br/simulador/) |
| Actual Budget | Crossover Point widget: expenses, income, return and safe withdrawal rate | inputs only | [reports](https://actualbudget.org/docs/reports/), read for the analytics study |

The Calculadora do Cidadão states that its results can differ from those of institutions in contracts. SECONDARY.

## 3. Methods

### 3.1 Compound interest

| ID | Tool | Formula | Source |
|---|---|---|---|
| M1 | Future value of a capital | Sₙ = q₀ (1 + j)ⁿ; n months, j monthly rate | [BCB, CALFW0502](https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaValorFuturoCapital.do?method=exibirMetodologiaValorFuturoCapital) |
| M2 | Regular deposits | Sₙ = (1 + j) · ((1 + j)ⁿ − 1) / j · p; deposits at the start of each month. j is found by approximation with error on Sₙ below 0.000001 | [BCB, CALFW0202](https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares) |
| M3 | Fixed-installment financing (Price) | q₀ = (1 − (1 + j)⁻ⁿ) / j · p; first installment one month after the loan. Any of q₀, j, n, p from the other three; j by approximation with error on p below 0.000001 | [BCB, CALFW0402](https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas) |
| M4 | Constant amortization (SAC) | amortization A = q₀ / n each month; interest of month k = j · (q₀ − (k − 1) A); installment = A + interest | DERIVED |
| M5 | Rate conversion | annual = (1 + monthly)¹² − 1 | DERIVED |
| M6 | Real rate | (1 + nominal) / (1 + inflation) − 1 | DERIVED |
| M7 | Correction by an index | corrected = value × accumulated factor of the index over the period | [BCB, Calculadora do Cidadão](https://www3.bcb.gov.br/CALCIDADAO/jsp/index.jsp), section "Índices de preços" |

### 3.2 Cost of credit

Custo Efetivo Total (CET), Resolução CMN nº 4.881 of 2020-12-23, in force from 2021-02-01 ([text](https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf)):

- Art. 3: the CET covers the credit amount and every amount charged: amortizations, interest, fees, taxes, insurance and linked expenses, including those not financed.
- Art. 4: FC₀ = Σⱼ₌₁ᴺ FCⱼ / (1 + CET)^((dⱼ − d₀) / 365). FC₀ is the credit amount net of fees paid upfront; FCⱼ each amount charged; dⱼ its date; d₀ the release date. Expressed as an annual percentage with two decimals, rounded by ABNT NBR 5891.
- Art. 5: floating rates and price indexes are left out of the CET.
- Art. 6: overdraft and revolving credit use a 30-day term and the agreed limit.

The same formula, applied to a cash price and an installment offer, returns the rate implied by "parcelado com juros" against the cash price. E1 states that households underestimate this rate.

Brazilian card credit, SECONDARY: Lei 14.690/2023, art. 28, caps interest and charges of revolving and statement installment credit at 100% of the original debt from 2024-01-03 ([COAD](https://www.coad.com.br/home/noticias-detalhe/123777/limite-dos-juros-do-cartao-entra-em-vigor)).

### 3.3 Debt payoff order

| Order | Rule | Property |
|---|---|---|
| Avalanche | extra payment to the highest rate first | lowest total interest (Kellogg summary, E3) |
| Snowball | extra payment to the smallest balance first | more accounts closed early; closing accounts predicted full repayment (E3) |

E3 supports showing both orders with their total interest and payoff date, and leaving the choice to the person.

### 3.4 Withdrawal rate and retirement

| ID | Finding | Source |
|---|---|---|
| W1 | A first-year withdrawal of 4% of the portfolio, then adjusted for inflation, never exhausted a 50/50 stock and intermediate Treasury portfolio before 33 years; 4.25% exhausted one in 28 years. United States data from Ibbotson, starting 1926. | [Bengen 1994](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf) |
| W2 | Stock allocations from 50% to 75% were recommended; above 75% the minimum longevity fell. | same |
| W3 | Withdrawal rates of 3% to 12%, payout periods of 15 to 30 years, United States returns 1926–1997; the study tabulates the share of historical periods in which each rate succeeded. | [Cooley, Hubbard and Walz 1998](https://everywhereonce.com/wp-content/uploads/2011/10/trinity-study1.pdf) |
| W4 | A closed-form "stochastic present value" gives the probability that a spending plan is unsustainable from return, volatility, mortality and spending, without simulation. | Milevsky and Robinson 2005, *Financial Analysts Journal* 61(6), 89–100, abstract. SECONDARY |

W1 to W3 rest on United States market history. No source read gives a withdrawal rate from the history of another market.

### 3.5 Owning against renting

Himmelberg, Mayer and Sinai 2005 ([NBER w11643](https://realestate.wharton.upenn.edu/wp-content/uploads/2017/03/522.pdf), p. 6–7), after Hendershott and Slemrod 1983 and Poterba 1984:

Annual cost of ownership = P·r_rf + P·ω − P·τ(r_m + ω) + P·δ − P·g + P·γ

P house price; r_rf risk-free rate (forgone interest); ω property tax rate; τ income tax rate applied to deductible mortgage interest and property tax; r_m mortgage rate; δ maintenance and depreciation; g expected capital gain; γ risk premium of owning. Owning costs less than renting when this sum is below the annual rent. The τ term exists only where mortgage interest is deductible; the paper models the United States federal income tax.

### 3.6 Taxes on fixed income, Brazil

| Rule | Content | Source |
|---|---|---|
| Income tax on fixed income | 22.5% up to 180 days; 20% from 181 to 360; 17.5% from 361 to 720; 15% above 720 | Lei 11.033/2004, art. 1, [Planalto](https://www.planalto.gov.br/ccivil_03/_Ato2004-2006/2004/Lei/L11033compilado.htm). SECONDARY: search excerpt; the page refused the connection |
| Status of that table | Medida Provisória 1.303/2025 replaced it with a flat 17.5% from 2026-01-01; Ato Declaratório CN nº 67/2025 declared the MP expired on 2025-10-08 without a vote | [PwC](https://www.pwc.com.br/pt/consultoria-tributaria-societaria/thinking-about-taxes/tax-legis/2025/tributacao-de-aplicacoes-financeiras-e-ativos-virtuais.html). SECONDARY |
| IOF on redemption | 1% a day on the redemption, limited to the yield, by the table of the annex: 96% of the yield on day 1, 0% from day 30 | Decreto 6.306/2007, art. 32. SECONDARY |
| Savings account yield | 0.5% a month while the Selic target exceeds 8.5% a year, else 70% of the target, monthly; plus TR | Lei 12.703/2012, art. 1. SECONDARY |
| Salary income tax from 2026 | monthly income up to R$ 5,000 exempt; reduction up to R$ 7,350; 10% withheld on dividends above R$ 50,000 a month from one company | Lei 15.270/2025. SECONDARY ([Mayer Brown](https://www.mayerbrown.com/pt/insights/publications/2025/12/enactment-of-law-no-15270-2025-which-establishes-dividend-taxation-expands-the-exemption-threshold-and-introduces-a-minimum-tax-on-high-incomes)) |

A tax-exempt rate r_e equals a taxable gross rate r_e / (1 − t) at tax rate t. DERIVED.

The rules of this section changed in 2025 and 2026 or were proposed to change. Every value of this section is region-dependent (CONTRIBUTING.md, Regions).

### 3.7 Budget shares

The 50/30/20 split (needs, wants, savings of after-tax income) comes from Warren and Tyagi, *All Your Worth*, 2005. SECONDARY. No peer-reviewed or independent evaluation of the split was found. The analytics design (`2026-10-26-analytics-design.md` §2) excludes reference thresholds for lack of sourced values.

## 4. equori today

| Capability | Where | Use for tools |
|---|---|---|
| Goal what-if: monthly amount and annual return give the completion month | `web/src/features/goals/goal-what-if.tsx`, `goal-plan.ts` (`completionWithReturn`, floating point, labelled an estimate) | M2 already exists for goals |
| Index rates `br_cdi`, `br_ipca` from the BCB SGS | `internal/marketdata/indexes.go` | M7 and M6 from stored series. `TickIndexes` fetches an index only while a security follows it |
| Exchange rates `bcbptax`, `ecb` | `internal/marketdata/sources.go` | currency conversion |
| Exact decimal `Rate` | `docs/domain/05-domain-model.md` | rates without floating point (ADR 005) |
| Loan accounts | kind `loan` (`05-domain-model.md`); S20 records principal and interest per payment | balances exist; contract rate and term are not stored |
| Card installments and committed amounts | `planning` `Committed`, card statements | future outflows for a payoff or cash-flow tool |
| Schedules and subscriptions | `web/src/features/planning/` | recurring amounts for a cost-over-time tool |
| Category totals, cash and accrual views | `reporting` | mean monthly expense for a reserve or withdrawal tool |
| Jurisdiction extension point | `internal/portfolio/internal/domain/jurisdiction.go` | the place for the rules of 3.6 |
| Assistant tools | ADR 012 | a tool computed on the server can also be a tool of the assistant |

## 5. Candidate tools

Inputs marked "data" come from equori and stay editable.

| ID | Tool | Method | Kind | Data inputs | Region-dependent values |
|---|---|---|---|---|---|
| C1 | Future value and regular deposits, with a chart of contributions against interest | M1, M2, E2 | standalone | none | none |
| C2 | Financing: solve any of amount, rate, term, installment | M3 | standalone | none | none |
| C3 | Amortization table, Price against SAC | M3, M4 | standalone | none | none |
| C4 | Cost of an offer (CET) from a cash flow with dates and fees | 3.2 | standalone | none | the CET definition is Brazilian; the formula is an annual-rate internal rate of return |
| C5 | Cash price against installments: implied rate, compared with a chosen rate | 3.2, M3, E1 | standalone | the chosen rate may be the stored CDI | none |
| C6 | Rate converter: monthly, annual, real | M5, M6 | standalone or data | inflation from `br_ipca` | the index |
| C7 | Correction of a value by an index between two months | M7 | data | `br_ipca`, `br_cdi` series | the index list |
| C8 | Debt payoff plan, avalanche and snowball side by side | 3.3, E3 | data | balances of `loan` and `credit_card` accounts | none |
| C9 | Prepayment of a loan: shorter term against lower installment | M3 | standalone or data | loan balance | consumer rules on prepayment are national |
| C10 | Emergency reserve: months covered and target | analytics I3 | data | liquid balance, mean monthly expense | none; the target months is the person's input |
| C11 | Cost of a recurring expense over N years at a chosen rate | M2 | data | schedules and subscriptions | none |
| C12 | Fixed income after tax: taxable against exempt, by holding period | 3.6 | standalone or data | CDI | every value: jurisdiction |
| C13 | Own against rent | 3.5 | standalone | none | τ and ω |
| C14 | Sustainable withdrawal and crossover point | 3.4, W4 | data | mean monthly expense, investment balance | withdrawal rate and return history: person's input |
| C15 | Simulation of a goal or retirement with a range of outcomes | E4, W4 | data | goal, contributions, balances | expected return and volatility: person's input |
| C16 | Distribution of spending by group against a chosen split | 3.7 | data | category totals | no stored group attribute on categories (analytics study §5.2) |

## 6. Constraints found

| ID | Constraint | Source |
|---|---|---|
| K1 | Amounts are integer minor units, rates exact decimals; a floating-point projection is labelled an estimate, as the goal what-if does | ADR 005, `goal-plan.ts` |
| K2 | No regional value is a literal or a default outside its region; C4, C12 and C13 hold such values | CONTRIBUTING.md, Regions; ADR 016 |
| K3 | A tool may not judge a figure as good or bad without a sourced threshold | analytics design §2 |
| K4 | Privacy mode masks amounts of data-connected tools | ADR 018 |
| K5 | `br_ipca` and `br_cdi` are fetched only while a security follows them; C6, C7 and C12 need them fetched otherwise | `internal/marketdata/indexes.go`, `TickIndexes` |
| K6 | Loan contract rate and term are not stored; C8 and C9 take them as input | `05-domain-model.md` |

## 7. Limits and sources not read

| Source | Reason |
|---|---|
| Planalto: Lei 11.033, Código de Defesa do Consumidor art. 52, Lei 14.690, Decreto 6.306 | connection reset; read through search excerpts only |
| Câmara: Decreto 6.306 consolidated with its annex | HTTP 403 |
| Stango and Zinman 2009, McKenzie and Liersch 2011, Milevsky and Robinson 2005, Pfau 2016 full text | abstracts and summaries only |
| AAII page of Cooley, Hubbard and Walz 1998 | HTTP 403; a PDF copy was read |
| PMO/SBM comparison of SAC and Price | the download returned no paper |
| Actual Budget crossover point page | HTTP 404 |
| Tesouro Direto simulator method | not published on the page read |

The rule on prepayment discounts (CDC art. 52 §2 and its CMN regulation) and the IOF annex table day by day need a reading of the official text before C9 and C12 are specified.
