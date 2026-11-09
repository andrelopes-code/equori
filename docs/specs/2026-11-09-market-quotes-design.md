# Market quotes: history, coverage and import

- Date: 2026-11-09
- Status: awaiting owner approval. The owner delegated every choice ("considere tudo de melhor", 2026-11-09).
- Amendment: A222. Scenarios: S355 to S374.
- Amends: ADR 025 F3, F5, F9, F10 and "Not covered"; P8 amendments A60 (range, priorities) and A62 (window).
- Keeps: N17. The application contacts only the sources an admin enabled.

## 1. Context

A quote is a stored price `(instrument, quote_instrument, date, value, source)` (A60). This document uses "quote" for the concept and "price" for the stored row.

These measurements describe the current state:

| # | Place | Observed | Effect |
|---|---|---|---|
| G1 | `internal/marketdata/feeds.go:20` | `feedWindowDays = 30`. Index sources load 20 years (`indexes.go:27`). | Five years of the dollar enter only through a CSV built by hand. |
| G2 | `listPrices` (A60), `web/src/features/instruments/price-window.ts` | The range is at most 366 days. The chart offers 30, 90 and 366 days. | An imported history longer than one year cannot be read on screen. |
| G3 | A62 | Fund shares and Tesouro Direto enter only as `manual` or `csv`. | The two most common Brazilian investments have no automatic quote. |
| G4 | ADR 025, "Not covered" | No source quotes an exchange other than the B3, and no source quotes crypto. | Foreign stocks, foreign ETFs and crypto need manual prices. |
| G5 | `POST /prices/import` | The header `instrument,quote_instrument,date,value` is mandatory, with a code on every line. | A downloaded series (date and close of one instrument, local date and decimal format) needs editing before import. |
| G6 | `define-instrument-dialog.tsx` | The dialog does not state whether a source quotes the instrument. The first quote waits for the next tick, which runs every 6 hours (A62). | A typing error in a code is found hours later, or never. |
| G7 | ADR 025 F9 | Staleness is measured per source, not per instrument. | An instrument without quotes for weeks shows no warning while its source has other codes up to date. |
| G8 | `internal/platform/registry/registry.go:65`, `domain/price.go:34` | Every source other than `manual` and `csv` has priority 3, `accrual` included. | On one date, a market price and an accrued estimate tie, and the latest `recorded_at` wins. |

These public sources were checked on 2026-11-09:

| Source | Request | Result |
|---|---|---|
| BCB PTAX | `ExchangeRatePeriod`, USD, 2021-01-01 to 2026-11-07 | One answer, 1,469 closing quotes, 2021-01-04 to 2026-11-06. `Currencies` lists 10 currencies. |
| B3 | `SerHist/COTAHIST_A{YYYY}.ZIP` | Keyless. 2024: 79,261,198 bytes. 2026: 102,322,138 bytes, updated on 2026-11-06 (the file of the current year grows daily). 1986: 8,713,632 bytes. |
| ECB | `eurofxref-hist.zip` | Keyless. One CSV with the full series. |
| CVM | `FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_YYYYMM.zip` from 2021-01; `DADOS/HIST/inf_diario_fi_YYYY.zip` for 2000 to 2020 | Keyless. 2025-10: 12,354,423 bytes. Columns `TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;...`. |
| Tesouro Transparente | `PrecoTaxaTesouroDireto.csv` | Keyless. 14,667,960 bytes, Latin-1, `;`, decimal comma, `dd/mm/yyyy`. Base dates 2004-12-31 to 2026-11-06. Eight title types. |
| Coinbase | `api/v3/brokerage/market/products/{base}-{quote}/candles?granularity=ONE_DAY` | Keyless. BTC-USD and ETH-EUR answer with at most 350 candles per request. BTC-BRL answers 400. |
| Yahoo | `query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1=0&period2=…&interval=1d&events=split,div` | Answers without a key. AAPL from 1980-12-12, PETR4.SA from 2000-01-03, USDBRL=X from 2003-12-01, BTC-USD from 2014-09-17, VWCE.DE from 2019-07-29. The answer carries `quote` and `adjclose`, the splits, and the exchange's time zone. `v1/finance/search` returns symbols by name. The service publishes no terms of use for this access. |
| Stooq | `q/d/l/?s=aapl.us&i=d` | Answers with a JavaScript challenge. Not usable from a server. |

