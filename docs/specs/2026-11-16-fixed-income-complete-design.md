# Fixed income, complete

Status: approved by the planning model on 2026-11-16 (amendment A236 of P8), issue #51. Owner directive of 2026-11-16: close every gap of fixed income for users from first-time investors to advanced ones, on the screen, in the assistant and through MCP.

## 1. Intent

A household records a fixed income application the way its bank or broker states it: "CDB of Banco X, 110% of the CDI, R$ 10,000.00 applied on 2026-03-02, maturing on 2028-03-02, daily liquidity". equori today needs three operations for that (define an instrument with an invented code, set its terms, record a buy), prices a pre-fixed security on calendar days, cannot model coupons or amortization, leaves a matured position open forever, shows only the gross value, holds no issuer and names every private contract in the catalog of every book of the instance. This amendment makes the application one operation, makes the contract a fact of its book, prices every common contract shape, lists the payments ahead, values the position net of tax, measures the exposure per issuer against the deposit guarantee of the region, handles the fund tax paid in units and reads the investments an aggregator connection reports.

Delivered before this amendment and kept: purchase lots for fixed income (A234), the withholding estimate of a redemption and the subtypes `debenture`, `lc`, `lf` (A235), the guide articles `fixed_income`, `fixed_income_payments`, `investments_br`.

## 2. Rules in force (research of 2026-11-16)

| Rule | Individual, Brazil | Source |
|---|---|---|
| Day count of a pre-fixed or spread rate | Business days of the national banking calendar, base 252 | ANBIMA, methodology of private fixed income; B3 contract terms of CDB |
| Income tax on a periodic coupon | Regressive table of A235, the bracket of the days since the application or acquisition of the security | IN RFB 1.585/2015, art. 46, § 4 |
| Exempt remuneration | LH, LCI, CRI (art. 3, II and IV); CDA, WA, CDCA, LCA, CRA (art. 3, V); LCD | Lei 11.033/2004, art. 3; Lei 14.937/2024 |
| Deposit guarantee (FGC) | R$ 250,000.00 per holder per institution or conglomerate; R$ 1,000,000.00 per holder in each 4 years from the first payment; covers demand and savings deposits, CDB, RDB, LC, LH, LI, LCI, LCA, LCD; does not cover LF, debentures, CRI, CRA, CDCA, government bonds | Resolução CMN 4.222/2013, annex II (FGC regulation), art. 2 and 3; fgc.org.br |
| LIG | Exempt for an individual and its guarantee by the FGC are stated only by secondary sources | none primary: the subtype `lig` reads taxed and not covered until a primary source confirms it |
| Come-cotas | Funds withhold income tax on the gain of the last business day of May and of November by cancelling units: 15% for a long-term fund, 20% for a short-term fund | Lei 14.754/2023, art. 17 to 19 |

Task 1 of each plan that uses a rule of this table reads its primary text again and records the date in the code comment; a rule whose primary text differs stops the task.

## 3. Goals, non-goals, anti-goals

Goals:

- G1. One operation records a new application (contract and purchase) or a contribution to an existing one, from the screen, the assistant and MCP.
- G2. A contract of a private issuer belongs to one book; a public security stays shared by the instance.
- G3. The accrual prices pre-fixed and spread rates on the business days of a calendar, and prices coupon and amortizing securities.
- G4. Each holding lists its payments ahead and the payments due and not recorded: coupon, amortization, maturity, come-cotas; one action records each with the expected figures.
- G5. A taxed position shows its estimated tax and net value.
- G6. The book shows its exposure per issuer and the part of it the deposit guarantee of the region covers.
- G7. Every value that changes by country is an extension point; a region without an implementation gets the neutral behavior of section 7.
- G8. An aggregator connection that reports investments proposes the applications, redemptions and payments it reads, each confirmed by the user.

Non-goals:

- NG1. The investor curve at the purchase rate of a security bought in the secondary market: it needs the projection of every future flow. A statement price recorded by the user re-anchors the accrual (Anchor, HR1).
- NG2. A market price feed for private securities (ANBIMA): its data needs a subscription. The CSV price import covers it.
- NG3. A projection of the current month of an inflation index: the published level repeats until the next one (amendment of 2026-10-26 of the investments design).
- NG4. An estimate of the come-cotas amount: the notice of the fund states the cancelled units.
- NG5. The import of the B3 investor area files: they omit the contracted rate. Open Finance (G8) carries it.
- NG6. Funds of other tax regimes (FIP, FIDC, ETF of fixed income): no come-cotas reminder is listed for them.

