# Current quotes: finished daily closes and the value of today

- Issue: #54
- Date: 2026-11-17
- Status: approved. The owner approved the approach on 2026-11-17 ("ok") under four conditions (section 2) and delegated the approval of this text ("você avalia a spec, e procede"). Delivered by plans 1 to 4 (2026-11-18).
- Amendment: A248. Scenarios: S553 to S566.
- Amends: A222 "Non-goals" (intraday quotes), MQ9, MQ17, MQ18, ADR 025 F5; P8 amendment A62 (what a tick stores).
- Keeps: N17 (the application contacts only the sources an admin enabled), A60 (one chosen price per date), A61 (conversion path), MQ22 (consent for an unofficial source), MQ24 (`stale`).

## 1. Context

A close is a stored price `(instrument, quote_instrument, date, value, source)` of a finished trading period (A60). A current quote is a value a source reports now, with the instant of its last trade. This document uses "close" and "current quote" for the two concepts and never "price" for the second.

Measurements of 2026-11-16 and 2026-11-17:

| # | Place | Observed | Effect |
|---|---|---|---|
| G1 | `feed/yahoochart/yahoochart.go` `closeQuotes`, `feed/coinbase/coinbase.go` `parse` | The bar of the running day is not filtered. | A tick during a session stores the value of that moment as the close of the day. |
| G2 | `feeds.go` `feedStart` | A tick fetches from the day after the latest stored date of the source and instrument. | The value of G1 is never fetched again. |
| G3 | Local database, `yahoo_chart` | NVDA 2026-11-12: stored 160.25 (recorded 14:47 UTC, 17 minutes after the open), close 166.19. | Error of -3.6% in the history. |
| G4 | Local database, `coinbase` | BTC 2026-11-14: stored 67,589.26 (recorded 03:08 UTC), close 64,118.79. | Error of +5.4% in the history. |
| G5 | Local database, last 8 days | 80 of 144 pairs (`yahoo_chart`, `b3_cotahist`) of the same instrument and date differ. | The official source (priority 3) hides the error on the next day; an instrument quoted only by `yahoo_chart` or `coinbase` keeps it. |
| G6 | `ledger/app/currency.go:95` | A transaction in another currency is converted at the stored price of its date. | A value of G1 can enter a recorded fact. |
| G7 | Portfolio screen | The value of today uses the row of G1, up to 6 hours old, shown with the date of today and no instant. | The member reads a partial value as a close. |

Sources probed without a key (2026-11-17, 19:12 to 19:58 UTC):

| Source | Request | Result |
|---|---|---|
| Yahoo | `v8/finance/chart/{symbol}?range=1d&interval=1d` | `meta` holds `regularMarketPrice`, `regularMarketTime`, `currency`, `exchangeTimezoneName` and `currentTradingPeriod.regular` (`start`, `end`). Answers for B3 shares, FIIs and ETFs, US shares, XETRA, Tokyo, currencies and indexes. 40 concurrent requests: 40 answers 200 in 0.8 s. B3 quotes are 15 minutes late; NASDAQ quotes are not. Mutual funds of the CVM and `ETH-BRL` answer 404. |
| Yahoo | `v7/finance/quote` | 401. Not usable. |
| Coinbase | `products/{code}-{quote}/ticker` | `price` and `time` of the last trade, official public API. `BTC-BRL` answers 404: a value in BRL needs the currency leg (A61). |
| B3 site | `cotacao.b3.com.br/mds/api/v1/instrumentQuotation/{code}` | Answers for shares, FIIs, ETFs and BDRs. Undocumented, no terms. Covers nothing Yahoo does not cover. |
| Binance, Kraken | public ticker | Answer. Neither is a source of equori. |

No official keyless source reports a current quote of a share. Fixed income, funds and Tesouro Direto have one value per day by nature.

## 2. Goals and non-goals

