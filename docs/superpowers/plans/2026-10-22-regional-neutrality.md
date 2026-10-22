# Regional Neutrality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the universal core of equori from its Brazilian implementations behind module-owned extension points, so a region is added by implementations, registry entries and settings.

**Architecture:** Each regional concern is an interface or data table owned by the consuming module, with an immutable `registry.Registry[T]` built in the module root and selected by the composition root (ADR 015, written in Task 1). Standard identifiers (ISO 4217, ISO 3166-1, ISO 10383, ISO 9362, BCP 47, IANA charsets) replace Brazilian literals. User settings `language` and `region` drive regional defaults for new records.

**Tech Stack:** Go (stdlib, `golang.org/x/text` via ADR 016), PostgreSQL with goose and sqlc, oapi-codegen, React with TypeScript and Intl.

**Spec:** `docs/superpowers/specs/2026-10-22-regional-neutrality-design.md`

## Global Constraints

- Every schema change is a new goose migration; applied migrations are never edited. Migration numbers in this plan are indicative; each task takes the next free number at execution time.
- Identifier columns of extension points: `CHECK (col ~ '^[a-z0-9_]{2,40}$')`; contract: `type: string, pattern: ^[a-z0-9_]{2,40}$`.
- No `init()` registration and no package-level mutable registry.
- A module never imports another module's `internal/` package.
- `make check-commit` passes before every commit; `make check` passes at the end of each phase.
- A new or changed operation in `api/openapi.yaml` updates `internal/server/tool_exposure_test.go`.
- Each new `Problem.code` has a test through `internal/apitest`.
- Commits follow Conventional Commits with module scope; no AI tool attribution.
- Execution runs in slices of at most three tasks with a checkpoint in `.claude/progress/current.md`.
- `make gen` after editing `db/queries`, `db/migrations` or `api/openapi.yaml`.

## Review Focus

1. A user who changes region after creating cards and schedules: existing records keep their calendar and foreign charge rate; only new records take the new default. Pinned in Task 9 and Task 15.
2. A currency with three decimals (`KWD`) or none (`JPY`) through the web formatter and parser. Pinned in Task 24.
3. A CSV file with a UTF-8 BOM under a profile declaring `windows-1252`: the BOM wins and the file decodes as UTF-8. Pinned in Task 19.
4. A conversion whose only path uses an intermediate price 200 days older than the other leg: the conversion succeeds and returns both prices, so the client can show their dates. Pinned in Task 12.
5. A formatting tag that Intl does not know as a pair (`pt-AO`, `en-DE`): formatting succeeds with Intl's fallback and never throws. Pinned in Task 24.

---

## Phase A: Foundations

### Task 1: ADR 015, ADR 016 and the generic registry

**Files:**
- Create: `docs/adr/015-regional-extension-points.md` (sections 4.1–4.4 of the spec as Context, Decision, Consequences)
- Create: `docs/adr/016-golang-x-text.md` (packages listed in spec 4.1)
- Create: `internal/platform/registry/registry.go`
- Test: `internal/platform/registry/registry_test.go`

**Interfaces:**
- Produces:
  - `type Entry[T any] struct { ID string; Value T }`
  - `func New[T any](kind string, entries ...Entry[T]) (Registry[T], error)`
  - `func (r Registry[T]) Get(id string) (T, error)` returning an error wrapping `ErrUnknown` with `kind` and `id` in the message
  - `func (r Registry[T]) IDs() []string` ascending
  - `var ErrUnknown = errors.New("unknown")`
  - `const IDPattern = "^[a-z0-9_]{2,40}$"`

- [ ] **Step 1: Write the failing test** `TestRegistry` table cases: duplicate id `"br_banking"` twice → error containing `duplicate`; id `"BR"` → error containing `must match ^[a-z0-9_]{2,40}$`; `Get("missing")` → `errors.Is(err, registry.ErrUnknown)` and message `unknown calendar "missing"` for kind `calendar`; `IDs()` of `b_x, a_y` → `[]string{"a_y", "b_x"}`.
- [ ] **Step 2:** Run `go test ./internal/platform/registry/` → FAIL (package missing).
- [ ] **Step 3:** Implement `registry.go` (a map plus a sorted id slice, both unexported and never mutated after `New`).
- [ ] **Step 4:** Run the test → PASS.
- [ ] **Step 5:** Write both ADRs. Add `golang.org/x/text` to `go.mod` at the latest release with `go get golang.org/x/text@latest`; record the version in ADR 016.
- [ ] **Step 6:** `make check-commit`, then commit `feat(platform): add registry for regional extension points`.

### Task 2: Text folding

**Files:**
- Create: `internal/platform/textfold/textfold.go`
- Test: `internal/platform/textfold/textfold_test.go`
- Modify: `internal/classification/internal/domain/text.go` (delete `latinFold`, `fold`; `Normalize` calls `textfold.String`)
- Modify: `internal/capture/internal/domain/text.go` (same)
- Modify: `internal/ingestion/internal/domain/match.go:246-266` (delete `fold`, `unaccented`; use `textfold.Rune`)
- Modify: `.golangci.yml` depguard: allow `internal/platform/textfold` and `golang.org/x/text` in `domain`
- Modify: `internal/ledger/internal/domain/transaction.go:241-252` (tags: `unicode.ToLower`, letters and digits of any script plus `-`)
- Create: `db/migrations/00038_ledger_tag_unicode.sql` (replace the `ledger_tag.name` pattern check with `CHECK (length(name) BETWEEN 1 AND 60 AND name !~ '\s')`)
- Test: `internal/ledger/transaction_search_test.go` or the existing tag test file, `internal/ledger/schema_test.go`

