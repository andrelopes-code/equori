# P8 Currencies and Investments Implementation Plan

**Goal:** Deliver roadmap phase P8: securities as instruments, prices with two public feeds, conversion between instruments, valued balances, foreign purchases, currency exchanges, trades with average cost, investment income, the Portfolio derived tables and multi-currency planning (S16, S17, S21, S22, S64–S67).

**Architecture:** `platform/money` generalizes `Money` to any instrument with its scale and adds an exact `Rate` and a single-rounding conversion. `marketdata` owns instruments, prices, feeds behind an anti-corruption layer (`internal/marketdata/internal/feed`) and the conversion service. `ledger` records foreign purchases, exchanges, trades and investment income as transactions with detail rows (D1 data) and computes the cost of a sale from the weights of the security account. A new module `internal/portfolio` rebuilds positions, realized results and income events from Ledger facts on the outbox events (ADR 006) and reads Ledger only through `ledger.Module` methods (ADR 002). `planning` drops the base-currency restriction of A47.

**Tech Stack:** As P7. New dependency: none (`archive/zip`, `encoding/json`, `math/big` from the standard library). New external hosts, contacted only when enabled (N17): `olinda.bcb.gov.br` (BCB PTAX), `bvmf.bmfbovespa.com.br` (B3 COTAHIST).