Goals:
- The table of closes holds only values of finished periods. The rows of G1 are replaced.
- A screen that values holdings at today uses the current quote of each instrument a source reports, and states the instant and whether the session is open.
- Owner condition 1: a missing current quote changes one label and one value to the last close. No screen fails, waits more than 3 seconds, or shows an error for it.
- Owner condition 2: every enabled source that can report a current quote does. Section 1 shows that `yahoo_chart` and `coinbase` together cover every instrument type that has an intraday value.
- Owner condition 3: no table, one request per symbol per minute at most, requests only while a member reads a valuation, no request to a source that asked to slow down.
- Owner condition 4: the rules of regions, currencies, time, books and data lifecycle hold (section 6).

Non-goals:
- The change of the day (current quote against the last close), per instrument or in total.
- An intraday series, an intraday chart, streaming, or a timer that refetches while a screen is open.
- Pre-market and after-hours quotes.
- Providers that require a key.
- New sources. Section 10 states when the B3 site or another exchange enters.
- Correcting a fact already recorded with a value of G1 (G6).

## 3. Decisions

### 3.1 Finished closes

| ID | Rule |
|---|---|
| CQ1 | A source returns a `feed.Quote` only for a finished period. `Fetch` reads the instant from the clock it receives at construction, never from the wall clock. |
| CQ2 | `yahoo_chart`: the bar whose local date equals the local date of now in `exchangeTimezoneName` is finished when now is at or after `currentTradingPeriod.regular.end` plus 30 minutes and the bar's date equals the local date of that `end`. Otherwise, or when the answer holds no `currentTradingPeriod`, it is dropped. A bar of an earlier date is finished. Amends MQ18. |
| CQ3 | `coinbase`: a candle is finished when its `start` plus 24 hours is at or before now. Amends MQ17. |
| CQ4 | A goose migration finds, for `yahoo_chart` and `coinbase`, each `(instrument, quote_instrument)` that holds a row with `recorded_at < date + 36 hours` (UTC). It deletes the rows of that source and pair from the earliest such date on and requests history (MQ4, MQ5) from that date. It runs only for a source that is enabled, as migration 98 does. A row loaded as history (`recorded_at` days after `date`) before the earliest such date is not touched. Until the next successful tick, the pair is valued at an earlier close or at the close of another source. |
| CQ4a | Amends MQ9: the end of a history row is the day before the earliest stored price of that source and instrument on or after `from_date`, or today when none is stored from `from_date` on. A request for dates after an older stored price is no longer finished without a fetch. |
| CQ4b | Amends CQ4a, 2026-11-20: the end of a history row is the day before the first price of the last run of stored prices of that source and instrument from `from_date`, a run having no two prices more than 14 days apart; today when none is stored. A request for a finished row whose stored prices from its `from_date` hold such a hole queues the row again from that date; a request over prices without a hole still changes nothing (MQ5). Before, one stored price ended the history before it, and a later request for a finished row was dropped: a security kept a hole of 45 months between a lone price and the prices of the daily tick. |
| CQ5 | `feedStart` is unchanged: once CQ1 holds, a stored date is final for its source. |

### 3.2 Current quote

| ID | Rule |
|---|---|
| CQ6 | A current quote is `(instrument, quote_instrument, value, at, date, open, source)`. `at` is the instant of the last trade the source reports. `date` is the trading date of `at` under T1 of A222. `open` states whether the source's regular session is running. It lives in memory in `marketdata`. It is never written to `marketdata_price`, never exported, never returned by `listPrices`, and never read by `Convert`. |
| CQ7 | Optional interface `feed.Spot`: `Current(ctx, ins []Instrument) ([]SpotQuote, error)`, returning the quotes read before a failure together with the failure, as `Fetch` does. |
| CQ8 | `yahoo_chart` implements it with the request of section 1, one per symbol (MQ19, MQ20), at most 8 at a time. `value` is `regularMarketPrice`, `at` is `regularMarketTime`, `open` is `regular.start <= now < regular.end`. A `currency` other than the instrument's quote currency is an error for that symbol (as MQ18). A 404 is no quote. |
| CQ9 | `coinbase` implements it with the ticker of section 1. `open` is always true. A 400 or 404 is no quote (as MQ17). |
| CQ10 | The sources asked are the enabled ones (F2) that implement `feed.Spot` and quote the instrument (`Codes`). No setting is added: enabling a source enables its current quotes. A book without such a source gets none. |
| CQ11 | When two sources hold a current quote of the same pair, the one with the lower priority number of A222 section 3.1 wins. |
| CQ12 | Cache per `(source, instrument, quote_instrument)`. A quote with `open` is fresh for 60 seconds, a quote without `open` for 15 minutes. A failed symbol is not asked again for 60 seconds. Concurrent reads of the same key share one request. |
| CQ13 | A 429 answer stops every current-quote request to that source for 15 minutes. |
| CQ14 | A read waits at most 3 seconds in total for current quotes (as MQ29). Requests still running finish and fill the cache for the next read. |
| CQ15 | The cache is empty after a restart and holds at most the instruments read since. It needs no eviction beyond CQ12: an entry past its freshness is replaced or ignored. |