## 2. Goals and non-goals

Goals:
- A quote of any listed instrument (B3 and foreign stock, ETF, REIT, depositary receipt, fund share, Tesouro Direto title, currency, crypto) arrives without manual entry once an admin enables its source.
- Defining an instrument loads its history at once, 20 years by default, without a separate request.
- A series that no source covers enters through a file or pasted text holding only a date and a value.
- Every screen that shows a quote shows its date and its source, and warns when the quote is late.

Non-goals:
- Intraday or real-time quotes. The unit is the daily close.
- Corporate actions (split, reverse split, bonus shares). See section 9.
- Providers that require a key.

Anti-goals:
- A fetch the admin did not enable (N17).
- An unofficial quote that wins over an official one on the same date.
- A missing quote read as zero or dropped in silence (`docs/contributing/currencies.md`, M2 to M8).

## 3. Decisions

### 3.1 Source priority

| ID | Decision |
|---|---|
| MQ1 | Priorities: `manual` 1, `csv` 2, an official source 3, `accrual` 4, an unofficial source 5. A market quote wins over an accrued estimate on the same date. An unofficial quote fills only the dates no other source covers. |
| MQ2 | A source entry in `sources.go` declares `Official bool`. `domain.Priority` receives the set of unofficial IDs as a value (the pattern of IC4 in `docs/specs/2026-11-09-index-compounding-design.md`). The domain names no source. |
| MQ3 | A migration replaces the priority `CHECK` of `marketdata_price` with `priority BETWEEN 1 AND 5`, `(source = 'manual') = (priority = 1)` and `(source = 'csv') = (priority = 2)`. It sets priority 4 on the stored rows of `accrual`. |

### 3.2 History

| ID | Decision |
|---|---|
| MQ4 | Table `marketdata_history (source text CHECK (source ~ '^[a-z0-9_]{2,40}$'), instrument text REFERENCES marketdata_instrument (code), from_date date NOT NULL, requested_at timestamptz NOT NULL, done_at timestamptz, error text, PRIMARY KEY (source, instrument))`. One row is one request: "the prices of this instrument from this source since this date". The table has no `books_id`: market data belongs to the instance (ADR 025, Context). |
| MQ5 | A request inserts the row, or lowers `from_date` when the stored one is later. It clears `done_at` and `error`. Requests come from three places: enabling a source (MQ6), defining or editing an instrument (MQ7), and `POST /instruments/{code}/history` (MQ8). |
| MQ6 | Enabling a source (F6) requests, for each code the source quotes (`Codes`), the default start: today minus 20 years (the constant `indexHistoryYears`). The B3 sources default to today minus 5 years, because each year file holds 79 to 102 MB. |
| MQ7 | Defining an instrument, or editing its type, exchange or quote currency, requests the default start of MQ6 from each enabled source that quotes it. |
| MQ8 | `POST /instruments/{code}/history` (`requestInstrumentHistory`, `x-book-role: write`) with `{from}` requests `from` from each enabled source that quotes the instrument. `from` before 1900-01-01 or after today is 422 `validation_failed`, field `from`. An instrument that no enabled source quotes is 422 `no_source`. |
| MQ9 | The tick (A62) runs the pending rows of `marketdata_history` after its incremental fetch. For each source, it makes one `Fetch` over [the earliest `from_date` of its pending rows, the latest end], where a row's end is the day before the earliest stored price of that source and instrument, or today when none is stored. The prices are upserted under A60, so repeating a range stores nothing new. A success sets `done_at`. A failure stores `error` and keeps the row pending for the next tick. |
| MQ10 | A request starts a tick when none runs. When one runs, the request sets a flag, and the loop runs one more tick when the current one ends. The 409 `refresh_running` of F7 stays for `POST /market-data/refresh` only. |
| MQ11 | `Source.Fetch` already takes `from` and `to` (`feed/feed.go:44`). Each source serves any range: `bcb_ptax` in windows of 1,825 days per currency; `ecb` reads `eurofxref-hist.zip` when `from` is older than 90 days, and `eurofxref-hist-90d.xml` otherwise. The incremental window of 30 days stays for the tick (A62). |
| MQ12 | `b3_consolidated` and `b3_cotahist` serve a range over 31 days from the year files `COTAHIST_A{YYYY}.ZIP`, the current year included, then from the daily files for the days after the last date of that year's file. One year file serves every pending code. `feed.Quote` gains `Source string`. Empty means the reading source. The quotes read from a year file carry `b3_cotahist`, the file they came from. |
| MQ13 | An answer over 16 MiB (`maxResponseBytes`) is read only through `feed.Download`. It streams the body to a file under `os.TempDir()` with a bound of 256 MiB and removes the file after reading. Year files of COTAHIST and of the CVM use it. Other answers keep the 16 MiB bound. |
| MQ14 | `bcb_ptax`, `ecb`, `cvm_funds` and `tesouro_direto` keep the `Last-Modified` of their last answer in memory and send `If-Modified-Since`. A 304 answer is `ErrNoData`. |

