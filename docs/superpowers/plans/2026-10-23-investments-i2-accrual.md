# Investments I2: fixed income accrual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `fixed_income` instrument with terms gets a daily price computed from an index series, stored as a price with source `accrual`.

**Architecture:** Market data stores the terms of an instrument and the period rates of an index. An `IndexSource` extension point (ADR 016) fetches the rates; `br_cdi` and `br_ipca` read BCB SGS series 12 and 433. A pure function turns terms and rates into a price; a job in the existing feed loop stores the prices after the latest one stored.

**Tech Stack:** Go, PostgreSQL (goose, sqlc), oapi-codegen, `internal/apitest`, `math/big`.

**Spec:** `docs/superpowers/specs/2026-10-23-investments-design.md`, section 4.2 (slice I2). Refinements recorded here and in the spec: the index series stores period rates, not cumulative levels, because a percent of an index (110% of CDI) applies to each period's rate; `bus252` is accepted with the `cdi` index only, every other terms use `act365`.

## Global Constraints

- No `float64` holds a price, a rate or an amount; accrual runs in `math/big` with 256-bit mantissas and the stored price has at most 12 decimals, rounded half to even (ADR 005, AG2).
- A price of a higher priority (`manual` 1, `csv` 2) still wins; `accrual` takes priority 3 like the feeds (A60).
- An index identifier matches `^[a-z0-9_]{2,40}$` in the column, the registry and the contract (ADR 016, X7 to X9); the sources are enabled by `EQUORI_INDEX_FEEDS` and an unknown identifier stops the process naming the variable (X6); URLs are overridden by `EQUORI_FEED_<ID>_URL`.
- Two implementations prove the extension point: `br_cdi` and `br_ipca`, tested through a fake BCB server (X10).
- `Price.source` in the contract becomes `pattern: "^[a-z0-9_]{2,40}$"` (X9): the enum already lags the feeds.
- Terms exist only for instruments of type `fixed_income`; marketdata tables are instance-wide.
- Do not edit existing price, instrument or feed scenarios.
- Commits are deferred while the index holds another session's work.

## Review Focus

- A matured instrument: no price after `matures_on`; the last price repeats through `Convert`.
- A day with no published rate (today, before the 18:00 publication): the price is computed up to the last published day.
- An index series with a gap: the missing business day is not invented; the price skips it.
- Terms changed after prices were stored: the next tick recomputes from `issued_on` and upserts only dates after the latest `accrual` price; a changed `face_value` is applied by deleting the instrument's `accrual` prices in the same transaction as the terms update.
- `percent_of_index_bp` of 10000 and `spread_bp` of 0 equal the plain index factor.

---

### Task 1: Terms

**Files:**
- Create: `db/migrations/00054_marketdata_fixed_income_terms.sql`, `db/queries/marketdata/terms.sql`, `internal/marketdata/internal/domain/terms.go`, `internal/marketdata/terms.go`, `internal/marketdata/internal/adapter/httpapi/terms.go`, `internal/marketdata/terms_test.go`
- Modify: `api/openapi.yaml` (`PUT` and `GET /instruments/{code}/terms`, `FixedIncomeTerms`, `Price.source` pattern), `internal/server/tool_exposure_test.go` (`putInstrumentTerms: "-write"`, `getInstrumentTerms: "-pending"`), `web/src/features/admin/operations.ts`

**Interfaces:**
- Produces: `domain.Terms{IssuedOn, MaturesOn time.Time; IndexID string; PercentOfIndexBP, SpreadBP int; DayCount string; FaceValue int64}` with `Validate() error`; `Module.PutTerms(ctx, code, Terms) (Terms, error)`, `Module.Terms(ctx, code) (Terms, error)` (`ErrNotFound` when none).