### 3.3 Valuation at today

| ID | Rule |
|---|---|
| CQ16 | `marketdata` gains one method that values a quantity now: the path of A61, where each leg takes the current quote of its pair when CQ17 holds and the chosen close on or before today otherwise. It returns the `Price` of every leg, as `Convert` does. |
| CQ17 | A leg takes the current quote when one is fresh (CQ12) and its `date` is later than the date of the chosen close of that pair. A close of the same date wins: a manual price of today (priority 1) and a finished close of today both replace the current quote. |
| CQ18 | Before valuing, a read asks for the current quotes of all its pairs in one call (CQ14), including the currency legs of A61. |
| CQ19 | A caller opts in by calling the method of CQ16. No context value and no date comparison inside `Convert` selects it. `Convert(ctx, q, to, date)` keeps its behavior for every caller. |
| CQ20 | The method of CQ16 is called only by a read whose valuation date is today of the book (`platform/clock`). A read at an earlier date, a point of a series before today, a write, the rebuild, the accrual, an import and an export call `Convert`. |
| CQ21 | The reads of CQ20, delivered in the order of section 8: `listPositions`, `getAllocation`, `getNetWorth`, `getIssuerExposure`, `getContributionPlan`, `previewContributionPlan`, the last point of `getNetWorthDays` and of `getReturn` when it is today; then `getAccountBalance` with `value_in` and the contribution operations. `getReturn`, `getIssuerExposure` and every value the reports read from the portfolio take current quotes at today through the same two functions. |
| CQ22 | `quote_warnings` (MQ26) and `stale` (MQ24) read closes only. A current quote never clears a warning. |

### 3.4 Contract

| ID | Rule |
|---|---|
| CQ23 | The schema `Price` gains `at` (`date-time`) and `open` (`boolean`), both absent for a close. `date` and `source` are filled for both kinds. |
| CQ24 | A response that holds a total valued at today (`getAllocation`, `getNetWorth`, the contribution operations) gains `current`: `count` (legs that took a current quote), `open` (true when any of them has `open`) and `oldest_at`. It is absent when `count` is 0. |
| CQ25 | `listMarketDataFeeds` (F5) gains `current` (the source implements `feed.Spot`), `current_at` (instant of its last successful request, or null) and `current_error` (message of its last failure, or null), kept in memory like `last_run`. |
| CQ26 | The tool `get_portfolio` returns `current` (CQ24) for its views `positions`, `allocation` and `net_worth` at today. Its description states that such values are read during the session and are partial while `open` is true. |

## 4. Screens

| ID | Rule |
|---|---|
| CQ27 | A value built from a current quote shows the hour of `at` in the member's time zone through `Intl`. With `open`, it shows the word of the key `quotes.partial` ("parcial", "partial") in the text colour of the informative tone. No icon carries this state. |
| CQ28 | A value built only from closes looks as it does today, including the date of a late quote (A222 section 4). |
| CQ29 | The header of the portfolio screen shows one line from `current` and the positions: the number of holdings at a current quote, the oldest `at`, and the number at a close. With no current quote the line is absent. |
| CQ30 | A row keeps one height in both states: the hour and the word sit on the line that holds the quote date today. The text is not wrapped. |
| CQ31 | The same rules apply on a phone (ADR 027). Privacy mode hides the amounts and keeps the hour and the word. |
| CQ32 | The market data settings row of a source that reports current quotes says so and shows `current_error` in words when set. |
| CQ33 | A screen fetches on load and under the refetch rules the web client already applies to a query. This feature adds no timer and no "update now" action. |

