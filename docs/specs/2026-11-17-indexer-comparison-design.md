# Indexer comparison

- Date: 2026-11-17
- Status: approved on 2026-11-17 (the owner delegated the approval to the planning session)
- Issue: #55
- Amends: ADR 025 (a fifth kind of feed, `curve`), ADR 026 (expectations of a monthly index), `docs/specs/2026-11-12-contribution-plan-design.md` ("This month")

## Intent

An investor who applies money in fixed income chooses an indexer: a fixed rate, a percent of a daily index, or an inflation index plus a spread. The choice depends on the path the index takes until maturity, which nobody knows. The owner's request of 2026-11-17: while planning a contribution, the investor compares the securities on offer under the published expectations and the market rates, and decides. equori computes; it gives no recommendation and no verdict.

An indexer is the rule that sets the yield of a fixed income security: a fixed annual rate, or a function of an index.

## Goals, non-goals, anti-goals

Goals:

- Compare two to six securities over one horizon, after tax, under the expected path of each index.
- State, for each pair of a floating security and the reference security, the break-even rate: the constant annual rate of the index at which both pay the same after tax.
- State beside each break-even rate the expected average rate of the index (survey) and the market rate for the horizon (curve), each with its source and date.
- Open the comparison from the contribution plan, with the amount of the row, and from the calculators.
- Cover every indexer of Brazilian fixed income served by an index source: fixed, percent of CDI, CDI plus spread, IPCA plus spread.

Non-goals:

- A sale before maturity and its price (mark to market).
- Securities with different maturities in one comparison (a reinvestment rate would be an invented input).
- Credit risk, liquidity and deposit guarantee of an issuer.
- Scenarios above and below the survey median, and a path typed by the user (ADR 026, "Not covered").
- Coupon-paying securities: every security pays once, at maturity.
- Storing a comparison, in the database or in the address.

Anti-goals:

- A sentence, colour, order or mark that names a winner or tells the investor what to buy. Rows keep the order the investor typed.
- A figure without its source and date.
- A second formula for a quantity the calculators already compute.

## Evidence the method rests on

- The expectations hypothesis is rejected for US data: the slope of the curve predicts excess returns (Fama and Bliss 1987; Campbell and Shiller 1991; Cochrane and Piazzesi 2005). A market rate therefore holds the expected path plus a term premium, and the screen says so (IC14).
- No source found validates a rule that picks an indexer from the level of the policy rate. This is the reason for the anti-goal above.
- The break-even rate is an identity, not a forecast: it follows from the contract terms and the tax table alone.

## Rules

### Comparison

