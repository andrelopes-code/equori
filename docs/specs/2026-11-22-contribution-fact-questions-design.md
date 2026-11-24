# Contribution plan: questions answered by the company's filings

- Date: 2026-11-22
- Status: approved on 2026-11-22 (the owner delegated the decisions to the planning session)
- Issue: #67
- Amends: `docs/specs/2026-11-18-contribution-questions-design.md` (non-goal "An answer computed by equori from a fact", anti-goal "A question shipped by equori", CQ3, CQ5, CQ6, Screen); `docs/specs/2026-11-18-company-report-design.md` (anti-goal "A sum of the signals of Piotroski")

## Intent

A group of the contribution plan divides its ideal among its assets by yes-or-no questions the investor writes and answers by hand (CQ1 to CQ3). The answers stay as typed until the investor edits them, whatever the company files afterwards. The owner's request of 2026-11-22: the plan recommends by the risk of the moment, not only by the distance to the ideal, and rests on methods that are published and studied.

A fact question is a question whose answer equori computes from stored market data.

## Goals, non-goals, anti-goals

Goals:

- A question can name a fact of a catalog. For each asset, equori answers it from the latest fiscal years of the company report, on every read of the plan.
- The catalog holds the nine signals of Piotroski (2000).
- The investor's own answer applies where the filings give none.
- The editor adds the nine questions in one action, and states the source, the fiscal year of each asset's answers and what the evidence supports.
- The assistant reads and writes the same through its tools.

Non-goals:

- A fact with a threshold the investor sets (price over book value below a number).
- A fact of the fund report: no published yes-or-no method for a real estate fund was found (fund report, Evidence).
- The two values each signal compares: the instrument page writes them (CR11).
- A weight per question.

Anti-goals:

- A fact answer without its fiscal year on screen.
- A colour, an order or a mark that reads a fact answer as a buy.
- A missing fact read as "não": an asset without filings keeps the investor's answers.

## Evidence the method rests on

