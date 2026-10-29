# Price feeds

equori records prices from public sources when the owner enables them. Both are free and
need no key. Phase P8 of the roadmap describes the rules (amendments A60–A62 of
`docs/plans/2026-10-17-p8-currencies-investments.md`).

## 1. Enabling

An admin enables and disables each feed under Settings, "Market data" (ADR 025). The screen suggests the feeds of the admin's region, shows the latest stored date of each feed, warns when a publication is overdue or the last run failed, and runs every enabled feed on request. Every 6 hours the enabled feeds run without a request.

`EQUORI_PRICE_FEEDS` and `EQUORI_INDEX_FEEDS` enable feeds only while no setting is stored: the first change on the screen stores them with it, and later values of the two variables are ignored.

| Variable | Default | Meaning |
|---|---|---|
| `EQUORI_PRICE_FEEDS` | empty | Comma list of `bcb_ptax`, `b3_cotahist`, `b3_consolidated`, `ecb`, enabled while no setting is stored. With both variables empty and no setting stored, equori sends no feed request (N17). |
| `EQUORI_FEED_BCB_PTAX_URL` | `https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata` | Base URL of the BCB PTAX service. |
| `EQUORI_FEED_ECB_URL` | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml` | URL of the ECB reference rates XML file (last 90 days). |
| `EQUORI_INDEX_FEEDS` | empty | Comma list of `br_cdi`, `br_ipca`, `eu_estr`, `ea_hicp`, `us_sofr`, `us_cpi`, enabled while no setting is stored: the index series that accrue the price of a fixed income security that has terms (`PUT /instruments/{code}/terms`). Empty: no index request. An enabled index is fetched from 20 years before today, or from the earliest issue date of a security that follows it when that is earlier. The calculators read the stored rates (`GET /indexes`). |
| `EQUORI_FEED_BR_CDI_URL`, `EQUORI_FEED_BR_IPCA_URL` | `https://api.bcb.gov.br` | Base URL of the BCB SGS service: series 12 (CDI, percent a day) and 433 (IPCA, percent a month). |
| `EQUORI_FEED_EU_ESTR_URL` | `https://data-api.ecb.europa.eu` | Base URL of the ECB Data Portal: series `EST.B.EU000A2X2A25.WT`, the euro short-term rate (€STR), percent a year on an actual/360 basis, one value per TARGET2 business day. Each calendar day is stored as the rate last published on or before it, over 360. |
| `EQUORI_FEED_EA_HICP_URL` | `https://ec.europa.eu` | Base URL of the Eurostat dissemination API: dataset `prc_hicp_minr`, the euro area's all-items HICP (`geo=EA`, `coicop18=TOTAL`, index 2025 = 100). Each month is stored as its level over the month before, minus 1, on its first day. |
| `EQUORI_FEED_US_SOFR_URL` | `https://markets.newyorkfed.org` | Base URL of the Markets Data API of the Federal Reserve Bank of New York: SOFR, percent a year on an actual/360 basis, stored as `eu_estr` is. |
| `EQUORI_FEED_US_CPI_URL` | `https://api.bls.gov` | Base URL of the public API of the Bureau of Labor Statistics, version 1: series `CUUR0000SA0` (CPI-U, all items, U.S. city average, not seasonally adjusted), stored as `ea_hicp` is. Version 1 takes no key and answers 25 requests a day from one address; a first fetch of 20 years takes five. |
| `EQUORI_FEED_BR_FOCUS_URL` | `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata` | Base URL of the Expectativas API of the Banco Central do Brasil: the Focus survey's medians of the Selic target at each year end, stored as the expected CDI (ADR 026). `br_focus` is enabled only on the settings screen. |
| `EQUORI_FEED_B3_COTAHIST_URL` | `https://bvmf.bmfbovespa.com.br/InstDados/SerHist` | Base URL of the B3 daily historical quotes files. |
| `EQUORI_FEED_B3_CONSOLIDATED_URL` | `https://arquivos.b3.com.br` | Base URL of the B3 file download service that serves the consolidated trades file. |

A network allowlist for the container adds `olinda.bcb.gov.br` and `bvmf.bmfbovespa.com.br`
for the enabled feeds (`arquivos.b3.com.br` for `b3_consolidated`; `www.ecb.europa.eu` for `ecb`; `api.bcb.gov.br` for `br_cdi` and
`br_ipca`; `data-api.ecb.europa.eu` for `eu_estr`; `ec.europa.eu` for `ea_hicp`;
`markets.newyorkfed.org` for `us_sofr`; `api.bls.gov` for `us_cpi`; `olinda.bcb.gov.br` for `br_focus`).

## 2. Sources

| Source | Instruments | Request | Price |
|---|---|---|---|
| `bcb_ptax` | Every currency instrument except `BRL` | `ExchangeRatePeriod` per currency for the whole window | `cotacaoVenda` of the `Fechamento` bulletin, quoted in `BRL` |
| `b3_cotahist` | Instruments with exchange `BVMF` and quote currency `BRL` | `COTAHIST_D{DDMMYYYY}.ZIP` per weekday | `PREULT` of the spot market (`TPMERC` 010), quoted in `BRL` |
| `b3_consolidated` | Instruments with exchange `BVMF` and quote currency `BRL` | `TradeInformationConsolidatedFile` per weekday: a request by name returns a token, the token returns the file | `LastPric` of the ticker in any segment, quoted in `BRL`; covers the fixed income ETFs (`AUPO11`, `LFTS11`) that COTAHIST omits |
| `ecb` | Every currency instrument except `EUR` | One XML file with the last 90 days | Units of the currency per euro, stored as the price of `EUR` quoted in that currency |

A currency the BCB does not quote returns an empty answer and stores nothing.

## 3. Schedule

The feeds run at start and every 6 hours. Each run fetches from the day after the latest
price of the source (per currency for `bcb_ptax`) to today, never earlier than today − 30
days. A day or currency without data (404, or 400 for `b3_consolidated`) is skipped. A
`b3_consolidated` file whose status is not `Final` ends the run without a failure. Any other
failure writes one `price feed` log line with the source and the day or currency; for
`b3_cotahist` and `b3_consolidated` it ends the run, for `bcb_ptax` it ends that currency only. The next run fetches the same days
again.

An instrument defined after its feed has run receives prices from the next new day on.
Earlier prices enter through `POST /prices/import`.

## 4. Priority

A manual price (`POST /prices`) wins over a CSV price, which wins over a feed price of the
same date. A feed run never replaces a manual or CSV price.

## 5. Not covered by a feed

Fund shares (CVM daily report), Tesouro Direto bonds and crypto assets enter through
`POST /prices` or `POST /prices/import`.