**Spec:** `docs/domain/` chapters 1 (M11, M12, M17, M18, B05, D1), 3 (F9), 4 (4.3.5, 4.3.6), 5 (5.1 `Quantity` and `Rate`, 5.2.2, 5.2.3, 5.6), 6 (S16, S17, S21, S22, fixture 6.1), 7 (7.4 marketdata and portfolio tables, 7.5 price index); ADR 002, ADR 005, ADR 006, ADR 007; P7 amendment A47 (lifted by A72); this plan's "Spec amendments" and "Scenarios".

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A58 | `money.Money` is the `Quantity` of 5.1: an `int64` amount in units scaled by the instrument scale, the instrument code and the scale. `money.New` keeps accepting only the ISO 4217 list; `money.NewOf(amount, code, scale)` builds the amount of any instrument. In the API, `Money.currency` carries any instrument code (`^[A-Z0-9.]{2,20}$`); `amount` is in units of the instrument scale (`{"amount": 150, "currency": "MXRF11"}`). A `Rate` is an exact decimal (int64 mantissa, 0–12 decimals), written in the API as a decimal string (`"5.4830"`). Every conversion multiplies by one or more rates exactly and rounds half to even once, at the end (5.1). ADR 005 section 2 is updated accordingly. | Securities need amounts that are not currencies; one type keeps postings uniform. |
| A59 | `POST /instruments` defines a non-currency instrument for the instance: `code` (`^[A-Z0-9.]{2,20}$`), `type` (`stock`, `fii`, `etf`, `bdr`, `fixed_income`, `fund`, `crypto`; the tax class of 5.6, stored in `instrument_type`), `scale` 0–12, `name` 1–120, `quote_currency` (a currency instrument) and optional `exchange` (`B3`). Code, type, scale and quote currency are immutable. A duplicate code returns 409 `instrument_exists`; `type` `currency` returns 422 on `type`. `GET /instruments?type=` lists them. | 5.6 lists the fields; 7.4 keeps one column for type and tax class, whose value sets are equal. |
| A60 | A price is an instance-wide fact `(instrument, quote_instrument, date, value > 0, source)`. Sources and priorities: `manual` 1, `csv` 2, `bcb_ptax` 3, `b3_cotahist` 3. The chosen price of a pair at date D is, among the prices dated D, the lowest priority, then the latest `recorded_at`; the price on or before D is the chosen price of the latest date ≤ D, without an age limit. Recording an existing `(instrument, quote_instrument, date, source)` replaces its value. `POST /prices` records a `manual` price; `POST /prices/import` takes a CSV (`instrument,quote_instrument,date,value` header, at most 10,000 lines) as source `csv`, all or nothing, 422 `validation_failed` with field `line N`; `GET /prices?instrument=&quote_instrument=&from=&to=` returns the chosen price of each date with prices (range ≤ 366 days). | 3.11 "one is chosen by source priority" without the order. |
| A61 | The value of an amount q of instrument X in currency Y at date D: q when X = Y; else the price on or before D of `(X, Y)`; else the inverse of `(Y, X)`; else through `BRL`, each leg direct or inverse. Every conversion returns the prices it used. No path returns 422 `price_missing` naming the instrument; the value is never zero by default. | B05 "the rate used is always traceable". |
| A62 | Feeds run only when named in `EQUORI_PRICE_FEEDS` (comma list of `bcb_ptax`, `b3_cotahist`; default empty, N17). `bcb_ptax`: for each currency instrument other than `BRL`, `GET {EQUORI_BCB_PTAX_URL}/ExchangeRatePeriod(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial='MM-DD-YYYY'&@dataFinalCotacao='MM-DD-YYYY'&$format=json`; the item with `tipoBoletim` `Fechamento` gives the price `(code, BRL, date of dataHoraCotacao, cotacaoVenda)`. `b3_cotahist`: for each weekday, `GET {EQUORI_B3_COTAHIST_URL}/COTAHIST_D{DDMMYYYY}.ZIP`; records of type `01` with `TPMERC` `010` give `(CODNEG trimmed, BRL, DATA, PREULT ÷ 100)` for instruments with exchange `B3`. Window: from the day after the latest price date of the source, never earlier than today − 30 days, to today. A day without data (404, empty result) stores nothing; any other failure is logged and ends the run of that `b3_cotahist` day or `bcb_ptax` currency for the tick (final review). A tick runs at start and every 6 hours. Fund shares (CVM), Tesouro Direto and crypto prices enter in P8 by `manual` or `csv`. | Owner delegated the choice (2026-10-17); both services are official, free and keyless (checked 2026-10-17). |
| A63 | A security is held only by a child of a `brokerage` parent; the child has kind `brokerage`. A brokerage parent's instrument is a currency; its children hold that currency or a security whose `quote_currency` is that currency (422 on `currency` otherwise). The balance of a parent whose children hold more than one instrument returns 422 `mixed_instruments` unless `value_in` is given; `GET /reports/balances` returns the same code for such a parent. | 5.2.2 and DM5; fixture 6.1 shows XP without instrument. |
| A64 | `original` on a posting: a currency instrument different from the account instrument, non-zero, with the sign of `amount` (422 on `postings[i].original`). | 5.2.3 defines `originalAmount` without validation. |
| A65 | `GET /accounts/{id}/balance?date=&value_in=` adds `value` (the balance converted by A61 at `date`) and `prices` (the prices used). Without `value_in` the response is unchanged. | S17 "net worth in BRL … shows Wise as 5,500.00"; the net worth series stays in P9. |
| A66 | `POST /foreign-purchases` `{account_id, category_id, date, description, payee_id?, original: Money, rate, iof_rate_bp?, iof_category_id?, statement?}` on a card or balance account in the base currency: amount = round(original × rate); IOF = round(amount × `iof_rate_bp` ÷ 10000), default `iof_rate_bp` 350, IOF category default the system role `taxes`; IOF 0 creates no IOF postings. The account and category postings carry `original`; card postings are billed as card charges. | S16; M11. |
| A67 | `POST /exchanges` `{from_account_id, to_account_id, date, from_amount, to_amount, fee?, fee_category_id?, description?}` between balance accounts of two different currencies, one of them the base currency (422 `currency_unsupported` on `to_account_id` otherwise). The fee is in the base currency, default category the system role `fees`, added to the debit when the base side is `from` and deducted from the credit when it is `to`. The foreign side's weight is the base-side amount without the fee. | S17; M12. Exchanges between two foreign currencies need a price-based weight; generic transactions with explicit weights cover them. |
| A68 | `POST /trades` `{account_id, cash_account_id, side, date, quantity, unit_price, fees?, taxes?, taxes_category_id?, description?}`: `account_id` holds a security, `cash_account_id` is a child of the same brokerage parent in the base currency (422 `currency_unsupported` otherwise). gross = round(quantity × unit_price). Buy: cash −(gross + fees); security +quantity with weight gross + fees; `taxes` on a buy is 422 on `taxes`. Sell: cost = the security account's weight sum × quantity ÷ held quantity on the trade date (half to even), or the whole weight sum when the full quantity is sold; result = gross − fees − cost; cash +(gross − fees − taxes); taxes category (default system role `taxes`) +taxes; security −quantity with weight −cost; result to `realized_gains` (negative weight) or `realized_losses` (positive weight), no posting for 0. A quantity above the held quantity returns 422 `validation_failed` on `quantity`. `ledger_trade` stores side, quantity, unit price, gross, fees, taxes and cost (D1). | S21; F9 "realized gain or loss computed from average cost". |
| A69 | A trade, a void, or any posting on a security account dated on or before a non-voided sale of that account other than itself returns 409 `later_sale_exists`. `PUT /transactions/{id}` on a transaction with a trade or income detail returns 409 `investment_transaction`; void and record again instead. | A sale's cost is fixed at recording; an earlier change would make it stale. |
| A70 | `POST /investment-income` `{account_id, cash_account_id, income_type, date, gross, withheld?, category_id, withheld_category_id?, description?}`: types `dividend`, `jcp`, `interest`, `coupon`; the same account rules as A68; cash +(gross − withheld); withheld category (default system role `taxes`) +withheld; income category −gross. `withheld` defaults to 0, and for `jcp` to round(gross × 15 %). `ledger_investment_income` stores type, gross and withheld. Amortization is not recorded in P8. | S22; F9. Amortization reduces cost without quantity, which a posting cannot express (non-zero amount). |
| A71 | Portfolio reacts to `ledger.transaction_recorded.v1`, `…_corrected.v1` and `…_voided.v1` whose `account_ids` contain a child of a brokerage parent, and rebuilds that parent: `portfolio_position_day` (one row per security account and date with a change, quantity and cost basis after the day), `portfolio_realized_result` (one row per sale, month = first day of the sale month) and `portfolio_income_event` (one row per income; tax treatment `exempt` for `dividend`, `exclusive` otherwise). `GET /positions?date=` returns per security account quantity, cost basis, average cost (4 decimals, half to even, when quantity and cost basis are positive), and, when a price exists, price and market value in the base currency; `GET /realized-results?year=` and `GET /income-events?year=` list the year. | 4.3.5, 5.6, 7.4. |
| A72 | A47 is lifted. A schedule amount is in the instrument of `account_id`, which is a currency (422 `currency_unsupported` on `account_id` for a security). For `transfer` and `savings`, `counterpart_id` has the instrument of `account_id` (422 `currency_unsupported` on `counterpart_id`). A projection is in the account's instrument. Committed amounts are in the base currency: occurrences in another currency are converted by A61 at today and the response lists the prices. A goal has any currency; current = the sum of the account balances converted by A61 at today. Budgets stay in the base currency: spent sums weights (A54). | Multi-currency weights and prices exist from P8 on. |

