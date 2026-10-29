# Regional neutrality

Status: draft

## 1. Intent

equori is a self-hosted application whose users may live outside Brazil (chapter 1, 1.3, "Self-hoster"). The code base mixes Brazilian rules, data sources and vocabulary into its universal core. A contributor from another country must currently edit Go code, the HTTP contract and the schema of several modules to add a currency, a holiday calendar, a price source, an exchange, an aggregator, a bank identifier, a tax rule or a language.

This design separates the universal core from regional implementations. After it, Brazil is one regional implementation among others, a contributor adds a region by adding implementations behind declared extension points, and an operator or user selects regional behavior through configuration and settings. The product is pre-release: data, contract and schema change freely in this work, through new migrations.

## 2. Goals, non-goals, anti-goals

| ID | Goal |
|---|---|
| G-R1 | No Brazilian value (currency, calendar, exchange, aggregator, identifier scheme, tax rule, word, locale) is a default or a literal outside a Brazilian implementation unit. |
| G-R2 | Each regional concern is an extension point: one Go interface or one data table owned by the module that consumes it, with an explicit registry. |
| G-R3 | Adding a region needs no edit to the universal core, to existing implementations, or to a `CHECK` constraint. It may add rows to a registry, files to an implementation directory, catalog files to `web/` and enum members to `api/openapi.yaml` where section 4.4 says so. |
| G-R4 | Identifiers come from international standards: ISO 4217 (currencies), ISO 3166-1 alpha-2 (regions), ISO 10383 MIC (exchanges), ISO 9362 BIC (institutions), BCP 47 (languages), IANA character set names (file encodings). |
| G-R5 | Configuration has three levels with one owner each: instance (environment), user (settings), record (attributes of a card, a schedule, a CSV profile). |
| G-R6 | The existing Brazilian behavior is preserved for a user whose region is `BR`. |

| ID | Non-goal |
|---|---|
| NG-R1 | Implementing regions other than Brazil, except the second implementations that section 5 lists to prove the extension points. |
| NG-R2 | A redirect or hosted-link connection flow for aggregators. The extension point declares the flow kind; only the reference flow exists. |
| NG-R3 | Tax reports. Portfolio keeps deriving the data of D1; report generation stays a later feature. |
| NG-R4 | Right-to-left layout. |
| NG-R5 | Changing the instance time zone model of ADR 005. |

| ID | Anti-goal: the work fails if |
|---|---|
| AG-R1 | A regional concern is reached through a `switch` on a region code in universal code. |
| AG-R2 | A registry is a package-level mutable variable or is filled by `init()` (`CONTRIBUTING.md`, "No global mutable state"). |
| AG-R3 | A module imports another module's internal package to register an implementation (ADR 002). |
| AG-R4 | A value list that grows with regions is enforced by a `CHECK (x IN (...))`. |
| AG-R5 | The web formats a number, a date or an amount with a branch on a locale tag. |

## 3. Constraints

- ADR 002: each extension point and its implementations live in the module that owns the concern; the composition root (`internal/server`, `cmd/equori`) selects implementations.
- `CONTRIBUTING.md`: standard library first; a new dependency needs an ADR. Section 4.1 adds one, `golang.org/x/text`, through ADR 017.
- `CONTRIBUTING.md`: applied migrations are never edited. Every schema change is a new goose migration from `00038` on.
- ADR 007, C3: field-shape rules stay declared in the contract. A value set that grows with regions is declared as a `pattern` in the contract and validated by the registry in the domain, which returns 422 `validation_failed` with the field.
- Definition of done, item 5: every new or changed operation keeps its entry in `internal/server/tool_exposure_test.go`.

## 4. Architecture

### 4.1 Extension point pattern

An extension point is declared by the module that consumes it:

