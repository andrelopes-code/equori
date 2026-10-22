# Price feeds

equori records prices from public sources when the owner enables them. Both are free and
need no key. Phase P8 of the roadmap describes the rules (amendments A60–A62 of
`docs/superpowers/plans/2026-10-17-p8-currencies-investments.md`).

## 1. Enabling

| Variable | Default | Meaning |
|---|---|---|
| `EQUORI_PRICE_FEEDS` | empty | Comma list of `bcb_ptax`, `b3_cotahist`, `ecb`. Empty: equori sends no feed request (N17). |
| `EQUORI_FEED_BCB_PTAX_URL` | `https://olinda.bcb.gov.br/olinda/service/PTAX/version/v1/odata` | Base URL of the BCB PTAX service. |
| `EQUORI_FEED_ECB_URL` | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml` | URL of the ECB reference rates XML file (last 90 days). |
| `EQUORI_FEED_B3_COTAHIST_URL` | `https://bvmf.bmfbovespa.com.br/InstDados/SerHist` | Base URL of the B3 daily historical quotes files. |

A network allowlist for the container adds `olinda.bcb.gov.br` and `bvmf.bmfbovespa.com.br`
for the enabled feeds (`www.ecb.europa.eu` for `ecb`).

## 2. Sources

| Source | Instruments | Request | Price |
|---|---|---|---|
| `bcb_ptax` | Every currency instrument except `BRL` | `ExchangeRatePeriod` per currency for the whole window | `cotacaoVenda` of the `Fechamento` bulletin, quoted in `BRL` |
| `b3_cotahist` | Instruments with exchange `B3` and quote currency `BRL` | `COTAHIST_D{DDMMYYYY}.ZIP` per weekday | `PREULT` of the spot market (`TPMERC` 010), quoted in `BRL` |
| `ecb` | Every currency instrument except `EUR` | One XML file with the last 90 days | Units of the currency per euro, stored as the price of `EUR` quoted in that currency |

A currency the BCB does not quote returns an empty answer and stores nothing.

## 3. Schedule

The feeds run at start and every 6 hours. Each run fetches from the day after the latest
price of the source (per currency for `bcb_ptax`) to today, never earlier than today − 30
days. A day or currency without data (404) is skipped. Any other failure writes one
`price feed` log line with the source and the day or currency; for `b3_cotahist` it ends
the run, for `bcb_ptax` it ends that currency only. The next run fetches the same days
again.

An instrument defined after its feed has run receives prices from the next new day on.
Earlier prices enter through `POST /prices/import`.

## 4. Priority

A manual price (`POST /prices`) wins over a CSV price, which wins over a feed price of the
same date. A feed run never replaces a manual or CSV price.

## 5. Not covered by a feed

Fund shares (CVM daily report), Tesouro Direto bonds and crypto assets enter through
`POST /prices` or `POST /prices/import`.
