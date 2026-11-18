# Fund report

- Date: 2026-11-18
- Status: approved on 2026-11-18 (the owner delegated the decisions to the planning session)
- Issue: #57
- Amends: ADR 025 (a sixth kind of feed, `fund_report`)

## Intent

An investor who buys units of a listed real estate fund reads, on third-party sites, the book value of a unit, the price over that value and the yield of the distributions. equori shows the price of the fund and nothing the fund reports. The owner's request of 2026-11-18: find the analysis methods of variable income that rest on evidence and bring the ones that fit. equori computes; it gives no recommendation and no verdict.

A fund report is the set of figures a listed fund files with its regulator for one month.

## Goals, non-goals, anti-goals

Goals:

- Show the figures a listed real estate fund reported for its latest month, each with its source and date.
- State the price over the book value of a unit, with the date of each.
- State the distributions of twelve months over the price.
- State the break-even growth: the constant real growth of the distributions at which the fund pays the same as the longest bond of the real curve.
- Open the report on the instrument page and from the contribution plan.

Non-goals:

- Figures of a company (balance sheet, income statement): a later delivery over the CVM `DFP` and `ITR` files.
- A weight of an asset computed from questions the investor writes and answers: a later delivery over the member ideals of the contribution plan.
- Exchange-traded funds: no source of their index series was verified.
- Measures of price history (volatility, return of twelve months): the stored prices are not adjusted for corporate events.
- The quarterly report (properties, tenants, vacancy): its columns were not inspected.
- Tax: the break-even growth is before tax.
- A fund the source cannot tie to one trading code (FR4): no manual link in this delivery.

Anti-goals:

- A grade, a threshold, a colour, an order or a mark that says a fund is cheap, dear, good or bad. No text reads "below 1" as a quality.
- A figure without its source and date.
- A price ceiling, a fair price or a ranking.

## Evidence the method rests on

Research of 2026-11-18, each source read by a real request unless stated.

- A rule that picks stocks from accounting ratios loses most of its return after publication: 97 predictors return 26% less out of sample and 58% less after publication (McLean and Pontiff 2016); 65% of 452 anomalies fail a t of 1.96 and 82% fail 2.78 (Hou, Xue and Zhang 2020); a new factor needs a t above 3.0 (Harvey, Liu and Zhu 2016).
- Brazilian factors of NEFIN/USP, monthly, value weighted, 2001-01 to 2026-08, 308 months, plain t test computed in the research session: market 0.278% a month (t 0.80), size 0.050% (0.18), value 0.488% (1.35), momentum 0.813% (2.08), illiquidity 0.093% (0.34). No factor reaches 3.0.
- No published test after publication was found for the Graham number, the Bazin price ceiling, the Magic Formula ranking, the Diagrama do Cerrado score or the rule "price below book value" for a real estate fund. This is the reason for the anti-goals above.
- The figures of this spec are identities: each follows from the report, the price and the curve alone. The break-even growth is the Gordon model solved for the growth, and holds under the assumption FR10 states on screen.
- Not verified: the full text of each article (abstracts only); the abstract of Piotroski 2000; a Brazilian source on the quality and low-risk factors.

## Rules

### Fund report source (amends ADR 025)

**FR1 Report.** A report belongs to one fund, named by the exchange (ISO 10383 MIC) and the trading code of its unit, and to one period: the first day of the month it covers. It holds the currency, the fund's identifier at the regulator, the fund's name and segment as the source writes them, the date of delivery, and the figures of FR5.