## Scenarios (added to chapter 6, section 6.17 "Prices and positions")

The clock is 2026-11-01 unless a scenario says otherwise. Accounts are those of 6.1; S21 buys on 2026-10-05 and sells on 2026-10-20; S22 is dated 2026-10-26.

| ID | Scenario |
|---|---|
| S16 | As chapter 6, through `POST /foreign-purchases` with original 100.00 USD, rate 5.4830 and IOF 350 bp on Taxes › IOF. |
| S17 | As chapter 6, through `POST /exchanges` on 2026-10-14; with a `manual` USD/BRL price of 5.5000 on 2026-10-30 and a `bcb_ptax` price of 5.4950 on the same date, `GET /accounts/{Wise USD}/balance?date=2026-11-01&value_in=BRL` returns value 5,500.00 and the manual price. |
| S21 | As chapter 6, through `POST /trades`. |
| S22 | As chapter 6, through `POST /investment-income`; the JCP omits `withheld`. |
| S64 | After S21, a `b3_cotahist` price of MXRF11 9.36 BRL on 2026-10-29: `GET /positions?date=2026-11-01` returns XP MXRF11 quantity 100, cost basis 1,008.27, average cost 10.0827, price 9.36, market value 936.00; `GET /realized-results?year=2026` returns one result of 33.77 in 2026-10. |
| S65 | After S22, `GET /income-events?year=2026` returns the dividend 10.00 `exempt` withheld 0.00 and the JCP 45.00 `exclusive` withheld 6.75. |
| S66 | A subscription of 9.99 USD monthly on Wise USD, Subscriptions, starting 2026-12-10; USD/BRL 5.5000 on 2026-10-30: `GET /commitments?month=2026-12` counts it as 54.94 (54.945 half to even) and lists the price. |
| S67 | Goal "Trip" 2,000.00 USD over Wise USD (1,000.00 USD) and Nubank checking (2,750.00 BRL) with USD/BRL 5.5000: current 1,500.00 USD, remaining 500.00 USD, progress 7500 bp. |

## Global Constraints

- All earlier constraints apply.
- Prices and instruments are instance-wide (`marketdata_` tables have no `user_id`); every other new table has `user_id` and composite foreign keys (7.1).
- Portfolio SQL touches only `portfolio_` tables; it reads Ledger through `ledger.Module` and prices through `marketdata.Module` (ADR 002).
- Rates are `money.Rate`, stored as `numeric(30,12)`; `float32` and `float64` never appear in `domain` packages or in `platform/money` (N03).
- Feed tests use `httptest` servers through `server.Config`; no test contacts the internet. Feed ticks are exercised through `App.Marketdata.TickFeeds`, never through a ticker.
- Defaults: IOF 350 bp, JCP withholding 1500 bp, feed window 30 days, feed interval 6 hours, average cost 4 decimals.

## Review Focus

1. A buy, void or correction dated on or before an existing sale of the same security account is rejected with 409 `later_sale_exists`, and the realized result of the sale stays 33.77 (Task 6).
2. Selling the whole position leaves quantity 0 and cost basis 0.00 exactly, with no rounding residue for the next buy; selling more than held is 422 on `quantity` (Task 6).
3. A `manual` price and a feed price on the same date: the manual one is chosen, and a later feed run does not replace it; a date with no price uses the latest earlier one; no path returns 422 `price_missing`, never a zero value (Tasks 2 and 5).
4. A feed day that returns 404, 500, a truncated ZIP or a malformed line stores no price for that day, logs one line, and the next tick fetches it again; a currency the BCB does not quote stores nothing and does not stop the other currencies (Task 3).
5. A brokerage parent holding BRL and MXRF11 children returns 422 `mixed_instruments` for its balance and its balance series, not a sum of reais and shares (Task 4).