| Part | Rule |
|---|---|
| Interface | Declared in the module's `internal/domain` (pure rules) or `internal/app` (I/O), named by behavior (`Calendar`, `PriceSource`, `Aggregator`, `Jurisdiction`, `Lexicon`). |
| Implementation | One package per implementation under `internal/<module>/internal/<point>/<id>/`, for example `internal/marketdata/internal/feed/bcbptax/`. A pure data implementation (a calendar, a lexicon) is a Go value in a file named after its id. |
| Identifier | A lowercase string `^[a-z0-9_]{2,40}$`, prefixed by region when the implementation is regional (`br_banking`, `bcb_ptax`), unprefixed when it is international (`ecb`, `weekend`, `bic`). |
| Registry | A value of type `Registry[T]` built by a constructor in the module root (`marketdata.NewCalendars()`), returning every implementation the module ships. A registry is immutable after construction; `Get(id)` returns the implementation or `ErrUnknown<Point>`. |
| Selection | The instance enables implementations by id through environment variables read in `internal/platform/config` as plain strings; the module validates the ids against its registry at startup and the process exits with the variable name and the unknown id. |
| Schema | A column holding an identifier has `CHECK (col ~ '^[a-z0-9_]{2,40}$')`. The registry, not the schema, holds the value set. |
| Contract | The same field is `type: string, pattern: ^[a-z0-9_]{2,40}$`. A listing endpoint returns the registered values when the web needs them for a form. |
| Proof | Each extension point ships two implementations, or one implementation and a test implementation in its `_test.go` files, exercised through the HTTP API. |

`Registry[T]` is a generic type in `internal/platform/registry` (no business rules): a constructor from a slice of `(id, T)` pairs that rejects duplicate and malformed ids, `Get`, and `IDs` in ascending order.

ADR 016 records this pattern. ADR 017 records the dependency `golang.org/x/text`, used for character set decoding (`encoding/charmap`, `encoding/japanese`, `encoding/simplifiedchinese`, `encoding/korean`, `encoding/traditionalchinese`) and Unicode normalization (`unicode/norm`, `runes`).

### 4.2 Configuration levels

| Level | Owner | Holds | Changed by |
|---|---|---|---|
| Instance | `internal/platform/config` | Enabled price feeds, aggregator base URLs, LLM keys, time zone | Environment variables, restart |
| User | `identity` (language, region); `ledger` (base currency) | `language` (BCP 47 primary language subtag, `^[a-z]{2,3}$`), `region` (ISO 3166-1 alpha-2), `base_currency` (ISO 4217) | `equori user create` flags; `PATCH /me`; `PUT /settings` (base currency, existing rule: until the first transaction) |
| Record | the owning module | Card calendar and foreign charge rate, schedule calendar, CSV profile encoding and formats, institution identifier | The record's own endpoints |

A record attribute that has a regional default receives it at creation from the user's region through the owning module's region defaults (section 4.3). Changing a user's region changes defaults for new records only.

The formatting locale of a user is `language-region` (`pt-BR`, `en-GB`, `en-DE`). The interface language is the catalog that best matches `language`, with English as the fallback.

### 4.3 Region defaults

A region default is a value a module proposes for a new record when the user's region is known. Each module that has region defaults owns a table `regionDefaults` (a Go value in its domain package, keyed by ISO 3166-1 alpha-2) and a fallback row for regions without an entry:

| Module | Default | `BR` | Fallback |
|---|---|---|---|
| `ledger` | base currency at provisioning | `BRL` | required flag at `user create` |
| `ledger` | card foreign charge rate | 350 basis points | 0 |
| `marketdata` | business-day calendar | `br_banking` | `weekend` |
| `portfolio` | tax jurisdiction | `br` | none (no tax treatment derived) |
| `platform/locale` | number and date conventions | decimal `,`, group `.`, order day-month-year | decimal `.`, group `,`, order year-month-day |

`identity` stores `region` only; it holds no defaults.

### 4.4 Contract enum policy

