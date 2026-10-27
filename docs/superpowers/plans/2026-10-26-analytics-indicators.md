# Analytics Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the financial indicators of the analytics design (savings rate, liquidity, committed share, debt service share, liabilities) as one API operation, an overview block, a reports tab and an assistant tool; add a hide control to overview blocks; replace two chart encodings.

**Architecture:** `reporting` owns `GET /reports/indicators`. It computes monthly cash-view income and expense from its existing cash allocation, reads loan principal and account facts with `SELECT` on ledger tables, and receives two late-bound sources from `internal/server`: the committed amount from `planning` and the valued balances from `portfolio`. A pure function turns 24 months of facts into 12 month entries. The web reads the operation in the overview and in `/reports`.

**Tech Stack:** Go 1.27 (stdlib, pgx, sqlc, oapi-codegen strict server, goose), PostgreSQL, React + TypeScript + Vite, `@slotted/react` 0.1.0-beta.16, TanStack Query and Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-analytics-design.md` (evidence: `docs/superpowers/specs/2026-10-26-analytics-study.md`). Read both before Task 1.

## Global Constraints

- Every rule of `CLAUDE.md` and `web/CLAUDE.md` applies. Read `web/CLAUDE.md` before Task 3.
- Scenario IDs S151 to S153 are taken by `docs/superpowers/plans/2026-10-26-distribution-f4-offline-capture.md`. This plan uses S154, S155 and S156.
- Migration number: `00061`. Applied migrations are never edited.
- Ratios are integers in basis points, truncated toward zero, computed with `math/big`. 10000 bp = 100% for a share; 10000 bp = one month for liquidity.
- Cash view everywhere in the indicators (design §4.1). The overview month block keeps its own computation.
- No threshold, no judgment color: `FigureCard` of an indicator uses `goodWhen="none"` and no `delta`.
- Liquid kinds: `checking`, `savings`, `cash`, `wallet`, `reserve` (class `asset`). `benefit` is never liquid.
- Minimum trailing history: 3 complete months. Trailing window: up to 12 complete months before the month, from the first posting month on.
- Reasons: exactly `no_income`, `no_expense`, `insufficient_history`.
- Privacy mode masks amounts and leaves percentages and months visible (ADR 018).
- localStorage key of hidden blocks: `equori.overview.hidden`, a JSON array of block ids.
- Commits: Conventional Commits, scope per module (`reporting`, `ledger`, `web`, `docs`), no tool or assistant names, no `Co-Authored-By`.
- Go tests need the test database: run `make db-test-up` once per session before any `go test`.
- Never pass `-tags eval` or `-tags live`.
- Execution slices: at most three tasks per slice, then write `.claude/progress/current.md` (user `CLAUDE.md`, "Execution slice protocol").

## Review Focus

1. A user with fewer than 3 months of records sees reasons, not zeros or errors. Test: `TestS155` (Task 5) and the reason test in `web/src/features/overview/indicators-block.test.tsx` (Task 7).
2. Expenses above income give a negative savings rate, truncated toward zero, never a reason. Test: case "expense above income" of `TestIndicatorMonths` (Task 4).
3. A liquid account in a foreign currency without a price returns 422 `price_missing`, not 500. Test: `TestIndicatorsPriceMissing` (Task 5).
4. A month after the current month returns 400 `invalid_request` on `month`. Test: `TestIndicatorsMonthProblems` (Task 5).
5. A browser that refuses `localStorage` shows every block and no error. Test: "shows every block when storage throws" in `web/src/features/overview/use-hidden-blocks.test.ts` (Task 8).

---

### Task 0: Preconditions

**Files:** none.

- [ ] **Step 1: Check the working tree**

Run: `git status --porcelain`
Expected: only these paths, untracked or modified:
`docs/superpowers/specs/2026-10-26-analytics-study.md`, `docs/superpowers/specs/2026-10-26-analytics-design.md`, `docs/superpowers/plans/2026-10-26-analytics-indicators.md`.
If any other path is listed (the export-archive work of 2026-10-26 touched `internal/reporting`, `api/openapi.yaml`, `db/migrations/00060_*`), STOP and ask the owner to commit or stash that work. Do not commit it.

- [ ] **Step 2: Check the archive version baseline**

Run: `grep -n "const ArchiveVersion" internal/reporting/internal/app/archive_steps.go && ls internal/reporting/testdata internal/reporting/internal/adapter/postgres/testdata`
Expected: `const ArchiveVersion = 1`, `archive-v1.zip`, `archive-v1.txt`. Any other value: STOP and report.

- [ ] **Step 3: Start the test database**

Run: `make db-test-up`
Expected: exit 0.

---

### Task 1: Scenarios and documents

**Files:**
- Modify: `docs/domain/06-scenarios.md` (append a section after S150)

- [ ] **Step 1: Append section 6.22 to `docs/domain/06-scenarios.md`**

Append exactly this text at the end of the file:

```markdown
## 6.22 Financial indicators

`GET /reports/indicators?month=` (`docs/superpowers/specs/2026-10-26-analytics-design.md`, section 4) returns 12 month entries, oldest first, the last one the month asked. Ratios are basis points truncated toward zero.

### S154 Indicators of a month

Today 2026-10-20, base BRL. Every month from 2026-04 to 2026-10: salary 5,000.00 on the 5th, rent 1,500.00 on the 10th, food 1,000.00 on the 15th, all on Checking. A personal loan of 10,000.00 enters Checking on 2026-06-01; installments of 1,250.00 (principal 900.00, interest 350.00 on the system category Interest) leave Checking on the 20th from 2026-07 to 2026-10. Checking moves 3,000.00 to Savings on 2026-08-01, 4,000.00 to Locked CDB (savings, `excluded_from_liquidity`) on 2026-08-02, 600.00 to Meal card (benefit) on 2026-10-01, and exchanges 500.00 for 100.00 USD into Dollars (wallet, USD) on 2026-10-01; USD is priced 5 BRL on 2026-10-20. A subscription of 50.00 to Streaming is expected on 2026-10-25.

Month 2026-10: income 5,000.00; expense 2,850.00; committed 50.00; debt service 1,250.00; liquid balance 17,900.00 (Checking 14,400.00, Savings 3,000.00, Dollars 500.00); liabilities 6,400.00; mean income 5,000.00 and mean expense 2,675.00 over 2026-04 to 2026-09. Savings rate 4300; trailing savings rate 4650; liquidity 66915; committed share 100; debt service share 2500.

Savings rate by month from 2025-11: `no_income` five times, then 5000 (2026-04 to 2026-06), then 4300 (2026-07 to 2026-10). Trailing savings rate: `insufficient_history` from 2025-11 to 2026-06, then 5000, 4825, 4720, 4650.

### S155 Books without history

Today 2026-10-20. The owner has no posting; another user records a salary of 5,000.00 in 2026-10. The owner's 2026-10: every amount 0.00, no mean, savings rate `no_income`, the four other ratios `insufficient_history`.

### S156 Income without expense

Today 2026-10-20. Salary 5,000.00 on the 5th of 2026-07 to 2026-10, nothing else. Month 2026-10: savings rate 10000; trailing savings rate 10000; liquidity `no_expense`; committed share 0; debt service share 0.
```

- [ ] **Step 2: Commit the documents**

```bash
git add docs/superpowers/specs/2026-10-26-analytics-study.md docs/superpowers/specs/2026-10-26-analytics-design.md docs/superpowers/plans/2026-10-26-analytics-indicators.md docs/domain/06-scenarios.md
git commit -m "docs(reporting): specify financial indicators" -m "Study of indicators, chart encodings and dashboard customization, the
design of the indicators operation, overview block and reports tab, its
plan, and scenarios S154 to S156."
```

---

### Task 2: Ledger flag `excluded_from_liquidity` with archive version 2

**Files:**
- Create: `db/migrations/00061_ledger_account_excluded_from_liquidity.sql`
- Modify: `db/queries/ledger/account.sql` (query `UpdateAccount`)
- Modify: `internal/ledger/internal/domain/account.go` (struct `Account`)
- Modify: `internal/ledger/internal/adapter/postgres/mapping.go`, `internal/ledger/internal/adapter/postgres/repository.go` (row ↔ domain, `UpdateAccount` params)
- Modify: `internal/ledger/internal/app/service.go` (`AccountPatch`, `UpdateAccount`)
- Modify: `internal/ledger/internal/adapter/httpapi/server.go` (`UpdateAccount`), `internal/ledger/internal/adapter/httpapi/convert.go` (`toAccountAPI`)
- Modify: `api/openapi.yaml` (schemas `Account`, `AccountPatch`)
- Modify: `internal/reporting/internal/app/archive_steps.go`, `internal/reporting/internal/app/archive_steps_test.go`
- Create (generated by `-update`): `internal/reporting/internal/adapter/postgres/testdata/archive-v2.txt`, `internal/reporting/testdata/archive-v2.zip`
- Test: `internal/ledger/account_liquidity_test.go`

**Interfaces:**
- Produces: column `ledger_account.excluded_from_liquidity boolean NOT NULL DEFAULT false`; API field `excluded_from_liquidity` (boolean, optional in schema, always written by the server) on `Account` and `AccountPatch`; `domain.Account.ExcludedFromLiquidity bool`; `app.AccountPatch.ExcludedFromLiquidity *bool`.

- [ ] **Step 1: Write the failing API test** `internal/ledger/account_liquidity_test.go`

```go
package ledger_test