Anti-goals:

- AG1. No figure enters a recorded transaction without the user's confirmation: an expected payment, an estimated tax or an aggregator record is a proposal (D4; A235 AG1).
- AG2. No tax rate, guarantee limit, calendar or index name is a literal outside the implementation of its region.
- AG3. A first-time investor never needs to know a code, a basis point or a day count convention.
- AG4. No new dependency.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| A. Keep the instance-wide instrument and only generate its code | Smallest change; every member of the instance sees the contracts of every book; the archive of one book carries the contracts of the others | Rejected |
| B. A book-owned instrument: `marketdata_instrument.books_id`, null for a public security | One column and one visibility rule in marketdata; the contract keeps every existing mechanism (prices, accrual, lots, positions) | Chosen |
| C. Terms on the holding (ledger account) instead of an instrument | Private by construction; duplicates pricing, accrual and the price table per account and breaks every reader of `instrument` | Rejected |

| Approach to the application | Trade-off | Decision |
|---|---|---|
| A. A client sequence of three calls | No new operation; a failure between calls leaves an instrument without purchase; the assistant needs three confirmations | Rejected |
| B. One composite operation in ledger, with a marketdata port and a compensation | One confirmation, one preview; atomic for the user; a crash between the two writes leaves an unused book-owned instrument that a retry with the same `application_id` adopts | Chosen |

## 5. Decisions

### 5.1 Contract (marketdata)

