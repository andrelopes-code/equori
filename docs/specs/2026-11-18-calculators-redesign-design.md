# Calculators redesign

The calculators (`web/src/features/calculators`, design `2026-10-26-calculators-design.md`) answer correct questions with a poor form. A results column of 7/12 of the page shows "The result appears here" until three inputs are typed. Every figure has the same weight: the financing screen asks the reader to combine a four-row table and six loose pairs to compare Price with SAC and to judge a prepayment. Field descriptions run to two lines, no label defines its term, optional inputs are always open under an uppercase overline, and two schedules of 360 rows stand open by default. The list holds 13 rows of text in three framed lists over a third of a 1440 px page; two of them, `reserve` and `independence`, open a frame that says the calculator is not written. The assistant reaches no calculator.

The approved mocks are the contract of the form: `docs/specs/assets/2026-11-18-calculators-redesign-mock/` (one calculator, owner, 2026-11-18, concept A "answer first") and `docs/specs/assets/2026-11-18-calculators-list-mock/` (the list, same date, concept A "by question"). `design.css` of each moves to the feature's stylesheets without edits and the markup follows `design.html` element by element.

## 1. Scope

- Every written calculator moves to the frame of section 2. The math, the address keys (design §4, "Address") and the method sections do not change.
- The list moves to section 3.
- The assistant gains one read-only tool (section 4).
- Out of scope: writing `reserve` and `independence` (they leave the list until written, CR13); new results; phone forms (calculators stay desktop-only, ADR 027).

## 2. Decisions: one calculator

| ID | Decision |
|---|---|
| CR1 | Order of the blocks, confirmed by the owner on 2026-11-18: answer, evidence, inputs, optional inputs (closed), detail tables (closed), method. |
| CR2 | Layout. Below 1024 px of the page: one column in the order of CR1. From 1024 px: the answer spans the page; the evidence takes 7/12 and the inputs 5/12 beside it, the inputs sticky under the page header; the details and the method span the page. Container queries on `slotted-page`, as today. |
| CR3 | The answer is an element of the app's own (`CalculatorAnswer`) with the panel material (web O18): a lead that names the figure (`sm`, muted), the figure (`4xl`, semibold, tabular), one sentence that qualifies it (one line at 1440 px, about 90 characters), and up to three facts (term `xs` muted, value `lg` medium, tabular) over a rule. Section 5 names the figure, sentence and facts of each calculator. |
| CR4 | Empty answer: the lead, the figure "—" and a sentence that names the inputs still missing, in reading order ("Preencha valor financiado, taxa de juros e prazo"). It replaces the `ResultState` "The result appears here". A method that finds no solution states why in the sentence (design §4, "Empty and invalid"). |
| CR5 | Evidence is a stack of `Section size="lg"` blocks without a surface, each answering one comparison of section 5 with the forms of the mock: `SplitBars` (bars on one axis, principal in `--slotted-text-muted`, interest or cost in the accent, total at the row end), `ChoiceRows` (options on one axis of money saved, effect in words), `RangeStrip` (the band of the simulations, the median and the fixed-rate marks, with a legend), labelled rows with values end-aligned. Each bar row has an accessible name with its values. Tables of the current screen that remain sit under the bars as `Table variant="ruled"`. |
| CR6 | Inputs: one `Card`. A solve-for choice is a `FieldGroup` with the legend "O que calcular" and its `SegmentedControl` in an `Inline` (forms F3, F6). Width steps of forms F3: an amount `medium`; a value with its unit (a rate and its period, a term and its unit) is one `medium` field, the value 7rem and the unit select at its content width. Every term of section 5 takes `FieldHelp` through `ui/form-fields/field-title` (F8), at most two sentences, no regional value. A description is one line or leaves (F8). |
| CR7 | Optional inputs are opened by a choice (F9): an outline button with a plus glyph ("Simular amortização extra", "Começar mais tarde", "Sacar por um prazo"). Opened, the inputs stand in a `FieldGroup kind="section"` with their legend and a ghost button "Remover …" that clears their address keys. An optional input whose key is in the address opens its group. The overline "Ajustes opcionais" leaves. |
| CR8 | Detail tables (schedules, flows, balance by month) sit in one `Collapsible`, closed, whose trigger names the table and its size in its description ("Prestações mês a mês", "360 meses, Price e SAC"). Two schedules open as `Tabs` (one per system), not side by side. The balance chart of `compound` moves inside the same collapsible as the balance table. |
| CR9 | The method line ("Passos, fórmula, premissas, limites e fontes" and "Ver o método") stays as it is. A footnote under a chart that repeats an assumption of the method leaves (the "Uma estimativa…" line of `compound`). |
| CR10 | `CalculatorFrame` takes `answer`, `evidence`, `inputs`, `optional`, `details`, `method`; `results` leaves. The pure functions behind each answer (missing inputs, facts, axis maximum, derived savings) live in `.ts` files beside each calculator, with tests. |

