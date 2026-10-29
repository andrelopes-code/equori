# Regional Neutrality Implementation Plan

**Goal:** Separate the universal core of equori from its Brazilian implementations behind module-owned extension points, so a region is added by implementations, registry entries and settings.

**Architecture:** Each regional concern is an interface or data table owned by the consuming module, with an immutable `registry.Registry[T]` built in the module root and selected by the composition root (ADR 016, Task 1). Standard identifiers (ISO 4217, ISO 3166-1, ISO 10383, ISO 9362, BCP 47, IANA charsets) replace Brazilian literals. The user's profile (`locale.Locale{Language, Region}`) drives regional defaults for new records.

**Tech Stack:** Go (stdlib, `golang.org/x/text` via ADR 017), PostgreSQL with goose and sqlc, oapi-codegen, React with TypeScript, Vitest and Intl.

**Spec:** `docs/specs/2026-10-22-regional-neutrality-design.md` (read the section a task cites before starting it).

## Global Constraints

- Every schema change is a new goose migration; applied migrations are never edited. Migration numbers in this plan follow task order from `00038`; when tasks run in another order, a task takes the next free number.
- Extension point identifiers: `CHECK (col ~ '^[a-z0-9_]{2,40}$')` in SQL; `type: string, pattern: "^[a-z0-9_]{2,40}$"` in the contract; validated against the module's registry in the domain, returning 422 `validation_failed` with the field.
- No `init()` registration; no package-level mutable variable. A registry is built by a constructor and never changed.
- A module never imports another module's `internal/` package. Cross-module calls go through the root package, through interfaces the consumer declares (pattern: `ledger.MarketData` in `internal/ledger/ledger.go:139`).
- `domain` packages import only the standard library, `internal/platform/money` and, after Task 1, `internal/platform/textfold`.
- After editing `db/queries`, `db/migrations` or `api/openapi.yaml`: `make gen`.
- A new or changed `operationId` gets an entry in `internal/server/tool_exposure_test.go`: `"-pending"` for reads, `"-write"` for writes.
- Each new `Problem.code` is triggered by a test through `internal/apitest`.
- HTTP tests use `apitest.New`, `h.MustDo(method, path, body, status, &out)` and `h.ExpectProblem(r, status, code, field)` (`internal/apitest/apitest.go:297-335`). Check the status before decoding.
- Verification per step runs only the changed package: `go test ./internal/<module>/... -run '<TestName>'`, or in `web/`: `pnpm exec vitest run <file>`. Before each commit: `make check-commit`. At the end of each phase: `make check`.
- Commits: Conventional Commits, module scope, imperative, at most 72 characters.
- Every Brazilian literal that remains after a task lives in a Brazilian implementation file, in a region default table, in a test fixture, or in a migration that converts existing data.

## Review Focus

1. A user who changes region after creating cards and schedules keeps their calendar and foreign charge rate on existing records. Pinned in Tasks 11, 12 and 19.
2. A currency with three decimals (`KWD`) or none (`JPY`) through the web formatter and parser. Pinned in Task 31.
3. A CSV file with a UTF-8 BOM under a profile declaring `windows-1252` decodes as UTF-8. Pinned in Task 25.
4. A conversion whose only path uses an intermediate price 200 days older than the other leg succeeds and returns both prices. Pinned in Task 16.
5. A formatting tag Intl knows only partially (`pt-AO`, `en-DE`) formats without throwing. Pinned in Task 31.

---

## Task 0: Clean working tree

- [ ] **Step 1:** Run `git status --short`. When the output is not empty, stop and report the listed paths to the owner. The owner commits or discards them; the executor never stages them.
- [ ] **Step 2:** Run `make check`. Expected: PASS. A failure is reported to the owner before Task 1 starts.

---

## Phase A: Foundations

### Task 1: ADRs, generic registry and the `x/text` dependency

**Files:**
- Create: `docs/adr/016-regional-extension-points.md` (Context: spec §1; Decision: spec §4.1–4.4; Consequences: the depguard allowance below and the contributor checklist of Task 36)
- Create: `docs/adr/017-golang-x-text.md` (packages: `unicode/norm`, `encoding`, `encoding/charmap`, `encoding/japanese`, `encoding/simplifiedchinese`, `encoding/korean`, `encoding/traditionalchinese`; the version added in Step 5)
- Create: `internal/platform/registry/registry.go`
- Test: `internal/platform/registry/registry_test.go`
- Modify: `.golangci.yml` (depguard rule for `domain`: add `github.com/andrelopes-code/equori/internal/platform/textfold` to the allow list)

**Interfaces:**
- Produces:
  ```go
  package registry
  const IDPattern = `^[a-z0-9_]{2,40}$`
  var ErrUnknown = errors.New("unknown")
  type Entry[T any] struct { ID string; Value T }
  type Registry[T any] struct { /* unexported */ }
  func New[T any](kind string, entries ...Entry[T]) (Registry[T], error)
  func (r Registry[T]) Get(id string) (T, error)   // error wraps ErrUnknown: `unknown <kind> "<id>"`
  func (r Registry[T]) IDs() []string             // ascending, a fresh slice
  func ValidID(id string) bool
  ```

- [ ] **Step 1: Write the failing test**

```go
func TestRegistry(t *testing.T) {
	if _, err := registry.New("calendar", registry.Entry[int]{"br_banking", 1}, registry.Entry[int]{"br_banking", 2}); err == nil || !strings.Contains(err.Error(), `duplicate calendar "br_banking"`) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := registry.New("calendar", registry.Entry[int]{"BR", 1}); err == nil || !strings.Contains(err.Error(), "must match ^[a-z0-9_]{2,40}$") {
		t.Fatalf("malformed: %v", err)
	}
	r, err := registry.New("calendar", registry.Entry[int]{"b_x", 1}, registry.Entry[int]{"a_y", 2})
	if err != nil {
		t.Fatal(err)
	}
	if v, err := r.Get("a_y"); err != nil || v != 2 {
		t.Fatalf("Get(a_y) = %d, %v", v, err)
	}
	if _, err := r.Get("missing"); !errors.Is(err, registry.ErrUnknown) || err.Error() != `unknown calendar "missing"` {
		t.Fatalf("Get(missing) = %v", err)
	}
	if got := r.IDs(); !slices.Equal(got, []string{"a_y", "b_x"}) {
		t.Fatalf("IDs = %v", got)
	}
}
```

- [ ] **Step 2:** Run `go test ./internal/platform/registry/` → FAIL (package does not exist).
- [ ] **Step 3:** Implement `registry.go` with an unexported map and a sorted id slice, both filled only in `New`. The error of `Get` is `fmt.Errorf("%w %s %q", ErrUnknown, kind, id)`.
- [ ] **Step 4:** Run the test → PASS.
- [ ] **Step 5:** Run `go get golang.org/x/text@latest` and `go mod tidy`; write the resulting version into ADR 017. Write ADR 016.
- [ ] **Step 6:** `make check-commit`; commit `feat(platform): add registry for regional extension points`.

### Task 2: Text folding package

**Files:**
- Create: `internal/platform/textfold/textfold.go`
- Test: `internal/platform/textfold/textfold_test.go`
- Modify: `internal/classification/internal/domain/text.go:8-35` (delete `latinFold`, `latinFirst`, `latinLast`, `fold`; `Normalize` maps words with `textfold.Rune`)
- Modify: `internal/capture/internal/domain/text.go:9-35` (same deletions; same use)
- Modify: `internal/ingestion/internal/domain/match.go:246-266` (delete `fold` and `unaccented`; `strings.Map(textfold.Rune, s)`)

**Interfaces:**
- Produces: `func Rune(r rune) rune`; `func String(s string) string` (`strings.Map(Rune, s)`; whitespace unchanged).

- [ ] **Step 1: Write the failing tests**

```go
// legacy is classification's table before this task (P5 amendment A26), U+00C0–U+017F.
var legacy = []rune("aaaaaaæceeeeiiiiðnooooo×ouuuuyþß" + "aaaaaaæceeeeiiiiðnooooo÷ouuuuyþy" +
	"aaaaaaccccccccddddeeeeeeeeeegggggggghhhhiiiiiiiiiiĳĳjjkkĸllllllllllnnnnnnŉŋŋoooooo" +
	"œœrrrrrrssssssssttttttuuuuuuuuuuuuwwyyyzzzzzzs")

func TestLatinRangeMatchesLegacyTable(t *testing.T) {
	for r := rune(0xC0); r <= 0x17F; r++ {
		if got, want := textfold.Rune(r), legacy[r-0xC0]; got != want {
			t.Errorf("Rune(%q) = %q, want %q", r, got, want)
		}
	}
}

func TestOtherScripts(t *testing.T) {
	for in, want := range map[string]string{"Ș": "s", "Ệ": "e", "Ǆ": "ǆ", "Й": "й", "Ά": "ά", "ÆON": "æon", "Straße": "straße"} {
		if got := textfold.String(in); got != want {
			t.Errorf("String(%q) = %q, want %q", in, got, want)
		}
	}
}
```

- [ ] **Step 2:** Run `go test ./internal/platform/textfold/` → FAIL.
- [ ] **Step 3:** Implement `Rune`: `l := unicode.ToLower(r)`; when `unicode.Is(unicode.Latin, l)`, decompose with `norm.NFD.String(string(l))` and return its first rune that is not in `unicode.Mn`; otherwise return `l`. Runes of U+00C0–U+017F whose legacy value differs from that result (`ĸ`, `ŉ`, `×`, `÷` and any other the test reports) come from an unexported `map[rune]rune` checked first.
- [ ] **Step 4:** Run → PASS. Replace the three call sites. Run `go test ./internal/classification/... ./internal/capture/... ./internal/ingestion/...` → PASS with no test changed.
- [ ] **Step 5:** `make check-commit`; commit `refactor(platform): fold text in one package for every script`.

### Task 3: Tags in any script

**Files:**
- Create: `db/migrations/00038_ledger_tag_unicode.sql` (drop the pattern check of `ledger_tag.name` from `00004_ledger.sql:63`; add `CHECK (length(name) BETWEEN 1 AND 60 AND name !~ '\s' AND name !~ '^-')`)
- Modify: `internal/ledger/internal/domain/transaction.go:241-252` (`normalizeTags`: `strings.ToLower` then spaces to `-`; accept `^[\p{L}\p{N}][\p{L}\p{N}-]{0,59}$` counted in runes; message `must use letters, digits and hyphens, up to 60 characters`)
- Test: `internal/ledger/tags_test.go` (new), `internal/ledger/schema_test.go`

- [ ] **Step 1: Write the failing tests.** `TestTagsInAnyScript`: create a transaction with `"tags": ["Café", "праздник", "a b"]`, GET it, assert tags `["a-b", "café", "праздник"]`. `TestTagNameSchema` in `schema_test.go`: direct `INSERT INTO ledger_tag (user_id, name) VALUES ($1, 'a b')` returns a check violation.
- [ ] **Step 2:** `go test ./internal/ledger/ -run 'TestTagsInAnyScript|TestTagNameSchema'` → FAIL.
- [ ] **Step 3:** Implement the migration and the domain rule; `make gen`.
- [ ] **Step 4:** Run → PASS; run `go test ./internal/ledger/ -run Tag` → PASS.
- [ ] **Step 5:** Commit `feat(ledger): accept tags in any script`.

