# Contribution plan: criteria with a limit, company multiples and the criteria board

- Date: 2026-11-23
- Status: approved on 2026-11-23 (the owner approved the direction and delegated the remaining decisions to the planning session)
- Issue: #68
- Amends: `docs/specs/2026-11-18-contribution-questions-design.md` (CQ1, CQ4, Screen), `docs/specs/2026-11-22-contribution-fact-questions-design.md` (FQ1, FQ2, FQ3, FQ7, FQ9, Screen, non-goals "A fact with a threshold the investor sets" and "The two values each signal compares"), `docs/specs/2026-11-18-company-report-design.md` (CR3, CR4, CR5, CR6, non-goal "Price multiples", Screen), `docs/specs/2026-11-12-contribution-plan-design.md` (Purchase list as one bar)

## Intent

The owner asked for a contribution that weighs valuation beside the distance to the ideal. The study of this spec found no valuation rule with evidence that supports moving money by itself. It found that a rule of the investor does not need that evidence: the investor picks a criterion and its limit, equori answers it with a checked figure, and the answer counts one point of the ideal the questions already derive (CQ3).

The owner also rejected the editor of the questions: ten numbered checkboxes per asset, whose numbers the reader has to look up in another list.

## Goals, non-goals, anti-goals

Goals:

- A question can be a criterion with a limit: equori computes the figure, compares it and answers.
- Price over earnings and price over book value of a listed company, shown only when the count of shares agrees with a second filing.
- The purchase list states the change of the profit of each company and opens its statements.
- The criteria are offered on the main screen of the plan, in one step.
- A board replaces the checkboxes: criteria in rows, assets in columns, the figure inside each automatic answer.
- A property test holds the split to its guarantee (AC16).

Non-goals:

