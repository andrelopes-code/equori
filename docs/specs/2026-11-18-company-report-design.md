# Company report

- Date: 2026-11-18
- Status: approved on 2026-11-18 (the owner delegated the decisions to the planning session)
- Issue: #58
- Amends: ADR 025 (a seventh kind of feed, `company_report`)

## Intent

An investor who holds a stock reads, on third-party sites, the return on equity, the margin, the debt and the history of profit of the company that issued it. equori shows the price of the stock and nothing the company filed. The owner's request of 2026-11-18: bring the figures of a listed company from its filings, each with source and date, and the nine signals of Piotroski as facts. equori computes; the investor decides.

A company report is the set of figures of one fiscal year or one quarter that a listed company filed with its regulator.

## Goals, non-goals, anti-goals

Goals:

- Store, for each listed company of the register, the accounts of its five latest fiscal years and of its latest quarters that the figures below read.
- Tie a stock instrument to its company by its trading code, or by a symbol the investor sets.
- State, for the latest twelve months: the return on equity and the net margin; for the latest balance: the net debt over equity; for the five latest fiscal years: how many closed with a positive net income.
- State the nine signals of Piotroski (2000) on the two latest fiscal years, each as a fact with the two values it compares.
- State, for each figure, when the company's chart of accounts does not hold it.

Non-goals:

- Dividends paid: the cash flow statement holds them in a line of free text, not in a fixed account.
- EBITDA: not an account of the filings.
- Price multiples (price over earnings, price over book value): not requested; the price and the shares are stored, so a later delivery adds them.
- Restated comparatives: a quarter of the year before is read as first filed (CR3).
- A source outside Brazil.

Anti-goals:

- A grade, a threshold, a colour, an order or a mark that says a company is good or bad, cheap or dear.
- A sum of the signals of Piotroski, or a text that reads a signal as advice.
- A figure without its source and date. A missing figure written as zero.

## Evidence the method rests on

Research of 2026-11-18, each source read by a real request unless stated.

- A rule that picks stocks from accounting ratios loses most of its return after publication (McLean and Pontiff 2016; Hou, Xue and Zhang 2020); the Brazilian factors of NEFIN reach no t of 3.0 from 2001 to 2026 (spec of the fund report, Evidence). This is the reason the signals of Piotroski are facts without a sum.
- Each figure of this spec is an identity of the filings: it follows from the stored accounts alone.
- Not verified: the full text of Piotroski (2000); the definitions of CR10 follow its published description of the nine signals.

## Facts of the register

Checked by request on 2026-11-18 on `dfp_cia_aberta_2025.zip` (12,863,177 bytes), `itr_cia_aberta_2026.zip` (28,783,604 bytes) and `fca_cia_aberta_2026.zip` (364,099 bytes) under `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/`:

- Each statement member has the columns `CNPJ_CIA`, `DT_REFER`, `VERSAO`, `DENOM_CIA`, `CD_CVM`, `GRUPO_DFP`, `MOEDA`, `ESCALA_MOEDA`, `ORDEM_EXERC`, (`DT_INI_EXERC` in the income and cash flow statements), `DT_FIM_EXERC`, `CD_CONTA`, `DS_CONTA`, `VL_CONTA`, `ST_CONTA_FIXA`; Latin-1, separated by `;`. `ESCALA_MOEDA` is `MIL` or `UNIDADE`; `MOEDA` is `REAL`. `ORDEM_EXERC` is `ÚLTIMO` (the period filed) or `PENÚLTIMO` (the comparative).
- The DFP of 2025 holds 442 companies with consolidated statements and 668 with individual ones; 229 file the individual alone and 3 the consolidated alone. No company of it has two versions.
- The fiscal year does not always end in December: `DT_REFER` 2025-03-31, 2025-06-30 and 2025-02-28 occur.
- The ITR holds, for the second and third quarters, the quarter alone and the year to date (`DT_INI_EXERC` at the start of the fiscal year); the first quarter holds the year to date alone. WEGE3, 2026-09-30, consolidated: revenue 30,472,677 thousand from 2026-01-01, net income 4,988,916 thousand.
- Three charts of accounts: the commercial and industrial one (`1.01` "Ativo Circulante": 434 of 442 consolidated companies, 655 of 668 individual); banks (`3.01` "Receitas de Intermediação Financeira"; equity at `2.07` for BBAS3, at `2.08` for ITUB4; net income at `3.11` for BBAS3, at `3.09` for ITUB4); insurers (net income at `3.13`).
- The net income is the level-two line of the income statement whose description holds "Lucro" and "Período" (442 of 442 consolidated, 668 of 668 individual: "Lucro/Prejuízo do Período", "Lucro/Prejuízo Consolidado do Período", "Lucro ou Prejuízo Líquido do Período", "Lucro ou Prejuízo Líquido Consolidado do Período"). The equity is the level-two line of the liabilities whose description begins with "Patrimônio Líquido" (442 of 442, 668 of 668).
- `composicao_capital` holds `QT_ACAO_TOTAL_CAP_INTEGR` and `QT_ACAO_TOTAL_TESOURO` by company and `DT_REFER`.
- `fca_cia_aberta_valor_mobiliario_2026.csv` holds `CNPJ_Companhia`, `Versao`, `Valor_Mobiliario`, `Codigo_Negociacao`, `Mercado`, `Data_Fim_Negociacao`: 451 codes with `Mercado` "Bolsa" and no end date, none shared by two companies, no company with two versions.
- `composicao_capital` carries no unit: ITAU UNIBANCO HOLDING files 11,026,869 shares, a count in thousands, while WEG files 4,197,317,998. P7 compares two counts of one company, so the unit cancels; the list writes the counts as filed.
- The source run against the real files on 2026-11-18 (DFP 2025, ITR 2026, FCA 2026): 671 companies in the DFP, 649 of the chart `standard` and 442 consolidated, each with a net income and an equity; 1,855 periods in the ITR; 436 listings; WEG S.A. 2025 net income 677,595,800,000 minor units and revenue 4,080,411,000,000, as the research found.
- The DFP files of 2020 and 2021 answer 200 (12,637,854 and 13,283,026 bytes); the ITR of 2025 answers 200 (31,684,925 bytes).

