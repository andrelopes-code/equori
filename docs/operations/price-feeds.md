# Price feeds

equori records prices from public sources when the owner enables them. Both are free and
need no key. Phase P8 (issue #18) describes the rules (amendments A60–A62 of
`docs/plans/2026-10-17-p8-currencies-investments.md`).

## 1. Enabling

An admin enables and disables each feed under Settings, "Market data" (ADR 025). The screen suggests the feeds of the admin's region, shows the latest stored date of each feed, warns when a publication is overdue or the last run failed, and runs every enabled feed on request. Every 6 hours the enabled feeds run without a request.

Price feeds: `bcb_ptax`, `b3_cotahist`, `b3_consolidated`, `ecb`, `tesouro_direto`, `cvm_funds`, `coinbase`, `yahoo_chart`. With no feed enabled, equori sends no feed request (N17).

Index feeds: `br_cdi`, `br_ipca`, `br_selic`, `br_igpm`, `br_ptax_usd`, `eu_estr`, `ea_hicp`, `us_sofr`, `us_cpi`: the index series that accrue the price of a fixed income security that has terms (`PUT /instruments/{code}/terms`). Empty: no index request. An enabled index is fetched from 20 years before today, or from the earliest issue date of a security that follows it when that is earlier. The calculators read the stored rates (`GET /indexes`). The whole history is read again every 7 days and, once a day, while an expected day has no rate; a rate that differs from the stored one replaces it and the log line `index revised` states it (A265 RI1 to RI4).

Market index feeds: `br_ibovespa`, `br_ifix`, `us_sp500`, `global_ftse`: total return indexes a portfolio is compared with (A265 MI1). `us_sp500` and `global_ftse` are unofficial: enabling them needs a confirmation. `global_ftse` is the ETF VT with its distributions reinvested, since 2011-12-19. A return report in reais compares with them through `br_ptax_usd`, which must be enabled.