---

## Slice A (Tasks 1–3)

### Task 1: Instrument amounts, rates and conversion (A58)

**Files:** `internal/platform/money/{money.go,rate.go,convert.go}`, `internal/platform/money/{money_test.go,rate_test.go,convert_test.go}`, `docs/adr/005-cross-cutting-conventions.md` (section 2).

```go
// money.go: Money gains its scale; New keeps the ISO list.
type Money struct{ amount int64; currency Currency; scale int8 }
func NewOf(amount int64, code Currency, scale int) (Money, error) // code ^[A-Z0-9.]{2,20}$, scale 0–12, |amount| ≤ MaxAmount
func (m Money) Scale() int                                       // Add, Sub, Neg and String keep and use the scale
// rate.go
type Rate struct{ mantissa int64; scale int8 }
var ErrInvalidRate = errors.New("invalid rate")
func ParseRate(s string) (Rate, error)       // "5.4830"; > 0; at most 12 decimals; no exponent
func NewRate(mantissa int64, scale int) (Rate, error)
func (r Rate) String() string                // keeps the scale: "5.4830"
func (r Rate) Mantissa() int64
func (r Rate) Scale() int
// convert.go
type Leg struct{ Rate Rate; Inverse bool }
func Convert(m Money, to Currency, legs ...Leg) (Money, error) // exact product with math/big, one half-even rounding to the scale of to
func Fraction(m Money, num, den int64) (Money, error)          // m × num ÷ den, half to even (cost of sold units)
func Quotient(a, b Money, decimals int) (Rate, error)           // a ÷ b per major unit, half to even (average cost)
```

**Tests (table-driven):** `NewOf(150, "MXRF11", 0)`; `NewOf` rejects scale 13 and code `mx`; `Add` of two MXRF11 amounts keeps scale 0; `String` of `NewOf(123456789, "BTC", 8)` is `BTC 1.23456789`; `ParseRate` accepts `"5.4830"` (scale 4) and rejects `"0"`, `"-1"`, `"1e3"`, 13 decimals; `Convert(100.00 USD, BRL, {5.4830})` = 548.30; `Convert(548.30 BRL, USD, {5.4830 inverse})` = 100.00; `Convert(9.99 USD, BRL, {5.5})` = 54.94 (half to even of 54.945); two legs JPY → BRL → USD round once; `Fraction(1,512.40, 50, 150)` = 504.13; `Quotient(1,512.40 BRL, 150 MXRF11, 4)` = `10.0827`; `Convert` to an unknown currency returns `ErrUnknownCurrency`.

Commit `feat(platform): amounts of any instrument and exact rates`.

### Task 2: Instruments, prices and conversion (A59, A60, A61)

**Files:** `db/migrations/00021_marketdata_prices.sql`, `db/queries/marketdata/{instrument.sql,price.sql}`, `api/openapi.yaml` (tag `marketdata`: `/instruments`, `/instruments/{code}`, `/prices`, `/prices/import`; schemas `Instrument`, `Price`, `Rate`; codes `instrument_exists`, `price_missing`; `Money.currency` pattern of A58), `internal/marketdata/{marketdata.go,price.go,convert.go}`, `internal/marketdata/internal/adapter/httpapi/{server.go,instruments.go,prices.go}`, `internal/marketdata/{instruments_test.go,prices_test.go,convert_test.go,schema_test.go}`.

**Tables:** `marketdata_instrument` gains `quote_currency text REFERENCES marketdata_instrument (code)` and `exchange text CHECK (exchange IN ('B3'))`, with `CHECK ((instrument_type = 'currency') = (quote_currency IS NULL))`; `marketdata_price (instrument, quote_instrument, date, value numeric(30,12) CHECK (value > 0), source CHECK IN ('manual','csv','bcb_ptax','b3_cotahist'), priority smallint, recorded_at timestamptz DEFAULT now())`, `PRIMARY KEY (instrument, quote_instrument, date, source)`, `CHECK (instrument <> quote_instrument)`, `CHECK (priority = CASE source WHEN 'manual' THEN 1 WHEN 'csv' THEN 2 ELSE 3 END)`, both instrument columns FK to `marketdata_instrument`; index `(instrument, quote_instrument, date DESC)` (7.5).