## Rules

### Company report source (amends ADR 025)

**CR1 Report.** A report belongs to one company, named by its identifier at the regulator (14 digits), and to one period: the last day of the fiscal year or quarter it covers, with the number of months it spans from the start of the fiscal year (`12` for a fiscal year; `3`, `6` or `9` for the year to date of a quarter). It holds the company's name, whether the statements are consolidated, the chart of accounts (`standard` or `other`), the date of delivery and the accounts of CR5.

**CR2 Source.** A new extension point of `marketdata` (ADR 016): interface `Source` in `internal/marketdata/companyreport/companyreport.go` (`ID`, `URL` of the register's dataset page, `Fetch` returning the files it read with their reports and the listings), one package per implementation under `internal/marketdata/companyreport/<id>/`, entries in `companyReportEntries` in `internal/marketdata/company_reports.go`. It is a feed of ADR 025 with `kind` `company_report`, enabled on the settings screen, suggested, ticked, refreshed and marked stale as the others. Its period is a quarter: `last` is the latest stored period, and the feed is stale when today is after the last day of the next quarter plus 90 days (the DFP is due three months after the fiscal year).

**CR3 `br_cvm_cia`.** Base address setting `EQUORI_FEED_BR_CVM_CIA_URL`, default `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC`; licence ODbL, attribution "CVM, Portal de Dados Abertos". A fetch reads, under the base address, `DFP/DADOS/dfp_cia_aberta_{Y}.zip` for the five years before today's year, `ITR/DADOS/itr_cia_aberta_{Y}.zip` for today's year and the year before, and `FCA/DADOS/fca_cia_aberta_{Y}.zip` for today's year, or the year before when the register does not hold it. A file that did not change since the process last read it (`Last-Modified`) is not read again, and its stored rows stay. From each statement file:

- only the rows of `ORDEM_EXERC` `ÚLTIMO` are read; of a company and `DT_REFER`, the highest `VERSAO`;
- the consolidated members when the company has a row of `DT_REFER` in the consolidated income statement, else the individual members;
- of the income and cash flow statements of an ITR, the rows whose `DT_INI_EXERC` is the start of the fiscal year (`DT_FIM_EXERC` minus the months the year to date spans); the months are counted from `DT_INI_EXERC` to `DT_FIM_EXERC`;
- the delivery date is `DT_RECEB` of the general member (`dfp_cia_aberta_{Y}.csv`, `itr_cia_aberta_{Y}.csv`) for the same company, `DT_REFER` and `VERSAO`;
- a value is `VL_CONTA` times 1,000 when `ESCALA_MOEDA` is `MIL`, in minor units of `BRL`, rounded half away from zero, exact.

`SuggestedFeeds("BR")` adds it.

**CR4 Listings.** From `valor_mobiliario` of the FCA, the rows with `Mercado` "Bolsa", `Data_Fim_Negociacao` blank and `Codigo_Negociacao` matching `^[A-Z0-9]{4}[0-9]{1,2}$`, of the highest `Versao` of a company: the trading code, exchange `BVMF`, the company's identifier (`CNPJ_Companhia` without punctuation) and `Nome_Empresarial`. When two companies give one code, neither listing is stored.

**CR5 Accounts.** Each is null when the line is absent or the chart of accounts is `other` and the account is marked standard only; a null is never zero.

| Account | Line | Charts |
|---|---|---|
| `total_assets` | `1` | both |
| `current_assets` | `1.01` | standard |
| `cash` | `1.01.01` | standard |
| `short_investments` | `1.01.02` | standard |
| `current_liabilities` | `2.01` | standard |
| `short_debt` | `2.01.04` | standard |
| `long_debt` | `2.02.01` | standard |
| `equity` | level-two line of the liabilities whose description begins with "Patrimônio Líquido"; of two, the higher code | both |
| `revenue` | `3.01` | standard |
| `gross_profit` | `3.03` | standard |
| `net_income` | level-two line of the income statement whose description holds "Lucro" and "Período"; of two, the higher code | both |
| `operating_cash_flow` | `6.01` of the cash flow statement, indirect (`DFC_MI`) or direct (`DFC_MD`) | both |
| `shares_issued`, `shares_treasury` | `QT_ACAO_TOTAL_CAP_INTEGR`, `QT_ACAO_TOTAL_TESOURO` of `composicao_capital` | both |

The chart is `standard` when line `1.01` of the assets reads "Ativo Circulante", else `other`. The amounts are integers of minor units; the shares are integer counts.

**CR6 Storage and API.** Table `marketdata_company_report (source, identifier, period, months, file, currency, name, consolidated, plan, delivered, total_assets, current_assets, cash, short_investments, current_liabilities, short_debt, long_debt, equity, revenue, gross_profit, net_income, operating_cash_flow, shares_issued, shares_treasury)`, primary key `(source, identifier, period, months)`; `file` names the file the row came from (`dfp_2025`, `itr_2026`). Table `marketdata_company_listing (source, exchange, code, identifier, name)`, primary key `(source, exchange, code)`. No `books_id`: market data shared by the instance, as `marketdata_fund_report`. A fetch replaces the rows of each file it read and of the listings it read, and deletes the rows of files outside the window of CR3. `GET /company-reports?code=` (`listCompanyReports`) returns `items`: one report set per enabled source that holds a company for the instrument, with source, source address, identifier, name, consolidated, plan, currency and the periods, newest first by period, then by months. The company of an instrument is the one its symbol for the source names (the mechanism of FR15), else the one the listing of its exchange and code names. An unknown code, an instrument without a company and a disabled source give an empty list.

### Figures of the screen

The web computes them from the periods, as the fund report does; each is a pure function with the cases of CR12.

**CR7 Twelve months.** With `F` the latest fiscal year and `Q` the latest year to date whose period is after `F` and whose start is the day after `F` (period minus months), and `Q'` the year to date of the same months one year before `Q`: a flow over twelve months is `F + Q − Q'`. Without such a `Q`, it is `F`. Without `Q'`, none. The screen writes the window ("12 meses até 30/09/2026").

**CR8 Return on equity.** Net income of twelve months over the equity of the latest balance (the period of `Q`, else of `F`). None when the equity is not above zero. Both include the holders of non-controlling interests when the statements are consolidated; the screen says which statements it reads.

**CR9 Net margin; net debt over equity.** Net margin: net income over revenue, both of twelve months; none when the revenue is not above zero. Net debt over equity: `(short_debt + long_debt − cash − short_investments) ÷ equity` of the latest balance; none when the equity is not above zero. Both are "não se aplica" when the chart is `other`, with the note "plano de contas desta companhia".

**CR10 Positive years.** Of the five latest fiscal years, how many have a net income above zero, written "3 de 5". With fewer than five stored, "2 de 3" and the count of years stored.

**CR11 Signals of Piotroski.** On the latest fiscal year `t`, the one before `t−1`, and the total assets at the end of `t−2`, each signal is "sim", "não" or "sem dado" (an input missing), and the screen writes the two values it compares. The chart `other` writes "não se aplica ao plano de contas desta companhia" once for the nine.

| ID | Signal | Holds when |
|---|---|---|
| P1 | ROA positive | `net_income(t) ÷ total_assets(t−1) > 0` |
| P2 | Operating cash flow positive | `operating_cash_flow(t) ÷ total_assets(t−1) > 0` |
| P3 | ROA rose | `net_income(t) ÷ total_assets(t−1) > net_income(t−1) ÷ total_assets(t−2)` |
| P4 | Cash flow above net income | `operating_cash_flow(t) ÷ total_assets(t−1) > net_income(t) ÷ total_assets(t−1)` |
| P5 | Leverage fell | `long_debt(t) ÷ mean(total_assets(t), total_assets(t−1)) < long_debt(t−1) ÷ mean(total_assets(t−1), total_assets(t−2))` |
| P6 | Current ratio rose | `current_assets(t) ÷ current_liabilities(t) > current_assets(t−1) ÷ current_liabilities(t−1)` |
| P7 | No shares issued | `shares_issued(t) ≤ shares_issued(t−1)` |
| P8 | Gross margin rose | `gross_profit(t) ÷ revenue(t) > gross_profit(t−1) ÷ revenue(t−1)` |
| P9 | Asset turnover rose | `revenue(t) ÷ total_assets(t−1) > revenue(t−1) ÷ total_assets(t−2)` |

A ratio whose divisor is not above zero makes its signal "sem dado". P2 and P4 scale the cash flow by the assets at the start of the year, as Piotroski (2000) does, so every value the list writes is a ratio, a percentage or a count of shares.

### Hand-computed cases

**CR12.** Each case is a test of the pure function it names. Amounts in units.

- Twelve months (CR7): `F` 2025-12-31 net income 100; `Q` 2026-09-30, 9 months, 90; `Q'` 2025-09-30, 9 months, 70: 120, window to 2026-09-30. Without `Q`: 100, window to 2025-12-31. With `Q` and without `Q'`: none.
- Return on equity (CR8): 120 over 1,000: 12.00%. Equity 0: none.
- Net margin (CR9): 120 over 800: 15.00%. Revenue 0: none.
- Net debt over equity (CR9): debts 100 and 300, cash 50, investments 50, equity 1,000: 0.30. Debts 0, cash 100, investments 0, equity 1,000: −0.10.
- Positive years (CR10): 10, −5, 3, 0, 7: 3 of 5. 10 and 7 alone: 2 of 2.
- Signals (CR11): `t−2` total assets 1,000; `t−1` net income 50, cash flow 60, assets 1,100, long debt 300, current assets 400, current liabilities 200, shares 100, revenue 900, gross profit 270; `t` net income 77, cash flow 90, assets 1,200, long debt 280, current assets 450, current liabilities 200, shares 100, revenue 1,000, gross profit 320. P1 sim (7.00%); P2 sim (8.18%); P3 sim (7.00% against 5.00%); P4 sim (8.18% against 7.00%); P5 sim (0.2435 against 0.2857); P6 sim (2.25 against 2.00); P7 sim (100 against 100); P8 sim (32.00% against 30.00%); P9 sim (0.9091 against 0.9000). The same years with shares 110 in `t` and gross profit 300 in `t`: P7 não, P8 não (30.00% against 30.00%). Without `t−2`: P3, P5 and P9 sem dado.

## Screen

### Company report (shared component)

`CompanyReport` in `web/src/features/instruments/company-report/`, exported by the feature `index.ts`. Props: the instrument code. It reads `GET /company-reports`. It draws nothing when the list is empty.

- Section "Demonstrações da companhia". Header line: "{consolidadas | individuais} · exercício até 31/12/2025 · entregue em 27/02/2026", the delivery of the latest period. Under it, the company's name on its own line, cut with an ellipsis and whole in its title when the line is too short.
- Figures as peer tiles of one grid, as the fund report, each with a line that says what it counts:
  - "Retorno sobre o patrimônio", "12 meses até 30/09/2026"
  - "Margem líquida", "12 meses até 30/09/2026"
  - "Dívida líquida sobre patrimônio", "balanço de 30/09/2026"
  - "Anos com lucro", "dos 5 últimos exercícios"
- Signals: a framed list "Sinais de Piotroski, exercício de 2025 contra 2024", nine rows of fixed height: the signal's name as label, the two compared values as description, "sim", "não" or "sem dado" at the end in the text colour. No sum, no colour by value.
- Fixed text under the figures: each figure is computed from the filings as stated; the signals are facts of the accounts, not a grade; the decision is the investor's.
- The source as a link to the dataset page ("CVM, Portal de Dados Abertos").
- A missing figure is written in words: "sem dado", or "não se aplica" with the note "plano de contas desta companhia".
- Privacy mode masks no figure: none is an amount of the book.

### Instrument page

The section below "Informe do fundo", for an instrument whose `GET /company-reports` list is not empty.

## Cross-cutting questions

- R1: The register, its files, its account lines, the description rules of CR5, the listing rule of CR4, the currency and the exchange belong to the company report source `br_cvm_cia`. Regional words (CVM) come from the source label in the catalogs; the company's name comes from the source's data.
- R2: A region without a company report source stores no report: no section on the instrument page.
- R3: Source ids and the feed kind follow `^[a-z0-9_]{2,40}$`; `plan` is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`, so a chart of accounts of another register adds a value.
- R4: Row "Company report source" added to `docs/contributing/regions.md`, and a checklist step for adding one.
- R5: Keys `companyReport.*`, pt-BR and en; the label of `br_cvm_cia` on the settings screen.
- R6: Rates through `format-rate.ts`; ratios, counts and dates through `Intl` of the active tag (`numberFormatter`, `formatDate`).
- C1: Every account is an integer of minor units (`bigint`), shares are integer counts; the web computes CR7 to CR11 in `number` from them, as the calculators do.
- C2: Every account of a report holds the report's currency; no figure adds two currencies.
- C3: A report is shown in its own currency, whatever the base currency of the book; the figures are ratios and counts.
- C4: The currency comes from the report; no amount of the report is written on screen in this delivery, so `useMoneyFormat()` is not reached.
- T1: A period is the last day of a fiscal year or quarter; the delivery date is a calendar date; "today" for the window of CR3 and for staleness comes from `platform/clock`.
- T2: Does not apply: no business day is counted.
- B1: Does not apply: both tables are instance market data without `books_id`, as `marketdata_fund_report`.
- B2: `listCompanyReports` needs `read`; an HTTP test covers a member, and a request without a session.
- B3: No setting beyond the feed switch of ADR 025 and the address `EQUORI_FEED_BR_CVM_CIA_URL`.
- D1: Both tables are classified as left out of the export: refetched market data.
- D2: One goose migration for the two tables.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: public market data, replaced whole per file on each read.
- D5: Does not apply: the diagnostic file gains no field.
- S1: One operation, `listCompanyReports`, mapped to `get_market_data` view `company_reports` in `tool_exposure_test.go`. No new `Problem.code`.
- S2: The section follows the phone scope of the instrument page.
- S3: `internal/assistant/guide/articles/investments.md` gains the company report; `equities_br.md` names the CVM files. Same commit as the screen.
- S4: The assistant reads the reports through `get_market_data` view `company_reports`. It computes no figure; the guide article states that equori gives no recommendation.
- X1: S598 `br_cvm_cia` enabled stores, from fixtures, the fiscal years and quarters of a company under its identifier, the consolidated members when present, the individual ones otherwise, the highest version, the scale `MIL`, and the listing of its code. S599 `GET /company-reports?code=WEGE3` returns them to a member, newest first; 401 without a session; an empty list for an unknown code and with the feed disabled; with the symbol `br_cvm_cia` set on an instrument whose code the FCA does not list, the report of that company. S600 a company of the chart `other` stores `total_assets`, `equity`, `net_income` and `operating_cash_flow` and null standard accounts. S601 the feed is listed with `kind` `company_report` and its `last`, and is stale after its lag. S602 a book of region `US` has the feed listed with `suggested` false. S603 the tool `get_market_data` view `company_reports` returns the items of S599.
- X2: S602 runs outside Brazil. Web tests: an instrument without a report draws no section; a company of the chart `other` writes the inapplicable figures in words.

## Approaches

1. Compute the figures in Go behind an endpoint. Rejected: the fund report computes its identities in the web from stored figures, and the signals are pure functions of the stored accounts.
2. Store every account of every statement. Rejected: about 760 MB of CSV a year for the ITR alone; the figures read fifteen accounts.
3. Store the fifteen accounts per company and period, and compute in the web. Chosen.

## Delivery order

1. Company report source, listings, storage, `listCompanyReports`, tool view, settings entry (CR1 to CR6).
2. Pure functions of CR7 to CR11 with the cases of CR12.
3. `CompanyReport` and the section of the instrument page; guide articles.

## Left to the builder

- The file split under `web/src/features/instruments/company-report/` and `internal/marketdata/companyreport/`, following `web/CLAUDE.md` and ADR 033.
- The licence line of `br_cvm_cia` in `docs/operations/price-feeds.md`.
- Fixtures of the members: a company with consolidated and individual statements and two versions, a company with individual statements alone, a bank of the chart `other`, a value in `UNIDADE`, a third-quarter ITR with the quarter alone and the year to date.