- Piotroski (2000), "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers", Journal of Accounting Research 38, pages 1 to 41: nine binary signals of profitability, leverage and liquidity, and operating efficiency. Among United States firms of high book value over price, 1976 to 1996, buying the firms of most signals and shorting those of fewest returned 23% a year ([RePEc record](https://econpapers.repec.org/RePEc:bla:joares:v:38:y:2000:i::p:1-41); [Chicago Booth Review](https://www.chicagobooth.edu/review/separating-winners-losers)). Read on 2026-11-22 through a search summary; the full text was not read.
- A rule that picks stocks from accounting ratios returns 58% less after publication (McLean and Pontiff 2016; fund report, Evidence).
- No test of a weight proportional to the number of signals was found; the proportional rule is CQ3 of the contribution questions.
- The screen states the three items above (Screen, Method block).

## Approaches

Criteria: correctness, cost, complexity, risk, reversibility, maintenance.

| # | Approach | Fails at |
|---|---|---|
| 1 | No change: the investor answers by hand | Correctness: an answer stays as typed after a filing contradicts it |
| 2 | The web proposes answers from the filings; the investor saves them | Correctness: the plan is stale until the investor opens the editor. The assistant tools read stale answers |
| 3 | The server answers fact questions on every read; the investor's answer applies where no fact exists | Maintenance: CR11 has a second implementation, in Go, beside the one of the instrument page |
| 4 | Weights from price history (inverse volatility, risk parity) | Correctness: the stored prices are not adjusted for corporate events (fund report, non-goals). Risk: the owner rejected the risk section on 2026-11-20 (`f6b9dc7e`) |
| 5 | A tilt of the group ideals by a valuation measure of the market | Correctness: no stored series serves it, and the Brazilian factors of NEFIN reach no t of 3.0 (fund report, Evidence) |

Chosen: 3. It sacrifices one implementation of CR11; the cases of CR12 run against both. The choice is void if the owner wants a confirmation of each changed answer before it moves an ideal: approach 2 then replaces it over the same storage. Confidence: medium.

## Rules

**FQ1 Fact of a question.** A question can name one fact: a key of the catalog of FQ2. A group names a fact at most once. A key outside the catalog, a repeated fact, or a list of facts whose length differs from the number of questions returns `contribution_question_invalid`. A fact question keeps its text under CQ1.

**FQ2 Catalog.** The keys `piotroski_p1` to `piotroski_p9` name the signals P1 to P9 of CR11 (company report). A key matches `^[a-z0-9_]{2,40}$`.

**FQ3 Fact answer.** A fact answer is `yes`, `no` or `none`. For a member that names an instrument, equori reads the first report set of `marketdata.CompanyReports` for its code, and from it the periods of 12 months, newest first: `t`, `t−1`, `t−2`. The answer of a signal is `yes` when the condition of CR11 holds, `no` when it does not, and `none` when an input is absent or a divisor is not above zero. Every answer is `none` when the member names an account, when no report set exists and with fewer than two fiscal years. A chart of accounts that is not `standard` answers P1, P3 and P7 and gives `none` to the other six (amended on 2026-11-24: the accounts of the three have one meaning in every chart; the operating cash flow of a bank, which P2 and P4 read, moves with its deposits and its loans). Ratios are compared as exact rationals (`math/big`).

**FQ4 Effective answer.** The effective answer of a member to a question is the fact answer when it is `yes` or `no`, else the investor's stored answer, blank when the investor gave none (amended on 2026-11-24). CQ3 counts the effective answers; a blank one is not a `no`.

**FQ5 Derived on every read.** GET, the response of PUT, both previews and the tools derive the member ideals of every group with questions from the effective answers at the time of the read. The stored member ideals of such a group are not read.

**FQ6 Fiscal year.** A member whose fact answers were computed (FQ3, two or more fiscal years) carries `facts_year`: the last day of `t`.

**FQ7 API.** `ContributionClassInput` gains `question_facts`: an array of at most 10 strings matching `^([a-z0-9_]{2,40})?$`, one per question, `""` for a question without a fact; absent means no fact. `ContributionClass` gains `question_facts`, always present, one string per question. `ContributionMember` gains `fact_answers` (array of `yes`, `no`, `none`, one per question; absent in a group without questions) and `facts_year` (date; absent without FQ6). `answers` stays the investor's stored answers.

**FQ8 Tools.** `get_portfolio` view `contribution` returns `question_facts`, `fact_answers` and `facts_year`; `save_contribution_plan` accepts `question_facts` per group.

**FQ9 Storage.** `portfolio_contribution_question` gains `fact text NULL CHECK (fact ~ '^[a-z0-9_]{2,40}$')` and a unique index on `(class_id, fact)` where `fact` is not null. The archive version rises by one; its step adds the column as null to the rows of an earlier archive.

**FQ10 Hand-computed cases.** Each is a test of the domain function. Amounts in minor units.

- Signals, the years of CR12: `t` 2025-12-31 net income 7,700, cash flow 9,000, assets 120,000, long debt 28,000, current assets 45,000, current liabilities 20,000, shares 100, revenue 100,000, gross profit 32,000; `t−1` 2024-12-31 net income 5,000, cash flow 6,000, assets 110,000, long debt 30,000, current assets 40,000, current liabilities 20,000, shares 100, revenue 90,000, gross profit 27,000; `t−2` 2023-12-31 assets 100,000. The nine answers are `yes`; `facts_year` 2025-12-31.
- The same with shares 110 and gross profit 30,000 in `t`: P7 `no`, P8 `no` (30.00% against 30.00%), the others `yes`.
- Without `t−2`: P3, P5 and P9 `none`; the others `yes`.
- With `t` alone: nine `none`, no `facts_year`. A chart `other` with the three years: P1, P3 and P7 `yes`, the others `none`, `facts_year` 2025-12-31; with `t` alone, nine `none`.
- Current liabilities 0 in `t`: P6 `none`.
- Effective answers: questions (`piotroski_p1`, "Tem tag along?"). Member A: fact `yes`, stored (não, sim): 2 points. Member B: fact `none`, stored (sim, não): 1 point. Ideals 6667, 3333 (CQ7, first case). Member A with fact `no` and stored (sim, sim): 1 point.
- Facts (`piotroski_p10`), (`piotroski_p1`, `piotroski_p1`), one fact for two questions: `contribution_question_invalid`.

## Screen

Edit mode, assets panel of a group, with "Pelas minhas perguntas" (contribution questions, Screen).

### Method block

Above the question list, one row of fixed height while the group names no fact and holds at most one question:

- the text "Sinais de Piotroski: nove perguntas que o equori responde pelas demonstrações de cada companhia";
- the button "Usar os nove sinais";
- a help button "Sobre o método" that opens a popover with the items of the section Evidence, in three sentences: what the signals measure and where they were tested; what later studies found; that the weight by signals was not tested and the decision is the investor's. The popover links the source.

The button appends the nine questions in the order P1 to P9, each with its fact and its text of the catalog in the active language. The row leaves when a fact is named.

### Fact question row

A fact question row writes its catalog text by key, read-only, with the muted note "respondida pelas demonstrações". Its remove button stays. A key the catalog of the web lacks writes the stored text.

| Key | pt-BR | en |
|---|---|---|
| `piotroski_p1` | Retorno sobre os ativos positivo | Positive return on assets |
| `piotroski_p2` | Caixa das operações positivo | Positive operating cash flow |
| `piotroski_p3` | Retorno sobre os ativos subiu | Return on assets rose |
| `piotroski_p4` | Caixa das operações acima do lucro | Operating cash flow above net income |
| `piotroski_p5` | Dívida de longo prazo caiu | Long-term debt fell |
| `piotroski_p6` | Liquidez corrente subiu | Current ratio rose |
| `piotroski_p7` | Sem emissão de ações | No shares issued |
| `piotroski_p8` | Margem bruta subiu | Gross margin rose |
| `piotroski_p9` | Giro dos ativos subiu | Asset turnover rose |

### Asset row

- The checkbox of a fact question whose fact answer is `yes` or `no` shows that answer and is read-only; its accessible name adds "pelas demonstrações". With `none` it is the investor's checkbox, as CQ2.
- "{n} de {m} sim" counts the effective answers (FQ4).
- The facts line of the asset starts with "sinais do exercício de {ano}" when the member has `facts_year`, and with "sem demonstrações para os sinais: as respostas são suas" when the group names a fact and the member has none.

### Assets without filings

Superseded on 2026-11-24: the line under the board names the assets that take an equal share (CQ3). Under the asset rows of a group that names a fact, one muted line of fixed height names the members without `facts_year`: "Sem demonstrações para os sinais: {nomes}. Sem um sim seu, esses ativos não recebem aporte." The line is absent when every member has filings. Review of 2026-11-22 on the demo book: ITUB4 and BBAS3 (chart `other`), BPAC11 and BOVA11 (no company report) showed "ideal 0% do grupo" with the reason only in their own facts line.

## Cross-cutting questions

- R1: The filings, their accounts and the chart of accounts belong to the company report source of the region (`br_cvm_cia`). The catalog of FQ2 is not regional: the signals read accounts every company report holds (CR5).
- R2: A region without a company report source gives `none` for every fact answer; the investor's answers apply (S680).
- R3: A fact key is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`. `fact_answers` is a closed set of three states that no region extends.
- R4: Does not apply: no extension point; the facts read the company report source.
- R5: Keys `contributionPlan.facts.*` and `contributionPlan.method.*`, pt-BR and en; the problem text of `contribution_question_invalid` is unchanged.
- R6: The fiscal year through `Intl` of the active tag (year of `facts_year`).
- C1: No amount is stored or returned; the accounts are integers of minor units compared as rationals.
- C2: Each ratio divides two accounts of one report, of one currency.
- C3: A fact answer is a boolean; the currency of the report is not shown.
- C4: Does not apply: no amount is written.
- T1: `facts_year` is the calendar date of the period as the source stores it.
- T2: Does not apply.
- B1: No new table; the new column belongs to a table with `books_id`. A schema test rejects a fact outside the pattern and a fact repeated in a class.
- B2: No new operation; GET and the previews keep `read`, PUT keeps `write`.
- B3: Does not apply: no setting.
- D1: `portfolio_contribution_question` stays a fact of the book in the export; the archive version rises by one (FQ9).
- D2: One goose migration.
- D3: Does not apply: no recorded fact changes; the plan is replaced whole by each save (CN1), and a derived ideal is never stored as the investor's entry.
- D4: The fact answer is computed by a rule without doubt (CR11) from public filings; it replaces no stored answer.
- D5: Does not apply.
- S1: No new operation; no new `Problem.code`. `TestToolCatalog` covers the changed tools.
- S2: Does not apply: the edit mode of the plan is desktop only (ADR 027).
- S3: `internal/assistant/guide/articles/contribution_plan.md` gains the fact questions, in the commit of the screen.
- S4: The assistant reads and writes the facts through `get_portfolio` view `contribution` and `save_contribution_plan` (FQ8).
- X1: S675 a save with the nine facts for a stock with three fiscal years returns its fact answers, `facts_year` and the ideals derived from them. S676 a later fiscal year stored after the save changes the fact answers and the ideals of GET without a save. S677 a stock without filings returns `none` nine times, no `facts_year`, and ideals from its stored answers. S678 each invalid case of FQ10 returns `contribution_question_invalid`. S679 `save_contribution_plan` with `question_facts` returns the plan of S675, and `get_portfolio` view `contribution` returns the fact answers. S680 a book of region `US`, with the company report feed disabled, saves the nine facts and derives the ideals from the stored answers.
- X2: S680 runs outside Brazil. No amount is converted.

## Delivery order

1. Domain rules FQ1 to FQ4 with the cases of FQ10; storage, read path, API, archive, tools (plan 1).
2. The method block, the fact question row, the asset row and the guide article (plan 2).