**Interfaces:**
- Produces: `func String(s string) string` (folds every rune, no whitespace change); `func Rune(r rune) []rune`

- [ ] **Step 1: Write the failing tests.** `TestLatinRangeMatchesLegacyTable`: copy the current `latinFold` string from `classification/internal/domain/text.go` into the test as `legacy`; for each `r` in U+00C0–U+017F assert `String(string(r)) == string(legacy[r-0xC0])`. `TestScripts`: `String("Ș")=="s"`, `String("Ệ")=="e"`, `String("Й")=="й"`, `String("Ά")=="ά"`, `String("ÆON")=="æon"`.
- [ ] **Step 2:** Run `go test ./internal/platform/textfold/` → FAIL.
- [ ] **Step 3:** Implement with `unicode.Is(unicode.Latin, r)` → `norm.NFD`, `runes.Remove(runes.In(unicode.Mn))`, `unicode.ToLower`, `norm.NFC`; others `unicode.ToLower`. Runes outside the legacy table's decomposition behavior that the legacy test pins (`æ`, `ð`, `þ`, `ß`, `ĳ`, `ĸ`, `ŉ`, `ŋ`, `œ`, `×`, `÷`) map through an explicit unexported table to the legacy value.
- [ ] **Step 4:** Run → PASS. Replace the three call sites. Run `go test ./internal/classification/... ./internal/capture/... ./internal/ingestion/...` → PASS unchanged.
- [ ] **Step 5:** Commit `refactor(platform): fold text in one package for every script`.
- [ ] **Step 6: Write the failing tag tests.** A transaction with tags `["Café", "праздник", "a b"]` stores `["a-b", "café", "праздник"]`; schema test: direct `INSERT` of tag name `'a b'` is rejected.
- [ ] **Step 7:** Run `go test ./internal/ledger/ -run Tag` → FAIL; implement the domain rule and migration; run → PASS.
- [ ] **Step 8:** Commit `feat(ledger): accept tags in any script`.

### Task 3: Locale conventions

**Files:**
- Create: `internal/platform/locale/locale.go`, `internal/platform/locale/regions.go` (ISO 3166-1 alpha-2 officially assigned codes, 249 entries), `internal/platform/locale/conventions.go`
- Test: `internal/platform/locale/locale_test.go`

**Interfaces:**
- Produces:
  - `type Locale struct { Language, Region string }`; `func (l Locale) Tag() string` → `"pt-BR"`
  - `func ValidLanguage(s string) bool` (`^[a-z]{2,3}$`); `func ValidRegion(s string) bool` (in `regions.go`)
  - `type DateOrder string` with `DMY`, `MDY`, `YMD`
  - `type Conventions struct { Decimal, Group rune; Order DateOrder }`
  - `func ConventionsOf(l Locale) Conventions`
  - `func EnglishName(l Locale) string` → `"Portuguese (Brazil)"`; region code alone when the name is absent

- [ ] **Step 1: Write the failing test** `TestConventionsOf`: `{pt,BR}` → `{',', '.', DMY}`; `{en,US}` → `{'.', ',', MDY}`; `{en,GB}` → `{'.', ',', DMY}`; `{de,DE}` → `{',', '.', DMY}`; `{en,ZZ}` → `{'.', ',', YMD}`. `TestEnglishName`: `{pt,BR}` → `Portuguese (Brazil)`; `{en,GB}` → `English (United Kingdom)`; `{pt,AO}` → `Portuguese (AO)`. `TestValidRegion`: `BR` true, `ZZ` false, `BRA` false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; the conventions table holds BR, PT, US, GB, DE, FR, ES, IT, NL, CH (decimal `.`, group `'`), CA, AU, MX, AR with `en-US` as the language override. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(platform): add locale conventions for server-side parsing`.

## Phase B: Currencies

### Task 4: ISO 4217 generated table

**Files:**
- Create: `internal/platform/money/iso4217.xml` (download of `https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml`, committed)
- Create: `internal/platform/money/gen/main.go`
- Create (generated): `internal/platform/money/currency.gen.go`
- Modify: `internal/platform/money/money.go:31-35` (delete `minorUnits` literal; `currency.gen.go` defines `minorUnits` and `currencyNames`)
- Modify: `Makefile` target `gen`: first line `go run ./internal/platform/money/gen`
- Test: `internal/platform/money/money_test.go`, `internal/platform/money/gen/main_test.go`

**Interfaces:**
- Produces: `func Name(c Currency) string` (English `CcyNm`); `Currencies()` unchanged in signature.

- [ ] **Step 1: Write the failing tests.** `TestISOCurrencies`: `ParseCurrency` accepts `EUR` (2), `INR` (2), `KWD` (3), `ISK` (0), `JPY` (0); rejects `XAU`, `CLF` (fund), `XXX`. `TestGeneratorRejectsExponentChange` in `gen`: given a previous table `{"ISK": 0}` and XML with `ISK` exponent 2, `generate` returns an error naming `ISK`.
- [ ] **Step 2:** Run `go test ./internal/platform/money/...` → FAIL.
- [ ] **Step 3:** Implement `gen/main.go` with `encoding/xml`: `func generate(xmlData []byte, previous map[string]int8) ([]byte, error)`; previous is parsed from the existing `currency.gen.go` by reading its map literal lines. Filters per spec 5.1. Output passes `gofmt`.
- [ ] **Step 4:** Run `make gen`, then tests → PASS. `make check-commit`.
- [ ] **Step 5:** Commit `feat(platform): support every ISO 4217 currency`.

### Task 5: Startup reconciliation of currency instruments

**Files:**
- Create: `internal/marketdata/currencies.go`
- Modify: `db/queries/marketdata/instrument.sql` (query `InsertCurrencyIfMissing` with `ON CONFLICT (code) DO NOTHING`)
- Modify: `cmd/equori/main.go` (serve: call before `ListenAndServe`), `internal/apitest/apitest.go` (harness calls it once per database)
- Test: `internal/marketdata/instruments_test.go`

**Interfaces:**
- Produces: `func (m *Module) ReconcileCurrencies(ctx context.Context) error`

- [ ] **Step 1: Write the failing test** `TestReconcileCurrencies`: on a fresh `pgtest.New(t)`, after `ReconcileCurrencies`, `SELECT count(*) FROM marketdata_instrument WHERE instrument_type = 'currency'` equals `len(money.Currencies())`; a row `EUR` whose name was updated to `Custom` keeps `Custom` after a second call.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): reconcile currency instruments at startup`.