| Value set | Contract |
|---|---|
| Universal and closed (account class, posting status, instrument type, link type) | `enum` |
| Grows with regions (calendar, price source, aggregator, identifier scheme, jurisdiction, income type, tax treatment, encoding) | `pattern` plus a listing endpoint when a form needs the values |
| Standard codes (currency, region, exchange, language) | `pattern` of the standard |

## 5. Decisions per concern

Numbers in brackets are the coupling numbers of the survey of 2026-10-22.

### 5.1 Currencies [1]

- `internal/platform/money` holds the full ISO 4217 List One as generated code: `currency.gen.go`, produced by `go run ./internal/platform/money/gen` from the committed file `internal/platform/money/iso4217.xml` (SIX Group, `list-one.xml`). `make gen` runs it.
- Included: every active entry with a numeric minor unit. Excluded: fund codes (`IsFund="true"`), entries whose minor unit is `N.A.`, and the `X` codes without a country (`XAU`, `XAG`, `XPD`, `XPT`, `XDR`, `XSU`, `XUA`, `XBA`–`XBD`, `XTS`, `XXX`).
- The generator fails when the exponent of a code already present in the committed `currency.gen.go` changes, because stored amounts carry the old scale; that change is a data migration outside this design.
- `marketdata` reconciles `marketdata_instrument` with `money.Currencies()` at startup: it inserts each missing currency with its scale and English name (from the XML `CcyNm`) and never updates or deletes a row. Migration `00038` removes nothing; the startup reconciliation runs before the HTTP server listens.

### 5.2 Conversion [2]

- The constant `pivot` is removed. `Convert` tries, in order: direct price, inverse price, then a two-leg path through an intermediate instrument `X` that has a price (direct or inverse) with both `from` and `to` on or before the date.
- Among several intermediates, the chosen one has the latest older leg date (the minimum of its two leg dates is the greatest), then the lowest code in byte order. One query in `db/queries/marketdata` returns the candidates.
- `Conversion.Prices` keeps returning the prices used (B05). P8 amendment A61 is amended in the domain documents.

### 5.3 Price feeds [3]

```go
// internal/marketdata/internal/feed
type Source interface {
	ID() string                                   // price source id, e.g. "bcb_ptax"
	Codes(ins []Instrument) []money.Currency      // the instrument codes whose prices this source fetches
	Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]Quote, error)
}
```

- `Fetch` returns every quote it read before a failure together with the failure; Market data stores the quotes and logs the failure. A code the source has no data for is skipped inside `Fetch`, so one currency without data never stops the others (the current per-currency behavior of `bcb_ptax`).

- `bcb_ptax` and `b3_cotahist` move to `feed/bcbptax` and `feed/b3cotahist`. Each declares its base URL default; `b3cotahist` selects instruments whose exchange is `BVMF` and whose quote currency is `BRL`, and keeps skipping Saturdays and Sundays (a holiday returns `ErrNoData`, as today).
- Second implementation: `ecb`, the euro foreign exchange reference rates of the European Central Bank, read from the 90-day history file (`eurofxref-hist-90d.xml` under `https://www.ecb.europa.eu/stats/eurofxref/`; the address is confirmed against the ECB downloads page before the task starts). The file states units of each currency per euro, so each value is stored as the price of `EUR` in that currency (`Instrument: EUR, Quote: USD, Value: 1.0832`), with no division; `Codes` returns the listed currencies that exist as instruments, other than `EUR`.
- `TickFeeds` iterates the enabled sources in registry order. The start date per source is the minimum over its instruments of the day after the latest stored price, bounded by `feedWindowDays`.
- Configuration: `EQUORI_PRICE_FEEDS` (comma-separated ids) and, per source, `EQUORI_FEED_<ID>_URL` with the id upper-cased (`EQUORI_FEED_BCB_PTAX_URL`). `EQUORI_BCB_PTAX_URL` and `EQUORI_B3_COTAHIST_URL` are removed. `internal/platform/config` parses only the id list; `cmd/equori`, the composition root, reads the URL variable of each registered source and passes `FeedURLs map[string]string` through `server.Config`. Aggregator URLs follow the same path (`AggregatorURLs`).
- `domain.Priority` returns 1 for `manual`, 2 for `csv` and 3 for any other valid identifier, the rule the existing `priority` check already states (`ELSE 3`).
- Schema: `marketdata_price.source` gets the identifier `CHECK` of 4.1.