### Task 4: Locale conventions

**Files:**
- Create: `internal/platform/locale/locale.go`, `internal/platform/locale/regions.go` (the 249 officially assigned ISO 3166-1 alpha-2 codes as a sorted `[]string` literal, and `map[string]string` English names for the regions of the conventions table), `internal/platform/locale/conventions.go`
- Test: `internal/platform/locale/locale_test.go`

**Interfaces:**
- Produces:
  ```go
  type Locale struct{ Language, Region string }
  func (l Locale) Tag() string                    // "pt-BR"
  func ValidLanguage(s string) bool               // ^[a-z]{2,3}$
  func ValidRegion(s string) bool                 // assigned ISO 3166-1 alpha-2
  type DateOrder string                           // "dmy", "mdy", "ymd"
  const (DMY DateOrder = "dmy"; MDY DateOrder = "mdy"; YMD DateOrder = "ymd")
  type Conventions struct{ Decimal, Group rune; Order DateOrder }
  func ConventionsOf(l Locale) Conventions
  func EnglishName(l Locale) string               // "Portuguese (Brazil)"
  ```

- [ ] **Step 1: Write the failing tests**

```go
func TestConventionsOf(t *testing.T) {
	for l, want := range map[locale.Locale]locale.Conventions{
		{"pt", "BR"}: {',', '.', locale.DMY},
		{"en", "US"}: {'.', ',', locale.MDY},
		{"en", "GB"}: {'.', ',', locale.DMY},
		{"de", "DE"}: {',', '.', locale.DMY},
		{"de", "CH"}: {'.', '\'', locale.DMY},
		{"en", "ZZ"}: {'.', ',', locale.YMD},
	} {
		if got := locale.ConventionsOf(l); got != want {
			t.Errorf("ConventionsOf(%v) = %+v, want %+v", l, got, want)
		}
	}
}

func TestEnglishName(t *testing.T) {
	for l, want := range map[locale.Locale]string{{"pt", "BR"}: "Portuguese (Brazil)", {"en", "GB"}: "English (United Kingdom)", {"pt", "AO"}: "Portuguese (AO)"} {
		if got := locale.EnglishName(l); got != want {
			t.Errorf("EnglishName(%v) = %q, want %q", l, got, want)
		}
	}
}

func TestValid(t *testing.T) {
	if !locale.ValidRegion("BR") || locale.ValidRegion("ZZ") || locale.ValidRegion("BRA") || !locale.ValidLanguage("pt") || locale.ValidLanguage("PT") {
		t.Fatal("validation")
	}
}
```