## Phase C: Profile and provisioning

### Task 6: User profile (language, region)

**Files:**
- Create: `db/migrations/00038_identity_profile.sql` (`language text NOT NULL DEFAULT 'pt' CHECK (language ~ '^[a-z]{2,3}$')`, `region text NOT NULL DEFAULT 'BR' CHECK (region ~ '^[A-Z]{2}$')`, then `ALTER ... DROP DEFAULT` on both)
- Modify: `db/queries/identity/*.sql`, `internal/identity/internal/domain/user.go`, `internal/identity/internal/app/service.go`, `internal/identity/internal/adapter/httpapi/*`, `internal/identity/identity.go`
- Modify: `api/openapi.yaml` (`GET /profile` → `Profile {language, region}`; `PATCH /profile` with both optional, `additionalProperties: false`)
- Modify: `internal/server/tool_exposure_test.go`
- Test: `internal/identity/profile_test.go`, `internal/identity/schema_test.go`

**Interfaces:**
- Produces: `func (m *Module) Profile(ctx context.Context, userID int64) (locale.Locale, error)`; domain error field `region` message `must be an ISO 3166-1 alpha-2 code`.

- [ ] **Step 1: Write the failing tests.** `TestProfile`: GET returns `{"language":"pt","region":"BR"}` for the harness user; PATCH `{"region":"GB","language":"en"}` → 200 and GET returns them; PATCH `{"region":"ZZ"}` → 422 `validation_failed` field `region`; PATCH `{"region":"bra"}` → 400 `invalid_request`. `TestProfileSchema`: direct `UPDATE identity_user SET language = 'PT'` is rejected.
- [ ] **Step 2–4:** Run → FAIL; implement with `locale.ValidLanguage` and `locale.ValidRegion`; run → PASS.
- [ ] **Step 5:** Commit `feat(identity): store language and region per user`.

### Task 7: Provisioning without a default currency

**Files:**
- Modify: `internal/identity/internal/adapter/postgres/repository.go:37` (`identity.user_created.v2` with `user_id`, `language`, `region`, `base_currency`)
- Modify: `internal/identity/identity.go` (`CreateUser(ctx, email, password, role, Profile{Language, Region, BaseCurrency})`)
- Modify: `cmd/equori/user.go` (flags `--language`, `--region`, `--currency`; usage text)
- Create: `internal/ledger/internal/domain/region_defaults.go` (`func DefaultBaseCurrency(region string) (money.Currency, bool)`: `BR` → `BRL`)
- Modify: `internal/ledger/ledger.go:32-33,200,410-423` (subscribe to v2; delete the constant)
- Create: `db/migrations/00040_planning_schedule_currency.sql` (`ALTER TABLE planning_schedule ALTER COLUMN currency DROP DEFAULT`)
- Modify: `internal/apitest/apitest.go` (`NewUser(t, region, currency string)`; existing helpers use `BR`, `BRL`)
- Test: `internal/ledger/provisioning_test.go`

**Interfaces:**
- Consumes: Task 6 `locale.Locale`.
- Produces: `identity.ErrCurrencyRequired`; `apitest.NewUser`.

- [ ] **Step 1: Write the failing tests.** `TestProvisioning`: user `{region:"DE", currency:"EUR"}` → `GET /settings` `base_currency` `EUR`; user `{region:"BR"}` without currency → `BRL`; `CreateUser` with `{region:"DE"}` without currency → `errors.Is(err, identity.ErrCurrencyRequired)`.
- [ ] **Step 2–4:** Run → FAIL; implement (identity resolves the default by calling a `CurrencyDefault func(region string) (money.Currency, bool)` field of `identity.Config`, wired to `ledger.DefaultBaseCurrency` in `internal/server` and `cmd/equori`); run → PASS.
- [ ] **Step 5:** Commit `feat(identity)!: choose language, region and currency at user creation` with footer `BREAKING CHANGE: equori user create requires --language and --region`.

## Phase D: Market data

### Task 8: Calendar rules and registry