// Analytics design 4.3: an account can be left out of the liquidity indicator.
func TestAccountExcludedFromLiquidity(t *testing.T) {
	t.Parallel()
	h := apitest.New(t)
	cdb := h.Account("Locked CDB", "asset", "savings", nil)
	type view struct {
		Excluded *bool `json:"excluded_from_liquidity"`
	}
	var got view
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+cdb, nil, http.StatusOK, &got)
	if got.Excluded == nil || *got.Excluded {
		t.Fatalf("new account excluded_from_liquidity = %v, want false", got.Excluded)
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cdb, map[string]any{"excluded_from_liquidity": true}, http.StatusOK, &got)
	if got.Excluded == nil || !*got.Excluded {
		t.Fatalf("patched excluded_from_liquidity = %v, want true", got.Excluded)
	}
	got = view{}
	h.MustDo(http.MethodGet, "/api/v1/accounts/"+cdb, nil, http.StatusOK, &got)
	if got.Excluded == nil || !*got.Excluded {
		t.Fatalf("read back excluded_from_liquidity = %v, want true", got.Excluded)
	}
	h.MustDo(http.MethodPatch, "/api/v1/accounts/"+cdb, map[string]any{"name": "CDB"}, http.StatusOK, &got)
	if !*got.Excluded {
		t.Fatal("a patch without the field reset excluded_from_liquidity")
	}
}
```
Imports: `net/http`, `testing`, `github.com/andrelopes-code/equori/internal/apitest`.

- [ ] **Step 2: Run it and read the failure**

Run: `go test ./internal/ledger/ -run TestAccountExcludedFromLiquidity -count=1`
Expected: FAIL; the PATCH is rejected by the contract (`additionalProperties: false`) or the field is absent.

- [ ] **Step 3: Write the migration** `db/migrations/00061_ledger_account_excluded_from_liquidity.sql`

```sql
-- +goose Up
-- Analytics design 4.3: an asset account left out of the liquidity indicator.
ALTER TABLE ledger_account ADD COLUMN excluded_from_liquidity boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE ledger_account DROP COLUMN excluded_from_liquidity;
```

- [ ] **Step 4: Add the column to `UpdateAccount` in `db/queries/ledger/account.sql`**

Add `excluded_from_liquidity = @excluded_from_liquidity` to the `SET` list. `InsertAccount` stays as it is (the default applies).

- [ ] **Step 5: Add the field to the contract in `api/openapi.yaml`**

In `AccountPatch.properties` and in the second `allOf` object of `Account.properties`, add:

```yaml
        excluded_from_liquidity:
          type: boolean
          description: Leaves the account out of the liquidity indicator (analytics design 4.3).
