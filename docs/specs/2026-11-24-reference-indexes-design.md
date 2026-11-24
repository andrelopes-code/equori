# Reference indexes and complete histories

Amendment A265. Owner, 2026-11-24: the fundamental indexes and quotes that the comparisons read are current, hold a correct history and have no holes; Ibovespa, IFIX, S&P 500 and FTSE exist, for the Results tab of the portfolio (`docs/specs/2026-11-24-portfolio-results-design.md`); holes of an instrument's prices are repaired wherever a source has the value.

## 1. Measurements (2026-11-24)

| Subject | Result |
|---|---|
| `cdi`, `selic`, `igpm`, `usd_brl` stored against SGS 12, 11, 28655, 1 | No difference and no hole over 20 years (`selic`, `igpm`: since 2000-07) |
| `ipca` stored against SGS 433 | 316 of 316 months equal at 2 decimals |
| `br_banking` against the dates of `cdi`, `selic`, `usd_brl` | The two sets are equal over the whole history |
| Ibovespa of the B3 site (`indexStatisticsProxy`) | 5,424 sessions, 2005-01-03 to 2026-11-23 |
| Ibovespa of Yahoo (`^BVSP`) against the B3 | 3 sessions missing, 99 closes off by more than 0.1% |
| S&P 500 total return (`^SP500TR`) against `^GSPC` | The same 5,257 dates; 9 closes away from the median of their neighbors by 0.03% or more, each undone by the next session (−0.57% on 2019-07-03, −0.29% on 2019-03-12, −0.21% on 2014-12-09). Years: 2008 −37.00%, 2019 31.49%, 2022 −18.11%, 2024 25.02% |
| FTSE Global All Cap (`GEISAC.FGI`) | One day of history. The ETF VT, which follows it since 2011-12-19, has a close and a close with reinvested distributions since 2008-06-26; the two differ by its 61 distributions exactly |
| BVMF instruments | No session without a price where COTAHIST was loaded, BPAC11 of 2017 excepted (no trade). Every other hole lies in years only Yahoo covered |
| COTAHIST 2006 | 20,433 spot records quoted per lot of 1,000 (`FATCOT`), SBSP3 among them |
| COTAHIST sizes, 2006 to 2026 | 9.3 to 108.3 MB a year, 685 MB in all |
| `TradeInformationConsolidatedFile` | Empty body on 2025-06-05 and before, about 6.5 MB a day from 2025-06-10 on, the fixed income ETFs included |

Causes of holes, read in the code: `tickIndex` resumes from the latest rate, so a fill back that fails midway is never completed; a rate the source revises is never read again; a finished `marketdata_history` row is never rechecked; a stop longer than 30 days leaves a hole behind the window of `tick`; a file published late is skipped once a later day is stored.

## 2. Rules

### Index rates (RI)

| ID | Rule |
|---|---|
| RI1 | The whole history of an enabled index, from its start (20 years, the base of a bond or the earliest issue date), is read again when it was never read whole, when its start moved back, when 7 days passed since the last whole read, and, at most once a day, while a hole remains. Otherwise the tick reads from the day after the latest rate. A whole read that fails leaves no record, so the next tick repeats it. |
| RI2 | Only a rate that is new or differs from the stored one is written. A rate written before the latest stored one deletes the accrued prices, from its date on, of each security that follows the index; the accrual of the same tick computes them again. A revision writes one log line with the index, the number of rates and the first date. |
| RI3 | A hole is an expected day between the first and the last stored rate that has none. Expected days: each business day of the calendar the source declares (`br_banking` for `cdi`, `selic`, `usd_brl`); each month of a monthly index; without a calendar, the weekdays of a run of more than 6 days between two rates. |
| RI4 | Table `marketdata_index_check` keeps, per index, the start and the day of the last whole read and the holes left after it. `GET /market-data/feeds` states them as `missing`; the settings row of a feed with holes reads as incomplete. |
| RI5 | A daily index is stale when more than 2 business days of its calendar, or 3 weekdays without a calendar, lie between its last rate and today. This replaces the lag of ADR 025 F9 for daily indexes. |
| RI6 | A tick in which a feed failed is repeated after 30 minutes instead of 6 hours. |

### Market indexes (MI)

| ID | Rule |
|---|---|
| MI1 | Sources: `br_ibovespa` (index `ibovespa`) and `br_ifix` (`ifix`), B3, daily closes of `GetPortfolioDay`, one request a year; `us_sp500` (`sp500`), the S&P 500 total return; `global_ftse` (`ftse_global`), the FTSE Global All Cap through the ETF VT with reinvested distributions, from 2011-12-19. Ibovespa and IFIX include distributions by their method, so the four compare total returns. |
| MI2 | A market index is stored as the rate of each session: the close over the close of the session before, less 1, at 12 decimals. It is `daily`, so every reader of a daily index reads it. |
| MI3 | A close enters after its session: the date is before today in the time zone of the exchange, or the session ended (B3: from 19:00 São Paulo). |
| MI4 | Total return check: the ratio of the total return to the price moves by the distributions alone. A ratio more than 0.03% away from the median of the 7 ratios around it is a wrong close: the session takes the median, as one without a total return close does. A session without 3 neighbors on one side may hold a distribution up to the largest of the index (`sp500` 0.12%, VT 3%). A median outside [−0.03%, that largest distribution] of the one before it fails the fetch: the source changed. |
| MI5 | `official` of `us_sp500` and `global_ftse` is false: enabling them needs `accept_unofficial` (MQ22). `SuggestedFeeds("BR")` names `br_ibovespa` and `br_ifix`. |
| MI6 | `GET /indexes` states `kind`: `rate` or `market`. A market index is not offered by the calculators and by the fixed income entry: no contract pays it. |
| MI7 | `indexCurrency`: `ibovespa`, `ifix`, `selic`, `igpm`, `usd_brl` `BRL`; `sp500`, `ftse_global`, `sofr` `USD`; `estr` `EUR`. |
| MI8 | `GET /reports/return?index=`: an index of another currency than the report is converted through the daily exchange index of the pair (`exchangeIndex` in `internal/portfolio/region_defaults.go`: `usd_brl` for USD to BRL). The converted rate of a day is `(1 + index)(1 + exchange) − 1`, a day without one of the two taking 0 for it, over the dates between the first and the last rate of the index. Without an exchange index, or with it disabled, the reason stays `currency_mismatch`. The return series draws each enabled market index in the currency of the report (portfolio results PS8). |
| MI9 | The levels in points are not stored. No screen of this change reads them. |