**Files:**
- Create: `internal/marketdata/internal/calendar/calendar.go` (types of spec 5.5), `rule.go` (resolution of `DateRule` and `ObservedRule` for a year), `br_banking.go`, `weekend.go`
- Modify: `internal/marketdata/calendar.go` (resolve through `registry.Registry[calendar.Calendar]`; `ruleHolidays` deleted; `CalendarBRBanking` deleted)
- Create: `internal/marketdata/region_defaults.go` (`func DefaultCalendar(region string) string`: `BR` → `br_banking`, else `weekend`)
- Modify: `api/openapi.yaml` (`GET /calendars` → items `{id, weekend: [weekday]}`), `internal/server/tool_exposure_test.go`
- Test: `internal/marketdata/internal/calendar/rule_test.go`, `internal/marketdata/calendar_test.go`

**Interfaces:**
- Produces: `marketdata.DefaultCalendar`; `marketdata.Calendars() []string`.

- [ ] **Step 1: Write the failing tests.** `TestRules` with a test calendar: `NthWeekday{May, Monday, -1}` in 2026 → `2026-05-25`; `Fixed{July, 4}` with `NearestWeekday` in 2026 → `2026-07-03`; `Fixed{December, 25}` with `NextWorkday` in 2022 → `2022-12-26`; a rule `From: 2024` is absent in 2023. Existing `TestHolidays` for `br_banking` passes unchanged. `TestWeekendCalendar`: `IsBusinessDay("weekend", 2026-04-21)` true, `2026-04-25` false. `GET /calendars` returns `br_banking` and `weekend`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): declare business-day calendars as rule tables`.

### Task 9: Calendar per card and per schedule

**Files:**
- Create: `db/migrations/00040_record_calendar.sql` (`ledger_billing_cycle_rule.calendar DROP DEFAULT` and identifier `CHECK`; `planning_schedule ADD COLUMN calendar text NOT NULL DEFAULT 'br_banking'` with identifier `CHECK`, then `DROP DEFAULT`)
- Modify: `internal/ledger/internal/domain/billing.go:109`, `internal/ledger/internal/app/billing.go` (calendar from request, else `DefaultCalendar(profile.Region)`); Ledger port `Profile`
- Modify: `internal/planning/internal/app/generate.go:12`, `internal/planning/internal/adapter/postgres/repository.go:93`; Planning port `Profile`
- Modify: `api/openapi.yaml` (optional `calendar` on billing cycle rule and schedule bodies; remove `br_banking` from descriptions at line 3907 and its siblings)
- Modify: `internal/server/server.go` (wire `identity.Profile` and `marketdata.DefaultCalendar` into both modules)
- Test: `internal/ledger/card_profile_test.go`, `internal/planning/schedule_calendar_test.go`

- [ ] **Step 1: Write the failing tests.** `TestCardCalendarFromRegion`: BR user card with due day 21 → statement due `2026-04-22` (Tiradentes); DE user (`weekend`) → `2026-04-21`; DE user who then PATCHes region `BR` keeps `weekend` on the existing rule. `TestScheduleBusinessDay`: first business day of 2026-01 for BR user → `2026-01-02`; for DE user → `2026-01-01`. Unknown calendar `"xx_yy"` in the body → 422 field `calendar`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(ledger): take the business-day calendar from the card or the region`.

### Task 10: Price source interface and registry

**Files:**
- Modify: `internal/marketdata/internal/feed/feed.go` (`Source` interface of spec 5.3)
- Move: `feed/ptax.go` → `feed/bcbptax/bcbptax.go`; `feed/cotahist.go` → `feed/b3cotahist/b3cotahist.go` (tests move with them)
- Modify: `internal/marketdata/feeds.go` (`FeedConfig{Sources []feed.Source, Client, Clock, Log}`; one generic `tick(ctx, src)`; delete `tickPTAX`, `tickCOTAHIST`)
- Modify: `internal/marketdata/internal/domain/price.go` (delete `SourceBCBPTAX`, `SourceB3COTAHIST` and their `Priority` cases; `Priority(source string, sources registry)`)
- Modify: `internal/platform/config/config.go` (`PriceFeeds []string`; remove `PTAXFeed`, `COTAHISTFeed`, `PTAXURL`, `COTAHISTURL`; `Getenv func(string) string` kept on `Config` for per-source variables)
- Create: `internal/marketdata/sources.go` (`func NewSources(ids []string, getenv func(string) string, hc *http.Client) ([]feed.Source, error)`; error text `EQUORI_PRICE_FEEDS: unknown feed "x"`)
- Create: `db/migrations/00041_marketdata_price_source.sql` (replace the `source IN (...)` check with the identifier `CHECK`)
- Modify: `docs/operations/price-feeds.md`
- Test: `internal/marketdata/feeds_test.go`, `internal/platform/config/config_test.go`

- [ ] **Step 1: Write the failing tests.** Existing feed tests pass through the generic tick. `TestNewSources`: `["bcb_ptax"]` with `EQUORI_FEED_BCB_PTAX_URL` set to an `httptest` server → the tick fetches only from it; `["nope"]` → error `EQUORI_PRICE_FEEDS: unknown feed "nope"`. Schema test: `INSERT ... source = 'BCB'` rejected.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `refactor(marketdata)!: run price feeds through a source registry` with a `BREAKING CHANGE:` footer naming the renamed variables.

### Task 11: ECB source

**Files:**
- Create: `internal/marketdata/internal/feed/ecb/ecb.go`, `ecb_test.go`, `testdata/eurofxref-hist-90d.xml` (three days, USD and GBP)
- Modify: `internal/marketdata/sources.go` (register `ecb`, default URL `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml`, confirmed before the task starts)