```go
// marketdata.go
type Instrument struct{ Code money.Currency; Type string; Scale int; Name string; QuoteCurrency money.Currency; Exchange string }
type Price struct{ Instrument, Quote money.Currency; Date time.Time; Value money.Rate; Source string }
type Conversion struct{ Value money.Money; Prices []Price }
var ErrInstrumentExists = errors.New("instrument exists")
var ErrPriceMissing = errors.New("price missing") // wrapped with the instrument code
func (m *Module) DefineInstrument(ctx context.Context, in Instrument) (Instrument, error)
func (m *Module) Instrument(ctx context.Context, code string) (Instrument, error)          // existing, now with the new fields
func (m *Module) RecordPrices(ctx context.Context, ps []Price) error                      // upsert by (instrument, quote, date, source), one transaction
func (m *Module) PriceOnOrBefore(ctx context.Context, instrument, quote money.Currency, date time.Time) (Price, bool, error)
func (m *Module) Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (Conversion, error) // A61
```

API: `POST /instruments` → 201; `GET /instruments?type=`; `GET /instruments/{code}`; `POST /prices` `{instrument, quote_instrument, date, value: Rate}` → 201 `Price`; `POST /prices/import` (multipart file, body limit 1 MiB) → `{recorded: n}`; `GET /prices?instrument=&quote_instrument=&from=&to=` → `{items: [Price]}`.

**Tests:** schema tests with direct SQL: a price of 0, a price with priority 1 and source `csv`, a security without `quote_currency` — each rejected; define MXRF11 (`fii`, scale 0, BRL, B3) → 201, again → 409 `instrument_exists`, type `currency` → 422 on `type`; Review Focus 3: `bcb_ptax` 5.4950 then `manual` 5.5000 on 2026-10-30, then `bcb_ptax` 5.4960 again → `GET /prices` returns 5.5000 for that date; `PriceOnOrBefore` on 2026-11-01 (Sunday) returns the 2026-10-30 price; `Convert` direct, inverse, through BRL (MXRF11 → USD) with the prices listed; no price → `ErrPriceMissing` naming the instrument, and 422 `price_missing` at the API; CSV with a bad date on line 3 → 422 on `line 3` and no price stored; range of 400 days → 422 on `to`.

Commit `feat(marketdata): define instruments and record prices`.

### Task 3: Price feeds (A62)

**Files:** `internal/marketdata/internal/feed/{ptax.go,cotahist.go,feed.go}`, `internal/marketdata/internal/feed/{ptax_test.go,cotahist_test.go}`, `internal/marketdata/internal/feed/testdata/{ptax_usd.json,COTAHIST_D29102026.TXT}`, `internal/marketdata/{feeds.go,feeds_test.go}`, `internal/platform/config/{config.go,config_test.go}` (`EQUORI_PRICE_FEEDS`, `EQUORI_BCB_PTAX_URL`, `EQUORI_B3_COTAHIST_URL`), `internal/server/server.go` (`App.Marketdata`, feed config), `cmd/equori/main.go` (`RunFeeds(ctx, 6*time.Hour)`), `docs/operations/price-feeds.md`.

```go
// feed/feed.go: the anti-corruption layer returns marketdata prices only.
type Quote struct{ Instrument, Quote string; Date time.Time; Value money.Rate }
var ErrNoData = errors.New("no data") // 404 or an empty result: the day stores nothing
type Source interface {
	Name() string // bcb_ptax, b3_cotahist
	Fetch(ctx context.Context, codes []string, day time.Time) ([]Quote, error)
}
func NewPTAX(c *http.Client, baseURL string) Source
func NewCOTAHIST(c *http.Client, baseURL string) Source // archive/zip; 245-byte records; PREULT at bytes 109–121
// feeds.go
func (m *Module) TickFeeds(ctx context.Context)                            // A62 window per enabled source, logs failures by source and day
func (m *Module) RunFeeds(ctx context.Context, interval time.Duration)      // ticks now, then every interval
```

`bcb_ptax` requests one period per currency for the whole window; `b3_cotahist` requests one file per weekday of the window. The testdata TXT holds a header, the MXRF11 and PETR4 `01` records of 2026-10-29 with `TPMERC` `010`, one `020` record and the trailer; the tests compress it with `archive/zip`, so no binary file enters the repository.

**Tests:** PTAX parsing keeps only `Fechamento` and uses `cotacaoVenda`; COTAHIST parsing gives MXRF11 9.36 and skips `TPMERC` `020` and undefined tickers; with feeds unset `TickFeeds` sends no request (N17, request counter on the `httptest` server); with both feeds and Today 2026-11-01, the first tick requests from 2026-10-02 and stores the prices; a second tick requests from the day after the latest stored date; Review Focus 4: a 404 day stores nothing and a later day still stores; a 500 ends that source's run, the log names the source and day, the next tick retries it; a truncated ZIP and a line of 200 bytes store nothing for the day; a currency answered with an empty `value` list does not stop the next currency; a `manual` price on the same date stays chosen; `config` rejects an unknown feed name.

Commit `feat(marketdata): fetch prices from BCB PTAX and B3`.

## Slice B (Tasks 4–6)

### Task 4: Security accounts and original amounts (A58, A63, A64)