## 5. Operations

No operation is added. `listPositions`, `getAllocation`, `getNetWorth`, `getIssuerExposure`, `getContributionPlan`, `previewContributionPlan`, `getNetWorthDays`, `getReturn` and `listMarketDataFeeds` change their response by CQ23 to CQ25. No `Problem.code` is added: a failure of a current quote is never an error of the read.

## 6. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | No regional value is added. Session hours come from the source's answer (`currentTradingPeriod`), not from a table. The symbol of an exchange comes from MQ19. |
| R2 | A region whose enabled sources report no current quote values every holding at its close, as today. |
| R3 | Does not apply: no value set is added. |
| R4 | `feed.Spot` is an optional interface of a source. `docs/contributing/regions.md` gains its line in the step that describes a new source. |
| R5 | `quotes.partial`, the header line of CQ29 (plural forms), the settings texts of CQ32, each in pt-BR and en. |
| R6 | The hour of `at` and the counts of CQ29, through `Intl` with the active tag. |
| C1 | No amount is stored. A current quote is a `money.Rate`; a valued amount is `money.Money`. No `float64` beyond the decimal text of the source, as MQ18. |
| C2 | A total sums amounts already in one currency. A conversion across currencies takes the current quote of the currency leg under the same CQ17. A total can mix instants; each leg reports its own `at`, and `current.oldest_at` states the oldest. A missing rate keeps the behavior of `price_missing`. |
| C3 | A book whose base currency differs from the instrument's quote currency values through A61 with the legs of CQ16. A pair without a current quote takes its close. |
| C4 | Currencies come from the record. Amounts go through `useMoneyFormat()`. |
| T1 | `date` of a current quote is the trading date of its source (T1 of A222). "Today" of CQ20 comes from `platform/clock`. A quote whose `date` is after the book's today (an exchange ahead of the book's zone) is used: it is the value now. `at` is an instant, shown in the member's zone. |
| T2 | Does not apply: no business-day count. Whether a session is open comes from the source. |
| B1 | Does not apply: no table. Current quotes belong to the instance, like `marketdata_price`. |
| B2 | No operation is added. The changed operations keep their `x-book-role`. |
| B3 | No setting is added (CQ10). |
| D1 | Does not apply: no table. The archive never holds a current quote. |
| D2 | One goose migration (CQ4). It changes no schema; it deletes rows of `marketdata_price` that a tick refills and inserts or updates rows of `marketdata_history`. |
| D3 | No recorded fact changes. CQ4 removes prices of a source that the same source refills. Facts recorded with a value of G1 are not rewritten (non-goal). |
| D4 | A current quote decides nothing and writes nothing. |
| D5 | Does not apply: the diagnostic file lists no state of a market data source, and this feature adds none. |
| S1 | No operation is added, so no new entry in `tool_exposure_test.go`. The tool catalog changes by CQ26 (`TestToolCatalog`). No new `Problem.code`. |
| S2 | Yes, CQ31. |
| S3 | The guide articles of the portfolio screen and of market data settings state what "parcial" means and that the history holds closes only. |
| S4 | Yes, CQ26. |
| X1 | Section 7. |
| X2 | S564 runs in a book of a region without a case and a base currency other than the instrument's quote currency. |

## 7. Scenarios

Tests use a fixed clock and sources served from fixtures. No test reaches a provider.