- [ ] **Step 1: Write the failing test** `TestECB`: `Quotes` of instruments `EUR, USD, GBP, BTC(crypto)` → `[GBP USD]`; `Fetch` from the fixture returns `Quote{Instrument:"USD", Quote:"EUR", Date: 2026-10-20, Value: 1.0000/<rate>}` — the file quotes units of currency per EUR, so the stored price of USD in EUR is the inverse with 12 decimals, rounded half to even; a 404 → `feed.ErrNoData`.
- [ ] **Step 2–4:** Run → FAIL; implement with `encoding/xml`; run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): add the ECB reference rates feed`.

### Task 12: Conversion through any intermediate

**Files:**
- Modify: `internal/marketdata/convert.go` (delete `pivot`)
- Modify: `db/queries/marketdata/price.sql` (query `ConversionIntermediates(from, to, date)` returning `code, from_date, to_date` ordered by `least(from_date, to_date) DESC, code`)
- Test: `internal/marketdata/convert_test.go`

- [ ] **Step 1: Write the failing tests.** `TestConvertThroughIntermediate`: prices `USD/EUR` and `GBP/EUR` only → `Convert(100.00 USD → GBP)` uses both and `len(Prices)==2`; intermediates `EUR` (legs dated 2026-10-01) and `BRL` (2026-10-20) → `BRL`; equal dates → `BRL` before `EUR` by code; one leg 200 days older than the other → success with both prices; no intermediate → `ErrPriceMissing`. Existing tests pass.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. Remove `pivot` from `feeds.go` (Task 10's `bcbptax.Quotes` skips `BRL` itself).
- [ ] **Step 5:** Commit `feat(marketdata): convert through any instrument priced against both sides`.

### Task 13: Exchanges as MIC and universal instrument types

**Files:**
- Create: `db/migrations/00042_marketdata_mic_types.sql` (drop the type and exchange checks; `UPDATE` `B3`→`BVMF`, `fii`→`reit`, `bdr`→`depositary_receipt`; new checks: type in the universal list of spec 5.4, `exchange ~ '^[A-Z0-9]{4}$'`)
- Modify: `internal/marketdata/internal/domain/instrument.go` (`SecurityTypes`, exchange rule `must be an ISO 10383 MIC`)
- Modify: `api/openapi.yaml:5441,5458-5483` (enum of types; `exchange` pattern)
- Modify: `internal/marketdata/internal/feed/b3cotahist/b3cotahist.go` (`BVMF`)
- Test: `internal/marketdata/instruments_test.go`, `internal/marketdata/schema_test.go`, migration test after the pattern of `internal/ledger/link_migration_test.go`

- [ ] **Step 1: Write the failing tests.** `POST /instruments` with exchange `B3` → 400; `BVMF` → 201; type `fii` → 400; `reit` → 201. Migration test: a row `(MXRF11, fii, B3)` before `00042` reads `(reit, BVMF)` after.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata)!: identify exchanges by MIC and use universal instrument types`.

## Phase E: Ledger

### Task 14: Institution identifiers

**Files:**
- Create: `db/migrations/00043_ledger_institution_identifier.sql` (add `identifier_scheme`, `identifier`; both null or both set; unique `(user_id, identifier_scheme, identifier)`; move `ispb`; drop `ispb`)
- Create: `internal/ledger/internal/domain/identifier.go` (registry: `br_ispb` `^[0-9]{8}$`, `bic` `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`)
- Modify: `db/queries/ledger/reference.sql`, `internal/ledger/internal/app/service.go`, `ports.go`, `adapter/httpapi/server.go`, `convert.go`, `adapter/postgres/*`
- Modify: `api/openapi.yaml` (`PUT /institutions/{id}/identifier`, `GET /institution-identifier-schemes`; remove the ISPB operation and field), `internal/server/tool_exposure_test.go`
- Test: `internal/ledger/institution_test.go`, `internal/ledger/schema_test.go`

- [ ] **Step 1: Write the failing tests.** PUT `{scheme:"bic", identifier:"BOFAUS3NXXX"}` → 200 and GET shows it; `{scheme:"bic", identifier:"BOFA"}` → 422 field `identifier`; `{scheme:"xx_yy"}` → 422 field `scheme`; a duplicate pair → the conflict code the ISPB endpoint returns today; migration moves `ispb '00360305'` to `('br_ispb','00360305')`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(ledger)!: identify institutions by scheme and identifier`.

### Task 15: Foreign charge

**Files:**
- Create: `db/migrations/00044_ledger_card_foreign_charge.sql` (`ledger_card ADD foreign_charge_bp int NOT NULL DEFAULT 350 CHECK (foreign_charge_bp BETWEEN 0 AND 10000)`, then `DROP DEFAULT`)
- Modify: `internal/ledger/internal/domain/region_defaults.go` (`DefaultForeignChargeBP(region string) int`: `BR` 350, else 0)
- Modify: `internal/ledger/internal/app/currency.go` (delete `DefaultIOFRateBP`; fields `ForeignChargeRateBP *int`, `ForeignChargeCategoryID uuid.UUID`)
- Modify: card creation in `app/card_operations.go`; `api/openapi.yaml:673,6206-6215` and the card schema
- Test: `internal/ledger/currency_test.go`, `internal/ledger/card_profile_test.go`

- [ ] **Step 1: Write the failing tests.** BR user card → `foreign_charge_bp` 350; foreign purchase of 100.00 USD at rate `5.0000` → card charge 500.00 BRL plus foreign charge 17.50 BRL on the given category; DE user card → 0 and no charge posting; explicit `foreign_charge_rate_bp: 100` → 5.00. DE user who PATCHes region `BR` keeps 0 on the existing card.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(ledger)!: model IOF as a per-card foreign charge`.