### 3.3 New sources

Each new source is a package of `internal/marketdata/internal/feed/<id>/`, an entry in `sourceEntries` with `Lag`, `Official` and default start (MQ6), and a test against a fixture in `testdata/` (`docs/contributing/regions.md`, step 6).

| ID | Decision |
|---|---|
| MQ15 | `cvm_funds` (official, `Lag` 10). `Codes`: type `fund`, no exchange, quote `BRL`, code `^[0-9A-Z]{14}$` (the CNPJ without punctuation; the alphanumeric CNPJ fits). `Fetch`: the monthly files from 2021-01 and the year files of `HIST/` before that. For each line with an empty `ID_SUBCLASSE` whose `CNPJ_FUNDO_CLASSE` without punctuation equals the code, the quote is `(code, BRL, DT_COMPTC, VL_QUOTA)`. Earliest date 2000-01-01. |
| MQ16 | `tesouro_direto` (official, `Lag` 5). `Codes`: type `fixed_income`, no exchange, quote `BRL`, code `^(LFT|LTN|NTNF|NTNB|NTNBP|NTNC|EDUCA|RENDA)\.[0-9]{8}$`. The prefix maps `Tipo Titulo`: Tesouro Selic `LFT`, Tesouro Prefixado `LTN`, Tesouro Prefixado com Juros Semestrais `NTNF`, Tesouro IPCA+ `NTNBP`, Tesouro IPCA+ com Juros Semestrais `NTNB`, Tesouro IGPM+ com Juros Semestrais `NTNC`, Tesouro Educa+ `EDUCA`, Tesouro Renda+ Aposentadoria Extra `RENDA`. The eight digits are `Data Vencimento` as `YYYYMMDD`. The quote is `(code, BRL, Data Base, PU Venda Manha)`, the price the Treasury pays on an early redemption at that date. A title type outside the map is skipped and logged once per fetch. |
| MQ17 | `coinbase` (official: the exchange's own public API, `Lag` 2). `Codes`: type `crypto` with any quote currency. Product `{code}-{quote}`. A 400 or 404 answer for a product is `ErrNoData` for that code. The quote is the `close` of the daily candle, dated by the UTC day of `start`. One request covers at most 300 days. |
| MQ18 | `yahoo_chart` (unofficial, `Lag` 5). `Codes`: the instruments with a symbol under MQ19. `Fetch`: one request per symbol per range, with `period1`, `period2` and `interval=1d`. The quote is `indicators.quote[0].close`, the close not adjusted for splits or dividends, so it matches `PREULT` of the B3. The date is the local date of `timestamp` in `meta.exchangeTimezoneName`. A null close is skipped. A 429 answer ends the source's tick with that error. Requests run one at a time. The header `User-Agent` is `equori/<version>` for every source (`feed.Get`). |
| MQ19 | The symbol of `yahoo_chart` is, in order: the instrument's override (MQ20); for a currency instrument other than `USD`, `{code}USD=X` with quote `USD` (A61 converts through the intermediate); for `crypto`, `{code}-{quote}`; for any other type, the code followed by the suffix of its MIC in a table of the package (`BVMF` `.SA`, `XNYS`/`XNAS`/`ARCX`/`BATS`/`XASE` none, `XTSE` `.TO`, `XLON` `.L`, `XETR` `.DE`, `XFRA` `.F`, `XPAR` `.PA`, `XAMS` `.AS`, `XBRU` `.BR`, `XLIS` `.LS`, `XMIL` `.MI`, `XMAD` `.MC`, `XSWX` `.SW`, `XSTO` `.ST`, `XCSE` `.CO`, `XHEL` `.HE`, `XOSL` `.OL`, `XWBO` `.VI`, `XDUB` `.IR`, `XASX` `.AX`, `XTKS` `.T`, `XHKG` `.HK`, `XKRX` `.KS`, `XNSE` `.NS`, `XMEX` `.MX`, `XBUE` `.BA`, `XJSE` `.JO`, `XSES` `.SI`). Under a MIC with no suffix, `.` in the code becomes `-` (`BRK.B` → `BRK-B`). A MIC outside the table without an override gives no symbol. |
| MQ20 | Table `marketdata_instrument_symbol (instrument text REFERENCES marketdata_instrument (code) ON DELETE CASCADE, source text CHECK (source ~ '^[a-z0-9_]{2,40}$'), symbol text NOT NULL CHECK (symbol ~ '^[A-Za-z0-9.=^_-]{1,40}$'), PRIMARY KEY (instrument, source))`. `Instrument` in `api/openapi.yaml` gains `symbols`, an object from source ID to symbol, written by `defineInstrument` and `editInstrument`. `feed.Instrument` gains `Symbols`, the same map, so `Codes` sees the overrides. A source declares that it reads overrides through the optional interface `feed.SymbolOverride`. Only `yahoo_chart` implements it. |
| MQ21 | `SuggestedFeeds("BR")` adds `cvm_funds` and `tesouro_direto`. No region suggests `coinbase` or `yahoo_chart`. A region without a case suggests nothing (F3). |
| MQ22 | Enabling an unofficial source requires `{enabled: true, accept_unofficial: true}` in F6. Without it the answer is 422 `unofficial_source`. The settings screen sends it after a confirmation dialog: "This source is not official: it publishes no terms for this use and can stop answering without notice. Its quotes fill only the dates that no official source covers." |

### 3.4 Coverage

| ID | Decision |
|---|---|
| MQ23 | `getInstrument` gains `coverage`: `first` and `last` (dates of the chosen prices against the quote currency, or null), `count`, `stale`, and `sources`. Each item of `sources` holds `id`, `enabled`, `official`, `first`, `last`, and `history` (`from`, `done`, `error` of its `marketdata_history` row, or null). It lists every registered source whose `Codes` includes the instrument, enabled or not. |
| MQ24 | An instrument is `stale` when an enabled source quotes it and F9 holds for the instrument's `last`, with the smallest `Lag` among its enabled sources. An instrument that no enabled source quotes is never `stale`. The screen shows the age of its last price instead (MQ35). |
| MQ25 | `listMarketDataFeeds` (F5) gains `official`, `covers` (the number of defined instruments in `Codes`) and `history_pending` (rows without `done_at`). |
| MQ26 | `listPositions` gains `quote_warnings`: the held instruments that are `stale` or have no price on or before the valuation date, with code and last date. The portfolio screen shows one notice that names their number and links to the first instrument. This covers the screen side of issue #43. |

### 3.5 Probe and catalog

| ID | Decision |
|---|---|
| MQ27 | `POST /market-data/probe` (`probeQuote`, `x-book-role: write`) with `{code, type, exchange, quote_currency, symbols}` stores nothing. For each enabled source that would quote the instrument, it fetches the last 10 days and returns `{source, date, value}` of the latest quote, or `{source, error}`. It also lists, as `available`, the disabled sources that would quote it. Each source has a 5-second bound. |
| MQ28 | Optional interface `feed.Catalog`: `Search(ctx, query string, limit int) ([]Listing, error)`. A `Listing` holds `code`, `name`, `type` (or empty), `exchange`, `quote_currency` and `symbol` (or empty). Implementations: `tesouro_direto` (the titles of the latest base date of its last file; name "Tesouro IPCA+ 2035"), `bcb_ptax` (`Currencies`), `ecb` (the currencies of its last file), `b3_consolidated` (the tickers of the latest daily file read by a tick, without name or type), `coinbase` (the product list), `yahoo_chart` (`v1/finance/search`, the Yahoo exchange code mapped back to a MIC by the table of MQ19). A source with a list caches it in memory for 24 hours. |
| MQ29 | `GET /market-data/catalog?q=` (`searchInstrumentCatalog`, `x-book-role: read`) asks each enabled source that implements `Catalog`, with a bound of 3 seconds each, and returns at most 20 listings, defined instruments marked `defined`. A source that fails or times out is named in `unavailable`. `q` shorter than 2 characters is 422 `validation_failed`. |

### 3.6 Long ranges

| ID | Decision |
|---|---|
| MQ30 | `listPrices` accepts a range of up to 18,300 days (50 years). `PriceList` gains `interval`: `day` for a range up to 400 days, `week` up to 3,660 days, `month` beyond. A week or month point is the chosen price of the latest date with a price in that ISO week or calendar month. |
| MQ31 | The chart offers 1M, 3M, 1Y, 5Y and Max. Max starts at `coverage.first`. The table under the chart lists the points the answer returned. |

### 3.7 Import of one instrument

| ID | Decision |
|---|---|
| MQ32 | `POST /instruments/{code}/prices` (`recordInstrumentPrices`, `x-book-role: write`) with `{quote_instrument, prices: [{date, value}], dry_run}` holds at most 20,000 prices and records them as source `csv`, all or nothing. A rejected item is 422 `validation_failed` with field `prices[N]`. `dry_run: true` stores nothing and returns `{new, replaced, unchanged, below_feed}`, where `below_feed` counts the dates that already have a price of an official source. Both modes return those counts. |
| MQ33 | The web reads the file or the pasted text in the browser. It reuses the decoding of `read-file.ts` and the date and decimal detection of `csv-guess.ts`. Those helpers move to a shared directory when the web rules require it. It proposes the date column and the value column, then sends normalized ISO dates and decimal strings. A total row or a row that cannot be read is listed and skipped in the preview, never sent. |
| MQ34 | `POST /prices/import` stays for files that hold several instruments. |

## 4. Screens

| ID | Screen | Change |
|---|---|---|
| MQ35 | Instrument page | A coverage line: "Quotes from {first} to {last} · {count} · {source}", or "No quote" with three actions: request history (when a source quotes it), import a file or paste, record a price. A stale instrument shows a warning with the date of its last quote. An instrument that no enabled source quotes shows "Last quote {n} days ago". An action "Load history since…" opens a date field (MQ8). While a request is pending, the line reads "Loading history since {from}". A failed request shows its error and a retry. |
| MQ36 | Price history | The segments of MQ31. Each row of the table keeps the label of its source (`instruments.source.<id>`). |
| MQ37 | Define instrument dialog | The first field is a search by code or name (MQ29). A result fills code, name, type, exchange and quote currency. Typing without choosing keeps the manual fields. With the code, type, exchange and quote currency filled, the dialog runs the probe 600 ms after the last change (MQ27) and shows one line per source: "{source}: {value} on {date}", "{source}: no quote for this code", or, for an admin, "Not enabled: {source}" with a link to the settings. The probe never blocks saving. |
| MQ38 | Edit instrument dialog | A field "Symbol at {source}" for each source that implements `SymbolOverride` (MQ20). |
| MQ39 | Import prices dialog | Two inputs: file and pasted text. A preview shows the columns found, the chosen date and value columns (changeable), a chart of the series, the skipped rows, and the counts of the dry run (MQ32) before "Record". |
| MQ40 | Settings, market data (F10) | Each row adds: "Covers {n} instruments", "Not official" for an unofficial source, "Loading history: {n} pending" while rows are pending, and the confirmation of MQ22 when an admin enables an unofficial source. |
| MQ41 | Portfolio | The notice of MQ26. |

Every screen keeps its current phone scope. The search of MQ37 and the preview of MQ39 fit a 360 px viewport (ADR 027).

## 5. Operations

| Operation | Change | Role |
|---|---|---|
| `requestInstrumentHistory` | new (MQ8) | write |
| `probeQuote` | new (MQ27) | write |
| `searchInstrumentCatalog` | new (MQ29) | read |
| `recordInstrumentPrices` | new (MQ32) | write |
| `getInstrument` | `coverage` (MQ23), `symbols` (MQ20) | read |
| `defineInstrument`, `editInstrument` | `symbols` (MQ20); history request (MQ7) | write |
| `listPrices` | range and `interval` (MQ30) | read |
| `listMarketDataFeeds` | `official`, `covers`, `history_pending` (MQ25) | read |
| `setMarketDataFeed` | `accept_unofficial` (MQ22); history request (MQ6) | admin |
| `listPositions` | `quote_warnings` (MQ26) | read |

New `Problem.code` values: `no_source` (MQ8), `unofficial_source` (MQ22).

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | The region-dependent values are the sources and what they hold: CNPJ (`cvm_funds`), Tesouro title types (`tesouro_direto`), the MIC suffix table (`yahoo_chart`). Each one lives in its source package, a registry entry of `sources.go`. The suggestions are cases of `SuggestedFeeds` in `region_defaults.go` (MQ21). |
| R2 | A region without a case suggests no source. `ecb`, `coinbase` and `yahoo_chart` are available to any region once an admin enables them. |
| R3 | Source IDs keep `^[a-z0-9_]{2,40}$` (MQ4, MQ20). No new `enum`. `interval` (MQ30) is a closed `enum`: the calendar units are universal. |
| R4 | `docs/contributing/regions.md` gains the row "Instrument catalog" (`feed.Catalog`, MQ28). Step 6 names `Official`, the default start and the optional interfaces. |
| R5 | New keys, with pt-BR and en text: `instruments.coverage.*`, `instruments.history.*`, `instruments.search.*`, `instruments.probe.*`, `instruments.symbol.*`, `prices.import.paste.*`, `prices.import.preview.*`, `settings.feeds.covers`, `settings.feeds.unofficial.*`, `settings.feeds.historyPending`, `portfolio.quoteWarnings.*`, and the labels `instruments.source.cvm_funds`, `instruments.source.tesouro_direto`, `instruments.source.coinbase`, `instruments.source.yahoo_chart`. |
| R6 | Dates, counts and prices on screen go through the formatters of `@/i18n/format`, with the active tag. |
| C1 | A price is a `numeric(30, 12)` rate (`money.Rate`), never a `float64`. The new sources parse decimal text into `money.Rate`. No amount is stored. |
| C2 | No new sum. The portfolio notice (MQ26) names the instruments whose valuation lacks a current price, so a missing price is stated on screen. |
| C3 | The probe and the coverage show the price in the instrument's quote currency. The conversion to the book's base currency stays A61. |
| C4 | Prices on screen use the formatter that `latest-price-cell.tsx` uses today. |
| T1 | A quote's date is the trading date of its source: the exchange's local date (`yahoo_chart`), the UTC day (`coinbase`), the publication date (`bcb_ptax`, `ecb`, B3, `cvm_funds`, `tesouro_direto`). The default start of MQ6 counts from today of `platform/clock`. |
| T2 | No business-day count. Staleness keeps the calendar days of F9. |
| B1 | `marketdata_history` and `marketdata_instrument_symbol` have no `books_id`. They belong to the instance, as `marketdata_price` and `marketdata_feed` do (ADR 025, Context). Schema tests reject an invalid source ID, an invalid symbol and a missing instrument. |
| B2 | Section 5. An HTTP test covers each role and an access without membership for each new operation. |
| B3 | Enabling a source stays an instance setting (F1). A symbol override is a fact of the instrument, at instance level. |
| D1 | `marketdata_history` is left out, as `marketdata_feed` is: it is a work queue. `marketdata_instrument_symbol` takes the class of `marketdata_instrument`. The archive version rises. |
| D2 | Two goose migrations: the priority `CHECK` and accrual rows (MQ3); the two tables (MQ4, MQ20). |
| D3 | A price recorded by MQ32 replaces the `csv` price of the same date (A60). The dry run shows `replaced` before anything is written. |
| D4 | Every write is an upsert keyed by `(instrument, quote_instrument, date, source)`. The same file imported twice, or the same history requested twice, stores nothing new (S359, S370). |
| D5 | Does not apply: no field is added to the diagnostic file. |
| S1 | `tool_exposure_test.go`: `searchInstrumentCatalog` and `requestInstrumentHistory` are exposed through the market tool of `toolapi`. The assistant searches an instrument and requests its history, and the write goes through the assistant's confirmation. `probeQuote` is excluded: it belongs to the dialog flow and the catalog covers the assistant's need. `recordInstrumentPrices` is excluded: it carries a file read in the browser. Each new `Problem.code` has an HTTP test (S362, S366). |
| S2 | Section 4, last paragraph. |
| S3 | The guide articles of the topics of the instrument screens, the settings for market data and the portfolio change in the commits that change those screens. |
| S4 | The market tool returns `coverage.last`, `coverage.stale` and the sources of an instrument, so the assistant can state the age of a quote. |
| X1 | Section 7. |
| X2 | S364 and S365 run in region `US` with base currency `USD`. S366 runs in a book with base currency `BRL` and an instrument quoted in `USD`. S367 runs in region `DE`. |

## 7. Scenarios

Every external source in a test is a fake server that serves a fixture of `testdata/`.

| ID | Scenario |
|---|---|
| S355 | A price of `bcb_ptax` and a price of `accrual` on the same date: the chosen price is the `bcb_ptax` one (MQ1). |
| S356 | A price of `yahoo_chart` and one of `b3_consolidated` on the same date: the chosen price is the B3 one. On a date with only the Yahoo price, that price is chosen (MQ1). |
| S357 | Enabling `bcb_ptax` with instrument `USD` defined stores a `marketdata_history` row from today minus 20 years. The next tick stores the fixture's 1,469 closing quotes, and the row has `done_at` (MQ6, MQ9). |
| S358 | Defining `PETR4` (BVMF, BRL) with `b3_consolidated` enabled requests history from today minus 5 years. The tick reads the year fixtures once each and stores the quotes as source `b3_cotahist` (MQ7, MQ12). |
| S359 | Requesting the same history twice stores no new price (D4). |
| S360 | A history request whose source answers 500: the row keeps `error` and stays pending. The next tick with a 200 answer clears it (MQ9). |
| S361 | With a stored `from_date` of 2006-11-09, `POST /instruments/USD/history` with `from` 2010-01-01 keeps 2006-11-09. With `from` 2000-01-01 it stores 2000-01-01 and clears `done_at` (MQ5). |
| S362 | `POST /instruments/{code}/history` for an instrument that no enabled source quotes answers 422 `no_source` (MQ8). |
| S363 | `listPrices` over 6 years returns `interval: week` and one point per ISO week, each the latest price of its week (MQ30). |
| S364 | Region `US`: enabling `yahoo_chart` without `accept_unofficial` answers 422 `unofficial_source`. With it, `AAPL` (XNAS, USD) gets the quotes of the fixture, dated in `America/New_York` (MQ18, MQ22). |
| S365 | Region `US`: `BRK.B` (XNYS) is requested as `BRK-B`. An override `{yahoo_chart: "BRK-B"}` on an instrument of MIC `XNZE` makes it quoted (MQ19, MQ20). |
| S366 | A book with base `BRL` and instrument `VWCE` (XETR, EUR): the probe with `yahoo_chart` enabled returns the latest fixture quote in `EUR`. With no enabled source it returns `available: [yahoo_chart]` (MQ27). |
| S367 | Region `DE`: `GET /market-data/feeds` suggests `ecb` and not `cvm_funds` (MQ21). |
| S368 | `cvm_funds` stores `VL_QUOTA` for a CNPJ code from a month fixture and skips the lines with an `ID_SUBCLASSE` (MQ15). |
| S369 | `tesouro_direto` stores `PU Venda Manha` for `NTNBP.20350515` and skips a title type outside the map (MQ16). |
| S370 | `recordInstrumentPrices` with `dry_run` returns `new 3, replaced 1, unchanged 1, below_feed 1` and stores nothing. The same call without `dry_run` stores them. A second identical call returns `new 0` (MQ32, D4). |
| S371 | `recordInstrumentPrices` with a bad item at index 2 answers 422 with field `prices[2]` and stores nothing (MQ32). |
| S372 | `GET /market-data/catalog?q=ipca` with `tesouro_direto` enabled lists "Tesouro IPCA+ 2035" as `NTNBP.20350515`. A source that times out is named in `unavailable` (MQ28, MQ29). |
| S373 | An instrument whose last `b3_consolidated` price is older than F9 allows is `stale` in `getInstrument`. The portfolio holding it returns it in `quote_warnings` (MQ24, MQ26). |
| S374 | `coinbase` answers 400 for `BTC-BRL`: the code stores nothing, and the other codes of the tick are stored (MQ17). |
## 8. Order of delivery

Each step is one vertical slice with its tests:

1. Priorities (MQ1 to MQ3).
2. History queue, PTAX and ECB history, `requestInstrumentHistory`, `coverage` (MQ4 to MQ11, MQ23, MQ24).
3. B3 year files and `feed.Download` (MQ12, MQ13).
4. Long ranges and the instrument page (MQ30, MQ31, MQ35, MQ36).
5. `tesouro_direto`, `cvm_funds`, conditional requests (MQ14 to MQ16, MQ21).
6. `coinbase`, `yahoo_chart`, symbols, unofficial confirmation, settings row (MQ17 to MQ20, MQ22, MQ25, MQ38, MQ40).
7. Catalog, probe, define dialog (MQ27 to MQ29, MQ37).
8. Import of one instrument (MQ32 to MQ34, MQ39).
9. Portfolio warnings (MQ26, MQ41).

ADR 025 receives an amendment section that cites this document in step 1. The P8 plan rows A60 and A62 cite A222.

## 9. Not covered

- Corporate actions. A split shows as a fall of the unadjusted close, and positions hold only `buy` and `sell` (`db/migrations/00022_ledger_investments.sql`). Recording a split or a bonus and adjusting positions and returns is a separate feature of `ledger` and `portfolio`. Yahoo already returns the splits (section 1), which a later feature can offer as suggestions.
- Adjusted series (`adjclose`).
- Fund subclasses (`ID_SUBCLASSE` not empty).
- B3 history before the last 30 days for the codes that COTAHIST omits (fixed income ETFs, ADR 025 amendment of 2026-10-28), unless `yahoo_chart` is enabled.
- Gaps measured by an exchange calendar.
- Providers with a key.
- Notifications of a stale quote outside the screens.

## 10. Revisit criteria

- `yahoo_chart` keeps `error` for more than 7 days on the owner's instance: a keyed provider for foreign exchanges becomes a feature.
- A user holds an instrument that no source of this document covers.
- The year file of COTAHIST grows past 200 MB (bound of MQ13).

## 11. Calls of the planning model

- `PU Venda Manha` as the Tesouro quote (MQ16).
- `Lag` 10 for `cvm_funds` and 2 for `coinbase`. The builder checks them against the `Last-Modified` of a week of answers and corrects them in the plan.
- `User-Agent: equori/<version>` (MQ18). Yahoo was checked with a browser `User-Agent`. The builder confirms that Yahoo answers to this one before step 6.
- Five years of default history for the B3, twenty for the other sources (MQ6).
- Coinbase counted as official: the data comes from the exchange's own public API.