| Variable | Default | Meaning |
|---|---|---|
| `EQUORI_FEED_BCB_PTAX_URL` | `https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata` | Base URL of the BCB PTAX service. |
| `EQUORI_FEED_ECB_URL` | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml` | URL of the ECB reference rates XML file (last 90 days). |
| `EQUORI_FEED_TESOURO_DIRETO_URL` | `https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv` | URL of the Tesouro Transparente CSV file with the prices of every Tesouro Direto title. |
| `EQUORI_FEED_CVM_FUNDS_URL` | `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS` | Base URL of the CVM daily reports of investment funds: `HIST/inf_diario_fi_{YYYY}.zip` up to 2020 and `inf_diario_fi_{YYYYMM}.zip` from 2021. |
| `EQUORI_FEED_COINBASE_URL` | `https://api.coinbase.com/api/v3/brokerage/market` | Base URL of the Coinbase public market API: `products/{code}-{quote}/candles`. |
| `EQUORI_FEED_YAHOO_CHART_URL` | `https://query1.finance.yahoo.com/v8/finance/chart` | Base URL of the Yahoo Finance chart API: `{symbol}?period1=…&period2=…&interval=1d`. |
| `EQUORI_FEED_BR_CDI_URL`, `EQUORI_FEED_BR_IPCA_URL` | `https://api.bcb.gov.br` | Base URL of the BCB SGS service: series 12 (CDI, percent a day) and 433 (IPCA, percent a month). |
| `EQUORI_FEED_EU_ESTR_URL` | `https://data-api.ecb.europa.eu` | Base URL of the ECB Data Portal: series `EST.B.EU000A2X2A25.WT`, the euro short-term rate (€STR), percent a year on an actual/360 basis, one value per TARGET2 business day. Each calendar day is stored as the rate last published on or before it, over 360. |
| `EQUORI_FEED_EA_HICP_URL` | `https://ec.europa.eu` | Base URL of the Eurostat dissemination API: dataset `prc_hicp_minr`, the euro area's all-items HICP (`geo=EA`, `coicop18=TOTAL`, index 2025 = 100). Each month is stored as its level over the month before, minus 1, on its first day. |
| `EQUORI_FEED_US_SOFR_URL` | `https://markets.newyorkfed.org` | Base URL of the Markets Data API of the Federal Reserve Bank of New York: SOFR, percent a year on an actual/360 basis, stored as `eu_estr` is. |
| `EQUORI_FEED_US_CPI_URL` | `https://api.bls.gov` | Base URL of the public API of the Bureau of Labor Statistics, version 1: series `CUUR0000SA0` (CPI-U, all items, U.S. city average, not seasonally adjusted), stored as `ea_hicp` is. Version 1 takes no key and answers 25 requests a day from one address; a first fetch of 20 years takes five. |
| `EQUORI_FEED_BR_IBOVESPA_URL`, `EQUORI_FEED_BR_IFIX_URL` | `https://sistemaswebb3-listados.b3.com.br` | Base URL of the B3 index statistics: `indexStatisticsProxy/IndexCall/GetPortfolioDay/{query}`, one request per year, the daily closes of `IBOVESPA` and `IFIX`. A close enters from 19:00 in São Paulo. |
| `EQUORI_FEED_US_SP500_URL`, `EQUORI_FEED_GLOBAL_FTSE_URL` | `https://query1.finance.yahoo.com/v8/finance/chart` | Base URL of the Yahoo Finance chart API: `^SP500TR` checked against `^GSPC`, and the adjusted closes of `VT` checked against its closes. A total return away from the median of its neighbors by more than 0.03% is replaced by it (A265 MI4). |
| `EQUORI_FEED_BR_FOCUS_URL` | `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata` | Base URL of the Expectativas API of the Banco Central do Brasil: the Focus survey's medians of the Selic target at each year end, stored as the expected CDI (ADR 026). `br_focus` is enabled only on the settings screen. |
| `EQUORI_FEED_BR_FOCUS_IPCA_URL` | `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata` | Base URL of the Expectativas API of the Banco Central do Brasil: the Focus survey's medians of the IPCA at each year end, stored as the expected `ipca` (ADR 026 E12). `br_focus_ipca` is enabled only on the settings screen. |
| `EQUORI_FEED_BR_TESOURO_URL` | `https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv` | URL of the Tesouro Transparente CSV file `tesouro_direto` reads: the buy rates of Tesouro Prefixado and Tesouro IPCA+ on the latest base date, stored as the curves `br_tesouro_prefixed` and `br_tesouro_ipca` (indexer comparison IC11). `br_tesouro` is enabled only on the settings screen. |
| `EQUORI_FEED_BR_CVM_FII_URL` | `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS` | Base URL of the CVM yearly files of the monthly reports of real estate funds (`inf_mensal_fii_{YYYY}.zip`), stored as fund reports (fund report FR3). Licence ODbL; attribution: CVM, Portal de Dados Abertos. `br_cvm_fii` is enabled only on the settings screen. |
| `EQUORI_FEED_BR_CVM_CIA_URL` | `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC` | Base URL of the CVM files of listed companies: DFP, ITR and FCA under `DFP/DADOS`, `ITR/DADOS` and `FCA/DADOS`, stored as company reports (company report CR3). Licence ODbL; attribution: CVM, Portal de Dados Abertos. `br_cvm_cia` is enabled only on the settings screen. |
| `EQUORI_FEED_B3_COTAHIST_URL` | `https://bvmf.bmfbovespa.com.br/InstDados/SerHist` | Base URL of the B3 daily historical quotes files. |
| `EQUORI_FEED_B3_CONSOLIDATED_URL` | `https://arquivos.b3.com.br` | Base URL of the B3 file download service that serves the consolidated trades file. |

A network allowlist for the container adds `olinda.bcb.gov.br` and `bvmf.bmfbovespa.com.br`
for the enabled feeds (`arquivos.b3.com.br` for `b3_consolidated`; `www.ecb.europa.eu` for `ecb`; `www.tesourotransparente.gov.br` for `tesouro_direto`; `dados.cvm.gov.br` for `cvm_funds`; `api.coinbase.com` for `coinbase`; `query1.finance.yahoo.com` for `yahoo_chart`; `api.bcb.gov.br` for `br_cdi` and
`br_ipca`; `data-api.ecb.europa.eu` for `eu_estr`; `ec.europa.eu` for `ea_hicp`;
`sistemaswebb3-listados.b3.com.br` for `br_ibovespa` and `br_ifix`; `query1.finance.yahoo.com` for `us_sp500` and `global_ftse`;
`markets.newyorkfed.org` for `us_sofr`; `api.bls.gov` for `us_cpi`; `olinda.bcb.gov.br` for `br_focus`).