## Phase F: Portfolio

### Task 16: Tax jurisdictions

**Files:**
- Create: `internal/portfolio/internal/domain/jurisdiction.go` (interface of spec 5.9, universal income types), `internal/portfolio/internal/jurisdiction/br/br.go`, `internal/portfolio/region_defaults.go` (`BR` → `br`)
- Modify: `internal/portfolio/internal/domain/rebuild.go:15-18,128-140` (treatment and tax class through the jurisdiction; null without one)
- Create: `db/migrations/00045_tax_jurisdiction.sql` (income type identifier checks on `ledger_investment_income` and `portfolio_income_event`; `tax_treatment`, `tax_class` nullable with identifier checks)
- Modify: `internal/ledger/internal/domain/income.go:16,46` (format check only; message `must match ^[a-z0-9_]{2,40}$`)
- Modify: `api/openapi.yaml:6029,6169` (patterns; `GET /investment-income-types`), `internal/server/tool_exposure_test.go`
- Modify: `cmd/equori` serve: one-time rebuild of every brokerage when the migration version first appears (use the existing A71 rebuild entry point)
- Test: `internal/portfolio/jurisdiction_test.go`

- [ ] **Step 1: Write the failing tests.** BR user: `dividend` → `exempt`, `jcp` → `exclusive`; sale of a `reit` on `BVMF` → `tax_class` `fii`; `depositary_receipt` on `BVMF` → `bdr`. DE user: `dividend` → `tax_treatment` null, `tax_class` null; `jcp` accepted by Ledger, treatment null. `GET /investment-income-types` for BR → `[coupon distribution dividend interest jcp]`; for DE → without `jcp`. Body `income_type: "Bad!"` → 400.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(portfolio)!: derive tax data through a jurisdiction per region`.

## Phase G: Ingestion and Classification

### Task 17: Aggregator registry and generic credentials

**Files:**
- Modify: `internal/ingestion/internal/app/integration.go:41-58` (add `ID() string`, `CredentialFields() []CredentialField`, `ConnectMethod() string`, `MinSyncInterval() time.Duration`, `State(providerStatus string) domain.ConnectionState`)
- Move: `internal/ingestion/aggregator.go` → `internal/ingestion/internal/aggregator/pluggy/port.go`; `internal/ingestion/internal/pluggy/` → `internal/ingestion/internal/aggregator/pluggy/client/`
- Modify: `internal/ingestion/internal/domain/integration.go:14,39-45` (`Credentials map[string]string`; delete `ProviderPluggy`)
- Modify: `internal/ingestion/internal/app/sync.go:16` (`blockedStatuses` moves into the Pluggy port as its `State` mapping)
- Modify: `internal/platform/config/config.go` (remove `PluggyURL`; `EQUORI_AGGREGATOR_<ID>_URL` read by `ingestion.NewAggregators(getenv, hc, clock)`)
- Modify: `internal/ingestion/ingestion.go:42-64`, `internal/server/server.go`, `cmd/equori/main.go`, `internal/apitest/apitest.go`
- Modify: `docs/operations/pluggy.md`
- Test: `internal/ingestion/connection_test.go`, `internal/ingestion/aggregators_test.go`

**Interfaces:**
- Produces: `type CredentialField struct { Name string; Secret bool }`; `domain.ConnectionState` values `ok`, `needs_owner`, `failed`.

- [ ] **Step 1: Write the failing tests.** Credentials `{client_id:"a"}` without `client_secret` → 422 field `credentials.client_secret`; an unknown member `{x:"1"}` → 422 field `credentials.x`; fake Pluggy status `LOGIN_ERROR` → connection `state` `needs_owner`, `UPDATED` → `ok`; existing sync scenarios pass.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `refactor(ingestion): run aggregators through a registry with declared credentials`.

### Task 18: Contract and schema rename to "aggregator"

**Files:**
- Create: `db/migrations/00046_aggregator_term.sql` (rename `provider` → `aggregator` in `ingestion_integration` and `classification_source_category` with the identifier check; `open_finance` → `aggregator` in `ingestion_batch.source` and `ledger_reconciliation.source` with their checks)
- Modify: `api/openapi.yaml:3157,3226,4333,4371,4406,4455,4463,4716,4879,2891` (`aggregator` pattern; `item_id` → `external_id`; `state` field; `GET /aggregators`), `internal/server/tool_exposure_test.go`
- Modify: `internal/classification/...` (`LineCategory.Aggregator`), `internal/ingestion/ingestion.go:154-158`
- Test: `internal/ingestion/schema_test.go`, `internal/classification/source_category_test.go`, `internal/ingestion/aggregators_test.go`

- [ ] **Step 1: Write the failing tests.** `GET /aggregators` → `[{id:"pluggy", name:"Pluggy", credential_fields:[{name:"client_id",secret:false},{name:"client_secret",secret:true}], connect_method:"reference"}]`; `POST /integrations {aggregator:"plaid"}` → 422 field `aggregator`; batch source `open_finance` rejected by schema; existing scenarios S51–S59 pass under the new names.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `refactor(ingestion)!: name the aggregator field and source consistently`.

### Task 19: File encodings

**Files:**
- Create: `internal/ingestion/internal/charset/registry.go` (names of spec 5.11 mapped to `x/text` decoders)
- Modify: `internal/ingestion/internal/charset/charset.go` (`func Decode(data []byte, name string) (string, error)`; BOM always wins)
- Modify: `internal/ingestion/internal/ofx/ofx.go:26` (header `CHARSET` or XML `encoding` → name, else `auto`)
- Modify: `internal/ingestion/internal/csvfile/csvfile.go:21`, CSV profile domain, queries, `api/openapi.yaml`
- Create: `db/migrations/00047_ingestion_csv_encoding.sql` (`encoding text NOT NULL DEFAULT 'auto'` with check `~ '^[a-z0-9_-]{2,40}$'`)
- Test: `internal/ingestion/internal/charset/charset_test.go`, `internal/ingestion/internal/ofx/ofx_test.go`, `internal/ingestion/profile_test.go`

- [ ] **Step 1: Write the failing tests.** `windows-1251` bytes of `Магазин` decode; `auto` with 1252 bytes of `Café` decodes; UTF-8 BOM under `windows-1252` decodes as UTF-8; OFX `CHARSET:1252` with `é`; OFX XML `encoding="ISO-8859-1"`; profile `encoding:"ebcdic"` → 422 field `encoding`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(ingestion): decode imports by declared encoding`.