**Files:** `internal/ledger/internal/domain/{account.go,transaction.go,errors.go}`, `internal/ledger/internal/domain/{account_test.go,transaction_test.go}`, `internal/ledger/internal/app/{ports.go,service.go,balances.go}`, `internal/ledger/internal/adapter/postgres/mapping.go`, `internal/ledger/internal/adapter/httpapi/{convert.go,errors.go}`, `internal/ledger/ledger.go`, `internal/reporting/…` (series of a mixed parent), `api/openapi.yaml` (code `mixed_instruments`), `internal/ledger/{securities_test.go,schema_test.go}`, `internal/reporting/reporting_test.go`.

```go
// domain/account.go
type Account struct{ /* existing fields */ Scale int } // the instrument scale, set by the app from marketdata
func (a Account) HoldsSecurity() bool
// app/ports.go
type Instruments interface{ Instrument(ctx context.Context, code string) (marketdata.Instrument, error) }
// ledger.go: Module keeps the scales it has resolved (instrument scale is immutable, A59); no package-level state.
var ErrMixedInstruments = errors.New("mixed instruments")
```

Every place that builds a posting amount from a row (`mapping.go`) uses `money.NewOf` with the account scale.

**Tests:** XP (brokerage, BRL) with children XP cash (BRL) and XP MXRF11 (`currency` `MXRF11`) → 201; a MXRF11 account that is not a child of a brokerage parent → 422 on `currency`; a PETR4 child of a USD brokerage parent → 422 on `currency`; a transaction moving 150 MXRF11 with weight 1,512.40 reads back `{"amount": 150, "currency": "MXRF11"}`; `original` in the account currency, with the opposite sign, or in MXRF11 → 422 on `postings[0].original`; Review Focus 5: balance of XP → 422 `mixed_instruments`, `GET /reports/balances` for XP → 422 `mixed_instruments`; balance of XP cash unchanged.

Commit `feat(ledger): hold securities in brokerage accounts`.

### Task 5: Valued balances, foreign purchases and exchanges (A65, A66, A67)

**Files:** `internal/ledger/internal/{app/currency.go,adapter/httpapi/currency.go}`, `internal/ledger/internal/app/{ports.go,balances.go}`, `internal/ledger/ledger.go` (`Prices` port wiring), `api/openapi.yaml` (`/foreign-purchases`, `/exchanges`; `value_in` on `/accounts/{id}/balance`; `Balance.value`, `Balance.prices`), `internal/ledger/{currency_test.go,scenarios_test.go}`.

```go
// app/ports.go
type Prices interface{ Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (marketdata.Conversion, error) }
// app/currency.go
type ForeignPurchase struct{ AccountID, CategoryID, PayeeID, IOFCategoryID uuid.UUID; Date time.Time; Description string; Original money.Money; Rate money.Rate; IOFRateBP int; Statement *domain.ReferenceMonth }
type Exchange struct{ FromAccountID, ToAccountID, FeeCategoryID uuid.UUID; Date time.Time; Description string; FromAmount, ToAmount money.Money; Fee *money.Money }
func (s *Service) RecordForeignPurchase(ctx context.Context, userID int64, in ForeignPurchase) (domain.Transaction, error)
func (s *Service) Exchange(ctx context.Context, userID int64, in Exchange) (domain.Transaction, error)
func (s *Service) ValuedBalance(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, basis Basis, in money.Currency) (Balance, marketdata.Conversion, error)
```

**Tests:** S16 (`TestS16ForeignPurchase`): four postings and statement 2026-11 as chapter 6; `iof_rate_bp` 0 → two postings; a USD account as `account_id` → 422 `currency_unsupported` on `account_id`; S17 (`TestS17CurrencyExchange`) with the valued balance; selling 1,000.00 USD for 5,400.00 BRL with fee 30.00 → Nubank +5,370.00, Fees +30.00, Wise −1,000.00 USD weight −5,400.00; USD to EUR → 422 `currency_unsupported` on `to_account_id`; same currency on both sides → 422 on `to_account_id`; `value_in` without any USD/BRL price → 422 `price_missing`; a valued balance of XP (mixed parent) sums cash and MXRF11 at the MXRF11 price.

Commit `feat(ledger): foreign purchases, exchanges and valued balances`.

### Task 6: Trades (A68, A69)

**Files:** `db/migrations/00022_ledger_investments.sql`, `db/queries/ledger/investment.sql`, `internal/ledger/internal/{domain/trade.go,app/trades.go,adapter/postgres/investment.go,adapter/httpapi/trades.go}`, `internal/ledger/internal/app/service.go` (A69 checks on record, correct and void), `internal/ledger/ledger.go` (`InvestmentFacts`), `api/openapi.yaml` (`/trades`; `Transaction.trade`; codes `later_sale_exists`, `investment_transaction`), `internal/ledger/internal/domain/trade_test.go`, `internal/ledger/{trades_test.go,scenarios_test.go,schema_test.go}`.