### 5.4 Exchanges and instrument types [4]

- `exchange` holds an ISO 10383 operating MIC, `^[A-Z0-9]{4}$`. Migration converts `B3` to `BVMF`.
- Instrument types become the universal set `currency`, `stock`, `etf`, `reit`, `depositary_receipt`, `fixed_income`, `fund`, `crypto`. Migration converts `fii` to `reit` and `bdr` to `depositary_receipt` in `marketdata_instrument`, and the stored `tax_class` values of Portfolio are rebuilt by section 5.9.
- The type list stays a closed `enum` and a `CHECK` (4.4).

### 5.5 Business-day calendars [13]

```go
// internal/marketdata/internal/calendar
type Calendar struct {
	ID      string
	Weekend []time.Weekday
	Rules   []Rule
}

type Rule struct {
	Name     string
	Date     DateRule      // Fixed{Month, Day} | EasterOffset{Days} | NthWeekday{Month, Weekday, N} (N = -1: last)
	Observed ObservedRule  // None | NearestWeekday | NextWorkday
	From, To int           // first and last year in force; 0 = unbounded
}
```

- `br_banking` is restated as a `Calendar` value with the rules of `ruleHolidays`, including `From: 2024` for Black Consciousness Day. `weekend` is the second implementation: Saturday and Sunday, no rules.
- `Easter` stays exported. `Module.Holidays`, `IsBusinessDay` and `Adjust` resolve the calendar through the registry; `ErrUnknownCalendar` is kept.
- `GET /calendars` lists the registered calendars (id, weekend). Instance holidays (`marketdata_holiday`) stay keyed by calendar id.
- Record level: `ledger_billing_cycle_rule.calendar` loses its `DEFAULT 'br_banking'`; Ledger sets it from the request or from the region default. `planning_schedule` gains `calendar` (existing rows: `br_banking`); `planning/internal/app/generate.go` reads it from the schedule. Both columns get the identifier `CHECK`.
- `api/openapi.yaml` descriptions stop naming `br_banking`.

### 5.6 Base currency at provisioning [14, 9, 10]

- `identity_user` gains `language` and `region`, both `NOT NULL`; the migration sets `pt` and `BR` on existing rows, the values of the only pre-release instance. The `User` schema of `GET /me` gains both fields; `PATCH /me` (tag `identity`) changes them. The pair is called the profile and travels as `locale.Locale`.
- `identity.user_created.v2` carries `user_id`, `email`, `language`, `region` and `base_currency`. `identity.CreateUser` requires all three settings and validates the currency format with `money.ParseCurrency`; it holds no defaults. `equori user create` takes `--region` (required), `--language` (required) and `--currency`; without `--currency` the command takes `ledger.DefaultBaseCurrency(region)` and fails when the region has none.
- Ledger, Planning, Portfolio and Capture read a user's profile through an interface each module root declares, `Profiles { Profile(ctx context.Context, userID int64) (locale.Locale, error) }`, the way `ledger.MarketData` is declared today. `*identity.Module` implements it; `internal/server` passes it to each constructor. Ledger and Planning read the default calendar of a region from Market data, their upstream.
- `ledger.DefaultBaseCurrency` is removed; `provision` reads the payload.
- `planning_schedule.currency` loses `DEFAULT 'BRL'`; the application always writes it.
- `apitest` keeps BRL helpers for Brazilian scenarios and gains a user factory with a region parameter.

### 5.7 Institution identifiers [7]