| ID | Decision |
|---|---|
| FC1 | `marketdata_instrument` gains `books_id bigint NULL REFERENCES identity_books (id) ON DELETE CASCADE`. Null is a public security. A book reads, prices, edits, deletes and trades the public instruments and its own; another book's instrument reads as absent (404 `not_found` "unknown instrument" on HTTP, the same error on tools). Only `fixed_income` takes a `books_id`. |
| FC2 | The code of a book-owned instrument is `RF.<YYMMDD of matures_on>.<5 characters>`, the characters the first 25 bits of SHA-256 of `application_id` in Crockford base32. Same `application_id`, same code. |
| FC3 | `marketdata_instrument` gains `issuer text NULL` (1 to 80 characters, trimmed), `issuer_scheme text NULL` (`^[a-z0-9_]{2,40}$`) and `issuer_id text NULL` (1 to 40 characters). Scheme and id are both null or both set; `IssuerSchemes` in `internal/marketdata/domain/issuer.go` validates the id (`br_cnpj`: 14 digits with check digits, punctuation removed). The issuer key of a grouping is the id when set, otherwise `textfold` of the name. |
| FC4 | `marketdata_fixed_income_terms` gains `calendar_id text NULL`, `daily_liquidity boolean NOT NULL DEFAULT false` and `redeemable_from date NULL` (between `issued_on` and `matures_on`). |
| FC5 | `day_count = bus252` is valid with a business-day index (as today) or with `calendar_id` set; the spread root counts the business days of that calendar, and a pre-fixed or monthly-index security is priced on the business days of that calendar instead of weekdays. An existing row keeps `calendar_id` null and its prices. |
| FC6 | A table `marketdata_fixed_income_payment (instrument_code, pays_on, amortization_bp, pays_interest)`, primary key `(instrument_code, pays_on)`, `amortization_bp` 0 to 10000, `pays_on` after `issued_on` and on or before `matures_on`; the sum of `amortization_bp` of a security is at most 10000. The terms operation replaces the rows with the terms. The operation also takes `interest_every_months` (1, 3, 6 or 12) with `first_payment_on`, expanded by `domain.Schedule` to one row per period up to maturity, each with `pays_interest` true and `amortization_bp` 0, the last on `matures_on`. |
| FC7 | A payment date that is not a business day of the terms' calendar moves to the next business day; without a calendar it moves to the next weekday. The stored date stays unadjusted. |
| FC8 | Accrual with payments, per unit. `I(d)`: the product of the monthly index rates since the issue (1 without a monthly index). `J(d)`: the interest factor since the last payment with `pays_interest` (the daily index product times percent, times the spread root to the days, as today). Price `P(d) = face × I(d) × J(d)`; an amortization reduces the quantity, not the price (FC10). On an interest payment date `p`, the coupon per unit is `face × I(p) × (J(p) − 1)` and `J` restarts at 1 the next day. A security without payment rows prices exactly as today. |
| FC9 | An index source of period `month` updates principal (`I`); an index source of period `day` pays interest (`J`). The web and the tools name the first kind "inflation" and the second "rate" from that property (`IndexSummary.period`), not from an index id. |
| FC10 | An amortization of `a` basis points on `p`, with `n` the residual basis points before it, is a sale of `quantity × a / n` units (rounded half to even to the instrument's scale) at `P(p)` after the coupon. A maturity is a sale of the remaining units at `P(matures_on)`. Neither needs a new ledger operation; the lots (A234) take the cost and the withholding estimate (A235) takes the tax. |

### 5.2 Application (ledger, composite)

| ID | Decision |
|---|---|
| FC11 | `POST /api/v1/fixed-income-applications` (tag `ledger`, `x-book-role: write`). Body: `application_id` (uuid), `brokerage_id`, `cash_account_id` (optional, the single candidate when absent, as BC6), `applied_on`, `amount` (minor units of the brokerage currency), `fees`, `taxes` (optional), `description` (optional), and either `contract` (new) or `instrument` (code of an existing fixed income instrument the book reads: a contribution). `contract`: `subtype`, `issuer`, `issuer_scheme`, `issuer_id` (optional), `name` (optional), `issued_on` (default `applied_on`), `matures_on`, `index_id`, `percent_of_index_bp`, `spread_bp`, `day_count`, `calendar_id`, `daily_liquidity`, `redeemable_from`, `payments` or `interest_every_months` with `first_payment_on`. |
| FC12 | A new contract has type `fixed_income`, quote currency the brokerage currency, scale 6, face value 1.00, `books_id` of the request. Without `day_count`: `bus252` when the index compounds by business day or the region has a default calendar, `act365` otherwise; without `calendar_id` and with `bus252` and no daily index: `DefaultCalendar(region)`. Without `name`: `<SUBTYPE in capitals> <issuer> <matures_on>`; the web and the assistant send a name in the book's language. |
| FC13 | Unit price: 1.00 when `applied_on` equals `issued_on`; otherwise the chosen price of the instrument at `applied_on` (accrued or recorded), and 422 `price_missing` without one. Quantity = `amount / unit price` rounded half to even to scale 6; the trade then takes the order total `amount` (A228 IO1) so its gross equals `amount`. |
| FC14 | Order of writes: validate every field, including the contract through the port `Contracts.Check`; `Contracts.Define` writes instrument, terms and payments in one marketdata transaction; the trade is recorded; when the trade fails, `Contracts.Discard` deletes the instrument when no account uses it. A request whose `application_id` names an existing instrument of the book with no account adopts it; with an account whose first buy exists, it returns 200 with that trade (idempotent replay). |
| FC15 | Response `201`: `instrument`, `transaction_id`, `quantity`, `unit_price`. Problems: `contract_invalid` (with field errors), `not_found` (an `instrument` the book does not read), `price_missing`, `trade_target_required`, `brokerage_cash_ambiguous`, `brokerage_cash_missing`. |
| FC16 | The tool `record_fixed_income` (ledger toolapi) takes the same fields as FC11, with rates as percents in text (`"110"`, `"6.5"`) converted to basis points by the tool; its preview states the contract in one line and the trade. `manage_instrument set_terms` gains `calendar_id`, `daily_liquidity`, `redeemable_from`, `payments`, `interest_every_months`, `first_payment_on`; `manage_instrument edit` gains `issuer`, `issuer_scheme`, `issuer_id`. |

### 5.3 Events ahead and due (portfolio)

| ID | Decision |
|---|---|
| FC17 | `GET /api/v1/fixed-income-events?from=&to=` (`x-book-role: read`, at most 400 days) lists, per held fixed income account: `interest` (expected gross = coupon per unit × quantity at the day before), `amortization` (units and gross of FC10), `maturity` (remaining units and gross), and, for a fund of a region with a unit-tax calendar, `unit_tax` (date only). Each item: `account_id`, `instrument`, `date` (adjusted, FC7), `kind`, `quantity`, `gross` (absent for `unit_tax` and when a rate is missing, with `rate_missing` true), `state`. |
| FC18 | `state`: `upcoming` after today; `due` on or before today when not recorded; `recorded` when the book holds, within 7 calendar days of `date`, an income of type `coupon` or `interest` on the account (`interest`), a sale of at least the units (`amortization`, `maturity`) or a unit tax on the account (`unit_tax`). Items before `from` are absent. |
| FC19 | The attention widget of the overview adds one item per `due` event (weight `high` for `maturity`, `normal` otherwise) and one item for the `upcoming` events of the next 7 days (weight `low`). |
| FC20 | Recording an event opens the matching form (sale or income) filled with the expected quantity, unit price or gross; the withholding estimate (A235) shows beside the tax field with an action "Use estimate" that copies it; the field never fills by itself (AG1). The assistant reads the same items through `get_portfolio` view `fixed_income_events`. |

### 5.4 Value net of tax and exposure (portfolio)

| ID | Decision |
|---|---|
| FC21 | `Position` gains `estimated_tax` and `estimated_net` (minor units of the base currency), present when the ledger estimate (A235 FS5) answers for the account at the date with the whole quantity at `market_value`. Allocation, net worth and return stay gross. |
| FC22 | The jurisdiction gains `Guarantee() (Guarantee, bool)`: `Name`, `LimitPerIssuer` (money), `LimitPerPeriod` (money) with `PeriodYears`, `Covered(subtype) bool`. `br`: FGC, 250,000.00 BRL, 1,000,000.00 BRL in 4 years, covered `cdb`, `rdb`, `lc`, `lh`, `lci`, `lca`, `lcd`. A region without a case has no guarantee. |
| FC23 | `GET /api/v1/issuer-exposure?date=` (`x-book-role: read`): per issuer key, `issuer` (name of the most valuable holding), `market_value`, `covered_value` (value of covered subtypes), `uncovered_value`, and with a guarantee `limit`, `excess` (`max(covered_value − limit, 0)`); a holding without issuer groups under `issuer` null. The response holds `guarantee` (name, limits) or null, and `period_note` true when the sum of `covered_value` exceeds `LimitPerPeriod`. Values in the base currency; a holding without price is listed in `missing_prices` and left out of the sums (C2). |
| FC24 | `br.Subtypes("fixed_income")` adds `lh`, `lcd`, `cdca` (tax class `fixed_income_exempt`) and `lig` (tax class `fixed_income`, not covered; the article states that its treatment is unconfirmed). |

### 5.5 Fund unit tax (ledger)

| ID | Decision |
|---|---|
| FC25 | The corporate action (A228) gains kind `unit_tax`: a holding of type `fund` loses `quantity` units on `date`; `amount` (tax paid) is posted to the taxes category against nothing in cash: the units leave at the value `amount`, the holding's cost basis stays, no realized result is recorded. A later sale before it is 409 `later_sale_exists`, as other actions. |
| FC26 | The jurisdiction gains `UnitTaxDates(year int) []time.Time`: `br` returns the last business day (`br_banking`) of May and of November for the fund subtypes `fixed_income_fund` and `multimarket`; FC17 lists them as `unit_tax`. A region without a case lists none. |

### 5.6 Aggregator investments (ingestion)

| ID | Decision |
|---|---|
| FC27 | An optional port `InvestmentReader` beside `Aggregator`: `Investments(ctx, integrationID, credentials, itemID) ([]domain.ExternalInvestment, error)`. `ExternalInvestment`: `ID`, `Type`, `Subtype` (region subtype or empty), `Name`, `Issuer`, `IssuerScheme`, `IssuerID`, `IndexID`, `PercentOfIndexBP`, `SpreadBP`, `IssuedOn`, `MaturesOn`, `Quantity`, `Balance` (money), `BalanceDate`, `Movements` (`ID`, `Kind` buy, sell, income, tax, `Date`, `Quantity`, `Amount`). `pluggy` implements it from `GET /investments?itemId=` and `GET /investments/{id}/transactions`, mapping its subtypes (`CDB`→`cdb`, `LCI`→`lci`, `LCA`→`lca`, `LC`→`lc`, `CRI`→`cri`, `CRA`→`cra`, `DEBENTURES`→`debenture`, `LIG`→`lig`, `TREASURY`→`tesouro`), `rateType` (`CDI`→`cdi`, `IPCA`→`ipca`; any other value, `SELIC` included while no index source serves `selic`, proposes the investment without terms, priced by its balance) and `rate`/`fixedAnnualRate` to basis points. |
| FC28 | A sync stores each external investment and movement once (key: connection, external id). A movement becomes a pending review item: a first `buy` proposes an application with a new contract, a later `buy` a contribution, `sell` a sale, `income` an income of type `interest`, `tax` the taxes of the nearest sale within 3 days. The balance becomes a price with source the aggregator id at `BalanceDate` (balance / quantity), which anchors the accrual. Confirming applies the operation of section 5.2 or the trade; dismissing keeps the record and its undo (D3, D4). |

### 5.7 Assistant and MCP

| ID | Decision |
|---|---|
| FC29 | The guide article `fixed_income` describes `record_fixed_income` as the path for a new application and a contribution, the facts to ask in one message when missing (kind, issuer, amount, date, maturity, rate, liquidity, whether interest is paid out) and the meaning of each field in plain words; `manage_instrument` stays the path of a public security. `fixed_income_payments` describes `fixed_income_events` and the recording of each kind. `investments_br` adds the guarantee, the new subtypes, come-cotas, liquidity and grace words, and removes the note on calendar days. |
| FC30 | `get_portfolio` gains the views `fixed_income_events` and `issuer_exposure`. |
| FC31 | `MCPPrompts` adds `record_fixed_income` (argument `description`, required: the application as the user states it) and `fixed_income_review` (no argument: the events due and of the next 30 days, and the exposure above the guarantee). |
| FC32 | Each new operation has its entry in `internal/server/tool_exposure_test.go`; each new tool fits `TestToolCatalogQuality`. |

### 5.8 Web

| ID | Decision |
|---|---|
| FC33 | The entry kind picker adds "Fixed income application". The form reads top to bottom: what (subtype with a one-line description from the catalog, issuer with the issuers of the book as suggestions), how much and when (brokerage, amount, date), return (a segmented choice "Rate", "Inflation + rate", "Fixed", from FC9; "Rate" takes the percent of the index and an optional added rate), term (maturity with shortcuts of 6, 12, 24, 36 and 60 months, daily liquidity, grace date), payments (collapsed: interest every 1, 3, 6 or 12 months from a first date, amortization rows). One summary line states the contract ("CDB Banco X · 110% of CDI · matures 2028-03-02 · R$ 10,000.00"). A contribution starts from the holding's action "Add money". |
| FC34 | The terms dialog takes the index from a select of the enabled indexes (`listIndexes`), labelled by catalog key `index.<id>` with the id as fallback, and adds calendar, liquidity, grace and payments. |
| FC35 | The instrument page of a contract shows the issuer, the rate in words, liquidity, grace, the next event and, with a guarantee, whether the subtype is covered. |
| FC36 | The Portfolio screen adds a panel "Fixed income" for a book that holds fixed income: shares by return kind (rate, inflation, fixed), a maturity ladder by year, the events of the next 90 days, and the issuer exposure with the guarantee limit. Holdings add the column "Estimated net". |

## 6. Delivery

Each plan follows `docs/contributing/agents.md` and is written after the previous one is executed, so it reads the code it changes. One GitHub issue of type `feature` tracks them.

| Plan | Content | Depends on |
|---|---|---|
| FI1 | FC4, FC5, FC34 (index select, calendar, liquidity, grace) and the bus252 correction | none |
| FI2 | FC1, FC2, FC3: book-owned instruments, issuer, archive | FI1 |
| FI3 | FC11 to FC16, FC33, FC29 (application and contribution) | FI2 |
| FI4 | FC6 to FC10, FC17 to FC20, FC30, FC35 (payments, events, attention) | FI3 |
| FI5 | FC21 to FC24, FC36 (net value, exposure, subtypes, panel) | FI4 |
| FI6 | FC25, FC26 (unit tax) | FI4 |
| FI7 | FC27, FC28 (aggregator investments) | FI3 |
| FI8 | FC31, FC32 review, guide consolidation, assistant eval cases for the owner | FI1 to FI7 |

## 7. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Calendar of a contract: `DefaultCalendar` (`internal/marketdata/region_defaults.go`). Index kind: the index source period (FC9). Issuer scheme: `IssuerSchemes` (`internal/marketdata/domain/issuer.go`). Guarantee: `Jurisdiction.Guarantee` (`internal/portfolio/jurisdiction/br`). Unit-tax dates: `Jurisdiction.UnitTaxDates`. Subtypes and tax class: `br.Subtypes`, `TaxClass`. Aggregator subtype and rate mapping: the `pluggy` adapter. Words: catalog keys and `investments_br`. |
| R2 | Neutral: `act365` without a calendar unless the user chooses one; no guarantee (exposure lists values, no limit); no unit-tax dates; universal subtypes; no withholding estimate (A235); an aggregator without `InvestmentReader` reads no investments. |
| R3 | `issuer_scheme`, `calendar_id`, `index_id`, `subtype`, event `kind` and movement `Kind` are `^[a-z0-9_]{2,40}$` patterns in SQL and `api/openapi.yaml`. |
| R4 | Rows in `docs/contributing/regions.md`: "Issuer identifier scheme", "Deposit guarantee", "Fund unit-tax calendar", "Aggregator investment mapping"; the row "Calendar" names the contract default. |
| R5 | Each plan lists its catalog keys with pt-BR and en text. |
| R6 | Dates through `formatDate`, amounts through `useMoneyFormat()`, percents through `numberFormatter`. |
| C1 | Amounts in minor units; per-unit prices and factors are 12-decimal decimals of the accrual's exact arithmetic; no `float64`. |
| C2 | Event gross and exposure sum one currency each: the instrument's quote currency for events, the base currency for exposure, converted at the chosen rate of the date with a missing rate listed in `missing_prices`. |
| C3 | A contract is quoted in its brokerage currency; the net value and the exposure value it in the base currency as positions do today (A222). An estimate exists only for lots in the base currency (A235 C3). |
| C4 | Amounts on screen through `useMoneyFormat()`; currency from the record. |
| T1 | Calendar dates of the book; "today" from `platform/clock`. |
| T2 | Business days of the terms' calendar (FC5, FC7) and `br_banking` for unit-tax dates (FC26). |
| B1 | `marketdata_fixed_income_payment` is keyed by an instrument; it inherits the instrument's `books_id` through the reference, and a schema test refuses a payment of an instrument owned by another book through the API. The aggregator tables of FC28 hold `books_id`. |
| B2 | `POST /fixed-income-applications` write; `GET /fixed-income-events` and `GET /issuer-exposure` read; each with a test per role and another book (404). |
| B3 | No setting. |
| D1 | `marketdata_fixed_income_payment` is shared with its instrument: public rows travel with the shared tables, book-owned rows with their book; the archive filters `marketdata_instrument`, its terms, payments, symbols and prices to public rows and the book's own; the archive version rises in FI2 and FI4. The aggregator tables of FC28 are facts. |
| D2 | One goose migration per plan that changes the schema. |
| D3 | An application is a trade with its version history; a deleted compensation instrument was never used; a confirmed aggregator item keeps its undo. |
| D4 | Expected events and aggregator records are proposals; equori writes them only on confirmation; a repeated sync creates nothing. |
| D5 | No diagnostic field. |
| S1 | Operations: `createFixedIncomeApplication` (tool `record_fixed_income`), `listFixedIncomeEvents` and `getIssuerExposure` (tool `get_portfolio`), plus the aggregator review operations of FI7. Problem codes of FC15 not yet tested get a test through the HTTP API. |
| S2 | The application form, the events list and the panel are phone routes; each row keeps one line at 390 px. |
| S3 | Articles `fixed_income`, `fixed_income_payments`, `investments_br`, `investments`, `investment_operations`, `imports_and_bank_connections` change in the plan that changes their screen. |
| S4 | Tools `record_fixed_income`, `get_portfolio` views of FC30, `manage_instrument` fields of FC16, MCP prompts of FC31. |
| X1 | Scenarios S467 onward, assigned by each plan in order, each with its test in `internal/apitest` or the module's black-box tests. |
| X2 | Each plan runs its region rules with `BR` and one test with region `DE` (neutral case), and one test with a base currency other than the brokerage currency. |

## 8. Left to the builder

- The texts of the catalog, within the plans.
- The visual layout of the panel of FC36, under `web/CLAUDE.md` and the Slotted guidelines.
