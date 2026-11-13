# Instrument sources: where to check

The instrument page (`/instruments/$code`) ends with a section "Where to check": a list of external pages that show the same instrument, so the reader can compare equori's quote with another source or read what equori does not hold (indicators, filings, official rates).

## Rules

- **IS1.** The section sits after "Data and sources" and draws one `List` (`variant="framed"`) of `ListItemLink` rows. A row has a fixed height, one line, the site name at the start, the purpose after it and the host at the end.
- **IS2.** Each link opens in another tab with `rel="noopener noreferrer"`. The address holds only market codes: the instrument code, its exchange or quote currency, and the book's base currency for a currency pair. It holds no amount, name, account or identifier of the book.
- **IS3.** A section with no link draws nothing: no heading, no hint, no empty message.
- **IS4.** Links serve security types `stock`, `reit`, `etf` and `depositary_receipt` (Google Finance, Yahoo Finance), `crypto`, `currency`, `fund` and `fixed_income` with subtype `tesouro`. Any other instrument has none.
- **IS5.** Google Finance and Yahoo Finance are global. Google needs a code per exchange (`BVMF`, `NASDAQ`, `NYSE`) and Yahoo a suffix per exchange (`.SA` for `BVMF`), both from `exchange-symbols.ts`, keyed by the MIC the instrument stores. An exchange without a case has no global link. A Yahoo symbol the instrument holds under the source `yahoo_chart` replaces the derived one.
- **IS6.** A crypto link is `{code}-{quote currency}`. An instrument whose code already ends with its quote currency (`BTCBRL`) has no link: the pair cannot be split from the code.
- **IS7.** A currency link is `{code}-{base currency}`. The base currency itself has no link.
- **IS8.** The regional links come from `source-links-region.ts`, a `switch` on the profile region. `BR`: Fundamentus (`stock`, `reit`, `etf` on `BVMF`), CVM RAD (`stock` on `BVMF`), CVM funds (`fund`), Banco Central PTAX (`currency` with base `BRL`), Tesouro Direto and Tesouro Transparente (`fixed_income`, subtype `tesouro`). A region without a case has the global links only.
- **IS9.** A link set stays within four rows.

## Curation

Each address was requested on 2026-11-13 and answered 200 with the instrument on the page (Google Finance, Yahoo Finance, Fundamentus) or with the page itself (the generic pages). Held out:

- Investidor10 and Status Invest: the path depends on the category (`/acoes/`, `/fiis/`, `/etfs/`) and the book may hold an ETF as `stock`; `investidor10.com.br/acoes/bova11/` answers 410. Status Invest answers 403 to a script.
- CoinMarketCap and CoinGecko: the path holds the coin name, not the code.
- Google Finance and Fundamentus answer 200 for a code that does not exist, so a wrong code is not detectable by status.

## Cross-cutting questions

- R1. The exchange code of Google and the symbol suffix of Yahoo vary by exchange (`exchange-symbols.ts`). The regional sources vary by region (`source-links-region.ts`).
- R2. A region without a case gets the global links, none of the regional ones.
- R3. Does not apply: no value set is stored.
- R4. Two extension points: `docs/contributing/regions.md` gets the rows "Instrument exchange symbols" and "Instrument sources".
- R5. Keys `instrument.sources.*` and `instrument.link.*` in `catalog-instruments.en.ts` and `catalog-instruments.pt-BR.ts`.
- R6. Does not apply: the section writes no number or date.
- C1. Does not apply: no amount is stored or computed.
- C2. Does not apply: no amount is added or compared.
- C3. A currency link uses the base currency from settings; the base currency itself has no link.
- C4. Does not apply: no currency is displayed.
- T1. Does not apply: no date is used.
- T2. Does not apply: no business day is counted.
- B1. Does not apply: no table.
- B2. Does not apply: no operation; the section reads the instrument already returned.
- B3. Does not apply: no setting.
- D1. Does not apply: no table.
- D2. Does not apply: no schema change.
- D3. Does not apply: no recorded fact changes.
- D4. Does not apply: no data is written.
- D5. Does not apply: no diagnostic field.
- S1. Does not apply: no operation is added.
- S2. The route is desktop-only (ADR 027, S3); the section holds no phone code.
- S3. The guide article `investments.md` names the section.
- S4. Does not apply: the assistant does not need the links.
- X1. Does not apply: no scenario; no HTTP behavior changes.
- X2. `source-links.test.ts` runs the region `US` (global links only) and a base currency other than `BRL`.
