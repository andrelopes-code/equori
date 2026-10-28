# ADR 026: Rate expectations

- Status: accepted
- Date: 2026-10-27
- Amends: ADR 025 (a third kind of feed), calculators design §4 ("Index basis")

## Context

A calculator projects a daily index at a constant rate: its current rate by default, or its trailing 12 months. In a cycle of cuts or rises, a constant rate misstates a long projection. On 2026-10-23 the median of the Focus survey of the Banco Central do Brasil placed the Selic target at 13.25% at the end of 2026, 11.75% at the end of 2027 and 10% at the end of 2028 to 2030, against 13.75% on that day. Over five years at 100% of the CDI, the constant current rate gives a factor of about 1.90 and the Focus path about 1.66.

The Focus survey is public, free and served by the Olinda API (`ExpectativasMercadoAnuais`). No source with the same properties was found for the euro area or the United States.

## Decision

| ID | Rule |
|---|---|
| E1 | An expectation source is an extension point of `marketdata` (ADR 016): interface `Source` in `internal/marketdata/internal/expectation/expectation.go`, one package per implementation under `internal/marketdata/internal/expectation/<id>/`, entries in `expectationEntries` in `internal/marketdata/expectations.go`. A source names the index it projects and returns a survey date and a list of points: a date and the expected annual rate of the index on that date, as a decimal fraction. |
| E2 | `br_focus` projects `cdi`. It reads the medians of the Selic target of the latest survey date over all respondents (`Indicador eq 'Selic'`, `baseCalculo eq 0`); each reference year becomes the point of its December 31, at the median minus 0.10 percentage points, the spread between the Selic target (SGS 432, 13.75%) and the annualized CDI (SGS 4389, 13.65%) on 2026-10-26. |
| E3 | Table `marketdata_index_expectation (index_id, date, rate, survey_date, source)`, primary key `(index_id, date)`, no `user_id`. A fetch replaces every point of the index. |
| E4 | An expectation source is a feed of ADR 025 with `kind` `expectation`, enabled on the settings screen only (not by `EQUORI_INDEX_FEEDS`), suggested, ticked, refreshed and marked stale as the others. `last` is its survey date; its period is a day; its lag is 9 days: the next survey, of the following Friday, is published the Monday or Tuesday after it, 10 or 11 days after `last`, and is due by the end of the day after `last` plus 9, 11 days after `last`. `SuggestedFeeds("BR")` adds `br_focus`. |
| E5 | `GET /indexes` items gain `expected`: true when an enabled expectation source stored points for the index. `GET /indexes/{id}/expectations` (`listIndexExpectations`) returns `survey_date` and the points, oldest first; 404 `not_found` without points. |
| E6 | The path of an index starts at its current annual rate (design §4, basis `current`) on its last stored date and runs linearly in the annual rate to each point; after the last point it stays at that point's rate. |
| E7 | Basis `expected` gives the constant annual rate equivalent to the path over the calculator's horizon: the product, month by month from the last stored date, of the monthly factor of the path's rate at the middle of the month, raised to 12 over the number of months, minus 1. A percent of the index or a spread applies to the rate of each stored day, as in basis `current`, with the count of stored days of the trailing year. |
| E8 | Horizons: `compound` its months; `fixed-income` its days held, in months rounded up; `cash-or-installments` its number of installments; `rates` 12 months. |
| E9 | The default basis of a rate over a daily index is `expected` when the index has `expected`, `current` otherwise. The origin note names the survey and its date. |
| E10 | `listIndexExpectations` maps to the tool `get_market_data`, view `index_expectations`. |

## Consequences

- A Brazilian projection follows the market's expected path without an input; a projection elsewhere keeps the current rate.
- The equivalent constant rate is exact for a single amount and approximate for a series of deposits, whose timing weighs the months differently.
- A survey older than 11 days marks the feed stale on the settings screen.

## Not covered

- Expectations of inflation indexes (the Focus survey also publishes the IPCA).
- Medians by Copom meeting: year-end points are the resolution of the path.
- A path typed by the user.

## Amendment of 2026-10-28 (ADR 025 F9)

E4's lag passes from 7 to 9 days with the amendment of ADR 025 F9. The due date of the next survey moves from 8 to 11 days after `last`: 8 days fell before the weekly publication, 10 days after `last`.

## Revisit criterion

A free official survey of policy-rate expectations for another region, or a request for scenarios above and below the median.