| ID | Scenario |
|---|---|
| S553 | A tick during the session of an exchange stores no `yahoo_chart` price of today for its instruments. |
| S554 | A tick 30 minutes after `regular.end` stores the close of today. |
| S555 | A tick during a UTC day stores no `coinbase` price of that day; a tick after it ends stores it. |
| S556 | The migration requests history again for an instrument with a row recorded during its date and leaves an instrument without one untouched; the next tick replaces the value. |
| S655 | A finished history over stored prices with a hole of 77 days is requested again from its start: the next tick fetches the hole and finishes the row (`TestS655HistoryFillsAHole`). |
| S557 | `listPositions` at today, with a current quote later than the last close, values the holding at it and returns its `Price` with `at` and `open`. |
| S558 | With the source disabled, failing, answering 429 or slower than 3 seconds, `listPositions` answers 200 with the close and no `at`. |
| S559 | A manual price of today wins over a current quote of today. |
| S560 | `listPositions` at a date before today takes no current quote. |
| S561 | A transaction in another currency recorded today converts at the close, with a fresh current quote of that currency in the cache. |
| S562 | Two reads within 60 seconds make one request per symbol; a 429 stops the requests to that source for 15 minutes. |
| S563 | `getNetWorth` and `getAllocation` at today return `current` with `count`, `open` and `oldest_at`, and the same total as the positions of S557. |
| S564 | A book with base currency USD in a region without a case holds an instrument quoted in BRL: the value takes the current quote of the instrument and of the currency leg; without the currency quote, it takes the currency close and reports no `at` for that leg. |
| S565 | `quote_warnings` lists an instrument with a late close while a current quote of it is fresh. |
| S566 | `listMarketDataFeeds` reports `current`, `current_at` and `current_error` of a source after a success and after a failure. |

## 8. Order of delivery

1. Finished closes: CQ1 to CQ5, S553 to S556. This step is a defect fix and ships alone.
2. Current quote in `marketdata`: CQ6 to CQ19, CQ25, S562, S566.
3. Portfolio operations and screens: CQ20 to CQ24 for the operations CQ21 names, CQ27 to CQ33, S557 to S561, S563 to S565, the guide articles.
4. The remaining reads of CQ21 and the tools of CQ26.

## 9. Approaches

| Approach | Trade-off | Outcome |
|---|---|---|
| An explicit method for reads at today, quotes in memory, fetched on demand | Each read opts in; a restart loses the cache | Chosen: no fact can read a current quote, and a lost quote costs one request. |
| `Convert` takes the current quote when the date is today | One change reaches every screen | Rejected: G6 shows that writes call `Convert` at today. |
| A table of current quotes | Survives a restart | Rejected: the process is single, the value expires in 60 seconds, and a table needs export classification and cleanup. |
| A background loop that polls every held instrument | Reads never wait | Rejected: requests with no reader, against condition 3. |
| The browser asks the source | No server work | Rejected: against N17, and the sources send no CORS headers for it. |

## 10. Revisit criteria

- `current_error` of `yahoo_chart` set on 7 consecutive days in the owner's instance: add `feed.Spot` to a second source per class (the B3 site for `XBVMF`, a second exchange for crypto).
- A member asks for the change of the day: it needs the previous close per leg, which CQ16 already reads.
- Yahoo answers 429 under CQ12 and CQ13 in normal use: raise the freshness of an open quote.
- `current` on `getReturn` and `getIssuerExposure`: when a screen shows one of them beside a value marked partial.
- The hour label on the account positions tab and on the instrument page: with the next change to either screen.

## 11. Calls of the planning model

- CQ2: the 30-minute margin after `regular.end` covers the closing auction. Not measured.
- CQ8: one chart request per symbol instead of `v8/finance/spark`, which holds several symbols but no session period and no currency.
- CQ10: no switch for current quotes.
- CQ12, CQ13, CQ14: 60 seconds, 15 minutes and 3 seconds.
- CQ21: the split of the reads in two deliveries.
- The exact name and signature of the method of CQ16 and how each port carries it are the builder's, under CQ19.

Not verified: the request limit of Yahoo over days; the answer on a holiday and on a shortened session; whether `regularMarketPrice` excludes pre-market and after-hours trades; the instant `currentTradingPeriod` rolls to the next session.