## 3. Decisions: the list

| ID | Decision |
|---|---|
| CR11 | The three groups stand side by side from 1024 px of the page, one column below. Each is a `Section size="lg"` with its name and a `List variant="framed"`; the group descriptions leave. |
| CR12 | A row's label is the calculator's question, one line at a third of the 1440 px page; its description is the calculator's name. The questions are rewritten for that length (catalog keys `calc.<id>.question`; the screen subheading reads the same key). |
| CR13 | The list holds only calculators with a screen (`screens` of `calculator-page.tsx`). `reserve` and `independence` leave until written; their route keeps answering with the unavailable frame. |
| CR14 | When `indexer-comparison` is absent for lack of index data, a muted `xs` line under the Invest list states why ("Comparar indexadores exige índices de mercado na instância."). Silence is the defect of quality bar item 5. |
| CR15 | The page subheading reads "Métodos publicados, cada um com fórmula, premissas e fontes." |

## 4. Decisions: the assistant

| ID | Decision |
|---|---|
| CR16 | The assistant module gains the read-only tool `open_calculator`: input `calculator` (one of the written calculator ids) and `inputs`, a map from a calculator's address key to a value. Output: `path` (`/calculators/<id>?<keys>`) and `title`. The model writes the path as a Markdown link; the conversation already turns a link starting with `/` into a link to the screen (`answer-markdown.ts`). The math stays in the client: the reader sees the result, the evidence and the method. |
| CR17 | The tool holds one table per calculator: each address key with its kind (`amount`, `rate`, `integer`, `month`, `date`, `choice` with its values, `debts`). An `amount` is taken as a decimal string in the book's base currency and written as minor units with that currency's scale (`platform/money`); the base currency is read through a port the server composes from the module that owns it. A `rate` is a decimal percent string. An unknown key or an invalid value is `tool.InvalidArgument` naming the key. |
| CR18 | A Go test reads the address keys of each calculator from its folder under `web/src/features/calculators` (`search.<key>` and the keys of `rate-source`) and fails when they differ from the tool's table, so a key renamed on one side breaks the build. |
| CR19 | The description of the tool names each calculator with its question and its keys, and tells the model to prefer the link to computing the figure itself. `get_help` keeps its role; the guide article of the calculators names the tool. |

## 5. Each calculator

Terms take `FieldHelp` (CR6); "By choice" lists the optional inputs of CR7.