```
Do not add it to any `required` list.

- [ ] **Step 6: Regenerate**

Run: `make gen`
Expected: exit 0; `internal/ledger/internal/adapter/postgres/*.gen.go`, `internal/*/internal/adapter/httpapi/api.gen.go` and `web/src/api/schema.gen.ts` change.

- [ ] **Step 7: Carry the field through the ledger**

- `domain.Account`: add `ExcludedFromLiquidity bool` after `YieldMode`. No validation.
- `postgres/mapping.go`: set `ExcludedFromLiquidity: row.ExcludedFromLiquidity` where the row becomes a `domain.Account`.
- `postgres/repository.go` `UpdateAccount`: pass `ExcludedFromLiquidity: a.ExcludedFromLiquidity`.
- `app.AccountPatch`: add `ExcludedFromLiquidity *bool`; in `UpdateAccount`, `if p.ExcludedFromLiquidity != nil { a.ExcludedFromLiquidity = *p.ExcludedFromLiquidity }` beside the `YieldMode` branch.
- `httpapi/server.go` `UpdateAccount`: `patch.ExcludedFromLiquidity = req.Body.ExcludedFromLiquidity`.
- `httpapi/convert.go` `toAccountAPI`: `ExcludedFromLiquidity: &excluded` with `excluded := a.ExcludedFromLiquidity`.

- [ ] **Step 8: Run the ledger test**

Run: `go test ./internal/ledger/ -run TestAccountExcludedFromLiquidity -count=1`
Expected: PASS.

- [ ] **Step 9: See the archive fingerprint fail**

Run: `go test ./internal/reporting/internal/adapter/postgres/ -run TestArchiveFingerprint -count=1`
Expected: FAIL with "an exported table changed under archive_version 1".

- [ ] **Step 10: Write the failing step test** in `internal/reporting/internal/app/archive_steps_test.go`

```go
// Analytics design 4.3, ADR 021 V3: version 1 rows of ledger_account gain excluded_from_liquidity false.
func TestAddExcludedFromLiquidity(t *testing.T) {
	t.Parallel()
	v1 := []ArchiveTable{
		{Name: "ledger_account", Rows: [][]byte{[]byte(`{"id":"a","name":"Checking"}`)}},
		{Name: "ledger_payee", Rows: [][]byte{[]byte(`{"id":"b","name":"Market"}`)}},
	}
	got, err := addExcludedFromLiquidity(v1)
	if err != nil {
		t.Fatal(err)
	}
	var row map[string]any
	if err := json.Unmarshal(got[0].Rows[0], &row); err != nil {
		t.Fatal(err)
	}
	if row["excluded_from_liquidity"] != false || row["name"] != "Checking" || row["id"] != "a" {
		t.Fatalf("ledger_account row = %s", got[0].Rows[0])
	}
	if string(got[1].Rows[0]) != `{"id":"b","name":"Market"}` {
		t.Fatalf("ledger_payee row = %s", got[1].Rows[0])
	}
	if string(v1[0].Rows[0]) != `{"id":"a","name":"Checking"}` {
		t.Fatalf("the step changed its input: %s", v1[0].Rows[0])
	}
}
```
Add `"encoding/json/v2"` to the imports as `json`.

- [ ] **Step 11: Run it to see it fail**

Run: `go test ./internal/reporting/internal/app/ -run TestAddExcludedFromLiquidity -count=1`
Expected: FAIL to compile: `undefined: addExcludedFromLiquidity`.

- [ ] **Step 12: Implement the step** in `archive_steps.go`

- `const ArchiveVersion = 2`.
- `var archiveSteps = []ArchiveStep{addExcludedFromLiquidity}`.
- `func addExcludedFromLiquidity(tables []ArchiveTable) ([]ArchiveTable, error)`: copy every table as `renameColumn` in the test file does (new slice of rows); for table `ledger_account`, decode each row into `map[string]jsontext.Value` (`encoding/json/v2`, `encoding/json/jsontext`), set key `excluded_from_liquidity` to `jsontext.Value("false")`, marshal it back with `json.Deterministic(true)`. Wrap a decode error as `fmt.Errorf("ledger_account row %d: %w", i, err)`.

- [ ] **Step 13: Run the step tests**

Run: `go test ./internal/reporting/internal/app/ -run 'TestAddExcludedFromLiquidity|TestMigrateArchive' -count=1`
Expected: PASS.

- [ ] **Step 14: Write the version 2 fingerprint and fixture**

Run: `go test ./internal/reporting/internal/adapter/postgres/ -run TestArchiveFingerprint -count=1 -update && go test ./internal/reporting/ -run TestImportArchiveFixtures -count=1 -update`
Expected: PASS; new files `internal/reporting/internal/adapter/postgres/testdata/archive-v2.txt` (it contains the line `ledger_account.excluded_from_liquidity bool`) and `internal/reporting/testdata/archive-v2.zip`.

- [ ] **Step 15: Run the reporting and ledger packages**

Run: `go test ./internal/reporting/... ./internal/ledger/... -count=1`
Expected: PASS, including `TestImportArchiveFixtures/v1` and `/v2`.

- [ ] **Step 16: Commit**

```bash
git add db/migrations/00061_ledger_account_excluded_from_liquidity.sql db/queries/ledger/account.sql api/openapi.yaml internal/ledger internal/reporting web/src/api/schema.gen.ts internal/*/internal/adapter/httpapi/api.gen.go
git commit -m "feat(ledger): leave an account out of the liquidity indicator" -m "Adds excluded_from_liquidity to ledger accounts, readable and patchable
through the account API (analytics design 4.3). The column changes the
exported ledger_account table, so archive_version becomes 2 with a step
that writes false into version 1 rows (ADR 021, V2)."
```

---

### Task 3: Exclusion switch on the account edit screen

**Files:**
- Modify: `web/src/features/accounts/account-kinds.ts` (add `liquidCapable`)
- Modify: `web/src/features/accounts/account-draft.ts` (field `excludedFromLiquidity`)
- Modify: `web/src/features/accounts/account-form.tsx` (switch)
- Modify: `web/src/features/accounts/edit-account-screen.tsx` (`movedPatch`)
- Modify: `web/src/i18n/catalog-accounts.en.ts`, `web/src/i18n/catalog-accounts.pt-BR.ts`
- Test: `web/src/features/accounts/account-form-page.test.tsx` (describe "Edit account")

**Interfaces:**
- Consumes: `excluded_from_liquidity` of Task 2 in `components["schemas"]["Account"]` and `AccountPatch`.
- Produces: `liquidCapable(kind: Kind): boolean` — true for `checking`, `savings`, `cash`, `wallet`, `reserve`.

- [ ] **Step 1: Write the failing test** inside `describe("Edit account", ...)`

```tsx
  it("leaves the account out of the reserve", async () => {
    const sent: Sent[] = [];
    await renderApp(`/accounts/${checkingID}/edit`, { fetch: api(sent) });
    const exclude = await screen.findByRole("switch", {
      name: catalogEn["accountForm.excludeFromLiquidity"],
    });
    expect(exclude).not.toBeChecked();
    await userEvent.click(exclude);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "PATCH", body: { excluded_from_liquidity: true } },
      ]);
    });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd web && pnpm vitest run src/features/accounts/account-form-page.test.tsx -t "leaves the account out of the reserve"`
Expected: FAIL: TypeScript or runtime error, key `accountForm.excludeFromLiquidity` missing, or no switch found.

- [ ] **Step 3: Implement**

- Catalog keys. English (`catalog-accounts.en.ts`): `"accountForm.excludeFromLiquidity": "Leave out of the reserve"`, `"accountForm.excludeFromLiquidityHint": "The reserve indicator stops counting this balance, for money that cannot be withdrawn at once."`. Portuguese (`catalog-accounts.pt-BR.ts`): `"Deixar fora da reserva"`, `"O indicador de reserva deixa de contar este saldo, para dinheiro que não pode ser sacado na hora."`.
- `account-kinds.ts`: `export function liquidCapable(kind: Kind): boolean`.
- `account-draft.ts`: `excludedFromLiquidity: boolean` in `AccountDraft`; `false` in the new draft; `account.excluded_from_liquidity === true` in `draftFromAccount`.
- `account-form.tsx`: right after the `yieldCapable(kind)` field, a `Field` with a `Switch` (`checked={draft.excludedFromLiquidity}`, `onCheckedChange={(excludedFromLiquidity) => { set({ excludedFromLiquidity }); }}`) and a `FieldDescription` with the hint. Render it only when `mode === "edit" && liquidCapable(kind)`.
- `edit-account-screen.tsx` `movedPatch`: add `...(draft.excludedFromLiquidity !== start.excludedFromLiquidity ? { excluded_from_liquidity: draft.excludedFromLiquidity } : {})`.

- [ ] **Step 4: Run the accounts tests**

Run: `cd web && pnpm vitest run src/features/accounts/`
Expected: PASS.

- [ ] **Step 5: Static checks**

Run: `cd web && pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/accounts web/src/i18n/catalog-accounts.en.ts web/src/i18n/catalog-accounts.pt-BR.ts
git commit -m "feat(web): leave an account out of the reserve from its edit screen"
```

---

### Task 4: Indicator arithmetic

**Files:**
- Create: `internal/reporting/internal/app/indicator_months.go`
- Test: `internal/reporting/internal/app/indicator_months_test.go`

**Interfaces:**
- Produces (package `app`):

```go
type Reason string

const (
	ReasonNoIncome            Reason = "no_income"
	ReasonNoExpense           Reason = "no_expense"
	ReasonInsufficientHistory Reason = "insufficient_history"
)

// Ratio holds BP when Reason is empty.
type Ratio struct {
	BP     int64
	Reason Reason
}

// MonthFacts are one month's amounts in the base currency's minor units. Committed, Liquid and
// Liabilities are read only for the 12 months returned.
type MonthFacts struct {
	Month                                                  time.Time
	Income, Expense, DebtService, Committed, Liquid, Liabilities int64
}

type IndicatorMonth struct {
	Month                                                  time.Time
	Income, Expense, Committed, DebtService, Liquid, Liabilities int64
	// HasMeans is false when the trailing window holds fewer than 3 months.
	HasMeans                bool
	MeanIncome, MeanExpense int64
	SavingsRate, TrailingSavingsRate, Liquidity, CommittedShare, DebtServiceShare Ratio
}

// indicatorMonths turns 24 months of facts, oldest first, into the indicators of the last 12.
// first is the first posting month; the zero time means the user has no posting.
func indicatorMonths(facts []MonthFacts, first time.Time) []IndicatorMonth
```

- [ ] **Step 1: Write the failing table test** `indicator_months_test.go`

Helper in the test file: `func month(s string) time.Time` (parses `2006-01`); `func facts(from string, n int, fill func(i int, f *MonthFacts)) []MonthFacts` building `n` consecutive months from `from`. Cases (each asserts with `reflect.DeepEqual` or field-by-field):

| Case | Facts (24 months ending 2026-10) | `first` | Expected for the last entry |
|---|---|---|---|
| S154 | months 2026-04..2026-06: Income 500000, Expense 250000; 2026-07..2026-09: Income 500000, Expense 285000; 2026-10: Income 500000, Expense 285000, DebtService 125000, Committed 5000, Liquid 1790000, Liabilities 640000 | 2026-04 | Month 2026-10; SavingsRate 4300; TrailingSavingsRate 4650; Liquidity 66915; CommittedShare 100; DebtServiceShare 2500; HasMeans true; MeanIncome 500000; MeanExpense 267500 |
| S154 series | same | 2026-04 | SavingsRate of the 12 entries: `no_income` ×5, 5000 ×3, 4300 ×4. TrailingSavingsRate: `insufficient_history` ×8, then 5000, 4825, 4720, 4650 |
| no posting | all zero | zero time | SavingsRate `no_income`; the four others `insufficient_history`; HasMeans false; MeanIncome 0 |
| two months of history | 2026-08..2026-10 Income 100000 Expense 50000 | 2026-08 | TrailingSavingsRate `insufficient_history`; Liquidity `insufficient_history` |
| no expense (S156) | 2026-07..2026-10 Income 500000 | 2026-07 | SavingsRate 10000; TrailingSavingsRate 10000; Liquidity `no_expense`; CommittedShare 0; DebtServiceShare 0 |
| expense above income | 2026-04..2026-10 Income 3, Expense 4 | 2026-04 | SavingsRate −3333; TrailingSavingsRate −3333 |
| months before first ignored | 2026-01..2026-03 Income 900000 Expense 0; 2026-04..2026-10 Income 500000 Expense 250000 | 2026-04 | TrailingSavingsRate 5000 (2026-01..03 are before `first` and do not count) |

- [ ] **Step 2: Run it to see it fail**

Run: `go test ./internal/reporting/internal/app/ -run TestIndicatorMonths -count=1`
Expected: FAIL to compile: `undefined: indicatorMonths`.

- [ ] **Step 3: Implement `indicatorMonths`**

Algorithm (the signature does not fix it):

```
for j := 12; j < 24; j++:
    f := facts[j]
    out.Income.. = f.Income.. (copy the six amounts)
    SavingsRate = f.Income <= 0 ? no_income : (f.Income − f.Expense) × 10000 / f.Income
    window := facts[j−12 : j] keeping entries with !first.IsZero() && !Month.Before(first)
    n := len(window); sumIncome, sumExpense := sums over window
    if n < 3: the four trailing ratios = insufficient_history; HasMeans = false; continue
    HasMeans = true; MeanIncome = sumIncome / n; MeanExpense = sumExpense / n   (int64 division)
    TrailingSavingsRate = sumIncome <= 0 ? no_income : (sumIncome − sumExpense) × 10000 / sumIncome
    Liquidity           = sumExpense <= 0 ? no_expense : f.Liquid × 10000 × n / sumExpense
    CommittedShare      = sumIncome <= 0 ? no_income : f.Committed × 10000 × n / sumIncome
    DebtServiceShare    = sumIncome <= 0 ? no_income : f.DebtService × 10000 × n / sumIncome
```
Every product and quotient uses `math/big` (`big.Int.Mul`, `big.Int.Quo`, which truncates toward zero). Panic if `len(facts) != 24`: the caller always builds 24.

- [ ] **Step 4: Run it**

Run: `go test ./internal/reporting/internal/app/ -run TestIndicatorMonths -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/reporting/internal/app/indicator_months.go internal/reporting/internal/app/indicator_months_test.go
git commit -m "feat(reporting): compute monthly financial indicators" -m "Savings rate, trailing savings rate, liquidity, committed share and debt
service share from 24 months of facts (analytics design 4.2)."
```

---

### Task 5: Operation `getIndicators`

**Files:**
- Modify: `api/openapi.yaml` (path `/reports/indicators`, schemas `Indicators`, `IndicatorMonth`, `IndicatorRatio`)
- Modify: `db/queries/reporting/cash.sql` (query `CashOffCardMonthTotals`)
- Create: `db/queries/reporting/indicators.sql`
- Create: `internal/reporting/internal/adapter/postgres/indicators.go`
- Modify: `internal/reporting/internal/adapter/postgres/cash.go` (method `OffCardMonthTotals`)
- Modify: `internal/reporting/internal/app/cash.go` (`cashMonthTotals`)
- Create: `internal/reporting/internal/app/indicators.go`
- Modify: `internal/reporting/internal/app/series.go` (`Repository` embeds `IndicatorRepository`; `Service` fields)
- Create: `internal/reporting/internal/adapter/httpapi/indicators.go`
- Modify: `internal/reporting/internal/adapter/httpapi/server.go` (`ToProblem`)
- Modify: `internal/reporting/reporting.go` (`Commitments`, `Valuations`, `UseIndicatorSources`)
- Modify: `internal/planning/planning.go` (`CommittedTotal`)
- Modify: `internal/portfolio/portfolio.go` (`ValuedBalances`, `ErrPriceMissing`), `internal/portfolio/internal/app/allocation.go` (`BaseValues`)
- Modify: `internal/server/server.go` (wiring), `internal/server/tool_exposure_test.go` (entry `"getIndicators": "-pending"` replaced in Task 6)
- Test: `internal/reporting/indicators_test.go`

**Interfaces:**
- Consumes: `indicatorMonths`, `MonthFacts`, `IndicatorMonth`, `Ratio`, `Reason` (Task 4); `excluded_from_liquidity` (Task 2).
- Produces:

```go
// internal/planning/planning.go
// CommittedTotal is the committed amount of month (A57), in the base currency.
func (m *Module) CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error)

// internal/portfolio/portfolio.go
var ErrPriceMissing = app.ErrPriceMissing
// ValuedBalances values each account's own balance at the end of date in the base currency;
// an account with a zero balance is absent. A missing price wraps ErrPriceMissing.
func (m *Module) ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error)

// internal/portfolio/internal/app/allocation.go
func (s *Service) BaseValues(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error)

// internal/reporting/reporting.go
type Commitments interface {
	CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error)
}
type Valuations interface {
	ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error)
}
func (m *Module) UseIndicatorSources(c Commitments, v Valuations)

// internal/reporting/internal/app/indicators.go
type Commitments interface { CommittedTotal(ctx context.Context, userID int64, month time.Time) (money.Money, error) }
type Valuations interface { ValuedBalances(ctx context.Context, userID int64, date time.Time) (map[uuid.UUID]money.Money, error) }
var ErrInvalidMonth = errors.New("month after the current month")
var ErrPriceMissing = errors.New("price missing")
type IndicatorAccount struct {
	ID                              uuid.UUID
	Class, Kind, Instrument         string
	Interest, ExcludedFromLiquidity bool
}
type IndicatorRepository interface {
	BaseCurrency(ctx context.Context, userID int64) (string, error)
	// FirstPosting is the earliest booked date of the user's postings that are not voided; ok is false without one.
	FirstPosting(ctx context.Context, userID int64) (first time.Time, ok bool, err error)
	IndicatorAccounts(ctx context.Context, userID int64) ([]IndicatorAccount, error)
	// OffCardMonthTotals is OffCardTotals per month, keyed by the first day of the month.
	OffCardMonthTotals(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]Shares, error)
	LoanPrincipalByMonth(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]int64, error)
}
type IndicatorReport struct {
	Currency string
	Months   []IndicatorMonth
}
func (s *Service) UseIndicatorSources(c Commitments, v Valuations)
func (s *Service) Indicators(ctx context.Context, userID int64, month, today time.Time) (IndicatorReport, error)
```

- [ ] **Step 1: Declare the operation in `api/openapi.yaml`**

Path, after `/reports/categories/{id}/cash-payments`:

```yaml
  /reports/indicators:
    get:
      tags: [reporting]
      operationId: getIndicators
      summary: Savings rate, liquidity, committed share, debt service share and liabilities of a month and the 11 months before it, cash view (analytics design 4).
      parameters:
        - name: month
          in: query
          required: true
          schema:
            type: string
            pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$"
      responses:
        "200":
          description: OK.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Indicators"
        "400":
          $ref: "#/components/responses/Problem"
        "401":
          $ref: "#/components/responses/Problem"
        "422":
          $ref: "#/components/responses/Problem"
```

Schemas, beside `CategoryTotals`:

```yaml
    Indicators:
      type: object
      required: [currency, months]
      properties:
        currency:
          type: string
          description: The base currency of every amount.
        months:
          type: array
          minItems: 12
          maxItems: 12
          description: Oldest first; the last entry is the month asked.
          items:
            $ref: "#/components/schemas/IndicatorMonth"
    IndicatorMonth:
      type: object
      required: [month, income, expense, committed, debt_service, liquid_balance, liabilities, savings_rate, trailing_savings_rate, liquidity, committed_share, debt_service_share]
      properties:
        month:
          type: string
          pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$"
        income:
          $ref: "#/components/schemas/Money"
        expense:
          $ref: "#/components/schemas/Money"
        committed:
          $ref: "#/components/schemas/Money"
        debt_service:
          $ref: "#/components/schemas/Money"
        liquid_balance:
          $ref: "#/components/schemas/Money"
        liabilities:
          $ref: "#/components/schemas/Money"
        mean_income:
          $ref: "#/components/schemas/Money"
        mean_expense:
          $ref: "#/components/schemas/Money"
        savings_rate:
          $ref: "#/components/schemas/IndicatorRatio"
        trailing_savings_rate:
          $ref: "#/components/schemas/IndicatorRatio"
        liquidity:
          $ref: "#/components/schemas/IndicatorRatio"
        committed_share:
          $ref: "#/components/schemas/IndicatorRatio"
        debt_service_share:
          $ref: "#/components/schemas/IndicatorRatio"
    IndicatorRatio:
      type: object
      additionalProperties: false
      description: Either bp, in basis points truncated toward zero, or the reason there is no value.
      properties:
        bp:
          type: integer
          format: int64
        reason:
          type: string
          enum: [no_income, no_expense, insufficient_history]
```
`mean_income` and `mean_expense` are absent when the trailing window holds fewer than 3 months.

- [ ] **Step 2: Add the exposure entry**

In `internal/server/tool_exposure_test.go`, after `"getCategoryTotals"`, add `"getIndicators": "get_financial_indicators",`. `TestToolExposure` fails until Task 6 registers the tool: a new operation without an entry fails it as well. Task 5 therefore does not commit; Task 6 commits both tasks.

- [ ] **Step 3: Write the failing API tests** `internal/reporting/indicators_test.go`

Types and helpers in the file:

```go
type amount struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}
type ratio struct {
	BP     *int64 `json:"bp"`
	Reason string `json:"reason"`
}
func (r ratio) String() string {
	if r.BP != nil {
		return strconv.FormatInt(*r.BP, 10)
	}
	return r.Reason
}
type indicatorMonth struct {
	Month               string  `json:"month"`
	Income              amount  `json:"income"`
	Expense             amount  `json:"expense"`
	Committed           amount  `json:"committed"`
	DebtService         amount  `json:"debt_service"`
	LiquidBalance       amount  `json:"liquid_balance"`
	Liabilities         amount  `json:"liabilities"`
	MeanIncome          *amount `json:"mean_income"`
	MeanExpense         *amount `json:"mean_expense"`
	SavingsRate         ratio   `json:"savings_rate"`
	TrailingSavingsRate ratio   `json:"trailing_savings_rate"`
	Liquidity           ratio   `json:"liquidity"`
	CommittedShare      ratio   `json:"committed_share"`
	DebtServiceShare    ratio   `json:"debt_service_share"`
}
type indicatorReport struct {
	Currency string           `json:"currency"`
	Months   []indicatorMonth `json:"months"`
}
func indicators(t *testing.T, h *apitest.Harness, month string) indicatorReport // MustDo GET /api/v1/reports/indicators?month=, 200
func interestAccount(t *testing.T, h *apitest.Harness) string // GET /api/v1/accounts, the item with system_role "interest"
```

Every `h.Account` call in these tests passes `map[string]any{"opened_on": "2026-01-01"}` (merged with any other extra field), so postings from 2026-04 are inside the account's life.

`TestS154`: build the books of S154 exactly as `docs/domain/06-scenarios.md` S154 states, with `apitest.New(t, apitest.Today("2026-10-20"))`:
- accounts: `Checking` (asset, checking), `Savings` (asset, savings), `Locked CDB` (asset, savings), `Meal card` (asset, benefit), `Dollars` (asset, wallet, extra `"currency": "USD"`), `Personal loan` (liability, loan), `Salary` (income), `Rent`, `Food`, `Streaming` (expense); `interest := interestAccount(t, h)`.
- for each month 2026-04 to 2026-10: `h.Record(m+"-05", Posting(checking, 500000), Posting(salary, -500000))`, `-10` rent 150000, `-15` food 100000.
- `h.Record("2026-06-01", Posting(checking, 1000000), Posting(loan, -1000000))`.
- for 2026-07 to 2026-10: `h.Record(m+"-20", Posting(checking, -125000), Posting(loan, 90000), Posting(interest, 35000))`.
- transfers: `2026-08-01` checking −300000 / savings +300000; `2026-08-02` checking −400000 / cdb +400000; `2026-10-01` checking −60000 / meal +60000.
- `POST /api/v1/exchanges` `{"from_account_id": checking, "to_account_id": dollars, "date": "2026-10-01", "from_amount": apitest.BRL(50000), "to_amount": {"amount": 10000, "currency": "USD"}}` → 201.
- `POST /api/v1/prices` `{"instrument": "USD", "quote_instrument": "BRL", "date": "2026-10-20", "value": "5"}` → 201.
- `PATCH /api/v1/accounts/{cdb}` `{"excluded_from_liquidity": true}` → 200.
- `POST /api/v1/schedules` `{"kind": "subscription", "account_id": checking, "counterpart_id": streaming, "description": "Streaming", "amount": apitest.BRL(5000), "recurrence": {"frequency": "monthly", "interval": 1, "day_of_month": 25, "start": "2026-10-25"}}` → 201.
- `h.Dispatch()`.
- Precondition: `GET /api/v1/commitments?month=2026-10` has `total.amount` 5000; otherwise `t.Fatalf` with the body. A different value is handled by the procedure of Step 11.
- Assertions: `Currency == "BRL"`; `len(Months) == 12`; `Months[0].Month == "2025-11"`, `Months[11].Month == "2026-10"`. The last entry: income 500000, expense 285000, committed 5000, debt_service 125000, liquid_balance 1790000, liabilities 640000, mean_income 500000, mean_expense 267500, savings_rate "4300", trailing_savings_rate "4650", liquidity "66915", committed_share "100", debt_service_share "2500". Savings rates of the 12 entries as strings: `[no_income ×5, 5000 ×3, 4300 ×4]`. Trailing savings rates: `[insufficient_history ×8, 5000, 4825, 4720, 4650]`.

`TestS155`: `apitest.New(t, apitest.Today("2026-10-20"))`; `other := h.Login("other@example.com")`; with `h.Call(other, ...)` create `Checking` (asset, checking, BRL, opened_on 2026-01-01) and `Salary` (income) and post `{"date": "2026-10-05", "description": "salary", "postings": [checking +500000, salary −500000]}` to `/api/v1/transactions` (expect 201). The owner's report for 2026-10: 12 entries; last entry every amount 0 with currency BRL, `MeanIncome == nil`, `MeanExpense == nil`, savings_rate `no_income`, the four other ratios `insufficient_history`.

`TestS156`: salary 500000 on the 5th of 2026-07..2026-10 into Checking. Last entry: savings_rate "10000", trailing_savings_rate "10000", liquidity "no_expense", committed_share "0", debt_service_share "0".

`TestIndicatorsMonthProblems`: Today 2026-10-20. `h.ExpectProblem(h.Do(GET, "/api/v1/reports/indicators?month=2026-11", nil), 400, "invalid_request", "month")`; `h.ExpectProblem(h.Do(GET, "/api/v1/reports/indicators?month=2026-13", nil), 400, "invalid_request", "")`.

`TestIndicatorsPriceMissing`: Today 2026-10-20. `Checking` (BRL) and `Dollars` (wallet, USD); exchange 50000 BRL for 10000 USD on 2026-10-01; no price. `h.ExpectProblem(h.Do(GET, "/api/v1/reports/indicators?month=2026-10", nil), 422, "price_missing", "")`.

- [ ] **Step 4: Run them to see them fail**

Run: `make gen && go test ./internal/reporting/ -run 'TestS154|TestS155|TestS156|TestIndicators' -count=1`
Expected: FAIL to compile: `*Server does not implement StrictServerInterface (missing method GetIndicators)`.

- [ ] **Step 5: Queries**

In `db/queries/reporting/cash.sql`, after `CashOffCardTotals`, add `CashOffCardMonthTotals :many`: the same `FROM`, `JOIN` and `WHERE` as `CashOffCardTotals`, selecting `date_trunc('month', p.booked_on)::date AS month, p.account_id, sum(p.amount)::bigint AS total`, grouped by `1, p.account_id`. Comment: `-- CV1 per month: category postings in [from, to] of transactions without a card line.`

Create `db/queries/reporting/indicators.sql`:

```sql
-- name: IndicatorBaseCurrency :one
SELECT base_currency FROM ledger_settings WHERE user_id = @user_id;

-- name: IndicatorFirstPosting :one
-- The earliest booked date of the user's postings that are not voided.
SELECT booked_on FROM ledger_posting
WHERE user_id = @user_id AND NOT voided
ORDER BY booked_on
LIMIT 1;

-- name: IndicatorAccounts :many
-- Every account of the user; interest marks the system category interest and its descendants.
WITH RECURSIVE interest AS (
    SELECT r.id FROM ledger_account r WHERE r.user_id = @user_id AND r.system_role = 'interest'
    UNION ALL
    SELECT a.id FROM ledger_account a JOIN interest i ON a.parent_id = i.id WHERE a.user_id = @user_id
)
SELECT a.id, a.account_class, coalesce(a.kind, '')::text AS kind, a.instrument, a.excluded_from_liquidity,
       (a.id IN (SELECT id FROM interest))::boolean AS interest
FROM ledger_account a
WHERE a.user_id = @user_id;

-- name: LoanPrincipalByMonth :many
-- Analytics design 4.2: postings that reduce a loan owed in the base currency, paid from an asset account.
SELECT date_trunc('month', p.booked_on)::date AS month, sum(p.amount)::bigint AS total
FROM ledger_posting p
JOIN ledger_account a ON a.id = p.account_id
JOIN ledger_settings st ON st.user_id = p.user_id
WHERE p.user_id = @user_id AND NOT p.voided AND a.account_class = 'liability' AND a.kind = 'loan'
  AND a.instrument = st.base_currency AND p.amount > 0
  AND p.booked_on BETWEEN @from_date::date AND @to_date::date
  AND EXISTS (
    SELECT 1 FROM ledger_posting q
    JOIN ledger_account qa ON qa.id = q.account_id
    WHERE q.user_id = p.user_id AND q.transaction_id = p.transaction_id AND NOT q.voided
      AND qa.account_class = 'asset')
GROUP BY 1;
```
Run `make gen`.

- [ ] **Step 6: Repository** — `internal/reporting/internal/adapter/postgres/indicators.go` implements the five `IndicatorRepository` methods on `*Repository` with the generated queries; `FirstPosting` returns `(time.Time{}, false, nil)` on `pgx.ErrNoRows`; map keys are the `month` column as returned (first day of month, UTC). `OffCardMonthTotals` goes in `postgres/cash.go` beside `OffCardTotals`.

- [ ] **Step 7: Cash month totals** — in `app/cash.go`:

```go
// cashMonthTotals is the cash view of [from, to] per category and per month, keyed by the
// first day of the month (CV1 to CV9).
func (s *Service) cashMonthTotals(ctx context.Context, userID int64, from, to time.Time) (map[time.Time]Shares, error)
```
Body: `OffCardMonthTotals(from, to)`; then `CardFacts(ctx, userID, to)`, `payments, _ := allocate(facts)`, and for each payment with `from <= p.date <= to`, `add` its shares into the map entry of `time.Date(p.date.Year(), p.date.Month(), 1, 0, 0, 0, 0, time.UTC)` (create the entry when absent).

- [ ] **Step 8: Service** — `app/indicators.go`:

Add `commitments Commitments` and `valuations Valuations` fields to `Service` (in `series.go`) and embed `IndicatorRepository` in `Repository`. `UseIndicatorSources` sets both.

`Indicators(ctx, userID, month, today)`:
1. If either source is nil, return `errors.New("indicators: sources not set")`.
2. `current := first day of today's month`; if `month.After(current)` return `ErrInvalidMonth`.
3. `base := BaseCurrency`.
4. `start := month.AddDate(0, -23, 0)`; `end := last day of month`, or `today` when `month.Equal(current)`.
5. `totals := cashMonthTotals(start, end)`; `loans := LoanPrincipalByMonth(start, end)`; `accounts := IndicatorAccounts`; `first, ok := FirstPosting` (first posting month = first day of `first`'s month when ok, zero time otherwise).
6. Sets from `accounts`: income ids (class `income`, instrument `base`), expense ids (class `expense`, instrument `base`), interest ids (`Interest` and instrument `base`), liquid ids (class `asset`, kind in the five liquid kinds, not `ExcludedFromLiquidity`), liability ids (class `liability`).
7. For `i := 0; i < 24; i++`: `m := start.AddDate(0, i, 0)`; `shares := totals[m]`; `Income = −Σ shares[income ids]`; `Expense = Σ shares[expense ids]`; `DebtService = loans[m] + Σ shares[interest ids]`. For `i >= 12` only: `date := last day of m`, or `today` when `m.Equal(current)`; `values := valuations.ValuedBalances(ctx, userID, date)`; `Liquid = Σ values[liquid ids].Amount()`; `Liabilities = −Σ values[liability ids].Amount()`; `c := commitments.CommittedTotal(ctx, userID, m)`; if `c.Currency() != base` return `fmt.Errorf("committed of %s in %s, base %s", ...)`; `Committed = c.Amount()`.
8. Return `IndicatorReport{Currency: base, Months: indicatorMonths(facts, firstMonth)}`.

- [ ] **Step 9: Sources** —
- `planning.go`: `CommittedTotal` calls `m.svc.Committed` and returns `money.New(c.Total, c.Currency)`.
- `portfolio/internal/app/allocation.go`: `BaseValues` reads `s.reportCurrency(ctx, userID, "")`, then `s.valuedBalances(ctx, userID, date, in)`, and returns `map[account.ID]value`.
- `portfolio.go`: `var ErrPriceMissing = app.ErrPriceMissing`; `ValuedBalances` returns `m.svc.BaseValues(...)`.
- `reporting.go`: the two interfaces; `UseIndicatorSources(c, v)` calls `m.svc.UseIndicatorSources(c, priced{v})`, where unexported `priced` wraps `ValuedBalances` and turns `errors.Is(err, portfolio.ErrPriceMissing)` into `fmt.Errorf("%w: %w", app.ErrPriceMissing, err)`. The import of `internal/portfolio` in `reporting.go` creates no cycle: `portfolio` does not import `reporting`.
- `internal/server/server.go`: after `planningModule := planning.New(...)`, add `reportingModule.UseIndicatorSources(planningModule, portfolioModule)`.

- [ ] **Step 10: Handler and problems** —
- `httpapi/indicators.go`: `GetIndicators(ctx, req)` parses `req.Params.Month` with `time.Parse("2006-01", ...)` (a parse error returns `app.ErrInvalidMonth`); computes `today` as `GetCardStatementAnalytics` does; calls `s.svc.Indicators`; converts every amount to `Money{Amount, Currency: report.Currency}`; sets `MeanIncome` and `MeanExpense` only when `HasMeans`; converts a `Ratio` to `IndicatorRatio` with `Bp` set when `Reason == ""`, else `Reason`.
- `ToProblem`: `app.ErrInvalidMonth` → `problem.New(http.StatusBadRequest, "invalid_request", "month must not be after the current month")` with `Errors: []problem.FieldError{{Field: "month", Message: "must not be after the current month"}}`; `app.ErrPriceMissing` → `problem.New(http.StatusUnprocessableEntity, "price_missing", err.Error())`.

- [ ] **Step 11: Run the tests**

Run: `go test ./internal/reporting/ -run 'TestS154|TestS155|TestS156|TestIndicators' -count=1`
Expected: PASS. The expected values were computed by hand. When one differs, apply this procedure without pausing:
1. Assume the code is wrong first. Recompute the value by hand from the S154 text and the formulas of design §4, writing each intermediate sum in the checkpoint file.
2. If the hand computation gives the test's value, fix the code.
3. If the hand computation gives the code's value, the scenario arithmetic was wrong: correct the value in `docs/domain/06-scenarios.md` S154 and in the test together, and in the commit body of Task 6 add a line `S154 corrected: <field> <old> → <new>, <one-line reason>`.
4. A difference caused by another module's behavior (for example the committed amount of `planning`) is scenario arithmetic: step 3 applies, and the reason names the behavior.
Never change a formula of design §4 to match a number.

- [ ] **Step 12: Run the touched packages**

Run: `go test ./internal/reporting/... ./internal/planning/... ./internal/portfolio/... -count=1`
Expected: PASS.

- [ ] **Step 13: No commit**

Leave the changes in the working tree and continue with Task 6, which commits Task 5 and Task 6 together.

---

### Task 6: Assistant tool `get_financial_indicators`

**Files:**
- Create: `internal/reporting/internal/adapter/toolapi/indicators.go`
- Modify: `internal/reporting/internal/adapter/toolapi/toolapi.go` (`Tools` takes a clock)
- Modify: `internal/reporting/reporting.go` (`Tools`; keep `clk` in `Module`)
- Test: `internal/reporting/indicators_tool_test.go`

**Interfaces:**
- Consumes: `(*app.Service).Indicators` (Task 5).
- Produces: tool `get_financial_indicators`, input `{"month": "YYYY-MM"}` (optional; the current month when empty), read-only.

- [ ] **Step 1: Write the failing test** `internal/reporting/indicators_tool_test.go`

Books of S156 (salary 500000 on the 5th of 2026-07..2026-10, Today 2026-10-20). Output type in the test:

```go
type toolRatio struct {
	BP     *int64 `json:"bp"`
	Reason string `json:"reason"`
}
type toolIndicatorMonth struct {
	Month       string     `json:"month"`
	Income      tool.Money `json:"income"`
	SavingsRate toolRatio  `json:"savings_rate"`
	Liquidity   toolRatio  `json:"liquidity"`
}
```
Assertions: `h.Tool("get_financial_indicators", map[string]any{})` is not an error; output `{"months": [...]}` has 12 entries; the last has `Month "2026-10"`, `Income {Amount: "5000.00", Currency: "BRL"}`, `SavingsRate.BP == 10000`, `Liquidity.Reason == "no_expense"`. Then `h.ExpectToolError(h.Tool("get_financial_indicators", map[string]any{"month": "2026-11"}), "invalid_request", "month")`.

- [ ] **Step 2: Run it to see it fail**

Run: `go test ./internal/reporting/ -run TestFinancialIndicatorsTool -count=1`
Expected: FAIL: unknown tool `get_financial_indicators`.

- [ ] **Step 3: Implement** `toolapi/indicators.go`, following `categories.go`:
- `Spec.Name "get_financial_indicators"`, `Effect: tool.ReadOnly`, description: `"Returns 12 months of financial indicators in the cash view, oldest first, the last one the month asked: savings rate, trailing 12-month savings rate, liquidity (10000 bp = one month of mean expense), committed share and debt service share of mean income, with their amounts. A ratio has bp or the reason it has none. Use it for how much is saved, how long the reserve lasts, and how much income is committed or spent on debt. Do not use it for category totals: get_category_totals lists them."`
- Input `Month string \`json:"month,omitzero" jsonschema:"the last month of the series, written YYYY-MM; the current month when absent"\``.
- Output: `Months []indicatorView` with fields `month`, `income`, `expense`, `committed`, `debt_service`, `liquid_balance`, `liabilities` (`tool.Money`), `mean_income`, `mean_expense` (`*tool.Money`, `omitzero`), and the five ratios as `ratioView{BP *int64 \`json:"bp,omitzero"\`; Reason string \`json:"reason,omitzero"\`}`.
- A month that does not parse returns `tool.InvalidArgument("month", "must be written YYYY-MM")`; `app.ErrInvalidMonth` reaches the client through `ToProblem` (`invalid_request` on `month`).
- `toolapi.Tools(svc *app.Service, clk app.Clock)`; `today` is computed from `clk.Now()` as the handler does. `reporting.New` stores `clk` and `Tools()` passes it.

- [ ] **Step 4: Run the tool and exposure tests**

Run: `go test ./internal/reporting/ -run TestFinancialIndicatorsTool -count=1 && go test ./internal/server/ -run TestToolExposure -count=1`
Expected: PASS.

- [ ] **Step 5: Run the Go packages of Tasks 5 and 6**

Run: `go test ./internal/reporting/... ./internal/planning/... ./internal/portfolio/... ./internal/server/... -count=1`
Expected: PASS.

- [ ] **Step 6: Commit Tasks 5 and 6**

```bash
git add api/openapi.yaml db/queries/reporting internal/reporting internal/planning/planning.go internal/portfolio internal/server web/src/api/schema.gen.ts internal/*/internal/adapter/httpapi/api.gen.go
git commit -m "feat(reporting): add the financial indicators operation" -m "GET /reports/indicators and the tool get_financial_indicators return 12
months of savings rate, trailing savings rate, liquidity, committed
share, debt service share and liabilities in the cash view (analytics
design 4, S154 to S156). planning lends its committed amount and
portfolio its valued balances."
```

---

### Task 7: Overview indicators block

**Files:**
- Modify: `web/src/features/overview/api.ts` (`indicatorsQuery`), `web/src/features/overview/index.ts` (export `indicatorsQuery` and the types of `indicators.ts`). The query lives in `overview` because `reports` already imports `@/features/overview` (`netWorthQuery`); `overview` importing `reports` would make a cycle.
- Modify: `web/src/i18n/format.ts` (`formatMonths`)
- Modify: `web/src/ui/figure-card.tsx` (props `trend`, `goodWhen` adds `"none"`)
- Create: `web/src/features/overview/indicators.ts` (pure helpers)
- Create: `web/src/features/overview/indicators-block.tsx`
- Modify: `web/src/features/overview/overview-page.tsx` (place the block)
- Modify: `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`
- Modify: `web/src/testing/report-api.ts` (`indicatorsFixture`)
- Modify: `web/src/features/overview/overview-page.test.tsx` (`api()` serves the indicators route)
- Test: `web/src/features/overview/indicators.test.ts`, `web/src/features/overview/indicators-block.test.tsx`

**Interfaces:**
- Consumes: `GET /reports/indicators` (Task 5) through `components["schemas"]["Indicators"]`.
- Produces:

```ts
// features/overview/api.ts
export function indicatorsQuery(api: Client<paths>, month: string) // queryKey ["reports", "indicators", month]; returns the Indicators body
// i18n/format.ts
export function formatMonths(bp: number, locale: string): string // one decimal: 66915 → "6.7" in en-US
// features/overview/indicators.ts
export type Indicators = components["schemas"]["Indicators"];
export type IndicatorMonth = components["schemas"]["IndicatorMonth"];
export type RatioKey = "savings_rate" | "trailing_savings_rate" | "liquidity" | "committed_share" | "debt_service_share";
export function lastMonth(report: Indicators): IndicatorMonth
export function ratioSeries(report: Indicators, key: RatioKey): (number | null)[]
export function showsDebt(month: IndicatorMonth): boolean // liabilities.amount > 0 || debt_service.amount > 0
// ui/figure-card.tsx
trend?: ReactNode; goodWhen?: "up" | "down" | "none"
// testing/report-api.ts
export function indicatorsFixture(last?: Partial<IndicatorMonth>): Indicators // 12 months 2025-11..2026-10, the S154 values; `last` overrides fields of the last entry
```

- [ ] **Step 1: Fixture** — `indicatorsFixture` in `testing/report-api.ts`: months `2025-11` to `2026-10`; every entry has the six amounts `brl(0)`, `savings_rate` and the other ratios `{ reason: "insufficient_history" }`, then apply S154: savings_rate `{reason: "no_income"}` ×5, `{bp: 5000}` ×3, `{bp: 4300}` ×4; trailing `insufficient_history` ×8, then `{bp: 5000}`, `{bp: 4825}`, `{bp: 4720}`, `{bp: 4650}`; the last entry: income `brl(500000)`, expense `brl(285000)`, committed `brl(5000)`, debt_service `brl(125000)`, liquid_balance `brl(1790000)`, liabilities `brl(640000)`, mean_income `brl(500000)`, mean_expense `brl(267500)`, liquidity `{bp: 66915}`, committed_share `{bp: 100}`, debt_service_share `{bp: 2500}`; spread `last` over it. In `overview-page.test.tsx` `api()`, add `"GET /api/v1/reports/indicators": () => json(200, indicatorsFixture())` to the base routes.

- [ ] **Step 2: Write the failing unit test** `indicators.test.ts`

```ts
describe("indicators", () => {
  it("reads the last month and the series of a ratio", () => {
    const report = indicatorsFixture();
    expect(lastMonth(report).month).toBe("2026-10");
    expect(ratioSeries(report, "trailing_savings_rate")).toEqual([
      null, null, null, null, null, null, null, null, 5000, 4825, 4720, 4650,
    ]);
  });
  it("writes liquidity in months with one decimal", () => {
    expect(formatMonths(66915, "en-US")).toBe("6.7");
    expect(formatMonths(66915, "pt-BR")).toBe("6,7");
  });
  it("shows debt only with liabilities or debt payments", () => {
    const zero = { amount: 0, currency: "BRL" };
    expect(showsDebt(lastMonth(indicatorsFixture()))).toBe(true);
    expect(
      showsDebt(lastMonth(indicatorsFixture({ liabilities: zero, debt_service: zero }))),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing block test** `indicators-block.test.tsx`

Render with `renderWithRouter(<IndicatorsBlock month="2026-10" />, { path: "/", fetch: fakeApi({ ...reportApiRoutes(), "GET /api/v1/reports/indicators": () => json(200, fixture) }) })`. Tests:
- "S154: shows the four indicators of the month": texts `"43.00%"`, `"6.7 months"`, `"1.00%"`, `"25.00%"`, and `catalogEn["overview.indicators.savingsNote"].replace("{mean}", "46.50%")`.
- "states why an indicator has no value": fixture `indicatorsFixture({ liquidity: { reason: "no_expense" } })`; text `catalogEn["overview.indicators.reason.no_expense"]`.
- "hides debt payments without liabilities": fixture with `liabilities` and `debt_service` zero; `queryByText(catalogEn["overview.indicators.debt"])` is null.
- "masks amounts and keeps ratios in privacy mode": `hideAmounts()` before render; after `"43.00%"` appears, strip the percentages as `features/portfolio/portfolio-page.test.tsx` does (`const amounts = document.createElement("div"); amounts.innerHTML = container.innerHTML.replace(/[\d.,]+\s?%/g, "");`), then `expectNoAmounts(amounts, ["17,900.00", "2,675.00"])`. The helper flags any `d.dd` text, so a percentage left in place fails it.

If a request reaches a route the fake does not define, `fakeApi` answers 404 and the block shows an error: add the missing route from `testing/transaction-api.ts` (`sharedRoutes`) or `testing/account-api.ts`, never a new fake.

Use `beforeEach(() => { localStorage.clear(); })`.

- [ ] **Step 4: Run them to see them fail**

Run: `cd web && pnpm vitest run src/features/overview/indicators.test.ts src/features/overview/indicators-block.test.tsx`
Expected: FAIL: modules not found.

- [ ] **Step 5: Catalog keys** (both catalogs; English first, Portuguese second)

| Key | en | pt-BR |
|---|---|---|
| `overview.indicators.title` | Indicators | Indicadores |
| `overview.indicators.open` | Open indicators | Abrir indicadores |
| `overview.indicators.label` | Indicators of the month | Indicadores do mês |
| `overview.indicators.savings` | Savings rate | Taxa de poupança |
| `overview.indicators.reserve` | Reserve | Reserva |
| `overview.indicators.committed` | Committed income | Renda comprometida |
| `overview.indicators.debt` | Debt payments | Prestações de dívida |
| `overview.indicators.months` | {months} months | {months} meses |
| `overview.indicators.savingsNote` | Income left after expenses this month, cash basis. 12-month mean: {mean}. | Renda que sobrou depois das despesas neste mês, visão de caixa. Média de 12 meses: {mean}. |
| `overview.indicators.savingsNoteShort` | Income left after expenses this month, cash basis. | Renda que sobrou depois das despesas neste mês, visão de caixa. |
| `overview.indicators.reserveNote` | {liquid} in checking, savings, cash, wallets and reserves against a mean monthly expense of {expense}. | {liquid} em contas correntes, poupanças, dinheiro, carteiras e reservas contra uma despesa média mensal de {expense}. |
| `overview.indicators.committedNote` | {committed} of bills, subscriptions and installments this month against a mean monthly income of {income}. | {committed} em contas, assinaturas e parcelas deste mês contra uma renda média mensal de {income}. |
| `overview.indicators.debtNote` | {debt} of loan principal and interest this month against a mean monthly income of {income}. | {debt} de principal e juros de empréstimos neste mês contra uma renda média mensal de {income}. |
| `overview.indicators.reason.no_income` | No income was recorded in this period. | Nenhuma receita registrada no período. |
| `overview.indicators.reason.no_expense` | No expense was recorded in the last 12 months. | Nenhuma despesa registrada nos últimos 12 meses. |
| `overview.indicators.reason.insufficient_history` | Needs at least 3 complete months of records. | Precisa de pelo menos 3 meses completos de registros. |

- [ ] **Step 6: Implement**
- `indicatorsQuery` in `features/overview/api.ts` following `cashPaymentsQuery` of `features/reports/api.ts`; export it and the `Indicators`, `IndicatorMonth` types from `features/overview/index.ts`.
- `formatMonths` in `i18n/format.ts` beside `formatBasisPoints`: `Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bp / 10000)`.
- `FigureCard`: `trend` renders `<StatCardTrend>{trend}</StatCardTrend>` after `StatCardFigure` when defined; widen `goodWhen`.
- `indicators.ts` helpers per the Interfaces block.
- `IndicatorsBlock({ month }: { month: string })`: `useQuery(indicatorsQuery(api, month))`, `useBase()` for the scale. It renders `OverviewBlock` (title `overview.indicators.title`, link label `overview.indicators.open` to `{ to: "/reports", search: { tab: "indicators" } }`), and inside a `FigureGrid` (label `overview.indicators.label`) the four `FigureCard`s with `goodWhen="none"`:
  - savings: value `formatBasisPoints(bp)` of `savings_rate`, note `savingsNote` with `mean` from `trailing_savings_rate` when it has `bp`, else `savingsNoteShort`;
  - reserve: value `t("overview.indicators.months", { months: formatMonths(bp) })`, note `reserveNote` with `liquid_balance` and `mean_expense` formatted by `useMoneyFormat()`;
  - committed: value `formatBasisPoints` of `committed_share`, note `committedNote` with `committed` and `mean_income`;
  - debt (only when `showsDebt`): value of `debt_service_share`, note `debtNote` with `debt_service` and `mean_income`.
  A ratio with `reason` gives `value={undefined}` and the note `t(\`overview.indicators.reason.${reason}\`)`. Each card's `trend` is `<Sparkline data={ratioSeries(report, key)} label={cardLabel} size="sm" />`.
- `overview-page.tsx`: desk, a new `<div className={styles.full}><IndicatorsBlock month={month} /></div>` right after the `DesktopFigures` div; phone, `<IndicatorsBlock month={month} />` right after `<NetWorthBlock month={month} />`.

- [ ] **Step 7: Run the overview tests**

Run: `cd web && pnpm vitest run src/features/overview/`
Expected: PASS, the existing overview tests included.

- [ ] **Step 8: Static checks**

Run: `cd web && pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add web/src
git commit -m "feat(web): show the financial indicators on the overview"
```

---

### Task 8: Hide overview blocks

**Files:**
- Create: `web/src/features/overview/use-hidden-blocks.ts`
- Create: `web/src/features/overview/hide-block-menu.tsx`
- Modify: `web/src/features/overview/overview-block.tsx` (prop `onHide`)
- Modify: `net-worth-block.tsx`, `month-flows-block.tsx`, `spending-block.tsx`, `spending-chart.tsx`, `upcoming-block.tsx`, `cards-block.tsx`, `budgets-block.tsx`, `goals-block.tsx`, `indicators-block.tsx` in `web/src/features/overview/` (prop `onHide` forwarded)
- Modify: `web/src/features/overview/overview-page.tsx`
- Modify: `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`
- Test: `web/src/features/overview/use-hidden-blocks.test.ts`, `web/src/features/overview/overview-page.test.tsx`

**Interfaces:**
- Produces:

```ts
export type BlockID = "net-worth" | "month-flows" | "spending" | "upcoming" | "cards" | "budgets" | "goals" | "indicators";
export const blockIDs: readonly BlockID[];
export const hiddenKey = "equori.overview.hidden";
export function readHidden(raw: string | null): ReadonlySet<BlockID> // invalid JSON, a non-array or unknown ids yield only the known ids
export function useHiddenBlocks(): { hidden: ReadonlySet<BlockID>; hide: (id: BlockID) => void; showAll: () => void }
export function HideBlockMenu({ block, onHide }: { block: string; onHide: () => void }) // block: the block title, for the trigger's name
```

- [ ] **Step 1: Write the failing unit test** `use-hidden-blocks.test.ts`

```ts
describe("readHidden", () => {
  it("keeps the known ids", () => {
    expect([...readHidden('["goals","x","cards"]')]).toEqual(["goals", "cards"]);
  });
  it("reads nothing from a missing or broken value", () => {
    expect(readHidden(null).size).toBe(0);
    expect(readHidden("{").size).toBe(0);
    expect(readHidden('{"goals":true}').size).toBe(0);
  });
});

describe("useHiddenBlocks", () => {
  it("shows every block when storage throws", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useHiddenBlocks());
    expect(result.current.hidden.size).toBe(0);
    act(() => { result.current.hide("goals"); });
    expect([...result.current.hidden]).toEqual(["goals"]);
    get.mockRestore();
    set.mockRestore();
  });
});
```

- [ ] **Step 2: Write the failing page tests** in `overview-page.test.tsx`

```tsx
  it("hides a block and shows it again", async () => {
    localStorage.clear();
    await renderApp("/", { width: 800, fetch: api() });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("overview.block.options", { block: catalogEn["overview.goals.title"] }),
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["overview.block.hide"] }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: catalogEn["overview.goals.title"] })).toBeNull();
    });
    expect(localStorage.getItem("equori.overview.hidden")).toBe('["goals"]');
    await userEvent.click(
      screen.getByRole("button", { name: words("overview.block.showHidden", { count: "1" }) }),
    );
    expect(
      await screen.findByRole("heading", { name: catalogEn["overview.goals.title"] }),
    ).toBeInTheDocument();
  });

  it("keeps the attention list without a hide control", async () => {
    localStorage.clear();
    await renderApp("/", { width: 800, fetch: api() });
    await screen.findByRole("heading", { name: catalogEn["overview.attention.title"] });
    expect(
      screen.queryByRole("button", {
        name: words("overview.block.options", { block: catalogEn["overview.attention.title"] }),
      }),
    ).toBeNull();
  });
```
`words(key, values)` is a local function of `web/src/features/accounts/accounts-page.test.tsx` (line 31); copy it into `overview-page.test.tsx` when that file has none. The goals block title is `overview.goals.title` ("Goals").

- [ ] **Step 3: Run them to see them fail**

Run: `cd web && pnpm vitest run src/features/overview/use-hidden-blocks.test.ts src/features/overview/overview-page.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Catalog keys**

| Key | en | pt-BR |
|---|---|---|
| `overview.block.options` | Options for {block} | Opções de {block} |
| `overview.block.hide` | Hide block | Ocultar bloco |
| `overview.block.showHidden` | Show hidden blocks ({count}) | Mostrar blocos ocultos ({count}) |

- [ ] **Step 5: Implement**
- `use-hidden-blocks.ts`: `readHidden` parses with `JSON.parse` in try/catch and keeps array strings found in `blockIDs`, in stored order. `useHiddenBlocks` initializes state from `localStorage.getItem(hiddenKey)` inside try/catch (a throw yields an empty set); `hide` and `showAll` update state, then write `JSON.stringify([...next])` (or `removeItem` for `showAll`) inside try/catch.
- `hide-block-menu.tsx`: `Menu` > `MenuTrigger` rendering an `IconButton` (`variant="ghost"`, `tone="secondary"`, `aria-label={t("overview.block.options", { block })}`, `<Icon><Glyph name="ellipsis" /></Icon>`), `MenuContent` > `MenuItem onSelect={onHide}` with `t("overview.block.hide")`. Copy the structure of `web/src/features/accounts/account-header.tsx` lines 232–247.
- `OverviewBlock`: optional `onHide?: () => void`; when set, render `<HideBlockMenu block={title} onHide={onHide} />` inside `SectionActions`, after the link. Render `SectionActions` when either the link or `onHide` is present.
- Each listed block takes `onHide?: () => void` and passes it to every `OverviewBlock` it renders. `SpendingChart` also renders `HideBlockMenu` inside its `actions` div, after the link, when `onHide` is set.
- `overview-page.tsx`: `const { hidden, hide, showAll } = useHiddenBlocks();`. Each hideable block renders only when `!hidden.has(id)`, with `onHide={() => { hide(id); }}`. IDs: `NetWorthBlock` "net-worth", `MonthFlowsBlock` "month-flows", `SpendingChart` and `SpendingBlock` "spending", `UpcomingBlock` "upcoming", `CardsBlock` "cards", `BudgetsBlock` "budgets", `GoalsBlock` "goals", `IndicatorsBlock` "indicators". On the desk, drop the wrapping `div` of a hidden block too. When `hidden.size > 0`, `PageHeaderTitleRow` gets `<PageHeaderActions><Button variant="ghost" onClick={showAll}>{t("overview.block.showHidden", { count: String(hidden.size) })}</Button></PageHeaderActions>`.

- [ ] **Step 6: Run the overview tests**

Run: `cd web && pnpm vitest run src/features/overview/`
Expected: PASS.

- [ ] **Step 7: Static checks**

Run: `cd web && pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat(web): hide overview blocks from the block itself" -m "Each block drawn through OverviewBlock offers Hide block; the page shows
every hidden block again. The choice is kept per browser under
equori.overview.hidden; the attention list cannot be hidden (analytics
design 5.2)."
```

---

### Task 9: Reports indicators tab

**Files:**
- Modify: `web/src/features/reports/reports-search.ts` (tab `indicators`, key `month`)
- Create: `web/src/features/reports/indicator-rows.ts`
- Create: `web/src/features/reports/indicators-tab.tsx`
- Modify: `web/src/features/reports/reports-page.tsx`
- Modify: `web/src/i18n/catalog-reports.en.ts`, `web/src/i18n/catalog-reports.pt-BR.ts`
- Test: `web/src/features/reports/indicator-rows.test.ts`, `web/src/features/reports/reports-indicators.test.tsx`, existing tests of `reports-search` if any (`grep -l validateReportsSearch web/src -r`)

**Interfaces:**
- Consumes: `indicatorsQuery`, `Indicators` (Task 7, imported from `@/features/overview`), `formatMonths` (`@/i18n/format`).
- Produces:

```ts
// reports-search.ts
export type ReportsTab = "net-worth" | "categories" | "flows" | "indicators";
// ReportsSearch gains: month?: string | undefined — YYYY-MM of the indicators tab; the current month when absent.
// indicator-rows.ts
export interface IndicatorRow {
  label: string;
  savings: number | null; trailing: number | null; liquidity: number | null;
  committed: number | null; debt: number | null; liabilities: number;
}
export function indicatorRows(report: Indicators, label: (month: string) => string): IndicatorRow[]
```

- [ ] **Step 1: Write the failing tests**

`indicator-rows.test.ts`: `indicatorRows(indicatorsFixture(), (m) => m)` has 12 rows; row 11 is `{ label: "2026-10", savings: 4300, trailing: 4650, liquidity: 66915, committed: 100, debt: 2500, liabilities: 640000 }`; row 0 has `savings: null`.

Search validation (add to the existing search test file, or create `reports-search.test.ts`): `validateReportsSearch({ tab: "indicators", month: "2026-09" })` has `tab: "indicators"` and `month: "2026-09"`; `month: "2026-13"` gives `month: undefined`.

`reports-indicators.test.tsx`: `renderApp("/reports?tab=indicators", { fetch: fakeApi({ ...reportApiRoutes(), "GET /api/v1/reports/indicators": (req) => { months.push(new URL(req.url).searchParams.get("month")); return json(200, indicatorsFixture()); } }) })`; expect `await screen.findByText(catalogEn["report.indicators.savings"])` and the other four chart titles; expect `months` to contain `"2026-10"` (default today `2026-10-17`).

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && pnpm vitest run src/features/reports/`
Expected: FAIL in the new tests.

- [ ] **Step 3: Catalog keys** (`catalog-reports.*.ts`)

| Key | en | pt-BR |
|---|---|---|
| `report.tab.indicators` | Indicators | Indicadores |
| `report.indicators.month` | Month of the indicators | Mês dos indicadores |
| `report.indicators.savings` | Savings rate | Taxa de poupança |
| `report.indicators.trailing` | 12-month mean | Média de 12 meses |
| `report.indicators.reserve` | Reserve in months of expense | Reserva em meses de despesa |
| `report.indicators.committed` | Committed income | Renda comprometida |
| `report.indicators.debt` | Debt payments | Prestações de dívida |
| `report.indicators.liabilities` | Liabilities | Passivos |
| `report.indicators.description` | Cash basis. A gap is a month without enough records. | Visão de caixa. Um intervalo é um mês sem registros suficientes. |

- [ ] **Step 4: Implement**
- `reports-search.ts`: add `"indicators"` to `ReportsTab` and `reportsTabs` (last); `month` validated with `/^\d{4}-(0[1-9]|1[0-2])$/`.
- `indicator-rows.ts` per the Interfaces block (`bp` or `null` per ratio; `liabilities.amount`).
- `indicators-tab.tsx`: `IndicatorsTab({ month, onMonth }: { month: string; onMonth: (month: string) => void })`. `ReportControls` with `start={<MonthControl value={month} onChange={onMonth} label={t("report.indicators.month")} />}`. Five `Chart`s (`variant="card"`, `size="sm"`, `x={{ field: "label" }}`, `description={t("report.indicators.description")}`) inside a `Grid gap={4} minItemWidth="lg"`, as `categories/category-charts.tsx` lays out its charts:
  1. savings: series `savings` (line) and `trailing` (line, `stroke: "dashed"`), format `formatBasisPoints`;
  2. reserve: series `liquidity` (line), format `(bp) => t("overview.indicators.months", { months: formatMonths(bp, locale) })` (`formatMonths` from `@/i18n/format`);
  3. committed: series `committed`, format `formatBasisPoints`;
  4. debt: series `debt`, format `formatBasisPoints`;
  5. liabilities: series `liabilities`, format money of `report.currency` through `useMoneyFormat()` and `useScale()`.
  Loading: `Skeleton`, as `net-worth-tab.tsx` does while pending; error: `QueryError`.
- `reports-page.tsx`: label `report.tab.indicators`; show `PeriodControl` only for `categories` and `flows`; render `{shownTab === "indicators" && <IndicatorsTab month={search.month ?? today.slice(0, 7)} onMonth={(next) => { onChange({ month: next === today.slice(0, 7) ? undefined : next }); }} />}`.

- [ ] **Step 5: Run the reports tests**

Run: `cd web && pnpm vitest run src/features/reports/`
Expected: PASS.

- [ ] **Step 6: Static checks**

Run: `cd web && pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat(web): add the indicators tab to reports"
```

---

### Task 10: Chart encodings

**Files:**
- Create: `web/src/features/planning/spending-bars.ts`
- Modify: `web/src/features/planning/budget-spending-chart.tsx`, `web/src/features/planning/budgets-tab.tsx` (drop `slot`)
- Create: `web/src/features/categories/composition-rows.ts`
- Modify: `web/src/features/categories/category-charts.tsx` (composition chart only)
- Modify: `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`
- Test: `web/src/features/planning/spending-bars.test.ts`, `web/src/features/categories/composition-rows.test.ts`

**Interfaces:**
- Produces:

```ts
// planning/spending-bars.ts
export function spendingBars(slices: readonly { name: string; spent: number }[], locale: string): { label: string; spent: number }[]
// categories/composition-rows.ts
export function compositionRows(series: readonly { field: string; label: string }[], record: Readonly<Record<string, string | number>>, locale: string): { label: string; amount: number }[]
```
Both: drop entries ≤ 0; sort by amount descending, then by name; share = `Math.trunc(amount * 10000 / total)` in bp; label `${name} · ${formatBasisPoints(share, locale)}`.

- [ ] **Step 1: Write the failing tests**

```ts
// spending-bars.test.ts
it("ranks the spending and prints each share", () => {
  expect(spendingBars([{ name: "Food", spent: 100 }, { name: "Rent", spent: 300 }, { name: "Gifts", spent: 0 }], "en-US")).toEqual([
    { label: "Rent · 75.00%", spent: 300 },
    { label: "Food · 25.00%", spent: 100 },
  ]);
});
// composition-rows.test.ts
it("ranks the groups of the last month and prints each share", () => {
  expect(compositionRows([{ field: "a", label: "Market" }, { field: "b", label: "Diner" }, { field: "c", label: "Bakery" }], { a: 200, b: 600, c: 0, label: "Oct" }, "en-US")).toEqual([
    { label: "Diner · 75.00%", amount: 600 },
    { label: "Market · 25.00%", amount: 200 },
  ]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd web && pnpm vitest run src/features/planning/spending-bars.test.ts src/features/categories/composition-rows.test.ts`
Expected: FAIL: modules not found.

- [ ] **Step 3: Implement**
- `budget-spending-chart.tsx`: one series `{ id: "spent", kind: "bar", field: "spent", label: t("budget.spent"), format: money }`; `orientation="horizontal"`; `data={spendingBars(slices, locale)}`; `x={{ field: "label" }}`; `y={{ format: money }}`; remove `innerRadius`, `slotField`, `legendValues`, `renderCenter`; `description={t("budget.spentTotal", { amount: money(total) })}`. Remove `slot` from `SpendingSlice` and from where `budgets-tab.tsx` builds the slices.
- `category-charts.tsx`, composition chart only: `data={compositionRows(compositionSeries, last, locale)}`, one series `{ id: "amount", kind: "bar", field: "amount", label: t("category.chart.amount"), format: money }`, `orientation="horizontal"`, `x={{ field: "label" }}`; remove `stackMode="percent"`, `trigger="item"` and `legendValues`. The monthly trend chart stays as it is.
- Keys: `budget.spentTotal` "Spent {amount}" / "Gasto {amount}"; `category.chart.amount` "Amount" / "Valor".

- [ ] **Step 4: Run the planning and categories tests**

Run: `cd web && pnpm vitest run src/features/planning/ src/features/categories/`
Expected: PASS.

- [ ] **Step 5: Static checks**

Run: `cd web && pnpm typecheck && pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat(web): rank budget and category composition as bars" -m "The budget spending donut and the 100% stacked composition bar become
horizontal bars sorted by amount with the share in the label: angle and
stacked segments read less accurately than position on a common scale
(analytics study V1, V3, V5)."
```

---

### Task 11: Roadmap and full check

**Files:**
- Modify: `docs/web-roadmap.md` (§7 Overview, §12 Reports)

- [ ] **Step 1: Update the roadmap**

§7, in "Functions", add two items:
`- Indicators: savings rate with its 12-month mean, reserve in months, committed income and debt payments of the month, cash basis, each with a 12-month sparkline (getIndicators; analytics design 5.1).`
`- Hide: each block except the attention list, the desk figures and the balance chart hides from its own menu; the page header shows every hidden block again (analytics design 5.2).`
§7 "Operations": add `getIndicators`. §12 "Status": add `getIndicators` to the operations and "the indicators tab" to the tabs. §12 "Functions": add `- Indicators: one chart per indicator over the 12 months ending at a chosen month.`

- [ ] **Step 2: Full check**

Run: `make check`
Expected: exit 0. A failure: fix it in the task that owns the file, never by changing an expected value.

- [ ] **Step 3: Commit**

```bash
git add docs/web-roadmap.md
git commit -m "docs(web): record the indicators and the hide control"
```