- `ledger_institution.ispb` is replaced by `identifier_scheme` and `identifier`, set together or both null, unique per `(user_id, identifier_scheme, identifier)`. Migration moves each `ispb` to `('br_ispb', ispb)`.
- Schemes are a registry in `ledger/internal/domain`: `br_ispb` (`^[0-9]{8}$`) and `bic` (ISO 9362, `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`).
- `PUT /institutions/{id}/ispb` becomes `PUT /institutions/{id}/identifier` with `{scheme, identifier}`; `GET /institution-identifier-schemes` lists the schemes.
- ADR 013 is amended: the web resolves a logo through a resolver per scheme; `br_ispb` uses `logos-bancos-br`. An institution whose scheme has no resolver draws its monogram.

### 5.8 Foreign purchase charge [22]

- IOF is the Brazilian case of a percentage charged on card purchases in another currency. The domain term becomes "foreign charge".
- `ledger_card` gains `foreign_charge_bp` (`int`, 0–10000), set at card creation from the request or the region default.
- `RecordForeignPurchase` takes `foreign_charge_rate_bp` (optional, defaulting to the card's value) and `foreign_charge_category_id`. `iof_rate_bp`, `iof_category_id` and `DefaultIOFRateBP` are removed.

### 5.9 Investment income and tax [23]

```go
// internal/portfolio/internal/domain
type Jurisdiction interface {
	ID() string
	IncomeTypes() []string                       // types beyond the universal set
	TaxClass(t InstrumentType, exchange string) string
	Treatment(incomeType string) string
}
```

- Universal income types: `dividend`, `interest`, `coupon`, `distribution`. A jurisdiction adds its own: `br` adds `jcp`.
- `ledger_investment_income.income_type` and `portfolio_income_event.income_type` get the identifier `CHECK`. Ledger validates the format only, because Portfolio depends on Ledger and not the reverse (chapter 4, 4.2). Portfolio derives a null treatment for a type that neither the universal set nor the jurisdiction knows. `GET /investment-income-types` (Portfolio) lists the universal types plus those of the user's jurisdiction for the web form.
- `br` maps `reit` on `BVMF` to `fii`, `depositary_receipt` on `BVMF` to `bdr`, any other type to itself; `dividend` to `exempt`, other types to `exclusive`. The current results are preserved.
- `portfolio_income_event.tax_treatment` becomes nullable with the identifier `CHECK`; it is null without a jurisdiction. `tax_class` likewise.
- `equori portfolio rebuild` rebuilds every brokerage of every user, after the precedent of `equori reporting rebuild`. The operator runs it once after upgrading; the release note of the migration says so.

### 5.10 Aggregators [5]

- The term is "aggregator" for the external service and for the field naming it. `provider` columns and fields are renamed `aggregator` (`ingestion_integration`, `classification_source_category`, contract schemas, `LineCategory.Provider`).
- `app.Aggregator` gains `ID()`, `CredentialFields() []CredentialField` (`name`, `secret`), `ConnectMethod()` (`reference` only, NG-R2) and `MinSyncInterval()`. `ingestion` holds a registry; `pluggyPort` moves to `ingestion/internal/aggregator/pluggy`.
- `domain.Credentials` becomes a map of field name to value, validated against the aggregator's fields, sealed as JSON (ADR 008 unchanged).
- The connection's provider status keeps its raw value and gains a normalized `state`: `ok`, `needs_owner`, `failed`. Each aggregator maps its statuses; `blockedStatuses` moves into the Pluggy package.
- Contract: `aggregator` is a pattern; `item_id` becomes `external_id`; `GET /aggregators` lists id, name, credential fields and connect method; Pluggy-specific descriptions move to that listing's data.
- Configuration: `EQUORI_AGGREGATOR_<ID>_URL` replaces `EQUORI_PLUGGY_URL`. `EQUORI_SYNC_INTERVAL` keeps its 1-minute floor; the scheduler uses the greater of it and the aggregator's minimum.
- `ingestion_batch.source` and `ledger_reconciliation.source` rename `open_finance` to `aggregator`, the term `ledger_statement_fact.source` already uses.

### 5.11 File import [6, 17, 18, 19]

- `ingestion_batch.source` keeps `('ofx', 'csv', 'aggregator')` as a closed set: file formats are universal, and a new format is a new parser.
- CSV profile gains `encoding` (IANA name from a registry: `auto`, `utf-8`, `windows-1252`, `iso-8859-1`, `iso-8859-15`, `windows-1250`, `windows-1251`, `shift_jis`, `gb18030`, `euc-kr`, `big5`). `auto` is UTF-8 when the bytes are valid UTF-8 or carry a BOM, otherwise `windows-1252`; existing profiles get `auto`.
- OFX: the SGML header `CHARSET` (`1252`, `ISO-8859-1`, `UTF-8`) and the XML declaration `encoding` select the decoder; absent or unknown values use `auto`.
- `date_layout` becomes a pattern of the tokens `DD`, `MM`, `YYYY`, `YY` joined by one repeated separator from `/ . -` or space, with each of day, month and year exactly once: `CHECK (date_layout ~ '^(DD|MM|YYYY|YY)([/. -])(DD|MM|YYYY|YY)\2(DD|MM|YYYY|YY)$')` plus the uniqueness check in the domain.
- CSV profile gains `group_separator` (`,`, `.`, space, no-break space, `'`, or empty) beside `decimal_separator`; an existing profile gets `.` when its decimal separator is `,` and `,` otherwise, the separator the current code removes.
- `MinorUnits` strips a leading and a trailing run of letters, currency symbols (Unicode category Sc) and spaces, and accepts a leading sign, a trailing sign and enclosing parentheses as negative. It no longer names `R$`.

### 5.12 Text folding [20, 26]

- `internal/platform/textfold` replaces the three folding tables (`classification/internal/domain/text.go`, `capture/internal/domain/text.go`, `ingestion/internal/domain/match.go`). A rune of the Latin script is decomposed (NFD), stripped of nonspacing marks (Mn), lowercased with `unicode.ToLower` and recomposed (NFC). A rune of any other script is only lowercased, because a mark distinguishes letters there (Cyrillic `й` and `и`).
- For every rune in U+00C0–U+017F the output equals the current classification table, so the stored classification match keys and the `capture_category_hint` keys stay valid without a data migration; a test asserts the equality over the whole range. Letters without a decomposition keep their current output (`æ`, `ß`, `þ`, `ð`, `œ`, `ĳ`).
- `ingestion` match tokens are computed per request and are not stored; they adopt `textfold` without a migration.
- Tags: the domain lowercases with `unicode.ToLower` and accepts letters and digits of any script plus `-`; `ledger_tag.name` gets `CHECK (length(name) BETWEEN 1 AND 60 AND name !~ '\s')`.

### 5.13 Capture [15, 16]

```go
// internal/capture/internal/domain
type Lexicon struct {
	Language     string
	DaysBack     map[string]int
	Weekdays     map[string]time.Weekday
	Multipliers  map[string]int64            // "mil", "k"
	CurrencyWords map[string]money.Currency  // "reais", "real", "r$"
	CountWords, InstallmentWords, LumpSumPhrases, DestinationWords, SourceWords []string
	Methods      map[string]Method
}
```

- `pt` and `en` lexicons hold the words now spread across `date.go`, `amount.go`, `installments.go` and `account.go`. The active lexicon is the user's language lexicon merged with `en`, the user's entries winning.
- Number reading takes the decimal and group separators, and date reading the day-month order, from `platform/locale` for the user's `language-region`. ADR 002 limits `domain` imports to the standard library and `platform/money`, so the capture domain declares its own `Conventions{Decimal, Group rune; Order DateOrder}` and `Vocabulary` gains `Lexicon` and `Conventions`; the capture `app` fills them from `platform/locale`. ADR 016 extends the depguard allowance of `domain` with `internal/platform/textfold` only.
- ADR 014 L2 is amended: the system prompt names the language and region of the user (`The descriptions are short texts the owner typed, mostly in Portuguese (Brazil)`), from `platform/locale` English names.

### 5.14 Locale conventions (server)

`internal/platform/locale` holds `Locale{Language, Region}`, a table of number and date conventions per region with language overrides (`en-US`: month-day-year), the English names of the supported languages and regions, and the fallback row of 4.3. Capture is its only reader in this design.

### 5.15 Web [9, 11, 12, 21, 24, 25]

- `web/src/i18n/locales.ts` is the one registry of interface languages: `{ language, nativeName, catalog, slottedCatalog }`. `Locale` becomes the BCP 47 tag string `language-region`; the menus in `command-menu.tsx`, `more-sheet.tsx` and `account-menu.tsx` read the registry.
- The profile (`GET /me`) decides language and region; `localStorage` keeps the last value only to render before the profile loads. Browser detection matches `navigator.languages` against the registry by primary language subtag.
- `format.ts` and `account-card-money.ts` derive every separator, gap and order from `Intl.NumberFormat#formatToParts` and `Intl.DateTimeFormat#formatToParts` for the tag; the `pt-BR` and `en` branches are removed. `parseAmount` reads the group and decimal separators from the parts of `1234.5`.
- No component falls back to a currency: the currency comes from the record or from settings, and the component renders its waiting state until settings are loaded. `account-card-preview.tsx` takes the base currency from settings; `operations.ts` takes the quote currency from the instrument.
- Collation and case mapping use the active tag (`institution-catalogue.ts`, `link-candidates.ts`).
- Institution logos and the institution catalogue resolve through a resolver per identifier scheme (5.7).
- The integration form renders the credential fields of `GET /aggregators`.
- A settings screen edits language and region (`PATCH /me`) and shows base currency (`PUT /settings`).

## 6. Documents

| Document | Change |
|---|---|
| ADR 016 (new) | Regional extension points: section 4.1 to 4.4 |
| ADR 017 (new) | Dependency `golang.org/x/text` |
| ADR 005 | Section 2: generated ISO 4217 table; conversion path of 5.2 |
| ADR 013 | Identifier schemes and logo resolvers |
| ADR 014 | L2 prompt language |
| `01-vision.md` | 1.3, T06 (calendar per card and schedule), G6 (aggregators), D1 (data per tax jurisdiction, `br` first) |
| `04-contexts.md`, `05-domain-model.md` | Market data feeds and calendars, 5.6 types and tax class, Ingestion aggregators, IOF as foreign charge |
| `08-non-functional-requirements.md` | N21: languages from the registry, formats from `language-region` |
| `docs/operations/price-feeds.md`, `pluggy.md` | New variable names |
| `docs/contributing/regions.md` (new) | Checklist: each extension point, its directory, its registry constructor, its test, and the web files a region adds |

## 7. Order of work

Each step is one or more vertical slices that leave `make check` passing.

1. ADR 016, ADR 017; `platform/registry`, `platform/textfold`, `platform/locale`.
2. ISO 4217 generation and startup reconciliation (5.1).
3. Identity profile, provisioning without a default currency (5.6), `GET/PATCH /me`.
4. Market data: calendars (5.5), feeds with `ecb` (5.3), conversion (5.2), MIC and types (5.4).
5. Ledger: calendar default on billing rules, foreign charge (5.8), institution identifiers (5.7); Planning schedule calendar.
6. Portfolio jurisdictions (5.9).
7. Ingestion and Classification: aggregators (5.10), file formats (5.11), folding (5.12).
8. Capture lexicons and prompt (5.13).
9. Web (5.15).
10. Domain documents and the contributor checklist (6).

## 8. Left to the builder

- Names of unexported helpers, file splits inside a package, and query names.
- The SQL of the intermediate-currency query, within the ordering rule of 5.2.
- The English names table size in `platform/locale`, provided it covers every language with a web catalog and every region with a region default.