## 2. Sources

| Source | Instruments | Request | Price |
|---|---|---|---|
| `bcb_ptax` | Every currency instrument except `BRL` | `ExchangeRatePeriod` per currency for the whole window | `cotacaoVenda` of the `Fechamento` bulletin, quoted in `BRL` |
| `b3_cotahist` | Instruments with exchange `BVMF` and quote currency `BRL` | `COTAHIST_D{DDMMYYYY}.ZIP` per weekday | `PREULT` of the spot market (`TPMERC` 010), quoted in `BRL` |
| `b3_consolidated` | Instruments with exchange `BVMF` and quote currency `BRL` | `TradeInformationConsolidatedFile` per weekday: a request by name returns a token, the token returns the file | `LastPric` of the ticker in any segment, quoted in `BRL`; covers the fixed income ETFs (`AUPO11`, `LFTS11`) that COTAHIST omits |
| `ecb` | Every currency instrument except `EUR` | One XML file with the last 90 days | Units of the currency per euro, stored as the price of `EUR` quoted in that currency |
| `tesouro_direto` | Instruments of type `fixed_income`, no exchange, quote currency `BRL`, code `{LFT,LTN,NTNF,NTNB,NTNBP,NTNC,EDUCA,RENDA}.{YYYYMMDD}` | One CSV file with every title and date | `PU Venda Manha` at `Data Base`, quoted in `BRL`; a zero price is skipped |
| `cvm_funds` | Instruments of type `fund`, no exchange, quote currency `BRL`, code a 14-character CNPJ without punctuation | One ZIP file per year up to 2020 and per month from 2021 | `VL_QUOTA` at `DT_COMPTC`, quoted in `BRL`; a subclass line and a zero value are skipped |
| `coinbase` | Instruments of type `crypto` with a quote currency | `products/{code}-{quote}/candles` with `granularity=ONE_DAY`, windows of 300 days at most | `close` of the daily candle at its `start` day (UTC), quoted in the quote currency of the instrument; a product the exchange refuses (400 or 404) stores nothing |
| `yahoo_chart` | Currencies other than `USD` that a security is quoted in (`{code}USD=X`), `crypto` (`{code}-{quote}`), and instruments whose MIC has a suffix in the table of the package (`BVMF` `.SA`, `XETR` `.DE`, …); a symbol set on the instrument replaces the derived one | `{symbol}?period1=…&period2=…&interval=1d&events=split`, one request per symbol, one at a time | `indicators.quote[0].close`, multiplied back by the ratio of every later split of `events.splits` (Yahoo divides it), not adjusted for dividends, dated in the time zone of the exchange; a null close is skipped; a currency other than the quote currency of the instrument (pence in London) fails that code; a 404 stores nothing; a 429 ends the run |

A currency the BCB does not quote returns an empty answer and stores nothing.

## 3. Schedule

The feeds run at start and every 6 hours, and 30 minutes after a run in which one failed. Each run fetches from the day after the latest
price of the source (per currency for `bcb_ptax`) to today, never earlier than today − 30
days. A day or currency without data (404, or 400 for `b3_consolidated`) is skipped. A
`b3_consolidated` file whose status is not `Final` ends the run without a failure. Any other
failure writes one `price feed` log line with the source and the day or currency; for
`b3_cotahist` and `b3_consolidated` it ends the run, for `bcb_ptax` it ends that currency only. The next run fetches the same days
again.

An instrument defined after its feed has run receives prices from the next new day on.
Earlier prices enter through `POST /prices/import`.

## 4. Priority

Five priorities order the prices of one date, the lowest winning: `manual` 1 (`POST /prices`),
`csv` 2 (`POST /prices/import`), an official feed 3, `accrual` 4 (computed from the terms of a
fixed income security), an unofficial feed 5. A feed run never replaces a manual or CSV price.

`yahoo_chart` is unofficial: enabling it needs a confirmation (A222 MQ22).

## 5. Not covered by a feed

An instrument that no enabled feed quotes enters through `POST /prices` or
`POST /prices/import`.