**IC1 Inputs.** An amount in minor units of one currency; a purchase date (today in the book's time zone); a maturity date after it; `days`, the calendar days between them; a list of two to six securities. A security has a form, a rate and `taxed` (true by default):

| Form | Index | Rate field |
|---|---|---|
| `fixed` | none | annual rate |
| `percent` | a daily index | percent of each day's rate (140) |
| `spread` | a daily or a monthly index | spread a year over the index |

The index choices are the indexes of `GET /indexes` with `expected` true whose currency is the currency of the amount. The first security of form `fixed` is the reference; without one, the first security is.

**IC2 Annual rate of a security.** `months = ceil(days / (365.25 / 12))` (ADR 026 E8, fixed-income).

- `fixed`: the typed rate.
- `percent` and `spread` over a daily index: `expectedOverDaily` with the forms of `floating.ts` (ADR 026 E7), unchanged.
- `spread` over a monthly index: `expectedOverMonthly` (IC6), then `(1 + index) × (1 + spread) − 1`.

**IC3 Result of a security.** `fixedIncome({ amount, annualRate, days, taxBp })` of `fixed-income-math.ts`, unchanged: gross yield, tax, net yield, net annual rate. `taxBp` is `fixedIncomeRules(region).taxBp(days)` when `taxed`, 0 otherwise; in a region without rules the investor types one tax rate for the taxed securities, as in the fixed-income calculator. With `days` below `minimumDays` the comparison shows the calculator's existing note and no result.

**IC4 Break-even rate.** For a floating security `j` and the reference `ref`, the break-even rate is the constant annual rate `x` of the index of `j` at which `net_j(x) = net_ref`. `net_j` is IC3 with the annual rate of `j` under an index constant at `x`: a daily index repeats `d = (1 + x)^(1/n) − 1` over the `n` stored days of its trailing year; a monthly index repeats `(1 + x)^(1/12) − 1`. `net_j` is increasing in `x`; the nets are compared unrounded, and the root is found on [−0.5, 5] by `bisect` of `model/solve.ts`, at its tolerance. No root in the interval gives no break-even rate. When `ref` floats on the same index as `j`, the pair has no break-even rate. When `ref` floats on another index, `net_ref` is its result under its expected path, and the text says so.

**IC5 Expected average rate.** The annual rate of 100% of the index over `months` under its expected path: `expectedOverDaily` with the identity per-day function, or `expectedOverMonthly`. It is the figure the break-even rate is read against.

### Expectations of a monthly index (amends ADR 026)

**IC6 (ADR 026 E11) Path of a monthly index.** A point of a monthly index is the expected accumulated rate of a calendar year, dated December 31 of that year. The monthly rate of a month `m` of year `Y` after the last stored month:

- `Y` is the year of the last stored month and has `k` stored months with accumulated rate `a` and a point `p`: `((1 + p) / (1 + a))^(1/(12 − k)) − 1`;
- `Y` has a point `p` and no stored month: `(1 + p)^(1/12) − 1`;
- `Y` is after the last point: the monthly rate of the last point's year;
- `Y` is the year of the last stored month and has no point: the monthly rate of the first later point's year.

`expectedOverMonthly(rates, points, months)` is the product of `1 + rate` over the `months` months after the last stored month, raised to `12 / months`, minus 1; null when no point exists.

**IC7 (ADR 026 E12) `br_focus_ipca`.** An expectation source that projects `ipca`: the medians of `Indicador eq 'IPCA'`, `baseCalculo eq 0` of `ExpectativasMercadoAnuais`, latest survey date, each reference year a point at its median over 100. Checked on 2026-11-17: the survey of 2026-11-13 publishes 5.1082 for 2026, 5.0000 for 2027, 4.0000 for 2028 and 2029, 3.9350 for 2030. Lag, staleness and suggestion as `br_focus` (E4); `SuggestedFeeds("BR")` adds it. Package `internal/marketdata/expectation/brfocusipca`, or a second constructor of `brfocus` with the indicator as a field.

**IC8 (ADR 026 E13) No basis change elsewhere.** The basis `expected` of a monthly index is offered by the comparison only. The other calculators keep their bases for a monthly index.

### Market curves (amends ADR 025)

**IC9 Curve.** A curve is a list of points (maturity date, annual rate as an exact decimal fraction) published for one base date. A curve has an id (`^[a-z0-9_]{2,40}$`), a currency, and a kind: `nominal` (a fixed rate) or `real` (a spread over the index it names).

**IC10 Curve source.** A new extension point of `marketdata` (ADR 016): interface `Source` in `internal/marketdata/curve/curve.go` (`ID`, `Fetch` returning the curves it serves), one package per implementation under `internal/marketdata/curve/<id>/`, entries in `curveEntries` in `internal/marketdata/curves.go`. A curve source is a feed of ADR 025 with `kind` `curve`, enabled on the settings screen, suggested, ticked, refreshed and marked stale as the others; `last` is its base date.

**IC11 `br_tesouro`.** It reads the file the price source `tesouro_direto` reads (`PrecoTaxaTesouroDireto.csv`; its own address setting `EQUORI_FEED_BR_TESOURO_URL` with the same default) and keeps the rows of the latest `Data Base`:

| Curve | Rows (`Tipo Titulo`) | Kind | Index |
|---|---|---|---|
| `br_tesouro_prefixed` | `Tesouro Prefixado` | `nominal` | none |
| `br_tesouro_ipca` | `Tesouro IPCA+` | `real` | `ipca` |

The rate is `Taxa Compra Manha` over 100, the rate the investor buys at. Rows with coupons (`com Juros Semestrais`), `Tesouro Selic`, `Educa+` and `Renda+` are not read: their rate is not the rate of one payment at maturity. A row with a blank or zero rate is skipped. Checked on 2026-11-17: the header holds `Taxa Compra Manha` and `Data Base` 16/11/2026. Currency `BRL`; period a business day of `br_banking`; lag as `tesouro_direto`. `SuggestedFeeds("BR")` adds it.

**IC12 Storage and API.** Table `marketdata_curve_point (curve_id, maturity, rate, base_date, source)`, primary key `(curve_id, maturity)`, no `books_id`: market data shared by the instance, as `marketdata_index_expectation` (E3). A fetch replaces every point of the curve. The kind, index and currency of a curve are stated by its source in code, as an expectation source states its index; no second table. `GET /curves` (`listCurves`) returns each stored curve of an enabled source with its kind, index, currency, base date, source and points, oldest maturity first; an empty list without curves.

**IC13 Market rate for the horizon.** The rate of a curve at the maturity of IC1: linear in the rate by calendar days between the two points that surround it; the rate of a point when the dates are equal. A maturity before the first point or after the last has no market rate: no extrapolation.

- For a daily index of the currency: the rate of the `nominal` curve.
- For a monthly index: implied inflation, `(1 + nominal) / (1 + real) − 1`, with the `real` curve of that index; none when either is missing.

**IC14 What the market rate is.** The screen states under the figure: a rate of a government bond for the horizon holds the expected path of the index plus a premium for the term, and is not a forecast.

### Hand-computed cases

**IC15.** Each case is a test of the pure function it names.

- Break-even (IC4), both taxed alike, `n` = 252: reference `fixed` 8%, security 140% of a daily index. `d = (1.08^(1/252) − 1) / 1.4`; break-even `(1 + d)^252 − 1` = 5.6514%. At an index of 3% the security yields 4.2249% a year; at 8%, 11.3757%.
- Result (IC3): 10,000.00, 720 days, `fixed` 12%, tax 1750 bp: gross 2,505.11, tax 438.39, net 2,066.72, net annual rate 9.9920%.
- Exempt against taxed (IC3): 10,000.00, 720 days, `fixed` 10% exempt: net 2,068.45, above the 2,066.72 of the taxed 12%.
- Monthly path (IC6): point 5.1082% for the year, 10 stored months accumulating 4.20%: each of the two remaining months 0.4349%.
- Market rate (IC13): points 2028-01-01 at 12.80% and 2030-01-01 at 13.40%, maturity 2029-01-01 (366 of 731 days): 13.1004%. Maturity 2031-01-01: none.
- Implied inflation (IC13): nominal 13.00%, real 7.00%: 5.6075%.

## Screen

### Comparison (shared component)

`IndexerComparison` in `web/src/features/calculators/indexer-comparison/`, exported by the feature `index.ts`. Props: the initial amount and the currency. The inputs live in the component's state in both places; the address holds nothing, because a list of securities has no form in the flat search string of the calculators.

- Inputs: the amount (`ui/money/money-input`), the maturity date, and one row per security: form, index (hidden for `fixed`), rate, the switch "Isento de imposto". "Adicionar título" up to six; a row is removed by its remove button; the first two rows cannot be removed.
- Results table, one row per security in typed order, fixed row height, values end-aligned: the security in words ("Prefixado 8,00% a.a.", "140% do CDI", "IPCA + 6,50% a.a."), gross yield, tax, net yield, net annual rate.
- Break-even block, one row per floating security: "empata com Prefixado 8,00% a.a. se o CDI médio for 5,65% a.a."; beside it, on one line each, "esperado: 4,90% a.a. · Focus de 13/11/2026" and "Tesouro Prefixado para o prazo: 6,10% a.a. · 16/11/2026". A missing figure is written in words: "sem pesquisa de expectativas", "sem título do Tesouro para esse prazo". For a monthly index the words are "IPCA médio" and "inflação implícita no Tesouro".
- Fixed text under the block: the figures assume each security is held to maturity; the expected rate is a survey and the market rate holds a term premium (IC14); the comparison ignores the issuer's credit risk; the decision is the investor's.
- Method section as in the other calculators (`calculator-frame/method-section`), with the sources of the tax rules, the survey and the curve.
- A stale feed (ADR 025) writes "pesquisa desatualizada" or "curva desatualizada" beside its date, in the warning text colour, with no icon.
- Privacy mode masks the amounts; rates stay.

### Calculators

A new calculator `indexer-comparison` in `model/calculators.ts`, route beside the others. Listed only when IC1 offers at least one index.

### Contribution plan ("This month")

In the purchase table, a row bought by its amount (CN17: an account member, a group without instruments; `byValue` of the shopping list) gains a text button "Comparar indexadores". It opens a dialog that holds `IndexerComparison` with the amount of the row and the base currency; the inputs live in the dialog's state and are dropped on close. The dialog changes nothing in the plan or the split. The button is absent when IC1 offers no index for the base currency, and while the plan is in edit mode. The row height does not change.

## Cross-cutting questions

- R1: Indexes (`cdi`, `ipca`): index sources. Expected paths: expectation sources (`br_focus`, `br_focus_ipca`). Market rates: curve sources (`br_tesouro`), new. Tax on yield: `fixedIncomeRules` in `web/src/features/calculators/fixed-income-calculator/fixed-income-region.ts`. Regional words (CDI, IPCA, Tesouro, Focus) come from the index, source and curve labels in the catalogs, never from the component.
- R2: A region without an expectation source for an index of the base currency has no calculator entry and no button in the plan. A region with expectations and no curve shows the comparison without the market rate, in words. A region without tax rules asks for the tax rate.
- R3: Curve ids, curve kinds and feed kinds are `^[a-z0-9_]{2,40}$` in SQL and `pattern` in the API.
- R4: Row "Curve source" added to `docs/contributing/regions.md`; the row "Expectation source" gains `br_focus_ipca`; the checklist gains a step for a curve source.
- R5: Keys `calc.indexerComparison.*` and the plan button, pt-BR and en; labels of `br_focus_ipca`, `br_tesouro` and its two curves on the settings screen.
- R6: Rates through `format-rate.ts`, dates and amounts through `Intl` of the active tag and `useMoneyFormat()`.
- C1: Amount, gross, tax and net are integers of minor units. Rates of curves and expectations are exact decimals in SQL and Go; the web computes rates in `number`, as the calculators do.
- C2: One currency per comparison. No conversion.
- C3: An index or a curve of another currency than the amount's is not offered (IC1, IC13).
- C4: The currency is the book's base currency in the plan, the calculator's currency field elsewhere; amounts through `useMoneyFormat()`.
- T1: The purchase date is today from the book's time zone; the maturity is a calendar date.
- T2: `days` are calendar days (calculators design §5). The curve source's period uses `br_banking` from the calendar registry.
- B1: Does not apply: the table is instance market data without `books_id`, as E3.
- B2: `listCurves` needs `read`; an HTTP test covers a member, and a request without a session.
- B3: No setting beyond the feed switches of ADR 025.
- D1: The table is classified as left out of the export: refetched market data, as `marketdata_index_expectation`.
- D2: One goose migration for the table.
- D3: Does not apply: no recorded fact changes.
- D4: Does not apply: public market data, replaced whole on each fetch.
- D5: Does not apply: the diagnostic file gains no field.
- S1: One operation, `listCurves`, mapped to `get_market_data` view `curves` in `tool_exposure_test.go`. No new `Problem.code`.
- S2: The plan dialog is desktop only, as the plan (ADR 027). The calculator follows the phone scope of the calculators.
- S3: `internal/assistant/guide/articles/investments.md` (contribution plan section) and the calculators article gain the comparison; `investments_br.md` names CDI, IPCA, Focus and Tesouro. Same commit as each screen.
- S4: The assistant reads curves through `get_market_data` view `curves` and expectations through `index_expectations`. It computes no comparison; the guide article states that equori gives no recommendation.
- X1: S553 `br_focus_ipca` enabled stores the points of IC7 and `GET /indexes` marks `ipca` `expected`. S554 `GET /indexes/ipca/expectations` returns them. S555 `br_tesouro` enabled stores both curves from a fixture, without coupon rows. S556 `GET /curves` returns them, oldest maturity first, to a member; 401 without a session. S557 with the feed disabled `GET /curves` is an empty list. S558 the feed is listed with `kind` `curve` and its `last`, and is stale after its lag. S559 a book of region `US` has both feeds listed with `suggested` false.
- X2: S559 runs outside Brazil. Web tests: the plan of a book whose region has no expectation source draws no button; a comparison with a `USD` amount offers no `BRL` index.

## Approaches

1. A mode of the fixed-income calculator, reached from the plan by a link. Rejected by the owner: the investor decides while planning and would have to remember the calculators.
2. A panel in the plan computed by a new `portfolio` endpoint. Rejected: it rewrites in Go the path compounding the web already computes and tests.
3. One web component over the existing functions, drawn in the plan and as a calculator; the backend gains data only (IPCA expectations, curves). Chosen by the owner on 2026-11-17, with every indexer and the market curve in the first delivery.

## Delivery order

1. `br_focus_ipca` (IC7) and `expectedOverMonthly` (IC6).
2. Curve source, storage, `listCurves`, settings screen entry (IC9 to IC12).
3. Pure functions of IC2 to IC5 and IC13 with the cases of IC15.
4. `IndexerComparison` and the calculator.
5. The plan button and dialog.

## Left to the builder

- Whether `GET /indexes` already carries the currency of an index; when it does not, the item gains `currency`.
- The file split under `web/src/features/calculators/indexer-comparison/` and `internal/marketdata/curve/`, following `web/CLAUDE.md` and ADR 033.
- The Slotted family of the plan dialog.
- A fixture of `PrecoTaxaTesouroDireto.csv` that includes a title closed for purchase, to confirm the rate such a row carries (IC11 skips blank and zero).
- The licence note of each source in `docs/operations/price-feeds.md`: Banco Central open data and Tesouro Transparente are the sources `br_focus` and `tesouro_direto` already read.

## Decisions taken during execution

- A security of form `percent` over a monthly index has no rate: IC1 offers only `spread` for a monthly index.
- IC6: a year with a point and 0 or 12 stored months takes `(1 + p)^(1/12) − 1` for each month.
- Implied inflation (IC13) is dated by the older of the two base dates.
- A security added to the list starts with the values of a default row.
- The calculator draws the comparison in the `details` slot of the frame, with no inputs column: the component holds its own inputs.
- The plan's guide article quotes the English label "compare indexers": the guide is written in English and its labels are checked against the English catalog.
- `cmd/equori/config.go` lists the curve sources, so `EQUORI_FEED_BR_TESOURO_URL` is a known variable.