### Task 20: Date layouts, group separator and amount reading

**Files:**
- Create: `db/migrations/00048_ingestion_csv_formats.sql` (replace the `date_layout IN` check with the pattern of spec 5.11; add `group_separator` backfilled per spec)
- Modify: `internal/ingestion/internal/domain/profile.go`, `amount.go:9-30`, `api/openapi.yaml:4675,4690`
- Test: `internal/ingestion/internal/domain/amount_test.go`, `profile_test.go`

- [ ] **Step 1: Write the failing tests.** Layout `DD.MM.YYYY` reads `05.11.2026`; `YYYY/MM/DD` reads `2026/11/05`; `DD/DD/YYYY` → 422 field `date_layout`. `MinorUnits` with scale 2: `"€ 1.234,50"` (`,`/`.`) → 123450; `"CHF 1'234.50"` (`.`/`'`) → 123450; `"(12.50)"` → −1250; `"12,50-"` → −1250; `"R$ 10,00"` → 1000; `"USD 10.00"` → 1000; `"10.00 USD"` → 1000.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(ingestion): read CSV dates and amounts by profile conventions`.

## Phase H: Capture

### Task 21: Lexicons and locale-aware reading

**Files:**
- Create: `internal/capture/internal/domain/lexicon.go` (type of spec 5.13, `func Merge(primary, fallback Lexicon) Lexicon`), `lexicon_pt.go`, `lexicon_en.go`
- Modify: `internal/capture/internal/domain/date.go:9-20`, `amount.go:25-48,94-130`, `installments.go:33-62`, `account.go:60-127`, `read.go` (every function that reads words takes `Lexicon` and `locale.Conventions`)
- Modify: `internal/capture/internal/app/service.go` (reads the profile through a `Profile` port; wired in `internal/server`)
- Test: `internal/capture/internal/domain/read_test.go`

- [ ] **Step 1: Write the failing tests.** Existing `pt-BR` cases pass unchanged. `en-US`: `lunch 25.90 05/11` → amount 2590, date `2026-05-11`; `en-GB`: `05/11` → `2026-11-05`; `en-US`: `1,234.50` → 123450; `pt-BR`: `1.234,50` → 123450; `de-DE` (no `de` lexicon): `today 12,50` → today, 1250.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(capture): read text by the user's language and conventions`.

### Task 22: Suggestion prompt by locale

**Files:**
- Modify: `internal/capture/internal/adapter/llmapi/suggester.go:17-22` (`func systemPrompt(l locale.Locale) string`)
- Modify: `docs/adr/014-capture-category-suggestions.md` (L2)
- Test: `internal/capture/internal/adapter/llmapi/suggester_test.go`

- [ ] **Step 1: Write the failing test.** With `llmtest`, the system message for `pt-BR` contains `mostly in Portuguese (Brazil)`; for `en-GB` contains `mostly in English (United Kingdom)`; neither contains `Brazilian owner`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(capture): name the user's language in the suggestion prompt`.

## Phase I: Web

Before each task: read `web/CLAUDE.md` and the Slotted skill it names for the task (compose-screen for Task 27). Report Slotted findings per that file.

### Task 23: Locale registry and profile-driven locale

**Files:**
- Create: `web/src/i18n/locales.ts` (`export const languages = [{ language: "en", nativeName: "English", catalog, slottedCatalog: undefined }, { language: "pt", nativeName: "Português", catalog, slottedCatalog: PT_BR }] as const`; `export type Language`; `export type LocaleTag = string`)
- Modify: `web/src/i18n/locale.ts` (`detectLanguage(languages: readonly string[]): Language` by primary subtag; storage keeps `{language, region}`), `i18n-provider.tsx`, `app/slotted-locale.tsx`, `app/shell/command-menu.tsx:26`, `more-sheet.tsx:43`, `account-menu.tsx:28`
- Modify: `web/src/features/session/` or the settings feature: read `GET /profile`, write `PATCH /profile`
- Test: `web/src/i18n/i18n-provider.test.tsx`, `web/src/i18n/locale.test.ts`

- [ ] **Step 1: Write the failing tests.** `detectLanguage(["pt-PT","en"])` → `pt`; `(["de-DE"])` → `en`; the provider exposes tag `pt-BR` for profile `{pt, BR}` and `en-DE` for `{en, DE}`; changing language in the account menu sends `PATCH /profile {language}`; the three menus render the registry's entries.
- [ ] **Step 2–4:** `cd web && pnpm test -- i18n` → FAIL; implement; → PASS.
- [ ] **Step 5:** `make check-commit`; commit `feat(web): take language and region from the profile`.