- [ ] **Step 1: Write the failing tests** in `terms_test.go`: `TestInstrumentTerms` puts terms on a `fixed_income` instrument (`issued_on` 2026-01-02, `matures_on` 2028-01-02, `index_id` `cdi`, `percent_of_index_bp` 11000, `spread_bp` 0, `day_count` `bus252`, `face_value` 100000), reads them back, replaces them with new values, and gets 404 for an instrument without terms. `TestInstrumentTermsErrors` (S125): terms on a `stock` are 422 `validation_failed` on `code`; `matures_on` not after `issued_on`, a `face_value` of zero, a `percent_of_index_bp` of zero, a negative `spread_bp`, an `index_id` outside the pattern, `bus252` with `index_id` `ipca` or without index are rejected with the field name. A schema test violates each `CHECK` with direct SQL.
- [ ] **Step 2: Run** `go test ./internal/marketdata -run Terms`. Expected: FAIL.
- [ ] **Step 3: Implement.** Table `marketdata_fixed_income_terms (instrument_code text PRIMARY KEY REFERENCES marketdata_instrument(code), issued_on date NOT NULL, matures_on date NOT NULL CHECK (matures_on > issued_on), index_id text CHECK (index_id IS NULL OR index_id ~ '^[a-z0-9_]{2,40}$'), percent_of_index_bp int NOT NULL DEFAULT 10000 CHECK (percent_of_index_bp > 0), spread_bp int NOT NULL DEFAULT 0 CHECK (spread_bp >= 0), day_count text NOT NULL CHECK (day_count IN ('bus252', 'act365')), face_value bigint NOT NULL CHECK (face_value > 0), CHECK (day_count = 'act365' OR index_id = 'cdi'))`. The contract schema `FixedIncomeTerms` carries the same fields; `percent_of_index_bp` and `spread_bp` default as above when omitted.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 2: Index rates and sources

**Files:**
- Create: `db/migrations/00056_marketdata_index_rate.sql`, `db/queries/marketdata/index.sql`, `internal/marketdata/internal/index/index.go` (`Source`, `Rate`), `internal/marketdata/internal/index/brsgs/brsgs.go` (shared SGS client), `internal/marketdata/internal/index/brsgs/cdi.go`, `internal/marketdata/internal/index/brsgs/ipca.go`, `internal/marketdata/indexes.go`, `internal/marketdata/indexes_test.go`
- Modify: `internal/marketdata/marketdata.go` (module field), `internal/platform/config/config.go` (`IndexFeeds`), `internal/server/server.go` (`Config.IndexFeeds`), `cmd/equori/main.go` (pass it; URL overrides by `EQUORI_FEED_<ID>_URL`), `internal/apitest/apitest.go` (`IndexFeeds(ids, urls)` option), `docs/operations/` note on `EQUORI_INDEX_FEEDS`

**Interfaces:**
- Produces: `index.Source` with `ID() string` and `Fetch(ctx, from, to time.Time) ([]Rate, error)`; `index.Rate{Date time.Time; Value string}` (decimal fraction, up to 12 decimals); `marketdata.IndexSourceIDs() []string` (`br_cdi`, `br_ipca`); `marketdata.NewIndexSources(ids, urls, hc) ([]index.Source, error)`; `Module.TickIndexes(ctx)`.

- [ ] **Step 1: Write the failing tests** in `indexes_test.go` with a fake BCB server answering `/dados/serie/bcdata.sgs.12/dados` and `.433/dados` with the SGS JSON (`[{"data":"05/01/2026","valor":"0.055131"}]`, dates `dd/MM/yyyy`, values in percent): `TestIndexFeeds` ticks with `br_cdi` and `br_ipca` enabled and asserts the stored rates through a read of the table by SQL (`rate` 0.00055131), the request URLs (from the day after the latest stored rate, never earlier than 400 days back for the first fetch), a second tick fetching only new days, an unknown id in `NewIndexSources` returning an error naming `EQUORI_INDEX_FEEDS` and the id, and a 500 answer logged and retried on the next tick.
- [ ] **Step 2: Run** `go test ./internal/marketdata -run IndexFeeds`. Expected: FAIL.
- [ ] **Step 3: Implement** the table `marketdata_index_rate (index_id text CHECK pattern, date date, rate numeric(20,12) NOT NULL CHECK (rate > -1), source text NOT NULL CHECK pattern, PRIMARY KEY (index_id, date))`, the sources and the tick (first fetch window 400 days, then from the day after the latest rate, upsert).
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 3: Accrual function