- [ ] **Step 2:** `go test ./internal/platform/locale/` → FAIL.
- [ ] **Step 3:** Implement. Conventions table by region: BR, PT, DE, FR, ES, IT, NL, AR → `{',', '.', DMY}`; CH → `{'.', '\'', DMY}`; GB, AU, MX → `{'.', ',', DMY}`; US, CA → `{'.', ',', MDY}`; JP, CN, KR → `{'.', ',', YMD}`; fallback `{'.', ',', YMD}`. Language names: `en` English, `pt` Portuguese, `es` Spanish, `de` German, `fr` French, `it` Italian. A missing language name uses the language code.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(platform): add locale conventions for server-side parsing`.

---

## Phase B: Currencies

### Task 5: ISO 4217 generated table

**Files:**
- Create: `internal/platform/money/iso4217.xml` (download `https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml`; when it does not resolve, stop and report)
- Create: `internal/platform/money/iso4217.lock.json` (first run: the 15 entries of `money.go:32-35` with their names from the XML)
- Create: `internal/platform/money/gen/main.go`, `internal/platform/money/gen/main_test.go`
- Create (generated): `internal/platform/money/currency.gen.go` (`var minorUnits = map[Currency]int8{...}`, `var currencyNames = map[Currency]string{...}`)
- Modify: `internal/platform/money/money.go:31-35` (delete the literal)
- Modify: `Makefile` target `gen`: first command `go run ./internal/platform/money/gen`
- Test: `internal/platform/money/money_test.go`

**Interfaces:**
- Produces: `func Name(c Currency) string`; in `gen`: `type LockEntry struct { Exponent int8 \`json:"exponent"\`; Name string \`json:"name"\` }` and `func Generate(listOne []byte, lock map[string]LockEntry) (source []byte, newLock map[string]LockEntry, err error)`.

- [ ] **Step 1: Write the failing tests**

```go
func TestISOCurrencies(t *testing.T) {
	for code, units := range map[string]int{"EUR": 2, "INR": 2, "KWD": 3, "ISK": 0, "JPY": 0} {
		c, err := money.ParseCurrency(code)
		if err != nil || c.MinorUnits() != units {
			t.Errorf("%s: %v, units %d", code, err, c.MinorUnits())
		}
	}
	for _, code := range []string{"XAU", "CLF", "XXX", "XTS"} {
		if _, err := money.ParseCurrency(code); !errors.Is(err, money.ErrUnknownCurrency) {
			t.Errorf("%s accepted", code)
		}
	}
	if money.Name("BRL") != "Brazilian Real" {
		t.Errorf("Name(BRL) = %q", money.Name("BRL"))
	}
}
```

`gen/main_test.go`: `TestGenerateRejectsExponentChange` (lock `{"ISK": {0, "Iceland Krona"}}`, XML with ISK `MinorUnits` 2 → error containing `ISK`); `TestGenerateKeepsWithdrawnCodes` (lock holds `SLL`, XML lacks it → output still contains `"SLL": 2` and the lock keeps it); `TestGenerateExcludes` (an entry with `IsFund="true"`, one with `N.A.`, and `XAU` are absent).

- [ ] **Step 2:** `go test ./internal/platform/money/...` → FAIL.
- [ ] **Step 3:** Implement `Generate` with `encoding/xml` and `go/format`. Output = union of the lock and List One. `main` reads both files, writes `currency.gen.go` and the new lock.
- [ ] **Step 4:** `make gen`; run the tests → PASS; `go test ./internal/...` for packages that use currencies: `go test ./internal/marketdata/... ./internal/ledger/...` → PASS.
- [ ] **Step 5:** Commit `feat(platform): support every ISO 4217 currency`.

### Task 6: Startup reconciliation of currency instruments

**Files:**
- Create: `internal/marketdata/currencies.go`
- Modify: `db/queries/marketdata/instrument.sql` (add query below)
- Modify: `cmd/equori/main.go` `serve()` (after `server.New`, before starting goroutines: `if err := app.Marketdata.ReconcileCurrencies(ctx); err != nil { return err }`)
- Modify: `internal/apitest/apitest.go` `start` (same call after `server.New`, `h.t.Fatal` on error)
- Test: `internal/marketdata/instruments_test.go`

**Interfaces:**
- Produces: `func (m *Module) ReconcileCurrencies(ctx context.Context) error`

```sql
-- name: InsertMissingCurrencies :exec
INSERT INTO marketdata_instrument (code, instrument_type, scale, name)
SELECT unnest(@codes::text[]), 'currency', unnest(@scales::smallint[]), unnest(@names::text[])
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 1: Write the failing test** `TestReconcileCurrencies`: `h := apitest.New(t)`; `SELECT count(*) FROM marketdata_instrument WHERE instrument_type = 'currency'` equals `len(money.Currencies())`; `UPDATE marketdata_instrument SET name = 'Custom' WHERE code = 'EUR'`; call `h.App.Marketdata.ReconcileCurrencies(t.Context())`; the name is still `Custom`.
- [ ] **Step 2:** `go test ./internal/marketdata/ -run TestReconcileCurrencies` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): reconcile currency instruments at startup`.

---

## Phase C: Profile and provisioning

### Task 7: Language and region on the user

**Files:**
- Create: `db/migrations/00039_identity_profile.sql`:
  ```sql
  -- +goose Up
  ALTER TABLE identity_user
      ADD COLUMN language text NOT NULL DEFAULT 'pt' CHECK (language ~ '^[a-z]{2,3}$'),
      ADD COLUMN region   text NOT NULL DEFAULT 'BR' CHECK (region ~ '^[A-Z]{2}$');
  ALTER TABLE identity_user ALTER COLUMN language DROP DEFAULT, ALTER COLUMN region DROP DEFAULT;
  -- +goose Down
  ALTER TABLE identity_user DROP COLUMN language, DROP COLUMN region;
  ```
- Modify: `db/queries/identity/identity.sql` (`CreateUser` inserts `language`, `region`; new `UpdateProfile :one`)
- Modify: `internal/platform/postgres/pgtest/pgtest.go:164-175` (`CreateUser` inserts `language 'en', region 'US'`; new `CreateUserBeforeProfile` with the current three-column insert)
- Modify: every test that calls `postgres.MigrateTo` with a version below 39 and then `pgtest.CreateUser`: switch it to `CreateUserBeforeProfile` (find them with `grep -rln 'MigrateTo' internal`); `internal/ledger/reconciliation_schema_test.go:48` adds the two columns
- Modify: `internal/identity/internal/domain/user.go`, `internal/identity/internal/app/service.go`, `internal/identity/internal/adapter/postgres/repository.go`, `internal/identity/internal/adapter/httpapi/server.go`, `internal/identity/identity.go`
- Modify: `api/openapi.yaml` (`User` gains required `language`, `region`; `/me` gains `patch` `updateCurrentUser` with body `{language?, region?}`, `additionalProperties: false`, patterns `^[a-z]{2,3}$` and `^[A-Z]{2}$`)
- Modify: `internal/server/tool_exposure_test.go` (`"updateCurrentUser": "-write"`)
- Test: `internal/identity/profile_test.go` (new), `internal/identity/schema_test.go` (new)

**Interfaces:**
- Consumes: Task 4 `locale.Locale`, `locale.ValidLanguage`, `locale.ValidRegion`.
- Produces: `func (m *Module) Profile(ctx context.Context, userID int64) (locale.Locale, error)`.

- [ ] **Step 1: Write the failing tests**

```go
func TestProfile(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	var me struct{ Language, Region string }
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)
	if me.Language != "pt" || me.Region != "BR" {
		t.Fatalf("me = %+v", me)
	}
	h.MustDo(http.MethodPatch, "/api/v1/me", map[string]any{"language": "en", "region": "GB"}, http.StatusOK, &me)
	h.MustDo(http.MethodGet, "/api/v1/me", nil, http.StatusOK, &me)
	if me.Language != "en" || me.Region != "GB" {
		t.Fatalf("after patch = %+v", me)
	}
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"region": "ZZ"}), http.StatusUnprocessableEntity, "validation_failed", "region")
	h.ExpectProblem(h.Do(http.MethodPatch, "/api/v1/me", map[string]any{"region": "bra"}), http.StatusBadRequest, "invalid_request", "region")
}
```

`TestProfileSchema`: `UPDATE identity_user SET language = 'PT'` on a `pgtest.New` database returns a check violation.

- [ ] **Step 2:** `go test ./internal/identity/ -run 'TestProfile'` → FAIL.
- [ ] **Step 3:** Implement. `CreateUser` in the service takes `locale.Locale` (Task 8 adds the parameter to the root API); until Task 8 the root passes `locale.Locale{Language: "pt", Region: "BR"}`. Domain error: field `region`, message `must be an ISO 3166-1 alpha-2 code`; field `language`, message `must be an ISO 639 language code`. `make gen`.
- [ ] **Step 4:** Run → PASS. Run `go test ./internal/ledger/ -run Migration` → PASS.
- [ ] **Step 5:** Commit `feat(identity): store language and region per user`.

### Task 8: Provisioning without a default currency

**Files:**
- Modify: `internal/identity/identity.go:51-57`: `func (m *Module) CreateUser(ctx context.Context, email, password, role string, l locale.Locale, baseCurrency money.Currency) (User, error)`
- Modify: `internal/identity/internal/adapter/postgres/repository.go:37-72` (event `identity.user_created.v2`; payload `{user_id, email, language, region, base_currency}`)
- Create: `internal/ledger/region_defaults.go`: `func DefaultBaseCurrency(region string) (money.Currency, bool)` (`BR` → `BRL`)
- Modify: `internal/ledger/ledger.go:32-33` (delete the constant), `:200` (subscribe to `identity.user_created.v2`), `:410-423` (payload gains `BaseCurrency money.Currency \`json:"base_currency"\``; `Provision` uses it)
- Modify: `cmd/equori/user.go:25-60` (flags `--language`, `--region`, `--currency`; usage line `usage: equori user create --email EMAIL --language LANG --region REGION [--currency CODE] [--admin]`; without `--currency`, `ledger.DefaultBaseCurrency(region)`, else error `--currency is required for region <REGION>`)
- Create: `db/migrations/00040_planning_schedule_currency.sql` (`ALTER TABLE planning_schedule ALTER COLUMN currency DROP DEFAULT`)
- Modify: `internal/apitest/apitest.go:166` (`Login(email)` calls `LoginAs(email, locale.Locale{Language: "pt", Region: "BR"}, "BRL")`; new `func (h *Harness) LoginAs(email string, l locale.Locale, base money.Currency) *http.Client`)
- Modify: `internal/identity/identity_test.go:243-300` (calls of `CreateUser` gain the two arguments; `TestCreateUserPublishesEvent` expects `identity.user_created.v2` and the new payload members)
- Test: `internal/ledger/provisioning_test.go` (new), `cmd/equori/user_test.go` (new, testing the flag resolution function)

**Interfaces:**
- Produces: `apitest.(*Harness).LoginAs`; `ledger.DefaultBaseCurrency`; in `cmd/equori`: `func userSettings(language, region, currency string) (locale.Locale, money.Currency, error)`.

- [ ] **Step 1: Write the failing tests**

```go
func TestProvisioningUsesTheChosenCurrency(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	c := h.LoginAs("de@example.com", locale.Locale{Language: "en", Region: "DE"}, "EUR")
	var s struct{ BaseCurrency string `json:"base_currency"` }
	r := h.Call(c, http.MethodGet, "/api/v1/settings", nil)
	if r.Status != http.StatusOK {
		t.Fatalf("status %d", r.Status)
	}
	r.Decode(t, &s)
	if s.BaseCurrency != "EUR" {
		t.Fatalf("base = %s", s.BaseCurrency)
	}
}
```

`TestUserSettings` in `cmd/equori`: `("pt","BR","")` → `BRL`; `("en","DE","EUR")` → `EUR`; `("en","DE","")` → error `--currency is required for region DE`; `("en","ZZ","EUR")` → error containing `region`.

- [ ] **Step 2:** `go test ./internal/ledger/ -run TestProvisioning ./cmd/equori/ -run TestUserSettings` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/identity/...` → PASS (Task 7's `TestProfile` now passes).
- [ ] **Step 5:** Commit `feat(identity)!: choose language, region and currency at user creation` with body naming spec §5.6 and footer `BREAKING CHANGE: equori user create requires --language and --region`.

---

## Phase D: Market data

### Task 9: Calendar rule tables

**Files:**
- Create: `internal/marketdata/internal/calendar/calendar.go` (types below), `internal/marketdata/internal/calendar/rule.go`, `internal/marketdata/internal/calendar/br_banking.go`, `internal/marketdata/internal/calendar/weekend.go`
- Test: `internal/marketdata/internal/calendar/rule_test.go`

**Interfaces:**
- Produces:
  ```go
  type Calendar struct { ID string; Weekend []time.Weekday; Rules []Rule }
  type Rule struct { Name string; Date DateRule; Observed Observed; From, To int }
  type DateRule interface{ dateIn(year int) time.Time }
  type Fixed struct{ Month time.Month; Day int }
  type EasterOffset struct{ Days int }
  type NthWeekday struct{ Month time.Month; Weekday time.Weekday; N int } // N = -1: last
  type Observed int
  const (ObservedNone Observed = iota; ObservedNearestWeekday; ObservedNextWorkday)
  type Holiday struct{ Date time.Time; Name string }
  func (c Calendar) Holidays(year int) []Holiday    // sorted by date
  func (c Calendar) IsWeekend(d time.Time) bool
  func Easter(year int) time.Time                  // moved from marketdata/calendar.go
  var BRBanking = Calendar{...}                    // value, never reassigned
  var Weekend = Calendar{ID: "weekend", Weekend: []time.Weekday{time.Saturday, time.Sunday}}
  ```
  `BRBanking` and `Weekend` are exported values used only to build the registry; no code assigns them.

- [ ] **Step 1: Write the failing tests**

```go
func TestRules(t *testing.T) {
	cal := calendar.Calendar{ID: "test", Weekend: []time.Weekday{time.Saturday, time.Sunday}, Rules: []calendar.Rule{
		{Name: "Memorial", Date: calendar.NthWeekday{Month: time.May, Weekday: time.Monday, N: -1}},
		{Name: "Independence", Date: calendar.Fixed{Month: time.July, Day: 4}, Observed: calendar.ObservedNearestWeekday},
		{Name: "Christmas", Date: calendar.Fixed{Month: time.December, Day: 25}, Observed: calendar.ObservedNextWorkday},
		{Name: "New", Date: calendar.Fixed{Month: time.March, Day: 1}, From: 2024},
	}}
	dates := func(year int) []string {
		var out []string
		for _, h := range cal.Holidays(year) {
			out = append(out, h.Date.Format(time.DateOnly))
		}
		return out
	}
	if got := dates(2026); !slices.Equal(got, []string{"2026-03-01", "2026-05-25", "2026-07-03", "2026-12-25"}) {
		t.Errorf("2026 = %v", got)
	}
	if got := dates(2022); !slices.Equal(got, []string{"2022-05-30", "2022-07-04", "2022-12-26"}) {
		t.Errorf("2022 = %v", got)
	}
}

func TestBRBankingMatchesThePreviousRules(t *testing.T) {
	got := calendar.BRBanking.Holidays(2026)
	if len(got) != 13 || got[3].Name != "Good Friday" || got[3].Date.Format(time.DateOnly) != "2026-04-03" {
		t.Fatalf("2026 = %v", got)
	}
	if len(calendar.BRBanking.Holidays(2023)) != 12 {
		t.Fatal("Black Consciousness Day must start in 2024")
	}
}
```

- [ ] **Step 2:** `go test ./internal/marketdata/internal/calendar/` → FAIL.
- [ ] **Step 3:** Implement. `ObservedNearestWeekday`: Saturday → Friday, Sunday → Monday. `ObservedNextWorkday`: Saturday or Sunday → next Monday. `BRBanking` restates the list in `internal/marketdata/calendar.go:65-90` (`ruleHolidays`) with `From: 2024` for Black Consciousness Day.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): declare business-day calendars as rule tables`.

### Task 10: Calendar registry in the module

**Files:**
- Modify: `internal/marketdata/calendar.go` (delete `CalendarBRBanking`, `Easter` body, `ruleHolidays`; `Module` holds `calendars registry.Registry[calendar.Calendar]` built in `marketdata.New`; `Holidays`, `IsBusinessDay` and `shift` use `Calendar.Holidays` and `Calendar.IsWeekend`; unknown ids return an error wrapping `ErrUnknownCalendar`; `func Easter(year int) time.Time { return calendar.Easter(year) }` stays as the exported wrapper)
- Create: `internal/marketdata/region_defaults.go`: `func (m *Module) DefaultCalendar(region string) string` (`BR` → `br_banking`, any other → `weekend`); `func (m *Module) Calendars() []string`
- Modify: `api/openapi.yaml` (new `GET /calendars`, `operationId: listCalendars`, response `{items: [{id, weekend: [string enum of weekday names]}]}`)
- Modify: `internal/marketdata/internal/adapter/httpapi/server.go`, `internal/marketdata/marketdata.go`
- Modify: `internal/server/tool_exposure_test.go` (`"listCalendars": "-pending"`)
- Test: `internal/marketdata/calendar_test.go`

- [ ] **Step 1: Write the failing tests.** `TestWeekendCalendar` through `h.App.Marketdata`: `IsBusinessDay(ctx, "weekend", 2026-04-21)` → true; `(…, 2026-04-25)` → false. `TestListCalendars`: `GET /api/v1/calendars` → ids `["br_banking", "weekend"]` and `weekend` of `weekend` = `["saturday", "sunday"]`. `TestDefaultCalendar`: `BR` → `br_banking`; `DE` → `weekend`. Existing `TestEaster`, `TestBRBanking2026`, `TestConsciousnessDayFrom2024`, `TestAdjust`, `TestInstanceHoliday`, `TestUnknownCalendar` pass unchanged.
- [ ] **Step 2:** `go test ./internal/marketdata/ -run 'Calendar|Easter|BRBanking|Consciousness|Adjust|Holiday'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `refactor(marketdata): resolve calendars through a registry`.

### Task 11: Card calendar from the region

**Files:**
- Modify: `internal/ledger/ledger.go:139-143` (`MarketData` gains `DefaultCalendar(region string) string`); add `type Profiles interface { Profile(ctx context.Context, userID int64) (locale.Locale, error) }`; `New(pool, dispatcher, md MarketData, profiles Profiles, clk, log)`
- Modify: `internal/ledger/internal/app/ports.go:75-80` (`Calendar` gains `DefaultCalendar(region string) string`; new port `Profiles` with the same method), `internal/ledger/internal/app/service.go:41` (`NewService(repo, clock, cal, ins, prices, profiles)`; callers pass `nil` where they pass `nil` today)
- Modify: `internal/ledger/internal/domain/billing.go:108-110` (delete the `br_banking` default; an empty calendar is invalid: field `calendar`, message `is required`)
- Modify: `internal/ledger/internal/app/cards.go:20-30` (before validation: an empty `rule.Calendar` takes `s.cal.DefaultCalendar(profile.Region)`)
- Modify: `internal/server/server.go:86` (`ledger.New(pool, dispatcher, marketdataModule, identityModule, clk, log)`)
- Create: `db/migrations/00041_ledger_billing_calendar.sql` (`ALTER TABLE ledger_billing_cycle_rule ALTER COLUMN calendar DROP DEFAULT, ADD CHECK (calendar ~ '^[a-z0-9_]{2,40}$')`)
- Modify: `api/openapi.yaml:5337` (description of `calendar`: `Business-day calendar id from GET /calendars; defaults to the calendar of the owner's region.`)
- Test: `internal/ledger/card_calendar_test.go` (new)

- [ ] **Step 1: Write the failing test** `TestCardCalendarFromRegion`: for the harness user (BR) and for `h.LoginAs("de@example.com", {en, DE}, "EUR")`, create a card with closing day 10 and due day 21 through `h.Card` (or its body for the DE client), then read the statement of reference month `2026-04`: BR due date `2026-04-22` (Tiradentes is 2026-04-21), DE due date `2026-04-21`. Then `PATCH /api/v1/me {"region":"BR"}` for the DE client and read the same statement: due date still `2026-04-21`. A billing rule body with `"calendar": "xx_yy"` → 422 `validation_failed` field `calendar`.
- [ ] **Step 2:** `go test ./internal/ledger/ -run TestCardCalendarFromRegion` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/ledger/ -run 'Card|Statement|Billing'` → PASS.
- [ ] **Step 5:** Commit `feat(ledger): default the card calendar to the owner's region`.

### Task 12: Schedule calendar

**Files:**
- Create: `db/migrations/00042_planning_schedule_calendar.sql` (`ADD COLUMN calendar text NOT NULL DEFAULT 'br_banking' CHECK (calendar ~ '^[a-z0-9_]{2,40}$')`, then `ALTER COLUMN calendar DROP DEFAULT`)
- Modify: `internal/planning/planning.go:38` (`New(pool, dispatcher, l, md, profiles Profiles, clk, log)`; `Profiles` declared as in Task 11), `internal/planning/internal/app/generate.go:12` (delete `calendarName`; read the schedule's calendar), `internal/planning/internal/adapter/postgres/repository.go:93`, schedule domain and queries, `internal/server/server.go:96`
- Modify: `api/openapi.yaml:3907-3910` (description without `br_banking`; optional `calendar` on the schedule create body and in the schedule response)
- Test: `internal/planning/schedule_calendar_test.go` (new)

- [ ] **Step 1: Write the failing test** `TestScheduleCalendarFromRegion`: a monthly schedule on the first business day starting `2026-01-01`: first occurrence for the BR user `2026-01-02`, for the DE user `2026-01-01`; the response carries `calendar` `br_banking` and `weekend` respectively; a body with `"calendar": "xx_yy"` → 422 field `calendar`.
- [ ] **Step 2:** `go test ./internal/planning/ -run TestScheduleCalendarFromRegion` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/planning/...` → PASS.
- [ ] **Step 5:** Commit `feat(planning): store the business-day calendar per schedule`.

### Task 13: Price source interface

**Files:**
- Modify: `internal/marketdata/internal/feed/feed.go` (add `Source` and `Instrument` below; keep `Quote`, `ErrNoData`, `get`)
- Move: `internal/marketdata/internal/feed/ptax.go` and its test → `internal/marketdata/internal/feed/bcbptax/` (type `Source`, `func New(c *http.Client, baseURL string) Source`, `ID()` = `bcb_ptax`, `Codes` = currency instruments other than `BRL`, `Fetch` loops codes and skips `feed.ErrNoData` per code)
- Move: `internal/marketdata/internal/feed/cotahist.go` and its test → `internal/marketdata/internal/feed/b3cotahist/` (`ID()` = `b3_cotahist`; `Codes` = instruments with exchange `B3` and quote currency `BRL` — Task 17 changes `B3` to `BVMF`; `Fetch` loops days from `from` to `to`, skips Saturdays and Sundays and days with `ErrNoData`)
- Modify: `internal/marketdata/feeds.go` (`FeedConfig{Sources []feed.Source; Client *http.Client; Clock clock.Clock; Log *slog.Logger}`; one `tick(ctx, src)`: codes from `src.Codes(instruments)`, start = minimum over codes of `feedStart(ctx, src.ID(), code, today)`, `Fetch`, store every returned quote, log the error when not nil)
- Modify: `internal/marketdata/internal/domain/price.go:13-37` (delete `SourceBCBPTAX`, `SourceB3COTAHIST`; `Priority`: `manual` 1, `csv` 2, any `registry.ValidID` id 3, otherwise error)
- Modify: `internal/server/server.go:51-53,82-85` (build `[]feed.Source` from the existing booleans and URLs; Task 14 replaces them)
- Test: `internal/marketdata/feeds_test.go`, the moved tests

**Interfaces:**
- Produces:
  ```go
  type Instrument struct{ Code money.Currency; Type, Exchange string; QuoteCurrency money.Currency }
  type Source interface {
  	ID() string
  	Codes(ins []Instrument) []money.Currency
  	// Fetch returns the quotes read before a failure together with the failure.
  	Fetch(ctx context.Context, codes []money.Currency, from, to time.Time) ([]Quote, error)
  }
  ```

- [ ] **Step 1: Write the failing test** `TestFeedFailureKeepsOtherCurrencies` in `feeds_test.go`: the fake PTAX server answers 500 for `EUR` and data for `USD` on `2026-10-30`; after `TickFeeds`, `GET /api/v1/prices?instrument=USD&quote=BRL&from=2026-10-30&to=2026-10-30` returns one price and the logs contain `price feed` and `bcb_ptax`. `TestFeedsDisabledSendNoRequest` and `TestFeedsFetchPrices` pass unchanged.
- [ ] **Step 2:** `go test ./internal/marketdata/... -run Feed` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `refactor(marketdata): fetch prices through a source interface`.

### Task 14: Price source registry and configuration

**Files:**
- Create: `internal/marketdata/sources.go`: `func SourceIDs() []string` (`b3_cotahist`, `bcb_ptax`, `ecb` after Task 15); `func NewSources(ids []string, urls map[string]string, hc *http.Client) ([]feed.Source, error)` (a missing URL uses the source's default; unknown id error `EQUORI_PRICE_FEEDS: unknown feed "<id>"`)
- Modify: `internal/platform/config/config.go:38-40,51-69` (delete `PTAXFeed`, `COTAHISTFeed`, `PTAXURL`, `COTAHISTURL` and their defaults; add `PriceFeeds []string` parsed from `EQUORI_PRICE_FEEDS`, trimmed, empty entries dropped)
- Modify: `cmd/equori/main.go` `serverConfig` (for each id of `marketdata.SourceIDs()`: `getenv("EQUORI_FEED_" + strings.ToUpper(id) + "_URL")` into `FeedURLs` when set)
- Modify: `internal/server/server.go` (`Config` gains `PriceFeeds []string`, `FeedURLs map[string]string`; calls `marketdata.NewSources`; returns its error)
- Modify: `internal/apitest/apitest.go:112-116` (`PriceFeeds(ids []string, urls map[string]string) Option`; update callers in `internal/marketdata/feeds_test.go`)
- Create: `db/migrations/00043_marketdata_price_source.sql` (drop the `source IN (...)` check of `marketdata_price`; add `CHECK (source ~ '^[a-z0-9_]{2,40}$')`; the priority check stays)
- Modify: `docs/operations/price-feeds.md` (new variable names)
- Test: `internal/marketdata/sources_test.go` (new), `internal/platform/config/config_test.go`, `internal/marketdata/schema_test.go`

- [ ] **Step 1: Write the failing tests.** `TestNewSources`: `NewSources([]string{"nope"}, nil, hc)` → error `EQUORI_PRICE_FEEDS: unknown feed "nope"`; `NewSources([]string{"bcb_ptax"}, map[string]string{"bcb_ptax": srv.URL}, hc)` → a tick requests only `srv`. `TestLoadPriceFeeds`: `EQUORI_PRICE_FEEDS=" bcb_ptax, ,ecb"` → `[]string{"bcb_ptax", "ecb"}`. Schema: `INSERT INTO marketdata_price (..., source, priority) VALUES (..., 'BCB', 3)` rejected.
- [ ] **Step 2:** `go test ./internal/marketdata/ ./internal/platform/config/ -run 'Sources|PriceFeeds|Schema'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/marketdata/... ./cmd/equori/...` → PASS.
- [ ] **Step 5:** Commit `refactor(marketdata)!: select price feeds from a registry` with footer `BREAKING CHANGE: EQUORI_BCB_PTAX_URL and EQUORI_B3_COTAHIST_URL are EQUORI_FEED_BCB_PTAX_URL and EQUORI_FEED_B3_COTAHIST_URL`.

### Task 15: ECB source

**Files:**
- Create: `internal/marketdata/internal/feed/ecb/ecb.go`, `ecb_test.go`, `testdata/eurofxref-hist-90d.xml`
- Modify: `internal/marketdata/sources.go` (register `ecb`; default URL `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml` — open it once with `curl -sI`; a non-200 answer stops the task and is reported)

Fixture (the ECB format):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time="2026-10-20"><Cube currency="USD" rate="1.0832"/><Cube currency="GBP" rate="0.8412"/></Cube>
    <Cube time="2026-10-19"><Cube currency="USD" rate="1.0815"/><Cube currency="GBP" rate="0.8420"/></Cube>
  </Cube>
</gesmes:Envelope>
```

- [ ] **Step 1: Write the failing test** `TestECB`: `Codes` of `EUR, USD, GBP, BTC (crypto)` → `[GBP USD]`; `Fetch(ctx, [USD], 2026-10-20, 2026-10-20)` → exactly `Quote{Instrument: "EUR", Quote: "USD", Date: 2026-10-20, Value: "1.0832"}`; `Fetch` with range `2026-10-19..2026-10-20` and codes `[GBP USD]` → 4 quotes; a 404 → `errors.Is(err, feed.ErrNoData)`.
- [ ] **Step 2:** `go test ./internal/marketdata/internal/feed/ecb/` → FAIL.
- [ ] **Step 3:** Implement with `encoding/xml` and `money.ParseRate`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): add the ECB reference rates feed`.

### Task 16: Conversion through any intermediate

**Files:**
- Modify: `internal/marketdata/convert.go` (delete `pivot`; the third step calls `ConversionIntermediate`, then `m.leg(from, x)` and `m.leg(x, to)`)
- Modify: `internal/marketdata/feeds.go` (no `pivot` reference remains)
- Modify: `db/queries/marketdata/price.sql`:
  ```sql
  -- name: ConversionIntermediate :one
  WITH legs AS (
      SELECT quote_instrument AS other, instrument AS side, max(date) AS latest FROM marketdata_price
      WHERE instrument IN (@from_code::text, @to_code::text) AND date <= @date GROUP BY 1, 2
      UNION ALL
      SELECT instrument, quote_instrument, max(date) FROM marketdata_price
      WHERE quote_instrument IN (@from_code::text, @to_code::text) AND date <= @date GROUP BY 1, 2
  ), best AS (
      SELECT other, side, max(latest) AS latest FROM legs GROUP BY other, side
  )
  SELECT f.other::text AS code FROM best f
  JOIN best t ON t.other = f.other AND t.side = @to_code::text
  WHERE f.side = @from_code::text AND f.other NOT IN (@from_code::text, @to_code::text)
  ORDER BY least(f.latest, t.latest) DESC, f.other
  LIMIT 1;
  ```
- Modify: `docs/adr/005-cross-cutting-conventions.md` section 2 (conversion path)
- Test: `internal/marketdata/convert_test.go`

- [ ] **Step 1: Write the failing tests** (prices recorded with `POST /api/v1/prices`):
  - `TestConvertThroughIntermediate`: prices `EUR/USD 1.10` and `EUR/GBP 0.85` on 2026-10-01 only; `Convert(100.00 USD → GBP, 2026-10-02)` = `77.27 GBP` (100 ÷ 1.10 × 0.85, half to even) with 2 prices.
  - `TestIntermediateChoice`: also `BRL/USD 0.20` and `BRL/GBP 0.15` on 2026-10-20 → `Convert(… , 2026-10-21)` uses `BRL` (newer); with all four on the same date, `BRL` before `EUR` by code.
  - `TestIntermediateOldLeg`: `EUR/USD` on 2026-03-16 and `EUR/GBP` on 2026-10-02 → success with both prices and their dates.
  - `TestNoPath`: no price → `errors.Is(err, marketdata.ErrPriceMissing)`.
  - Existing `TestConvert` passes.
- [ ] **Step 2:** `go test ./internal/marketdata/ -run 'Convert|Intermediate|NoPath'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(marketdata): convert through any instrument priced against both sides`.

### Task 17: Exchanges as MIC and universal instrument types

**Files:**
- Create: `db/migrations/00044_marketdata_mic_types.sql`: drop the type check (`00003_marketdata.sql:4`) and the exchange check (`00021_marketdata_prices.sql:4`); `UPDATE marketdata_instrument SET exchange = 'BVMF' WHERE exchange = 'B3'`; `UPDATE ... SET instrument_type = 'reit' WHERE instrument_type = 'fii'`; `... 'depositary_receipt' WHERE ... 'bdr'`; add `CHECK (instrument_type IN ('currency','stock','etf','reit','depositary_receipt','fixed_income','fund','crypto'))` and `CHECK (exchange ~ '^[A-Z0-9]{4}$')`. Apply the same type rename to `portfolio_realized_result.tax_class` rows (Task 20 rebuilds them).
- Modify: `internal/marketdata/internal/domain/instrument.go:16,26,44-45` (`SecurityTypes`; exchange rule `must be an ISO 10383 MIC`, pattern `^[A-Z0-9]{4}$`)
- Modify: `api/openapi.yaml:5441` (type enum), `:5458-5483` (`exchange`: `pattern: "^[A-Z0-9]{4}$"`)
- Modify: `internal/marketdata/internal/feed/b3cotahist/b3cotahist.go` (`BVMF`)
- Test: `internal/marketdata/instruments_test.go`, `internal/marketdata/mic_migration_test.go` (new, after `internal/ledger/link_migration_test.go`: `pgtest.Empty`, `postgres.MigrateTo(ctx, pool, 43, log)`, insert, migrate up, read)

- [ ] **Step 1: Write the failing tests.** `POST /api/v1/instruments` with `exchange: "B3"` → 400 `invalid_request` field `exchange`; `"BVMF"` → 201; `type: "fii"` → 400 field `type`; `"reit"` → 201. Migration test: row `('MXRF11', 'fii', 0, 'Maxi Renda', 'BRL', 'B3')` reads `('reit', 'BVMF')` after migrating up.
- [ ] **Step 2:** `go test ./internal/marketdata/ -run 'Instrument|Mic'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`. Update the existing tests that create `fii` or `B3` instruments (search `grep -rn '"fii"\|"B3"\|"bdr"' internal web/src`) to the new values, with the spec section in the commit body.
- [ ] **Step 4:** Run → PASS; `go test ./internal/marketdata/... ./internal/portfolio/... ./internal/ledger/ -run 'Trade|Income|Securit'` → PASS.
- [ ] **Step 5:** Commit `feat(marketdata)!: identify exchanges by MIC and use universal instrument types` (body: spec §5.4).

---

## Phase E: Ledger

### Task 18: Institution identifiers

**Files:**
- Create: `db/migrations/00045_ledger_institution_identifier.sql`: add `identifier_scheme text CHECK (identifier_scheme ~ '^[a-z0-9_]{2,40}$')`, `identifier text CHECK (length(identifier) BETWEEN 1 AND 40)`, `CHECK ((identifier_scheme IS NULL) = (identifier IS NULL))`, unique index on `(user_id, identifier_scheme, identifier)`; `UPDATE ledger_institution SET identifier_scheme = 'br_ispb', identifier = ispb WHERE ispb IS NOT NULL`; drop index `ledger_institution_ispb_key` and column `ispb`
- Create: `internal/ledger/internal/domain/identifier.go`: `type IdentifierScheme struct{ ID string; Pattern *regexp.Regexp }`; schemes `br_ispb` `^[0-9]{8}$`, `bic` `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$`; `func ValidateIdentifier(scheme, identifier string) error` (fields `scheme` and `identifier`)
- Modify: `db/queries/ledger/reference.sql`, `internal/ledger/internal/app/service.go`, `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/adapter/httpapi/server.go`, `convert.go`, `internal/ledger/internal/adapter/postgres/repository.go`, `mapping.go`
- Modify: `api/openapi.yaml` (replace operation `setInstitutionISPB` with `PUT /institutions/{id}/identifier` `setInstitutionIdentifier`, body `{scheme, identifier}`; `Institution` replaces `ispb` with `identifier: {scheme, identifier} | null`; new `GET /institution-identifier-schemes` `listInstitutionIdentifierSchemes` → `{items: [{id, pattern}]}`)
- Modify: `internal/server/tool_exposure_test.go` (remove `setInstitutionISPB`; add `"setInstitutionIdentifier": "-write"`, `"listInstitutionIdentifierSchemes": "-pending"`)
- Test: `internal/ledger/institution_test.go`, `internal/ledger/schema_test.go`, `internal/ledger/identifier_migration_test.go` (new)

- [ ] **Step 1: Write the failing tests.** PUT `{scheme: "bic", identifier: "BOFAUS3NXXX"}` → 200, GET shows it; `{scheme: "bic", identifier: "BOFA"}` → 422 field `identifier`; `{scheme: "xx_yy", identifier: "1"}` → 422 field `scheme`; the same pair on a second institution → the status and code that `institution_test.go` expects today for a duplicate ISPB. Migration test: ISPB `00360305` before → `('br_ispb', '00360305')` after. Existing ISPB tests in `institution_test.go` move to the new endpoint (spec §5.7 in the commit body).
- [ ] **Step 2:** `go test ./internal/ledger/ -run 'Institution|Identifier'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ledger)!: identify institutions by scheme and identifier`.

### Task 19: Foreign charge

**Files:**
- Create: `db/migrations/00046_ledger_card_foreign_charge.sql` (`ALTER TABLE ledger_card ADD COLUMN foreign_charge_bp int NOT NULL DEFAULT 350 CHECK (foreign_charge_bp BETWEEN 0 AND 10000)`, then `ALTER COLUMN foreign_charge_bp DROP DEFAULT`)
- Modify: `internal/ledger/region_defaults.go` (`func DefaultForeignChargeBP(region string) int`: `BR` 350, any other 0)
- Modify: `internal/ledger/internal/app/currency.go:17-30` (delete `DefaultIOFRateBP`; `ForeignPurchase` fields `ForeignChargeCategoryID uuid.UUID`, `ForeignChargeRateBP *int`; nil rate uses the card's `foreign_charge_bp`)
- Modify: card creation and card read in `internal/ledger/internal/app/card_operations.go` and the card queries (body field `foreign_charge_bp` optional; default from the region through `Profiles`)
- Modify: `internal/ledger/internal/adapter/httpapi/currency.go:23-24`; `api/openapi.yaml:673` (summary without IOF), `:6206-6215` (`foreign_charge_rate_bp`, `foreign_charge_category_id`), card schemas (`foreign_charge_bp`)
- Test: `internal/ledger/currency_test.go` (`TestS16ForeignPurchase` uses the new field names), `internal/ledger/foreign_charge_test.go` (new)

- [ ] **Step 1: Write the failing tests.** `TestForeignChargeDefaults`: BR user card → `foreign_charge_bp` 350; foreign purchase of `100.00 USD` at rate `5.0000` without a rate → postings `−500.00 BRL` purchase and `−17.50 BRL` foreign charge on the card, `+17.50` on the given category; DE user (EUR) card → 0 and a purchase without a charge posting; explicit `foreign_charge_rate_bp: 100` on the BR card → `−5.00`; after `PATCH /me {"region":"BR"}` for the DE user, the existing card still reads 0.
- [ ] **Step 2:** `go test ./internal/ledger/ -run 'ForeignCharge|S16'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ledger)!: model IOF as a per-card foreign charge` (body: spec §5.8).

---

## Phase F: Portfolio

### Task 20: Jurisdiction interface and the `br` implementation

**Files:**
- Create: `internal/portfolio/internal/domain/jurisdiction.go`:
  ```go
  var UniversalIncomeTypes = []string{"coupon", "distribution", "dividend", "interest"}
  type Jurisdiction interface {
  	ID() string
  	IncomeTypes() []string
  	TaxClass(instrumentType, exchange string) string
  	Treatment(incomeType string) string // "" when the type has no treatment
  }
  ```
- Create: `internal/portfolio/internal/jurisdiction/br/br.go` (`reit`+`BVMF` → `fii`; `depositary_receipt`+`BVMF` → `bdr`; other → the type; `dividend` → `exempt`; `jcp`, `interest`, `coupon`, `distribution` → `exclusive`; `IncomeTypes` → `["jcp"]`)
- Create: `internal/portfolio/region_defaults.go` (`BR` → `br`)
- Modify: `internal/portfolio/internal/domain/rebuild.go:15-18,128-140` (delete the treatment constants; `Rebuild` takes a `Jurisdiction`, nil allowed; nil → empty tax class and treatment)
- Modify: `internal/portfolio/portfolio.go:36` (`New(pool, dispatcher, l, md, profiles Profiles, log)`; the rebuild reads the owner's profile), `internal/server/server.go:97`
- Test: `internal/portfolio/internal/jurisdiction/br/br_test.go`, `internal/portfolio/internal/domain/rebuild_test.go`

- [ ] **Step 1: Write the failing tests.** `TestBR`: `TaxClass("reit","BVMF")` = `fii`; `TaxClass("depositary_receipt","BVMF")` = `bdr`; `TaxClass("reit","XNYS")` = `reit`; `Treatment("dividend")` = `exempt`; `Treatment("jcp")` = `exclusive`. `TestRebuildWithoutJurisdiction`: the rebuild of a sale and a dividend with a nil jurisdiction yields `TaxClass == ""` and `TaxTreatment == ""`.
- [ ] **Step 2:** `go test ./internal/portfolio/... -run 'BR|Rebuild'` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `go test ./internal/portfolio/...` → PASS.
- [ ] **Step 5:** Commit `refactor(portfolio): derive tax data through a jurisdiction`.

### Task 21: Income types in schema and contract; rebuild command

**Files:**
- Create: `db/migrations/00047_tax_jurisdiction.sql`: in `ledger_investment_income` and `portfolio_income_event`, replace the `income_type IN (...)` checks with the identifier check; `portfolio_income_event.tax_treatment` and `portfolio_realized_result.tax_class` drop `NOT NULL` and get the identifier check (null allowed)
- Modify: `internal/ledger/internal/domain/income.go:16,46` (keep `IncomeJCP` out of ledger: delete the enumerated check; validate `registry.ValidID`; message `must match ^[a-z0-9_]{2,40}$`)
- Modify: `internal/portfolio/internal/adapter/postgres/repository.go`, `internal/portfolio/internal/adapter/httpapi/server.go:75,90` (null → JSON null)
- Modify: `api/openapi.yaml:6027-6029` (`IncomeType` → `type: string, pattern`), `:6168-6170` (`tax_treatment` nullable pattern), `tax_class` nullable; new `GET /investment-income-types` `listInvestmentIncomeTypes` (tag `portfolio`) → `{items: [string]}`
- Modify: `internal/server/tool_exposure_test.go` (`"listInvestmentIncomeTypes": "-pending"`)
- Modify: `cmd/equori/main.go` (command `portfolio` with argument `rebuild`, after `reportingCommand`; usage `usage: equori portfolio rebuild`); `internal/portfolio/portfolio.go` (`func (m *Module) RebuildAll(ctx context.Context) error`)
- Test: `internal/portfolio/jurisdiction_test.go` (new)

- [ ] **Step 1: Write the failing tests** through the HTTP API: BR user records a `dividend` and a `jcp` → `GET /income-events?year=2026` treatments `exempt` and `exclusive`; DE user records a `dividend` → `tax_treatment` null; DE user records `jcp` → 201 and treatment null; `income_type: "Bad!"` → 400 field `income_type`; `GET /investment-income-types` → BR `["coupon","distribution","dividend","interest","jcp"]`, DE `["coupon","distribution","dividend","interest"]`. `TestRebuildAll`: after a direct `UPDATE portfolio_income_event SET tax_treatment = NULL`, `RebuildAll` restores `exempt`.
- [ ] **Step 2:** `go test ./internal/portfolio/ -run 'Jurisdiction|IncomeTypes|RebuildAll'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/ledger/ -run Income` → PASS.
- [ ] **Step 5:** Commit `feat(portfolio)!: open income types per jurisdiction` with a footer telling operators to run `equori portfolio rebuild` once.

---

## Phase G: Ingestion and Classification

### Task 22: Aggregator port with identity and capabilities

**Files:**
- Modify: `internal/ingestion/internal/app/integration.go:41-58` (add to `Aggregator`: `ID() string`, `CredentialFields() []CredentialField`, `ConnectMethod() string`, `MinSyncInterval() time.Duration`, `State(providerStatus string) domain.ConnectionState`)
- Create: `internal/ingestion/internal/domain/connection_state.go`: `type ConnectionState string`; `StateOK = "ok"`, `StateNeedsOwner = "needs_owner"`, `StateFailed = "failed"`
- Move: `internal/ingestion/aggregator.go` → `internal/ingestion/internal/aggregator/pluggy/port.go` (package `pluggy`, type `Port`, `func NewPort(baseURL string, hc *http.Client, clk clock.Clock) (*Port, error)`); `internal/ingestion/internal/pluggy/` → `internal/ingestion/internal/aggregator/pluggy/client/` (package `client`; `pluggytest` moves with it)
- Modify: `internal/ingestion/internal/app/sync.go:16-20` (`blockedStatuses` moves to `Port.State`: those statuses → `needs_owner`, `UPDATED` → `ok`, any other → `failed`; sync reads `Aggregator.State`)
- Modify: `internal/ingestion/ingestion.go:23,42-64` (the module holds `map[string]app.Aggregator` built from a registry; Pluggy is its only entry)
- Test: `internal/ingestion/internal/aggregator/pluggy/port_test.go`, existing `internal/ingestion/sync_test.go`, `connection_test.go`

- [ ] **Step 1: Write the failing test** `TestPluggyPortCapabilities`: `ID()` = `pluggy`; `CredentialFields()` = `[{client_id false} {client_secret true}]`; `ConnectMethod()` = `reference`; `MinSyncInterval()` = `time.Minute`; `State("LOGIN_ERROR")` = `needs_owner`; `State("UPDATED")` = `ok`; `State("ERROR")` = `failed`.
- [ ] **Step 2:** `go test ./internal/ingestion/... -run 'PluggyPort'` → FAIL.
- [ ] **Step 3:** Implement the moves with `git mv`; fix imports.
- [ ] **Step 4:** Run → PASS; `go test ./internal/ingestion/...` → PASS.
- [ ] **Step 5:** Commit `refactor(ingestion): move Pluggy behind a self-describing aggregator port`.

### Task 23: Generic credentials, aggregator listing, configuration

**Files:**
- Modify: `internal/ingestion/internal/domain/integration.go:14,39-45` (delete `ProviderPluggy`; `type Credentials map[string]string` with `String`/`GoString` returning `credentials`; `func (c Credentials) Validate(fields []CredentialField) error`: each declared field non-empty, field `credentials.<name>`, message `is required`; an undeclared member: field `credentials.<name>`, message `is not a field of this aggregator`)
- Modify: integration create/update in `internal/ingestion/internal/app/integration.go` and `internal/ingestion/internal/adapter/httpapi/` (credentials sealed as JSON of the map; ADR 008 unchanged)
- Modify: `internal/platform/config/config.go:30-31,48,70-72` (delete `PluggyURL`)
- Modify: `cmd/equori/main.go` `serverConfig` (for each id of `ingestion.AggregatorIDs()`: `EQUORI_AGGREGATOR_<ID>_URL` into `AggregatorURLs`), `internal/server/server.go` (`Config.AggregatorURLs map[string]string`; delete `PluggyURL`), `internal/ingestion/ingestion.go` (`Config.URLs map[string]string`; `func AggregatorIDs() []string`)
- Modify: `internal/apitest/apitest.go:106-109` (`Aggregator(id, url string) Option` sets `AggregatorURLs[id]` and the secret key; delete `Pluggy`; update callers with `grep -rln 'apitest.Pluggy' internal`)
- Modify: `api/openapi.yaml` (new `GET /aggregators` `listAggregators` → `{items: [{id, name, credential_fields: [{name, secret}], connect_method}]}`; integration `credentials` becomes `type: object, additionalProperties: {type: string}`)
- Modify: `internal/server/tool_exposure_test.go` (`"listAggregators": "-pending"`), `docs/operations/pluggy.md` (`EQUORI_AGGREGATOR_PLUGGY_URL`)
- Test: `internal/ingestion/aggregators_test.go` (new)

- [ ] **Step 1: Write the failing tests.** `GET /api/v1/aggregators` → `[{"id":"pluggy","name":"Pluggy","credential_fields":[{"name":"client_id","secret":false},{"name":"client_secret","secret":true}],"connect_method":"reference"}]`; create an integration with credentials `{"client_id":"a"}` → 422 field `credentials.client_secret`; with `{"client_id":"a","client_secret":"b","x":"1"}` → 422 field `credentials.x`; the S51–S59 scenario tests pass against the fake Pluggy.
- [ ] **Step 2:** `go test ./internal/ingestion/ -run 'Aggregators|S5'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ingestion)!: declare aggregator credentials and list aggregators` with footer `BREAKING CHANGE: EQUORI_PLUGGY_URL is EQUORI_AGGREGATOR_PLUGGY_URL`.

### Task 24: One term for aggregators across schema and contract

**Files:**
- Create: `db/migrations/00048_aggregator_term.sql`: `ALTER TABLE ingestion_integration RENAME COLUMN provider TO aggregator` and replace its check with the identifier check; same for `classification_source_category` (and its unique constraint keeps working on the renamed column); `ingestion_batch.source` and `ledger_reconciliation.source`: replace `open_finance` with `aggregator` in data and in the checks (`ingestion_batch`: `('ofx','csv','aggregator')`; `ledger_reconciliation`: `('manual','import','aggregator')`)
- Modify: queries in `db/queries/ingestion/`, `db/queries/classification/`, `db/queries/ledger/` that name these columns or values; `internal/classification/classification.go` (`LineCategory.Provider` → `Aggregator`), `internal/classification/internal/app/ports.go:90`, `internal/classification/internal/adapter/postgres/source_category.go:30-31`, `internal/ingestion/ingestion.go:154-158`
- Modify: `api/openapi.yaml:3157,3226,4333,4371,4406,4455,4463,4716,4879,2891` (`provider` → `aggregator` with the identifier pattern; `item_id` → `external_id`; the connection gains `state` enum `[ok, needs_owner, failed]`; descriptions name no aggregator; `open_finance` → `aggregator` in both enums)
- Modify: every Go and web caller reported by `make gen` and `make web-check` failures (web types come from `schema.gen.ts`)
- Test: `internal/ingestion/schema_test.go`, `internal/classification/source_category_test.go`, `internal/ingestion/connection_test.go`

- [ ] **Step 1: Write the failing tests.** Schema: `INSERT INTO ingestion_batch (..., source) VALUES (..., 'open_finance')` rejected; `POST /integrations {"aggregator":"plaid", ...}` → 422 field `aggregator`; `GET /connections/{id}` carries `state` `needs_owner` when the fake Pluggy item is `LOGIN_ERROR`; the source category of a synced line carries `aggregator: "pluggy"`.
- [ ] **Step 2:** `go test ./internal/ingestion/ ./internal/classification/ -run 'Schema|SourceCategory|Connection'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`; fix compile errors in Go and `web/`.
- [ ] **Step 4:** Run → PASS; `go test ./internal/ingestion/... ./internal/classification/... ./internal/ledger/ -run Reconcil` → PASS; `make web-check` → PASS.
- [ ] **Step 5:** Commit `refactor(ingestion)!: name the aggregator consistently in schema and contract` (body: spec §5.10).

### Task 25: File encodings

**Files:**
- Create: `internal/ingestion/internal/charset/registry.go`: `func Decoder(name string) (encoding.Encoding, bool)` for `utf-8`, `windows-1252`, `iso-8859-1`, `iso-8859-15`, `windows-1250`, `windows-1251`, `shift_jis`, `gb18030`, `euc-kr`, `big5`; `func Names() []string` including `auto`
- Modify: `internal/ingestion/internal/charset/charset.go:15-30` (`func Decode(data []byte, name string) (string, error)`: UTF-8 BOM → strip, UTF-8; `auto` → UTF-8 when valid, else `windows-1252`; named → that decoder; unknown → error). `Text` is deleted; callers use `Decode(data, "auto")`.
- Modify: `internal/ingestion/internal/ofx/ofx.go:26` (read the SGML header `CHARSET:` (`1252` → `windows-1252`, `ISO-8859-1` → `iso-8859-1`, `UTF-8`/`65001` → `utf-8`) or the XML declaration `encoding="…"` lowercased; else `auto`)
- Modify: `internal/ingestion/internal/csvfile/csvfile.go:21` (profile encoding)
- Create: `db/migrations/00049_ingestion_csv_encoding.sql` (`ADD COLUMN encoding text NOT NULL DEFAULT 'auto' CHECK (encoding ~ '^[a-z0-9_-]{2,40}$')`; the default stays: `auto` is universal)
- Modify: `internal/ingestion/internal/domain/profile.go` (field `Encoding`, validated against `charset.Names()`, field `encoding`, message `must be one of ...`), CSV profile queries, `api/openapi.yaml` (CSV profile `encoding`, `type: string`, `pattern: "^[a-z0-9_-]{2,40}$"`, default `auto`)
- Test: `internal/ingestion/internal/charset/charset_test.go`, `internal/ingestion/internal/ofx/ofx_test.go`, `internal/ingestion/profile_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func TestDecode(t *testing.T) {
	cyrillic, _ := charmap.Windows1251.NewEncoder().String("Магазин")
	latin, _ := charmap.Windows1252.NewEncoder().String("Café")
	for _, c := range []struct{ data, name, want string }{
		{cyrillic, "windows-1251", "Магазин"},
		{latin, "auto", "Café"},
		{"\xef\xbb\xbfCafé", "windows-1252", "Café"},
		{"Café", "auto", "Café"},
	} {
		got, err := charset.Decode([]byte(c.data), c.name)
		if err != nil || got != c.want {
			t.Errorf("Decode(%q, %s) = %q, %v", c.data, c.name, got, err)
		}
	}
	if _, err := charset.Decode([]byte("x"), "ebcdic"); err == nil {
		t.Error("ebcdic accepted")
	}
}
```

OFX: a 1.02 file with `CHARSET:1252` and memo bytes `Caf\xe9` reads `Café`; a 2.x file with `<?xml version="1.0" encoding="ISO-8859-1"?>` reads `Café`. Profile: `encoding: "ebcdic"` → 422 field `encoding`.
- [ ] **Step 2:** `go test ./internal/ingestion/... -run 'Decode|OFX|Profile'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ingestion): decode imports by declared encoding`.

### Task 26: CSV date layouts, group separator, amount reading

**Files:**
- Create: `db/migrations/00050_ingestion_csv_formats.sql`: replace the `date_layout IN` check (`00010_ingestion.sql:9`) with `CHECK (date_layout ~ '^(DD|MM|YYYY|YY)([/. -])(DD|MM|YYYY|YY)\2(DD|MM|YYYY|YY)$')`; add `group_separator text NOT NULL DEFAULT '' CHECK (group_separator IN (',', '.', ' ', U&'\00A0', '''', ''))`; `UPDATE ingestion_csv_profile SET group_separator = CASE decimal_separator WHEN ',' THEN '.' ELSE ',' END`
- Modify: `internal/ingestion/internal/domain/profile.go` (layout: each of day, month, year exactly once, field `date_layout`; parse by building a Go layout from the tokens), `internal/ingestion/internal/domain/amount.go:9-30` (`func MinorUnits(s string, decimal, group rune, scale int) (int64, error)`)
- Modify: `api/openapi.yaml:4675` (pattern of `date_layout`), `:4690` (unchanged decimal enum) and `group_separator` (`enum: [",", ".", " ", " ", "'", ""]`)
- Test: `internal/ingestion/internal/domain/amount_test.go`, `internal/ingestion/internal/domain/profile_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func TestMinorUnitsConventions(t *testing.T) {
	for _, c := range []struct {
		in             string
		decimal, group rune
		want           int64
	}{
		{"€ 1.234,50", ',', '.', 123450},
		{"CHF 1'234.50", '.', '\'', 123450},
		{"(12.50)", '.', ',', -1250},
		{"12,50-", ',', '.', -1250},
		{"R$ 10,00", ',', '.', 1000},
		{"USD 10.00", '.', ',', 1000},
		{"10.00 USD", '.', ',', 1000},
		{"1 234,50", ',', ' ', 123450},
	} {
		got, err := domain.MinorUnits(c.in, c.decimal, c.group, 2)
		if err != nil || got != c.want {
			t.Errorf("MinorUnits(%q) = %d, %v; want %d", c.in, got, err, c.want)
		}
	}
}
```

Profile: layout `DD.MM.YYYY` reads `05.11.2026` as `2026-11-05`; `YYYY/MM/DD` reads `2026/11/05`; `DD/DD/YYYY` → error field `date_layout`.
- [ ] **Step 2:** `go test ./internal/ingestion/internal/domain/ -run 'MinorUnits|Layout'` → FAIL.
- [ ] **Step 3:** Implement; `make gen`; callers pass the profile's group separator.
- [ ] **Step 4:** Run → PASS; `go test ./internal/ingestion/...` → PASS.
- [ ] **Step 5:** Commit `feat(ingestion): read CSV dates and amounts by profile conventions`.

---

## Phase H: Capture

### Task 27: Lexicon extraction

**Files:**
- Create: `internal/capture/internal/domain/lexicon.go`:
  ```go
  type Lexicon struct {
  	Language         string
  	DaysBack         map[string]int
  	Weekdays         map[string]time.Weekday
  	Multipliers      map[string]int64
  	CurrencyWords    map[string]money.Currency
  	CurrencySymbols  map[string]money.Currency
  	CountWords       []string // "x", "vezes", "parcelas"
  	InstallmentLeads []string // "parcelado", "parcelada", "em"
  	LumpSum          [][]string // {"a", "vista"}
  	Of               []string // "de"
  	Destination      []string
  	Source           []string
  	Methods          map[string]method
  }
  func Merge(primary, fallback Lexicon) Lexicon // primary entries win
  ```
- Create: `internal/capture/internal/domain/lexicon_pt.go` (`var Portuguese = Lexicon{...}` holding the Portuguese words now in `date.go:9-16`, `amount.go:94,127,130`, `installments.go:33-62`, `account.go:60-61,124-127`), `lexicon_en.go` (`var English` with the English words of the same lines)
- Modify: those four files: every word list is read from a `Lexicon`; `Vocabulary` gains `Lexicon Lexicon`
- Modify: `internal/capture/internal/app/service.go` (fills `Vocabulary.Lexicon = domain.Merge(domain.Portuguese, domain.English)`, the current behavior)
- Test: existing `internal/capture/internal/domain/read_test.go`, new `lexicon_test.go`

- [ ] **Step 1: Write the failing test** `TestMergePrimaryWins`: `Merge(Lexicon{DaysBack: {"hoje":0}}, Lexicon{DaysBack: {"hoje":5, "today":0}})` → `DaysBack == {"hoje":0, "today":0}`.
- [ ] **Step 2:** `go test ./internal/capture/internal/domain/ -run TestMerge` → FAIL.
- [ ] **Step 3:** Implement; `read_test.go`'s `vocabulary()` sets `Lexicon: Merge(Portuguese, English)`.
- [ ] **Step 4:** `go test ./internal/capture/...` → PASS with no expected value changed.
- [ ] **Step 5:** Commit `refactor(capture): hold the words of each language in a lexicon`.

### Task 28: Reading by the user's language and conventions

**Files:**
- Create: `internal/capture/internal/domain/conventions.go`: `type DateOrder string` (`"dmy"`, `"mdy"`, `"ymd"`); `type Conventions struct{ Decimal, Group rune; Order DateOrder }`; `Vocabulary` gains `Conventions Conventions`
- Modify: `internal/capture/internal/domain/amount.go:25-48` (`parseNumber` uses `Conventions.Decimal`/`Group`), `date.go:18-22` (`dayMonth` reads day and month by `Conventions.Order`; `ymd` reads `MM/DD` for two-part dates)
- Modify: `internal/capture/capture.go:32` (`New(pool, l, c, profiles Profiles, router, clk, log)`), `internal/capture/internal/app/service.go` (lexicon `Merge(lexiconOf(language), English)`; conventions from `locale.ConventionsOf`), `internal/server/server.go:89`
- Test: `internal/capture/internal/domain/read_test.go`, `internal/capture/locale_test.go` (new, through the HTTP API)

- [ ] **Step 1: Write the failing tests** in `read_test.go` (today `2026-11-20`): with `Conventions{'.', ',', MDY}` and `Merge(English, English)`: `lunch 25.90 05/11` → amount 2590, date `2026-05-11`; `1,234.50 rent` → 123450. With `{'.', ',', DMY}`: `05/11` → `2026-11-05`. With `{',', '.', DMY}` and Portuguese: `1.234,50 aluguel` → 123450 (existing cases unchanged). With `{',', '.', DMY}` and `Merge(English, English)` (a `de` user, no German lexicon): `today 12,50` → today, 1250. HTTP test: a DE (`en`) user posts the preview of `lunch 12,50` and gets amount 1250.
- [ ] **Step 2:** `go test ./internal/capture/... -run 'Read|Locale'` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `go test ./internal/capture/...` → PASS.
- [ ] **Step 5:** Commit `feat(capture): read amounts and dates by the user's conventions`.

### Task 29: Suggestion prompt by locale

**Files:**
- Modify: `internal/capture/internal/adapter/llmapi/suggester.go:17-22` (`func systemPrompt(l locale.Locale) string`; the second sentence becomes `The descriptions are short texts the owner typed, mostly in <locale.EnglishName(l)>, often a shop or service name.`); the suggest call receives the locale
- Modify: `docs/adr/014-capture-category-suggestions.md` L2 (the prompt names the owner's language and region)
- Test: `internal/capture/internal/adapter/llmapi/suggester_test.go`

- [ ] **Step 1: Write the failing test** `TestSystemPrompt`: `systemPrompt({pt, BR})` contains `mostly in Portuguese (Brazil)`; `systemPrompt({en, GB})` contains `mostly in English (United Kingdom)`; neither contains `Brazilian owner`.
- [ ] **Step 2:** `go test ./internal/capture/internal/adapter/llmapi/ -run TestSystemPrompt` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `make check` (end of the backend phases) → PASS.
- [ ] **Step 5:** Commit `feat(capture): name the owner's language in the suggestion prompt`.

---

## Phase I: Web


### Task 30: Language registry and profile-driven locale

**Files:**
- Create: `web/src/i18n/languages.ts`:
  ```ts
  export const languages = [
    { language: "en", nativeName: "English", catalog: catalogEn },
    { language: "pt", nativeName: "Português", catalog: catalogPtBR, slotted: PT_BR },
  ] as const;
  export type Language = (typeof languages)[number]["language"];
  export function matchLanguage(tags: readonly string[]): Language; // by primary subtag; "en" when none matches
  ```
- Modify: `web/src/i18n/locale.ts` (`Locale` becomes `{ language: Language; region: string }`; `tagOf(l)` → `"pt-BR"`; storage key `equori.locale` stores the JSON pair; `readLocale()` falls back to `{matchLanguage(navigator.languages), region: navigator.language.split("-")[1] ?? "US"}`)
- Modify: `web/src/i18n/i18n-provider.tsx` (context exposes `tag` and `language`; once `GET /me` loads, its `language`/`region` replace the stored pair), `web/src/app/slotted-locale.tsx` (catalogs from `languages`), `web/src/app/shell/command-menu.tsx:26`, `more-sheet.tsx:43`, `account-menu.tsx:28` (menus list `languages`; choosing one sends `PATCH /api/v1/me {language}`)
- Modify: every caller of `Locale` as a string that `make web-check` reports: functions of `format.ts` take the tag string (`tagOf(locale)`)
- Test: `web/src/i18n/i18n-provider.test.tsx`, `web/src/i18n/languages.test.ts` (new)

- [ ] **Step 1: Write the failing tests.** `matchLanguage(["pt-PT","en"])` → `"pt"`; `matchLanguage(["de-DE"])` → `"en"`; provider with `GET /me` mocked as `{language:"en", region:"DE"}` exposes `tag` `"en-DE"`; choosing Português in the account menu sends `PATCH /api/v1/me` with `{language:"pt"}`; each of the three menus renders `English` and `Português`.
- [ ] **Step 2:** `cd web && pnpm exec vitest run src/i18n src/app/shell` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `make web-check` → PASS.
- [ ] **Step 5:** Commit `feat(web): take language and region from the profile`.

### Task 31: Formatting from Intl only

**Files:**
- Modify: `web/src/i18n/format.ts:104-140` (`formatMoney` assembles sign, symbol, gap and number in the order and with the literal of `formatToParts`; `parseAmount` reads group and decimal from `new Intl.NumberFormat(tag).formatToParts(1234.5)`), `:183-195` (`formatDayMonth` joins the `day` and `month` parts in their Intl order with one space), `web/src/features/accounts/account-card-money.ts:5-7` (gap from the parts), `web/src/features/admin/draft.ts:92` (the active tag)
- Test: `web/src/i18n/format.test.ts`

- [ ] **Step 1: Write the failing tests** (values measured with Node 24 ICU; existing `pt-BR` and `en` cases unchanged):

```ts
describe("Intl-derived formats", () => {
  it.each([
    [{ amount: 123450, currency: "EUR" }, 2, "de-DE", "1.234,50 €"],
    [{ amount: 1234567, currency: "KWD" }, 3, "en-US", "KWD 1,234.567"],
    [{ amount: 1234, currency: "JPY" }, 0, "ja-JP", "￥1,234"],
    [{ amount: 123450, currency: "EUR" }, 2, "en-DE", "€1,234.50"],
  ])("formats %o at scale %d in %s", (m, scale, tag, want) => {
    expect(formatMoney(m, scale, tag)).toBe(want);
  });
  it.each([
    ["1.234,50", 2, "de-DE", 123450],
    ["1'234.50", 2, "de-CH", 123450],
    ["1,234", 0, "ja-JP", 1234],
    ["1,234.567", 3, "en-US", 1234567],
  ])("parses %s at scale %d in %s", (text, scale, tag, want) => {
    expect(parseAmount(text, scale, tag)).toBe(want);
  });
  it("orders day and month by locale", () => {
    expect(formatDayMonth("2026-10-16", "en-GB")).toBe("16 Oct");
    expect(formatDayMonth("2026-10-16", "en-US")).toBe("Oct 16");
  });
  it("formats partial locales without throwing", () => {
    expect(() => formatMoney({ amount: 123450, currency: "AOA" }, 2, "pt-AO")).not.toThrow();
  });
});
```

  Before writing each formatted expectation, print the value with `node -e` (for example `new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(1234.5)`) and copy its exact characters; the space characters inside are no-break spaces in current ICU, written ` ` in the test.
- [ ] **Step 2:** `cd web && pnpm exec vitest run src/i18n/format.test.ts` → FAIL.
- [ ] **Step 3:** Implement. O7 stays: `formatPlain` produces the decimal string Intl reads.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `refactor(web): derive every number and date format from Intl`.

### Task 32: No currency fallback; collation by locale

**Files:**
- Modify: `web/src/features/accounts/import-page.tsx:84`, `candidate-card.tsx:38`, `account-card-preview.tsx:142`, `web/src/features/cards/card-plans.ts:28`, `statement-lines.tsx:92`, `plan-drawer.tsx:94`, `web/src/features/categories/categories-page.tsx:120`, `rule-editor.tsx:99`, `web/src/features/admin/use-admin-context.ts:62`, `operations.ts:661` (the quote currency comes from the instrument definition being written), `web/src/features/accounts/institution-catalogue.ts:17,22,51`, `link-candidates.ts:27`
- Test: co-located tests of each changed file (`*.test.tsx` beside it; create `card-plans.test.ts` when absent)

- [ ] **Step 1: Write the failing tests.** Categories page while `GET /settings` is pending renders its waiting state and no amount; with settings `EUR` the amounts carry `€`. `card-plans` with a plan without installments returns no amount. `sortInstitutions(["Ålandsbanken","Zeta","Aba"], "sv-SE")` → `["Aba","Zeta","Ålandsbanken"]`. `grep -rn '"BRL"' web/src --include='*.ts' --include='*.tsx' | grep -v test` returns no line.
- [ ] **Step 2:** Run the changed test files → FAIL.
- [ ] **Step 3:** Implement with the waiting states of the `waiting-states` skill.
- [ ] **Step 4:** Run → PASS; `make web-check` → PASS.
- [ ] **Step 5:** Commit `fix(web): take currency from data and collate by the active locale`.

### Task 33: Institution identifiers and logo resolvers

**Files:**
- Modify: `web/src/features/accounts/institution-logo.ts` (`const resolvers: Record<string, (identifier: string) => string | undefined> = { br_ispb: ispbLogo }`; `export function logoOf(id: { scheme: string; identifier: string } | null): string | undefined`), `institution-catalogue.ts` (catalogue entries carry `{scheme: "br_ispb", identifier}`; the catalogue is offered when the profile region is `BR`), `set-logo-dialog.tsx` (`PUT /institutions/{id}/identifier`), `institution-field.tsx`, `institutions-page.tsx`, `account-avatar.tsx`, `account-preview.tsx`, `web/src/features/cards/card-tile.tsx`, `web/src/features/transactions/use-account-choices.ts`, `web/src/features/accounts/api.ts`, `web/src/testing/account-api.ts`, `web/src/i18n/catalog-accounts.en.ts`, `catalog-accounts.pt-BR.ts`
- Modify: `docs/adr/013-institution-logos.md` (identifier schemes, resolvers per scheme)
- Test: `institution-logo.test.ts`, `institution-field.test.tsx`, `institutions-page.test.tsx`

- [ ] **Step 1: Write the failing tests.** `logoOf({scheme:"br_ispb", identifier:"00360305"})` equals the URL the current test of `institution-logo.test.ts` expects for ISPB `00360305`; `logoOf({scheme:"bic", identifier:"BOFAUS3N"})` → `undefined` and the avatar renders the monogram; the set-logo dialog sends `PUT /api/v1/institutions/<id>/identifier` with `{scheme:"br_ispb", identifier:"00360305"}`; for a profile with region `DE`, the institution field offers no Brazilian catalogue entry.
- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `make web-check` → PASS.
- [ ] **Step 5:** Commit `feat(web): resolve institution logos by identifier scheme`.

### Task 34: Aggregator form from the server

**Files:**
- Modify: the integration form under `web/src/features/connections/` (locate it with `grep -rln 'client_secret' web/src/features`): fields from `GET /api/v1/aggregators`; a field with `secret: true` renders a password input; the body sends `{aggregator, credentials}`
- Test: the form's co-located test

- [ ] **Step 1: Write the failing test.** With `GET /aggregators` mocked as the Task 23 response, the form renders `client_id` as a text input and `client_secret` as a password input; submitting sends `{"aggregator":"pluggy","credentials":{"client_id":"a","client_secret":"b"}}`; a 422 on `credentials.client_secret` marks that field.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per compose-screen. **Step 4:** Run → PASS; `make web-check`.
- [ ] **Step 5:** Commit `feat(web): build the aggregator form from the server`.

### Task 35: Regional settings screen

**Files:**
- Create: `web/src/i18n/regions.ts` (the ISO 3166-1 alpha-2 codes of `internal/platform/locale/regions.go`, same order)
- Create: `web/src/features/settings/settings-page.tsx`, `settings-page.test.tsx`, `api.ts`, `index.ts` (feature per O2); route and navigation entry in `web/src/app/` following an existing destination
- Test: `web/src/features/settings/settings-page.test.tsx`

- [ ] **Step 1: Write the failing tests.** The page lists regions named with `new Intl.DisplayNames([tag], {type: "region"})` (`PT` shows `Portugal` under `pt-BR`); choosing `PT` sends `PATCH /api/v1/me {"region":"PT"}`; the base currency selector sends `PUT /api/v1/settings`, and a 409 answer shows the catalog message for a currency locked by transactions.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per compose-screen. **Step 4:** Run → PASS; `make check` (end of Phase I) → PASS.
- [ ] **Step 5:** Commit `feat(web): edit language, region and base currency`.

---

## Phase J: Documents

### Task 36: Domain documents and contributor checklist

**Files:**
- Modify: `docs/domain/01-vision.md` (1.3; T06: calendar per card and per schedule from the region; G6: aggregators behind a registry, Pluggy first; D1: tax data derived per jurisdiction, `br` first)
- Modify: `docs/domain/04-contexts.md` (4.3.3 aggregators; 4.3.5 jurisdictions; 4.3.6 feeds, calendars, conversion path)
- Modify: `docs/domain/05-domain-model.md` (5.2.3 balancing currency: "the user's base currency"; 5.6 instrument types, MIC, tax class from the jurisdiction, calendars `br_banking` and `weekend`)
- Modify: `docs/domain/08-non-functional-requirements.md` (N21: languages from `web/src/i18n/languages.ts`; formats from `language-region`)
- Modify: `docs/domain/09-roadmap.md` (a row for this work naming the plan file)
- Create: `docs/contributing/regions.md`: one table row per extension point with columns interface file, implementation directory, registry constructor, region default file, test file — calendars (Task 9–10), price sources (13–15), identifier schemes (18), foreign charge default (19), jurisdictions (20), aggregators (22–23), encodings (25), lexicons (27), locale conventions (4); and the web files (`languages.ts`, catalogs, `institution-logo.ts`, `regions.ts`)

- [ ] **Step 1:** Write the changes; each statement names a file, a type or an identifier introduced in Tasks 1–35.
- [ ] **Step 2:** Run `grep -rn 'br_banking\|BRL\|\bB3\b\|pluggy\|IOF\|ISPB' docs/domain docs/adr`. Expected: every hit is a Brazilian example, the Brazilian row of a table, or ADR history.
- [ ] **Step 3:** `make check` → PASS; commit `docs: describe regional extension points and the region checklist`.