### Task 24: Formatting from Intl only

**Files:**
- Modify: `web/src/i18n/format.ts:104-140,183-195`, `web/src/features/accounts/account-card-money.ts:5-7`, `web/src/features/admin/draft.ts:92`
- Test: `web/src/i18n/format.test.ts`

- [ ] **Step 1: Write the failing tests.** Existing expected strings for `pt-BR` and `en` stay. New: `formatMoney({amount:123450,currency:"EUR"},2,"de-DE")` → `"1.234,50 €"`; `parseAmount("1.234,50",2,"de-DE")` → 123450; `parseAmount("1’234.50",2,"de-CH")` → 123450; `formatMoney({amount:1234567,currency:"KWD"},3,"en-US")` → `"KWD 1,234.567"` per Intl output captured in the test; `parseAmount("1,234",0,"ja-JP")` → 1234; `formatDayMonth("2026-10-16","en-GB")` → `"16 Oct"`; formatting with `pt-AO` and `en-DE` does not throw.
- [ ] **Step 2–4:** Run → FAIL; implement (separators and order from `formatToParts`; `draft.ts` passes the active tag); run → PASS.
- [ ] **Step 5:** Commit `refactor(web): derive every number and date format from Intl`.

### Task 25: No currency fallback; locale collation

**Files:**
- Modify: `web/src/features/accounts/import-page.tsx:84`, `candidate-card.tsx:38`, `account-card-preview.tsx:142`, `cards/card-plans.ts:28`, `cards/statement-lines.tsx:92`, `cards/plan-drawer.tsx:94`, `categories/categories-page.tsx:120`, `categories/rule-editor.tsx:99`, `admin/use-admin-context.ts:62`, `admin/operations.ts:661`, `accounts/institution-catalogue.ts:17,22,51`, `accounts/link-candidates.ts:27`
- Test: the co-located `*.test.tsx` of each changed screen

- [ ] **Step 1: Write the failing tests.** Categories page with settings pending renders its waiting state and no amount; with settings `EUR` amounts show `€`; card plan with no installments renders no amount; `institution-catalogue` sorts `["Ålandsbanken","Zeta","Aba"]` with `sv-SE` as `Aba, Zeta, Ålandsbanken`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `fix(web): take currency from data and collate by the active locale`.

### Task 26: Institution identifiers and logo resolvers

**Files:**
- Modify: `web/src/features/accounts/institution-logo.ts` (`resolvers: Record<string, (identifier: string) => string | undefined>`; `br_ispb` → `logos-bancos-br`), `institution-catalogue.ts` (catalogue per scheme; shown when the user's region is `BR` for `br_ispb`), `set-logo-dialog.tsx`, `institution-field.tsx`, `institutions-page.tsx`, `account-avatar.tsx`, `card-tile.tsx`, `use-account-choices.ts`, `api.ts`, catalogs
- Modify: `docs/adr/013-institution-logos.md`
- Test: `institution-logo.test.ts`, `institution-field.test.tsx`, `institutions-page.test.tsx`

- [ ] **Step 1: Write the failing tests.** `resolveLogo({scheme:"br_ispb", identifier:"00360305"})` → the Caixa asset URL; `{scheme:"bic", identifier:"BOFAUS3N"}` → `undefined` and the mark draws the monogram; the set-logo dialog sends `PUT /institutions/{id}/identifier`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Commit `feat(web): resolve institution logos by identifier scheme`.

### Task 27: Aggregator form and regional settings screen

**Files:**
- Modify: the integration form in `web/src/features/connections/` (fields from `GET /aggregators`; secret fields as password inputs)
- Create: a settings destination for language, region (select of `GET /profile`-valid regions from a static ISO 3166-1 list in `web/src/i18n/regions.ts` named with `Intl.DisplayNames`) and base currency
- Test: co-located tests

- [ ] **Step 1: Write the failing tests.** The integration form renders `client_id` as text and `client_secret` as password from a mocked `GET /aggregators`; the settings screen sends `PATCH /profile {region:"PT"}` and shows `Portugal` via `Intl.DisplayNames`; base currency is read-only after the first transaction (409 path shown).
- [ ] **Step 2–4:** Run → FAIL; implement per compose-screen; run → PASS.
- [ ] **Step 5:** Commit `feat(web): configure aggregators and regional settings from the server`.

## Phase J: Documents

### Task 28: Domain documents and contributor checklist

**Files:**
- Modify: `docs/adr/005-cross-cutting-conventions.md`, `docs/domain/01-vision.md` (1.3, T06, G6, D1), `04-contexts.md` (4.3.3, 4.3.5, 4.3.6), `05-domain-model.md` (5.2.3 balancing currency default, 5.6), `08-non-functional-requirements.md` (N21), `09-roadmap.md` (a phase entry for this work)
- Create: `docs/contributing/regions.md` (one row per extension point: interface file, implementation directory, registry constructor, region default file, test file; plus the web files: `i18n/locales.ts`, catalogs, `institution-logo.ts`)

- [ ] **Step 1:** Write the changes; each statement names a file, a type or an identifier introduced in Tasks 1–27.
- [ ] **Step 2:** `grep -rn "br_banking\|BRL\|B3\b\|pluggy" docs/domain docs/adr` → every remaining hit is inside a Brazilian example or the Brazilian implementation row.
- [ ] **Step 3:** `make check`, then commit `docs: describe regional extension points and the region checklist`.