**Tables:** `ledger_trade (transaction_id, user_id, account_id, cash_account_id, side IN ('buy','sell'), quantity bigint > 0, unit_price numeric(30,12) > 0, gross bigint, fees bigint >= 0, taxes bigint >= 0, cost bigint, currency text)`, `PRIMARY KEY (transaction_id)`, composite FKs `(user_id, transaction_id)` → `ledger_transaction`, `(user_id, account_id)` and `(user_id, cash_account_id)` → `ledger_account`, `CHECK ((side = 'sell') = (cost IS NOT NULL))`, `CHECK (side = 'sell' OR taxes = 0)`; index `(account_id, side)`.

```go
// domain/trade.go
type Side string // buy, sell
type Trade struct{ AccountID, CashAccountID, TaxesCategoryID uuid.UUID; Side Side; Date time.Time; Quantity money.Money; UnitPrice money.Rate; Fees, Taxes money.Money; Description string }
type Holding struct{ Quantity, CostBasis money.Money } // sums of amounts and weights of the security account up to the trade date
func BuildTrade(t Trade, h Holding, roles SystemAccounts) (Transaction, TradeDetail, error) // A68 postings and cost
// ledger.go
type InvestmentFacts struct{ Accounts []AccountFact; Postings []PostingFact; Trades []TradeFact; Incomes []IncomeFact }
func (m *Module) InvestmentFacts(ctx context.Context, userID int64, brokerageID uuid.UUID) (InvestmentFacts, error)
```

`RecordTrade` locks the security account row (`SELECT … FOR UPDATE`) before reading the holding, so two sales of one account serialize.

**Tests (domain, table-driven):** S21 buy and sell postings; full sale gives cost = basis; sale of 1 of 3 units with basis 10.00 gives cost 3.33; loss posts to `realized_losses`; result 0 has no result posting. **API:** S21 (`TestS21PurchaseAndSale`); Review Focus 2: sell 100 on 2026-10-21 after S21 → XP MXRF11 balance 0 and weight sum 0.00, a new buy of 10 at 9.00 has basis 90.00; sell 101 → 422 on `quantity`; `taxes` on a buy → 422 on `taxes`; cash account of another brokerage → 422 on `cash_account_id`; Review Focus 1: a buy dated 2026-10-15, a void of the 2026-10-05 buy and a generic transaction on XP MXRF11 dated 2026-10-20 → each 409 `later_sale_exists`, realized result still 33.77; `PUT /transactions/{sale}` → 409 `investment_transaction`; voiding the sale itself is accepted; schema test: a `sell` row without `cost` rejected.

Commit `feat(ledger): record trades at average cost`.

## Slice C (Tasks 7–9)

### Task 7: Investment income (A70)

**Files:** `db/migrations/00023_ledger_investment_income.sql`, `db/queries/ledger/investment.sql`, `internal/ledger/internal/{domain/income.go,app/income.go,adapter/httpapi/income.go}`, `api/openapi.yaml` (`/investment-income`; `Transaction.investment_income`), `internal/ledger/internal/domain/income_test.go`, `internal/ledger/{income_test.go,scenarios_test.go}`.

**Table:** `ledger_investment_income (transaction_id, user_id, account_id, cash_account_id, income_type IN ('dividend','jcp','interest','coupon'), gross bigint > 0, withheld bigint >= 0, currency text)`, `PRIMARY KEY (transaction_id)`, composite FKs as `ledger_trade`, `CHECK (withheld < gross)`.

```go
type IncomeType string // dividend, jcp, interest, coupon
type Income struct{ AccountID, CashAccountID, CategoryID, WithheldCategoryID uuid.UUID; Type IncomeType; Date time.Time; Gross money.Money; Withheld *money.Money; Description string }
func BuildIncome(in Income, roles SystemAccounts) (Transaction, IncomeDetail, error)
func (s *Service) RecordIncome(ctx context.Context, userID int64, in Income) (domain.Transaction, error)
```

**Tests:** S22 (`TestS22InvestmentIncome`) with the JCP default 6.75; `withheld` 0.00 on a JCP is kept; `withheld` ≥ `gross` → 422 on `withheld`; an expense category as `category_id` → 422 on `category_id`; type `amortization` → 400 `invalid_request`; `PUT /transactions/{income}` → 409 `investment_transaction`; `GET /transactions/{id}` shows `investment_income`.

Commit `feat(ledger): record investment income`.

### Task 8: Portfolio (A71)

**Files:** `db/migrations/00024_portfolio.sql`, `db/queries/portfolio/{position.sql,result.sql,income.sql}`, `sqlc.yaml`, `api/openapi.yaml` (tag `portfolio`: `/positions`, `/realized-results`, `/income-events`), `internal/portfolio/internal/adapter/httpapi/oapi-codegen.yaml`, `internal/portfolio/{portfolio.go,positions_test.go,scenarios_test.go,schema_test.go}`, `internal/portfolio/internal/{domain/rebuild.go,domain/rebuild_test.go,app/{ports.go,service.go},adapter/postgres/repository.go,adapter/httpapi/server.go}`, `internal/server/server.go` (`App.Portfolio`), `.golangci.yml` (depguard entry for the module, as for `planning`).