**FR2 Source.** A new extension point of `marketdata` (ADR 016): interface `Source` in `internal/marketdata/fundreport/fundreport.go` (`ID`, `URL` of the register's dataset page, `Fetch` returning the reports of the periods the store lacks), one package per implementation under `internal/marketdata/fundreport/<id>/`, entries in `fundReportEntries` in `internal/marketdata/fund_reports.go`. A fund report source is a feed of ADR 025 with `kind` `fund_report`, enabled on the settings screen, suggested, ticked, refreshed and marked stale as the others; `last` is its latest period; its period is a month.

**FR3 `br_cvm_fii`.** It reads the yearly file `inf_mensal_fii_{YYYY}.zip` of the CVM dataset `fii-doc-inf_mensal` (base address setting `EQUORI_FEED_BR_CVM_FII_URL`, default `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS`; licence ODbL): the members `inf_mensal_fii_geral_{YYYY}.csv` and `inf_mensal_fii_complemento_{YYYY}.csv`, Latin-1, separated by `;`, joined by `CNPJ_Fundo_Classe`, `Data_Referencia` and `Versao`. A fetch reads the file of today's year and the file of the year twelve months before today; a file whose twelve periods are all stored is not requested. For one fund and period the row of the highest `Versao` is kept. Checked on 2026-11-18: the file of 2026 answers 200 with 13,103 rows, periods 2026-01-01 to 2026-10-01, and the period 2026-10-01 was delivered on 2026-11-13. Currency `BRL`; exchange `BVMF`. A report is stale when today is more than 80 days after the latest stored period. `SuggestedFeeds("BR")` adds it.

**FR4 Trading code of `br_cvm_fii`.** The file names a fund by its identifier and by `Codigo_ISIN`, never by its trading code. The code is the four characters after `BR` of an ISIN that matches `^BR[A-Z0-9]{4}CTF[0-9A-Z]{3}$`, followed by `11`. A row is read only when `Mercado_Negociacao_Bolsa` is `S` and the ISIN matches. When two funds of one period give the same code, neither is stored. Checked on 2026-11-18: `BRHGLGCTF004` gives `HGLG11`; of 1,366 funds of 2026-10-01, 1,112 hold a matching ISIN, and 28 codes are shared by two or more funds before the exchange filter.

**FR5 Figures.** Each is null when the source leaves it blank; a null is never read as zero.

| Figure | Unit | `br_cvm_fii` column |
|---|---|---|
| `net_assets` | minor units of the currency | `Patrimonio_Liquido` |
| `units` | exact decimal | `Cotas_Emitidas` |
| `unit_book_value` | exact decimal of the currency | `Valor_Patrimonial_Cotas` |
| `holders` | integer | `Total_Numero_Cotistas` |
| `admin_fee` | exact decimal fraction of the net assets, in the month | `Percentual_Despesas_Taxa_Administracao` |
| `month_yield` | exact decimal fraction of the book value, in the month | `Percentual_Dividend_Yield_Mes` |
| `month_amortization` | exact decimal fraction, in the month | `Percentual_Amortizacao_Cotas_Mes` |

Checked on 2026-11-18 for `HGLG11`, period 2026-10-01: unit book value 165.02474631029, month yield 0.006943, 633,787 holders.

**FR6 Storage and API.** Table `marketdata_fund_report (source, exchange, code, period, currency, identifier, name, segment, delivered, net_assets, units, unit_book_value, holders, admin_fee, month_yield, month_amortization)`, primary key `(source, exchange, code, period)`, no `books_id`: market data shared by the instance, as `marketdata_curve_point`. A fetch replaces the rows of each period it read and keeps the 24 latest periods of the source. `GET /fund-reports?code=` (`listFundReports`) returns `items`: zero or one report set for the instrument of that code whose exchange a stored row names, from an enabled source, with source, source address, currency, identifier, name, segment and the periods, newest first. An unknown code, an instrument without rows and a disabled source give an empty list.

### Figures of the screen

**FR7 Price over book value.** `price ÷ unit_book_value`, with the latest stored price of the instrument and the unit book value of the latest period. The screen writes both dates. None when either is missing or the book value is not above zero.

**FR8 Distribution of a month.** `month_yield × unit_book_value` of the same period: the amount a unit distributed in the month, as the report implies it. It is an estimate: the report states the yield and not the amount, and the screen says so.

**FR9 Yield of twelve months.** The sum of FR8 over the twelve latest periods, divided by the latest stored price. None when the twelve latest periods are not twelve consecutive months, when a month of them lacks a figure of FR8, or without a price.

**FR10 Break-even growth.** With `y` the yield of FR9 and `r` the reference rate of FR11: `g = (r − y) ÷ (1 + y)`. It is the constant real growth of the distributions, for ever, at which the fund returns `r` a year above inflation when the price keeps the same multiple of the distribution: `y × (1 + g) + g = r`. None without `y` or `r`.

**FR11 Reference rate.** The point of the latest maturity of the curve of kind `real` whose currency is the quote currency of the instrument, from `GET /curves`. The screen writes the curve's label, the maturity and the base date. Without such a curve the screen writes the absence in words.

### Hand-computed cases

**FR14.** Each case is a test of the pure function it names.

- Price over book value (FR7): price 158.00, unit book value 165.02474631029: 0.9574.
- Distribution of a month (FR8): yield 0.006943, unit book value 165.02474631029: 1.1458.
- Yield of twelve months (FR9): twelve months of 1.10 each, price 158.00: 8.3544%. Eleven periods: none. Twelve periods with a gap of one month: none.
- Break-even growth (FR10): `y` 8.00%, `r` 7.00%: −0.9259%. `y` 6.00%, `r` 7.50%: 1.4151%. `y` equal to `r`: 0.0000%.
- Reference rate (FR11): points 2029-05-15 at 7.10% and 2045-05-15 at 6.90%: 6.90%, maturity 2045-05-15.

## Screen

### Report (shared component)

`FundReport` in `web/src/features/instruments/fund-report/`, exported by the feature `index.ts`. Props: the instrument code. It reads `GET /fund-reports`, the instrument's quote and `GET /curves`. It draws nothing when the list is empty.

- Header line: the fund's name as the source writes it, its segment, "Informe de outubro de 2026 · entregue em 13/11/2026", and the source as a link to the dataset page ("CVM, Informe Mensal de FII").
- Figures, one row each, fixed row height, values end-aligned on one line, each with its date when it differs from the report's month:
  - "Valor patrimonial da cota"
  - "Preço sobre o valor patrimonial", with "preço de 17/11/2026"
  - "Patrimônio líquido"
  - "Cotistas"
  - "Taxa de administração no mês"
  - "Rendimento do mês sobre o valor patrimonial"
  - "Distribuído por cota em 12 meses (estimado)"
  - "Distribuído em 12 meses sobre o preço"
- Break-even row: "empata com Tesouro IPCA+ 2045 (6,90% a.a. · 16/11/2026) se o rendimento crescer 1,42% a.a. acima da inflação, para sempre". A missing figure is written in words: "sem curva de juro real", "menos de 12 informes seguidos".
- Fixed text under the figures: the distributed amount is estimated from the reported yield and the book value; the break-even assumes constant growth and a constant price multiple, before tax; a figure is not a forecast; the decision is the investor's.
- A stale feed writes "informe desatualizado" beside the report's month, in the warning text colour, with no icon.
- Privacy mode masks no figure: none is an amount of the book.
- No figure changes colour with its value.

### Instrument page

A section "Informe do fundo" below the price section, for an instrument whose `GET /fund-reports` list is not empty.

### Contribution plan ("This month")

In the purchase table, a row of an instrument with a report gains a text button "Ver informe". It opens a dialog that holds `FundReport`. The dialog changes nothing in the plan or the split. The button is absent while the plan is in edit mode. The row height does not change.

## Cross-cutting questions

- R1: The register, its file layout, the trading-code rule (FR4), the currency and the exchange belong to the fund report source `br_cvm_fii`. The reference rate comes from a curve source (`br_tesouro`). Regional words (CVM, FII, Tesouro IPCA+) come from the source and curve labels in the catalogs and from the source's data, never from the component.
- R2: A region without a fund report source stores no report: no section on the instrument page and no button in the plan. A region with a report and no real curve shows the figures and writes the absence of the reference rate.
- R3: Source ids, exchange and feed kinds follow the patterns the module already uses (`^[a-z0-9_]{2,40}$`, MIC); the segment is free text of the source.
- R4: Row "Fund report source" added to `docs/contributing/regions.md`, and a checklist step for adding one.
- R5: Keys `fundReport.*` and the plan button, pt-BR and en; the label of `br_cvm_fii` on the settings screen. The fund's name and segment are data of the source, shown as written.
- R6: Rates through `format-rate.ts`, dates, counts and amounts through `Intl` of the active tag and `useMoneyFormat()`.
- C1: `net_assets` is an integer of minor units. `unit_book_value`, `units` and the fractions are exact decimals in SQL and Go; the web computes FR7 to FR10 in `number`, as the calculators do.
- C2: Every figure of a report holds the report's currency. FR7 and FR9 divide by the price only when the instrument's quote currency equals the report's currency; otherwise none, in words.
- C3: A report is shown in its own currency, whatever the base currency of the book. The reference rate is the real curve of the quote currency, never of the base currency.
- C4: The currency comes from the report; amounts through `useMoneyFormat()`.
- T1: A period is the first day of a month; the delivery date and the price date are calendar dates; "today" for staleness comes from `platform/clock`.
- T2: Does not apply: no business day is counted.
- B1: Does not apply: the table is instance market data without `books_id`, as `marketdata_curve_point`.
- B2: `listFundReports` needs `read`; an HTTP test covers a member, and a request without a session.
- B3: No setting beyond the feed switch of ADR 025 and the address `EQUORI_FEED_BR_CVM_FII_URL`.
- D1: The table is classified as left out of the export: refetched market data.
- D2: One goose migration for the table.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: public market data, replaced whole per period on each fetch.
- D5: Does not apply: the diagnostic file gains no field.
- S1: One operation, `listFundReports`, mapped to `get_market_data` view `fund_reports` in `tool_exposure_test.go`. No new `Problem.code`.
- S2: The section follows the phone scope of the instrument page. The plan dialog is desktop only, as the plan (ADR 027).
- S3: `internal/assistant/guide/articles/investments.md` and `contribution_plan.md` gain the report; `investments_br.md` names CVM, FII and Tesouro IPCA+. Same commit as each screen.
- S4: The assistant reads reports through `get_market_data` view `fund_reports`. It computes no break-even; the guide article states that equori gives no recommendation.
- X1: S591 `br_cvm_fii` enabled stores, from a fixture, the periods of a fund under its trading code, and keeps the highest version of a period. S592 `GET /fund-reports?code=HGLG11` returns them, newest first, to a member; 401 without a session. S593 with the feed disabled the list is empty. S594 two funds that give one code store nothing, and a row with ISIN `0` or outside the exchange is skipped. S595 the feed is listed with `kind` `fund_report` and its `last`, and is stale after 80 days. S596 a book of region `US` has the feed listed with `suggested` false.
- X2: S596 runs outside Brazil. Web tests: an instrument without a report draws no section; a report in `BRL` on an instrument quoted in `USD` writes no price figure; a book whose curves hold no real curve writes the absence.

## Approaches

1. Carry a selection method (the Diagrama do Cerrado score, the Magic Formula ranking, the Bazin ceiling) into the app. Rejected: each exists only as a verdict and none has a test after publication.
2. Compute the figures in Go behind a `portfolio` endpoint. Rejected: the web already holds the quote and the curves, and the calculators compute rates there.
3. The backend gains data only (the fund report source); one web component computes the identities and is drawn on the instrument page and in the plan. Chosen.

## Delivery order

1. Fund report source, storage, `listFundReports`, settings screen entry (FR1 to FR6).
2. Pure functions of FR7 to FR11 with the cases of FR14.
3. `FundReport` and the section of the instrument page.
4. The plan button and dialog.

## Left to the builder

- The file split under `web/src/features/instruments/fund-report/` and `internal/marketdata/fundreport/`, following `web/CLAUDE.md` and ADR 033.
- The Slotted family of the plan dialog and of the figure rows.
- The licence line of `br_cvm_fii` in `docs/operations/price-feeds.md`: ODbL, with the attribution "CVM, Portal de Dados Abertos".
- A fixture of the two CSV members that holds a fund with two versions of one period, two funds of one code, a row with ISIN `0` and a row outside the exchange.