### Instrument prices (PH)

| ID | Rule |
|---|---|
| PH1 | COTAHIST divides `PREULT` by `FATCOT`. |
| PH2 | Once a day, each enabled price source requests, for each code it quotes whose sessions are stored (PH3), the history of 20 years; a currency only from a source that stored it in the currency of its sessions. Enabling a source or defining an instrument still requests the years of its entry at once; the B3 ones stay 5. A request that lowers no date changes nothing (MQ5). |
| PH3 | A hole is a session of the exchange between the first and the last price of an instrument, at least 7 days old, with no price of any source. The sessions are the dates of `ibovespa` for `BVMF`, of `sp500` for `XNYS`, `XNAS`, `ARCX`, `BATS` and `XASE`, and of `usd_brl` for a currency quoted in `BRL` (`sessionIndex` in `internal/marketdata/region_defaults.go`). Without a session index, or with it not stored, nothing is checked. |
| PH4 | Once a day, after PH2 left no pending history, each enabled source that quotes a code with a hole is asked for the years of its holes. A source that keeps daily files (`feed.DayArchive`: `b3_consolidated`, 500 days) is then asked for the remaining days, the latest 31 a day. Only the prices of the holes are stored. |
| PH5 | A hole that every source answered without a price is recorded in `marketdata_price_hole` and is not asked again. Enabling a price source empties the table. A source that failed records nothing. |
| PH6 | `coverage.missing` of an instrument is the number of recorded holes still without a price; the coverage panel states it. A session without a trade is such a hole: the source cannot tell the two apart. |

## 3. Approaches

| Approach | Trade-off | Choice |
|---|---|---|
| Whole read of each index every 7 days | 4 requests a series of 20 years; repairs holes and revisions without bookkeeping | Chosen |
| Ask only for the holes of an index | No repair of a revised rate | Rejected |
| Indexes as instruments with prices | A pseudo instrument in portfolio pickers; every reader of daily rates would need a second path | Rejected |
| Ibovespa from Yahoo | 99 wrong closes | Rejected |
| BOVA11 and IVVB11 as proxies | Tracking difference and fee; IVVB11 starts in 2014 | Rejected |
| 20 years of COTAHIST at each definition of an instrument | 685 MB a definition | Rejected for the daily batch (PH2) |

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Index sources (registry), session index (`sessionIndex`), exchange index (`exchangeIndex`), index currency (`indexCurrency`). |
| R2 | No suggestion, no session check, no conversion: the reason `currency_mismatch` stays. |
| R3 | Index and feed ids keep `^[a-z0-9_]{2,40}$`. `kind` is not regional: an enum. |
| R4 | Rows "Session index" and "Exchange index" in `docs/contributing/regions.md`. |
| R5 | `marketData.feed.*`, `marketData.feedName.*`, `marketData.feedSource.*` of the four sources; index names; `settings.feeds.missing.*`, `settings.feeds.status.incomplete`, `instrument.coverage.missing.*`. |
| R6 | Counts through `numberFormatter`. |
| C1 | No amount is stored or computed; rates are exact decimals. |
| C2 | MI8: the date of the rate is the session, the source is `usd_brl`; a missing exchange index is stated as `currency_mismatch`. |
| C3 | MI8. |
| C4 | Does not apply: no displayed currency. |
| T1 | Dates are sessions; today comes from `platform/clock`. |
| T2 | RI3 and RI5 read the calendar registry. |
| B1 | Two tables of instance data, without `books_id` as the rest of market data (ADR 025, Context). |
| B2 | No operation. |
| B3 | No setting. |
| D1 | Both tables are left out of the export: a tick writes them again. |
| D2 | Migrations 148 and 149. |
| D3 | Does not apply: market data holds no recorded fact. |
| D4 | Does not apply: no bank, file or model. |
| D5 | Does not apply. |
| S1 | No operation; `kind`, `missing` fields of existing ones. |
| S2 | The settings screen and the instrument page keep their phone forms. |
| S3 | The article `settings_language_and_region.md`. |
| S4 | `get_market` lists indexes and rates; the new ids appear without a change of schema. |
| X1 | S701 whole read repairs a hole and a revision. S702 accrued prices follow a revised rate. S703 Ibovespa and IFIX. S704 S&P 500 with a wrong total return close. S705 unofficial index needs acceptance. S706 return against the S&P 500 in BRL. S707 a hole of prices is filled from a year file. S708 a session without a trade is recorded once. |
| X2 | S706 (report currency other than the index's); a region without an exchange index keeps `currency_mismatch`. |