- A limit, a template of limits or a list of questions shipped by equori (owner, 2026-11-18, issue #60). The nine signals of Piotroski stay (issue #67).
- A weight per criterion, or a "no" that subtracts a point: the second concentrates the group (Approaches, 3).
- Real estate funds (owner, 2026-11-23).
- A stored history of answers.

Anti-goals:

- A word, a colour, an order or a mark that reads a figure as cheap, dear, good or bad.
- A multiple computed from a count of shares that a second filing does not confirm.
- A missing figure read as "não".

## Evidence the method rests on

Study of 2026-11-23. "Read" means the abstract, and the passage cited where one is cited.

| Question | Finding | Source |
|---|---|---|
| Contributions to the underweight asset | Redirecting portfolio income gave most of the risk control of rebalancing, 1926 to 2009, with no sale | [Vanguard 2010](https://indexacapital.com/bundles/unaiadvisor/docs/papers/2010-Vanguard-Best-practices-for-portfolio-rebalancing.pdf), read |
| Low multiples in Brazil | 2007 to 2022, before costs: low price over book 13.20% a year, low price over earnings 16.26%, equal weighted control 8.74% | [UFU](https://repositorio.ufu.br/bitstream/123456789/43908/1/BacktestingEfeitoValor.pdf), read |
| Quality and value in Brazil | Higher quality, higher return; a value premium, best measured by book to market; betting against expensive companies is not profitable | [USP 2024](https://teses.usp.br/teses/disponiveis/12/12139/tde-25062024-151317/publico/IgorToledodeQueirozCorrigida.pdf), read |
| Profitability beside price | Controlling for profitability raises the performance of value strategies | [Novy-Marx, NBER 15940](https://www.nber.org/papers/w15940), read |
| Piotroski, Graham and Greenblatt in Brazil | Positive and significant alpha, 2006 to 2019, varying with the model | [REAd](https://www.redalyc.org/journal/1230/123075329001/123075329001.pdf), read |
| Graham's criteria in Brazil | Excess return at eight and ten years, not shorter | [CAFI 2024](https://revistas.pucsp.br/index.php/CAFI/article/download/65982/45812/223353), read |
| Buying what fell, Brazil | Contrarian strategy not significant, 1995 to 2021; short momentum significant | [UNIFAL](https://publicacoes.unifal-mg.edu.br/revistas/index.php/revistadebateeconomico/article/download/1592/1244), read |
| Multiple against the company's own history | No direct test found. The priced part is the deviation from the sector's valuation | [Golubov and Konstantinidi 2019](https://openaccess.city.ac.uk/id/eprint/21414/1/GK%20accepted.pdf), read |
| Ratios as a verdict | "have nothing to do with valuation except to the extent they provide clues to the amount and timing of cash flows" | [Buffett 2000](https://www.berkshirehathaway.com/2000ar/2000letter.html), read |
| Value averaging | Inefficient under any plausible risk preference | [Hayley 2014](https://openaccess.city.ac.uk/id/eprint/6298/1/VALUE%20AVERAGING%207%20October%202014.pdf), read |
| Bazin price ceiling | No test found in two searches | none |

A value rule cannot be proven with Brazilian data: the factor of NEFIN has t 1.35 in 308 months (fund report, Evidence); at the same mean and volatility, t 2.0 takes 56 years and t 3.0 takes 127, and the statements of the register start in 2010. This is why a valuation never moves money by itself.

### The data, checked

Files of the register read on 2026-11-23: DFP 2021 to 2026, ITR 2025 and 2026, FRE 2021 to 2026, FCA 2026.

- `composicao_capital` carries no unit. The FRE (`fre_cia_aberta_capital_social_{Y}.csv`) states the capital in units. Of 358 listed companies of the DFP of 2025, 219 agree in units and 94 in thousands.
- The delivered code over those files, for the 297 stocks of the spot market that an independent source (Fundamentus, prices of 2026-11-19) also values: price over book for 249 and price over earnings for 215. Without a value: no verified count 12, classes of different rights 11, balance older than 200 days 8, missing account 2; equity not above zero 15; loss 47; profit of the parent not filed 2. Where both give a value, none differs in order of magnitude: price over book differs by 0.60% at the median and 5.4% at the 95th percentile, price over earnings by 0.42% and 6.3%, return on equity by 0.05 percentage points at the median. The largest differences are a company that restates under another standard (SANB: the register holds the IFRS statements) and counts between two capital events.
- Verified counts per fiscal year, 2021 to 2025: 90%, 90%, 88%, 92% and 91% of the listed companies.
- The line of the profit of the parent is filed as zero by some companies in some quarters (BBAS3, 2026-09-30; SBSP3, 2025-12-31), hence AC2.
- A company whose fiscal year ends in March files the statement of 2026-03-31 in the DFP of 2026, which CR3 did not read: its twelve months were a year old.

## Rules

### Company report (amends CR3 to CR6)

**AC0 Files.** CR3 reads the DFP of today's year and of the five years before, and the FRE of the same six years (`/FRE/DADOS/fre_cia_aberta_{Y}.zip`, member `fre_cia_aberta_capital_social_{Y}.csv`). CR5 gains `net_income_parent` (the level-three line of the income statement whose description holds "Empresa Controladora"), `equity_minority` (the level-three line of the liabilities whose description holds "não controladores", ignoring case), both charts, and `classes_differ`: two lines `3.99.01.NN` of the period, neither zero, whose absolute values differ by a factor above 1.5, or one zero and another not zero in a company whose ordinary and preferred shares are each 1% of the capital or more. CR4 gains `shares_per_unit`: 1 for a row that is not `Units`; for `Units`, the sum of the numbers of its composition that precede a class of share ("1 ON E 2 PN" is 3, "1 KLBN3 + 4 KLBN4" is 5, "2 ações preferenciais e 1 ação ordinária" is 3), null when none is read or the sum passes 100.

**AC1 Verified shares.** A count of the register is, per company and year, `Quantidade_Total_Acoes` of the row of type `Capital Integralizado`, else `Capital Emitido`, of the highest version and latest approval. The shares of a period of year `y` are verified when `shares_issued` times `k`, with `k` 1 or 1000, lies within 10% of the count of year `y` or `y + 1`: `0.9 ≤ count ÷ (shares_issued × k) ≤ 1 ÷ 0.9`. The outstanding shares are `(shares_issued − shares_treasury) × k`, a null treasury read as zero; or `shares_issued × k` when the count is closer to `(shares_issued + shares_treasury) × k` than to `shares_issued × k`, because the filing then states the capital net of the treasury. They are unverified when no count agrees, when `classes_differ`, or when the result is not above zero.

**AC2 Profit of the parent.** Over the terms of a window, the profit of the parent is `net_income_parent` when it is neither null nor zero in every term; else `net_income` when, in every term, `equity_minority` is null or at most 1% of `equity`; else none.

**AC3 Twelve months.** The candidates of a window are the years to date after the latest fiscal year, whose start is the day after it, newest first, then the fiscal year (CR7). A figure that needs the profit of the parent takes the first candidate that gives it. A candidate that ends more than 200 days before the date of the price, or of today for a figure without a price, gives none, reason `stale`.

**AC4 Price over earnings.** `price ÷ shares_per_unit × shares ÷ profit of the parent of twelve months`, with the verified shares of the newest period. A profit at or below zero gives no value, reason `loss`.

**AC5 Price over book value.** `price ÷ shares_per_unit × shares ÷ (equity − equity_minority)` of the newest period, a null minority read as zero. A divisor at or below zero gives no value, reason `negative_equity`.

**AC6 Price.** The price is the chosen price of the latest date on or before the date asked, at most 10 days older, in the currency of the report; else reason `no_price`. When two successive chosen prices between the date of the newest balance and the price, oldest first, have a ratio below 0.55 or above 1.8, the multiples have reason `price_jump`: a split the filings do not state yet.

**AC7 Range.** For each of the five latest fiscal years with a verified count and an official price (priority 3) on its last day or at most 10 days before, the multiples of AC4 and AC5 with the profit and the equity of that year; a year of reason `loss` or `negative_equity` is left out. With three or more years, the range is the least and the greatest value and the number of years; else none.

**AC8 Change of the year.** The profit (`net_income`) and the revenue of the newest year to date against the same months of the year before, or of the latest fiscal year against the one before when no year to date follows it. With both above zero, the change is `now ÷ before − 1`. Else the state in words: `loss` (now at or below zero), `turned` (now above zero, before at or below zero). None, reason `short_history`, without the comparison.

**AC9 Figures.** `return_on_equity` (CR8), `net_margin` and `net_debt_to_equity` (CR9), `gross_profit_to_assets` (gross profit of twelve months over the total assets of the newest balance), `current_ratio` (current assets over current liabilities of the newest balance), `revenue_growth` (the compound growth a year of the revenue from the oldest to the latest of the stored fiscal years, at most five, at least four), `positive_years` (CR10). A figure has a value or a reason: `chart` (the account belongs to the standard chart only), `missing` (a filing lacks an input), `short_history`, `stale`, `negative_equity`, `loss`, `shares` (not verified), `classes`, `unit`, `parent_income`, `no_price`, `price_jump`.

### Criteria (amends CQ1, CQ4 and FQ1 to FQ9)

**AC10 Catalog.** The catalog of FQ2 gains the keys below. Each has a limit; a signal of Piotroski has none.

| Key | Holds when | Limit |
|---|---|---|
| `price_earnings_max` | price over earnings at most the limit | 0.01 to 1000 |
| `price_book_max` | price over book value at most the limit | 0.01 to 1000 |
| `roe_min` | return on equity at least the limit | −1 to 10 |
| `net_margin_min` | net margin at least the limit | −1 to 10 |
| `gross_profit_assets_min` | gross profit over assets at least the limit | −1 to 10 |
| `net_debt_equity_max` | net debt over equity at most the limit | −10 to 100 |
| `current_ratio_min` | current ratio at least the limit | 0.01 to 100 |
| `revenue_growth_min` | growth of the revenue at least the limit | −1 to 10 |
| `positive_years_min` | fiscal years with profit, of the five latest, at least the limit | whole, 1 to 5 |

**AC11 Limit.** `question_limits` holds one string per question, `""` without a limit, else a decimal matching `^-?[0-9]{1,4}(\.[0-9]{1,4})?$`: the figure itself (12% is `0.12`). A criterion with a limit key and no limit, a limit outside its range, a limit on a question without a limit key, or a list whose length differs from the questions returns `contribution_question_invalid`. A class holds at most 20 questions (CQ1 raised from ten: nine signals, nine limits and the investor's own).

**AC12 Answer.** `yes` when the figure meets the limit, compared as exact rationals; `no` when it does not; `no` when the figure has reason `loss` or `negative_equity`, because such a company does not meet a criterion on earnings or equity; `none` for every other reason, when the member is an account and when no company report exists. `positive_years_min` with fewer than five fiscal years stored answers `yes` when the years with profit reach the limit, `no` when they cannot reach it with the missing years, else `none`. `revenue_growth_min` compares `(1 + limit)^n × oldest ≤ latest`.

**AC13 Date.** The price of a criterion is the one of AC6 at the last day of the month before today, so an answer moves at most once a month for the price, and on a new filing. The other figures read the filings stored at the read.

**AC14 API.** `ContributionClassInput` gains `question_limits`, absent meaning none. `ContributionClass` gains `question_limits`, always present. `ContributionMember` gains `fact_details`, one per question, absent in a group without questions: `value` (decimal string of at most six decimals, absent without one), `reason` (a key of AC9, or `no_report`; absent with a value), `date` (the end of the window or of the balance the value reads; absent without a value). A signal of Piotroski carries no value; without an answer its reason is `chart`, `short_history` or `missing`. `GET /company-figures?code=` (`listCompanyFigures`, `read`) returns `items`: per report set of CR6, the figures of AC4 to AC9 at today's price, the date of the price and the ranges; an unknown code and an instrument without a company give an empty list.

**AC15 Storage.** `marketdata_company_report` gains `net_income_parent`, `equity_minority` (bigint, null) and `classes_differ` (boolean, default false). `marketdata_company_listing` gains `shares_per_unit` (smallint, null, 1 to 100). Table `marketdata_company_share_count (source, identifier, year, shares)`, key of the first three, shared market data as `marketdata_company_report`. `portfolio_contribution_question` gains `limit_value numeric(10, 4) NULL`, null without a fact; its `position` check rises to 19. The archive version rises by one; its step adds the column as null.

**AC16 Guarantee of the split.** For any classes and amount, the split of CN7 and CN9, before whole shares: adds up to the amount; has no negative part; and leaves `Σ |value + part − ideal × total|` within one minor unit per class of its lower bound, twice the excess over the ideal that no purchase removes. Property test over 20,000 drawn cases with a fixed seed.

**AC17 Hand-computed cases.** Each is a test of the domain function. Amounts in minor units, thousands omitted as `k`.

- The company `X`: fiscal year 2025 net income 10,000k, parent 10,000k, revenue 100,000k, gross profit 40,000k; nine months to 2026-09-30 9,000k, 9,000k, 90,000k, 36,000k; nine months to 2025-09-30 7,500k, 7,500k, 75,000k, 30,000k; balance of 2026-09-30: assets 120,000k, current assets 45,000k, current liabilities 30,000k, short debt 5,000k, long debt 20,000k, cash 4,000k, short investments 1,000k, equity 50,000k, minority 4,000k; shares issued 1,010, treasury 10; count of 2026 1,010,000; price 1.15 on 2026-10-30. Twelve months: income 11,500k, revenue 115,000k, gross profit 46,000k. Shares 1,000,000. Price over earnings 115,000k ÷ 11,500k = 10. Price over book 115,000k ÷ 46,000k = 2.5. Return on equity 0.23. Net margin 0.1. Net debt over equity 0.4. Gross profit over assets 0.383333. Current ratio 1.5. Change of the profit 0.2, of the revenue 0.2.
- Unit of 5 shares at 5.75: price over earnings 10.
- Count of 2026 1,200,000: reason `shares`. `classes_differ`: reason `classes`. Count 1,010 (units) with price 1,150.00: price over earnings 10.
- Parent null in the nine months of 2026, minority 4,000k of 50,000k (8%): the window of 2026-09-30 gives none; with the six months to 2026-06-30 filed (parent 6,000k; 2025-06-30, 5,000k), the window ends on 2026-06-30 and the income is 11,000k: price over earnings 10.454545. Minority 400k: 0.8%, the total income is read: 10.
- Income of twelve months −1: reason `loss`. Equity 4,000k, minority 4,000k: reason `negative_equity`.
- Price of 2026-10-19 for the date 2026-10-30: reason `no_price`; of 2026-10-20: read. Prices 1.15 on 2026-10-05 and 0.57 on 2026-10-06 (ratio 0.4957): reason `price_jump`.
- Today 2027-04-19 with the newest balance 2026-09-30 (201 days): `stale`; 2027-04-18: read.
- Range: five fiscal years with price over earnings 8, 12, 10, loss, 9: 8 to 12, 4 years. Two years: none.
- Revenue growth 2021 to 2025 from 64,000k to 100,000k, limit 0.118: (1.118)^4 = 1.562308, 64,000k × 1.562308 = 99,987.7k ≤ 100,000k: `yes`. Limit 0.1181: 1.562867 × 64,000k = 100,023.5k: `no`.
- Positive years 3 of 3 stored, limit 4: `none`; limit 3: `yes`; 1 of 3 stored, limit 4: `no`.
- `price_earnings_max` 10 for `X`: `yes`; 9.9999: `no`. `loss`: `no`. Reason `shares`: `none`.
- Limits: `price_earnings_max` with `""`, `0`, `1000.0001`; `positive_years_min` with `2.5`; a limit on `piotroski_p1`; one limit for two questions: `contribution_question_invalid`. `1e3`: the contract rejects it, `invalid_request`.
- Nine signals and nine limits and two own questions are 20: saved; 21: `contribution_question_invalid`.

## Screen

Vocabulary: pt-BR "critério" replaces "pergunta" on the screen; en "criterion". An automatic criterion is one equori answers; the others are "sua resposta".

### Main screen

**Criteria section**, between "Este mês" and "Carteira frente ao ideal", title "Critérios dos ativos", description "Opcional: seus critérios definem o ideal de cada ativo dentro do grupo. O aporte continua sem vender nada." One row of fixed height per group that holds an instrument as a chosen asset: the group's dot and name; the state in words ("ideal digitado", "ideal único do grupo", "{n} critérios, {m} automáticos"); for a group with criteria, the share of each asset as one segmented bar with the tickers; at the end "Usar critérios" or "Abrir critérios". The section is absent without such a group. The button enters edit mode with the board of that group.

**Purchase list**: a column "Lucro no ano" for a list that holds a company with figures: "subiu 20%", "caiu 18%", "prejuízo", "voltou ao lucro", "sem dado"; nothing for another asset. The order cell of a company offers "ver demonstrações", as "ver informe" for a fund; it opens a dialog with `CompanyReport`. The group cell of a member of a group with criteria adds "{n} de {m} critérios". No colour reads the change.

### Criteria board (edit mode)

It replaces the group list while open. Header: way back "Grupos e ideais", the dot and name of the group, "Adicionar critério" (primary of the section), and the segmented choice "Digitado | Por critérios" at the end.

The board is a grid, an own element (`role="grid"`): one row per criterion, one column per asset.

- Column head: the ticker, the derived ideal in the heaviest weight, "{n} de {m}", and a bar of the ideal. It stays visible while the rows scroll; the first column stays visible while the columns scroll.
- Row head: for an own criterion, a text field; for an automatic one, its text, the limit field in the unit of the figure (percent, number, years) and the note "automático"; at the end, remove.
- Cell: one button that fills the cell. Two lines of fixed height: "sim" or "não"; under it, for an automatic criterion, the figure ("8,2") or, without one, "sua resposta". A cell equori answers is not a button: it names the figure and its date. A cell without a figure is the investor's button and names the reason in its tooltip and accessible name. "sim" has the text weight and a neutral wash, "não" is muted; no colour reads it.
- Keyboard: one tab stop for the cells; arrows move, Home and End go to the ends of the row, Space and Enter answer.
- "Adicionar critério" opens a panel beside the button with: "Escrever o meu" (adds a row and focuses its field); the automatic criteria in four groups (Preço, Rentabilidade, Dívida e liquidez, Crescimento e histórico), each with a one-line meaning; "Sinais de Piotroski", each alone or the nine at once, with the help of the method. A criterion already in the group is marked "no grupo" and disabled.
- A criterion with a blank text or a limit missing or out of range is marked in its field; the save bar writes "Complete {n} critérios" and disables Save. The preview leaves such a criterion out.
- Empty board: two choices of equal weight, "Escrever um critério" and "Escolher critérios automáticos", and the line of what a criterion does.
- Every answer "não": "Nenhum sim: o grupo recebe o valor sem divisão entre os ativos."
- Assets without a company report: one line names them, as FQ.

In the group list, the assets panel of a group with criteria shows its assets with their derived ideals and the button "Abrir critérios"; the choice "Digitado | Pelos meus critérios" keeps its place and opens the board.

### Company report

`CompanyReport` gains, above the existing figures, "Preço e resultado": "P/L", "P/VP" (each with "faixa de {n} exercícios: {a} a {b}" or the reason in words), "Lucro no ano" and "Receita no ano" (with the months compared). Under them: "Um P/L baixo também pode indicar que se espera queda do lucro." The date of the price and of the balance are written. Reasons in words: "número de ações não conferido", "classes com direitos diferentes", "composição da unit não informada", "prejuízo em 12 meses", "patrimônio não positivo", "sem cotação em {currency}", "cotação com salto: possível desdobramento", "lucro da controladora não informado", "balanço com mais de 200 dias", "não se aplica ao plano de contas".

## Cross-cutting questions

- R1: The files, their columns, the unit of the counts and the composition of a unit belong to `br_cvm_cia`. The catalog of criteria is not regional.
- R2: A region without a company report source gives `none` with reason `no_report`; the investor's answers apply (S695).
- R3: Fact keys keep `^[a-z0-9_]{2,40}$`; `reason` is a `pattern` of the same form.
- R4: Does not apply: no extension point; the company report source gains fields.
- R5: Keys `contributionPlan.criteria.*`, `companyReport.*`, `contributionPlan.profit.*`, pt-BR and en. The keys of the removed checkboxes leave.
- R6: Figures through `numberFormatter` and `format-rate.ts`, dates through `formatDate` of the active tag.
- C1: Accounts and shares are integers; ratios are `big.Rat` in Go and decimal strings on the wire. The price is the exact decimal of the store.
- C2: A multiple divides a price and a report of one currency; another currency gives `no_price`.
- C3: The figures are shown in the report's currency as ratios, whatever the base currency (S696 runs with base `USD`).
- C4: No amount of the book is added to the screen.
- T1: Dates are calendar dates; today is `platform/clock` in the book's time zone; AC13 uses the last day of the month before it.
- T2: Does not apply: no business day.
- B1: `marketdata_company_share_count` is instance market data without `books_id`. The new column belongs to a table with `books_id`; schema tests reject a position of 20 and a limit on a question without a fact.
- B2: `listCompanyFigures` needs `read`; an HTTP test covers a member and a request without a session.
- B3: No setting.
- D1: The share counts are left out of the export; the question column is a fact of the book; the archive version rises by one.
- D2: One goose migration per module change.
- D3: Does not apply: the plan is replaced whole by each save (CN1).
- D4: Public filings replaced whole per file; an answer equori gives replaces no stored answer (FQ4).
- D5: Does not apply.
- S1: `listCompanyFigures` is covered by `get_market_data` view `company_figures`. No new `Problem.code`.
- S2: Does not apply: the plan is desktop only (ADR 027); the company report section follows the instrument page.
- S3: `internal/assistant/guide/articles/contribution_plan.md`, `investments.md` and `equities_br.md`, in the commit of each screen; the help page of the plan.
- S4: `get_portfolio` view `contribution` and `save_contribution_plan` carry `question_limits` and `fact_details`.
- X1: S689 a save with `price_earnings_max` 10 and `roe_min` 0.2 for company `X` returns both answers `yes`, their values and dates, and the ideals derived. S690 a new filing that lowers the profit changes the answer on GET without a save. S691 each invalid limit of AC17 returns `contribution_question_invalid`. S692 a count that disagrees gives `none` with reason `shares`, and the stored answer counts. S693 `GET /company-figures` returns the figures of `X`, 401 without a session, an empty list for an unknown code. S694 `save_contribution_plan` with limits returns the plan of S689 and `get_market_data` view `company_figures` the figures of S693. S695 a book of region `US` with the feed disabled saves the limits and derives the ideals from the stored answers. S696 a book with base currency `USD` returns the same answers.
- X2: S695 runs outside Brazil; S696 with a base currency other than the report's.

## Approaches

1. Priority as the product of a weight factor and a valuation factor. Rejected: with every asset at its ideal the product is zero and nothing is allocated; the valuation has no evidence that supports it (Evidence).
2. A tilt of the ideals by a valuation equori picks (the multiple against its own history, or cheap and healthy with a bonus). Rejected: the first has no test; the second changes its answer for 37% to 45% of the companies from one year to the next, and fewer than half of the companies fail it.
3. A score with plus one and minus one, as the Diagrama do Cerrado. Rejected: with 8, 6 and 5 of 10 answers it gives 75%, 25% and 0% where CQ3 gives 42%, 32% and 26%; no published test was found.
4. Criteria with limits the investor types, over CQ3. Chosen: every rule after CQ3 stays, the figures are checkable, and equori states no verdict.

For the editor:

1. Keep the rows per asset and label the checkboxes. Rejected: the text of ten criteria does not fit a row of one asset.
2. One asset at a time, as a form. Rejected: the reader cannot compare one criterion across assets.
3. Criteria in rows, assets in columns. Chosen: the text fits, a ticker is short, and the figures of one criterion sit on one line.

## Delivery order

1. Company report source and storage (AC0, AC15).
2. Figures, operation and tool view (AC1 to AC9).
3. Criteria: domain, storage, API, archive, tools; the property test (AC10 to AC16).
4. Company report section and purchase list.
5. Criteria section and board; guide and help.