| Calculator | Figure and sentence | Facts | Evidence | Terms | By choice |
|---|---|---|---|---|---|
| `compound`, final amount | final amount; deposited and interest at the rate | today's money; starting after the delay; cost of waiting | SplitBars deposited and interest; RangeStrip when volatility is set; rows of monthly income | rate, inflation, volatility | start later, withdraw over a term |
| `compound`, deposit for a target | monthly deposit; target in months at the rate | total deposited; interest; today's money | SplitBars deposited and interest | same | same |
| `compound`, live on income | monthly income that keeps the assets, today's money | same income at the term's end; reinvested part; living part | rows of the income split | same | same |
| `rates` | equivalent in the other period; "equivale a … ao ano" | real rate; annual rate of the percent of the index | none | real rate, percent of an index | inflation, percent of an index |
| `correction` | corrected amount; from month to month by the index | factor; percent; months used | none | index | none |
| `fixed-income` | net yield; over the days held | gross yield; tax; net annual rate | SplitBars net and tax; row of the equivalent rate of the other kind | taxable, exempt, equivalent rate | none |
| `indexer-comparison` | security with the largest final value; difference to the next | its net rate; break-even rate | the current comparison table and break-even list | indexer, break-even | none |
| `financing` | Price installment, or the solved value; the SAC first and last | total paid; interest; less interest in SAC | SplitBars Price and SAC; ruled table first, last, interest; ChoiceRows of the prepayment | rate, Price, prepayment | prepayment |
| `cash-or-installments` | the cheaper option and by how much | implied monthly rate; implied annual rate; present value | two bars on one axis: cash price, present value of the installments | implied rate, present value | none |
| `credit-cost` | effective annual cost | monthly equivalent; total paid; amount released | SplitBars amount released and cost | effective annual cost, upfront fees | upfront fees |
| `debt-payoff` | the order that pays less interest and how much less | months to the last payment in each order | two bars of total interest; table of the month each debt closes | avalanche, snowball, minimum payment | none |
| `recurring-cost` | total paid over the years | future value at the rate; difference | two bars on one axis: total paid, future value | future value | annual rate |
| `own-or-rent` | the cheaper option per year and by how much | annual cost of owning; annual rent | bar of the six components of owning beside the rent bar | forgone interest, risk premium, appreciation | deductible tax rate |

## 6. Derivations on the client

| Value | Rule | Test |
|---|---|---|
| Less interest in SAC | Price interest − SAC interest | 723.197,89 − 493.442,12 = 229.755,77 |
| Saved by shortening the term | remaining interest without prepayment − remaining interest keeping the installment | 657.880,13 − 410.024,54 = 247.855,59 |
| Saved by lowering the installment | remaining interest without prepayment − remaining interest keeping the term | 657.880,13 − 613.594,28 = 44.285,85 |
| Months fewer | (term − prepayment month) − months left keeping the installment | (360 − 24) − 242 = 94 |
| Cost of waiting | final amount − final amount after the delay (already computed today) | 227.395,02 − 195.231,36 = 32.163,66 |
| Axis maximum of a bar set | the largest total rounded up to a multiple of 2 × 10ⁿ⁻¹, where 10ⁿ is the largest power of ten not above it; the value stands in its own column, so no label is clipped | 1.023.197,89 → 1.200.000; 359.999,66 → 360.000 |

Each amount is an integer of minor units; a difference is integer subtraction (web O7).

## 7. Cross-cutting questions

- R1: Does not apply: no regional value is added; the tax rule of `fixed-income` keeps its region code (design §7).
- R2: Does not apply: same as today.
- R3: Does not apply: no value set.
- R4: Does not apply: no extension point.
- R5: New and changed catalog keys (pt-BR and en): answer leads, sentences and facts of section 5; help texts of CR6; buttons of CR7; collapsible triggers of CR8; questions of CR12; CR14 and CR15.
- R6: Numbers through `numberFormatter`, amounts through `useMoneyFormat()`, percents as today.
- C1: Amounts stay integers of minor units; `open_calculator` converts a decimal string to minor units with the scale of the base currency (CR17).
- C2: Does not apply: each calculator works in the base currency only.
- C3: Does not apply: no account or instrument currency is read beyond today's index reads.
- C4: The base currency from settings, as today (`useCalculatorMoney`); the tool reads the same value.
- T1: Does not apply: no new date.
- T2: Does not apply.
- B1: Does not apply: no table.
- B2: Does not apply: no HTTP operation; the tool runs with the member's book like every assistant tool.
- B3: Does not apply: no setting.
- D1 to D5: Does not apply: nothing is stored.
- S1: Does not apply: no operation in `api/openapi.yaml`; the tool catalog changes (`TestToolCatalog`, `tools.json`).
- S2: Desktop only, as today (ADR 027).
- S3: The guide article that covers the calculators changes in the same commit as the frame and as the tool.
- S4: Yes: `open_calculator` (section 4).
- X1: Does not apply: no scenario of `06-scenarios.md` covers calculators.
- X2: Does not apply.