**Tables:** `portfolio_position_day (user_id, account_id, date, quantity bigint, cost_basis bigint)`, `PRIMARY KEY (account_id, date)`; `portfolio_realized_result (user_id, transaction_id PK, account_id, instrument, date, month, quantity, cost, proceeds, result, tax_class)`; `portfolio_income_event (user_id, transaction_id PK, account_id, instrument, date, income_type, tax_treatment IN ('exempt','exclusive'), gross, withheld)`; FKs `(user_id, account_id)` → `ledger_account`; `portfolio_processed_event (event_id PK, processed_at)`.

```go
// portfolio.go
func New(pool *pgxpool.Pool, dispatcher *outbox.Dispatcher, l *ledger.Module, md *marketdata.Module, clk clock.Clock, log *slog.Logger) *Module
func (m *Module) RegisterRoutes(mux *http.ServeMux)
// domain/rebuild.go: pure, from ledger.InvestmentFacts of one brokerage parent.
type Rebuilt struct{ Days []PositionDay; Results []RealizedResult; Incomes []IncomeEvent }
func Rebuild(f Facts) Rebuilt
type Position struct{ AccountID uuid.UUID; Instrument money.Currency; Quantity, CostBasis money.Money; AverageCost money.Rate; Price *marketdata.Price; MarketValue *money.Money }
func (s *Service) Positions(ctx context.Context, userID int64, date time.Time) ([]Position, error)
```

The handler returns at once when no `account_ids` entry has a brokerage parent; otherwise it rebuilds each affected parent inside the dispatcher transaction (delete and insert by `account_id`).

**Tests:** S64 (`TestS64PositionAndRealizedResult`) and S65 (`TestS65IncomeEvents`); `Rebuild` table tests: two buys on one day give one position row; a voided sale disappears from results after its event; positions at a date before the first trade are empty; a position without any MXRF11 price has no `price` and no `market_value`; a full sale leaves a row with quantity 0 and is not listed by `GET /positions`; `h.Dispatch()` twice leaves the same rows; another user's brokerage is never listed; `year` 1999 → 422 on `year`.

Commit `feat(portfolio): positions, realized results and income events`.

### Task 9: Multi-currency planning (A72)

**Files:** `internal/planning/internal/app/{schedules.go,commitments.go,goals.go,ports.go}`, `internal/planning/planning.go` (`Prices` port), `internal/planning/{schedules_test.go,views_test.go,goals_test.go,scenarios_test.go}`, `api/openapi.yaml` (`Committed.prices`, `Goal.prices`).

```go
// app/ports.go
type Prices interface{ Convert(ctx context.Context, q money.Money, to money.Currency, date time.Time) (marketdata.Conversion, error) }
type Committed struct{ Month time.Time; Installments, Occurrences, Total money.Money; Prices []marketdata.Price }
```

**Tests:** S66 (`TestS66ForeignSubscriptionCommitted`) and S67 (`TestS67GoalInForeignCurrency`); a USD rent schedule on Wise USD generates occurrences in USD and is realized by a matching USD transaction; a transfer schedule from Nubank checking to Wise USD → 422 `currency_unsupported` on `counterpart_id`; a schedule on XP MXRF11 → 422 `currency_unsupported` on `account_id`; a projection of Wise USD is in USD; commitments with a USD occurrence and no price → 422 `price_missing`; the earlier test that expected 422 `currency_unsupported` for a USD account changes with A72 named in the commit body.

Commit `feat(planning): schedules and goals in any currency`.

## Slice D (Task 10)

### Task 10: Documentation and closing

- Chapters 1 (D1 status), 3 (F9 rows with A66–A70, events), 4 (4.3.5 events and calls of A71, 4.3.6 commands, queries and feeds of A59–A62), 5 (5.1 `Money` of A58, 5.2.2 brokerage children of A63, 5.2.3 `original` of A64, 5.6 price priority), 6 (S16, S17, S21, S22 test names, 6.17 S64–S67, coverage line), 7 (7.4 marketdata, ledger investment and portfolio tables of this plan), 8 (N17 verification line with the feeds), 9 (P8 row, 9.3 next step P9 and the web interface track); P7 plan note that A72 lifts A47; README status line; `docs/operations/price-feeds.md` reviewed.
- `make check`, self-review against Review Focus, merge `--ff-only` into `main`, push, CI green, checkpoint, domain book republished.

Commit `docs: describe currencies and investments`.

**Exit criterion: S16, S17, S21, S22 and S64–S67 pass through the HTTP API; trades and income store every D1 datum (date, quantity, unit price, fees, taxes, income type, withheld amount, cost at average cost); every new `Problem.code` has an API test; with `EQUORI_PRICE_FEEDS` unset the application sends no feed request.**