**Files:**
- Create: `internal/marketdata/internal/domain/accrual.go`, `internal/marketdata/internal/domain/accrual_test.go`

**Interfaces:**
- Consumes: `domain.Terms` (Task 1), rates as `[]domain.IndexRate{Date time.Time; Rate string}` sorted by date.
- Produces: `func Accrue(t Terms, quoteScale int, rates []IndexRate, from, to time.Time) ([]DatedPrice, error)` with `DatedPrice{Date time.Time; Value string}`: the prices of the days after `from` up to `to` (and `matures_on`), `Value` a decimal with at most 12 decimals.

- [ ] **Step 1: Write the failing tests:** the plain index factor (`percent` 10000, `spread` 0, one rate of 0.00055131 on a Monday and the next four business days gives `1000 × 1.00055131^5` rounded to 12 decimals, the expected string computed independently with Python `decimal`); 110% of CDI; a spread of 600 bp with `act365` over 58 days; IPCA applied as a step at each month end; no index (pre-fixed); a price skipped for a missing business day; `to` after `matures_on` stopping at maturity; empty rates for an index series returning nothing after `from`.
- [ ] **Step 2: Run** `go test ./internal/marketdata/internal/domain -run Accrue`. Expected: FAIL.
- [ ] **Step 3: Implement** with `big.Float` at 256 bits: daily spread factor as the 252nd (`bus252`) or 365th (`act365`) root of `1 + spread` by Newton's method, raised to the integer count of days; CDI factor the product of `1 + rate × percent` over the rate dates in `(issued_on, d]`; IPCA factor the product of `1 + rate` over the months whose last day is on or before `d`; price `face_value / 10^quoteScale × factor`; the date list is the dates with a CDI rate, or the weekdays for the other indexes.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 4: Job and scenarios

**Files:**
- Create: `internal/marketdata/accrual.go`, `internal/marketdata/accrual_test.go`
- Modify: `internal/marketdata/feeds.go` (`TickFeeds` also runs `TickIndexes` and `TickAccrual`), `db/queries/marketdata/price.sql` (latest accrual date per instrument, delete accrual prices of an instrument), `internal/marketdata/terms.go` (a terms update deletes the instrument's accrual prices in the same transaction), `docs/domain/05-domain-model.md`, `docs/domain/06-scenarios.md`

**Interfaces:**
- Consumes: `Accrue` (Task 3), the stored terms and rates (Tasks 1 and 2), `Module.upsert` for prices.
- Produces: `Module.TickAccrual(ctx)`.

- [ ] **Step 1: Write the failing scenarios** in `accrual_test.go`: S123 a CDB at 110% of CDI with a face of 1,000.00 issued on 2026-01-02, clock 2026-01-09, CDI fixture rates for the five business days: `GET /prices?instrument=CDBXPTO` lists the accrual prices with the independently computed values and source `accrual`; a manual price for one of the days replaces it in `GET /positions` (the position of a holding of one unit). S124 a Tesouro IPCA+ with spread 600 bp over the fixture IPCA rates of January and February. A terms update replaces the stored accrual prices on the next tick. A matured instrument stores nothing after `matures_on`.
- [ ] **Step 2: Run** `go test ./internal/marketdata -run 'S123|S124|Accrual'`. Expected: FAIL.
- [ ] **Step 3: Implement** the tick: for each instrument with terms, read the rates of its index from `issued_on`, compute `Accrue` from the latest accrual date to `min(today, matures_on)`, upsert as source `accrual`.
- [ ] **Step 4: Run** `go test ./...` and `make lint`; add S123 to S125 and amendment A126 to `docs/domain/06-scenarios.md` and the terms and accrual rule to `docs/domain/05-domain-model.md`; update spec section 4.2 with the refinements named above. Expected: PASS.
