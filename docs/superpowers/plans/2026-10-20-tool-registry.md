# Tool Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tool contract in `internal/platform/tool`, consumed by `llm.RunTools`, with four read-only tools from `ledger` and `reporting` and tests that keep the catalog aligned with `api/openapi.yaml`.

**Architecture:** `tool.New[In, Out]` erases a typed handler into a `Tool` with JSON Schemas inferred by `github.com/google/jsonschema-go`. Modules declare tools in `internal/<module>/internal/adapter/toolapi` and expose a `tool.Group`; `internal/server` builds one `*tool.Registry` as `App.Tools`. `Set.LLM()` bridges a selection of tools to `llm.RunTools`.

**Tech Stack:** Go 1.27 (`encoding/json/v2`), `github.com/google/jsonschema-go` v0.4.3, PostgreSQL through sqlc, `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-20-tool-registry-design.md`; rules in `docs/adr/012-tool-registry.md` (T1 to T14).

## Global Constraints

- Work happens in the worktree `/home/dreco/dev/equori-tool-registry`, branch `feat/tool-registry`, created from `74f3b66`. The main worktree holds uncommitted work of another branch; nothing in it is touched after Task 0.
- Tool name pattern: `^[a-z][a-z0-9_]{0,63}$`.
- Allowed schema keywords: `type`, `properties`, `required`, `items`, `enum`, `format`, `description`, `additionalProperties` (only `false`), `minimum`, `maximum`. `type` is a single string.
- `MaxResultBytes = 32 << 10`. List tools: `limit` default 20, maximum 50.
- Registry error codes: `invalid_arguments`, `result_too_large`, `internal_error`.
- `tool.Money`: `{"amount": "-1234.56", "currency": "BRL"}`. `tool.Date`: `"2026-10-20"`.
- Logs per call: `tool`, `user_id`, `effect`, `outcome` (`ok` or the error code), `duration`, `bytes`. Never arguments or results.
- Commits: Conventional Commits, no AI attribution, `make check` passes before each commit.
- Tests: exact values, status checked before decoding, `apitest.Today` for dates.

## Review Focus

1. A tool argument with the right type but an unusable value (malformed UUID in `account_id`, `limit` 0): expected `invalid_arguments` naming the field, not `internal_error`. Pinned in Task 5.
2. A user reading another user's data through a tool: expected the other user's rows to be absent. Pinned in Task 5.
3. A tool called with `null` or empty arguments: expected the same result as `{}`. Pinned in Task 2.
4. A closed category with zero totals: expected absence from `get_category_totals`, as in `GET /reports/category-totals`. Pinned in Task 6.
5. Model-visible error text: expected no Go error strings or SQL in `internal_error` detail. Pinned in Task 2.

---

### Task 0: Worktree

- [ ] **Step 1:** `git -C /home/dreco/dev/equori worktree add -b feat/tool-registry ../equori-tool-registry 74f3b66`
- [ ] **Step 2:** Move (not copy) `docs/adr/012-tool-registry.md`, `docs/superpowers/specs/2026-10-20-tool-registry-design.md` and this plan from `/home/dreco/dev/equori` to the same paths in the worktree.
- [ ] **Step 3:** In the worktree, run `make check`. Expected: PASS. A failure here is recorded as a known problem in the checkpoint, and the slice stops.
- [ ] **Step 4:** Commit the three documents: `docs(platform): record ADR 012 tool registry and its plan`.

### Task 1: Tool definition, values and schema inference

**Files:**
- Create: `internal/platform/tool/tool.go` (Effect, Spec, Tool, New), `internal/platform/tool/schema.go` (inference, enum discovery, name and keyword checks), `internal/platform/tool/value.go` (Money, Date)
- Modify: `internal/platform/money/money.go` (add `Decimal`), `go.mod`, `go.sum`
- Test: `internal/platform/tool/tool_test.go`, `internal/platform/tool/value_test.go`, `internal/platform/money/money_test.go`

**Interfaces:**
- Produces:
  - `type Effect int` with `ReadOnly`, `Write`, `Destructive` (starting at 1); `func (e Effect) String() string` returns `read_only`, `write`, `destructive`.
  - `type Spec struct { Name, Description string; Effect Effect; Idempotent bool }`
  - `type Tool struct` (unexported fields); `func (t Tool) Spec() Spec`; `func (t Tool) InputSchema() *jsonschema.Schema`; `func (t Tool) OutputSchema() *jsonschema.Schema`; `func (t Tool) ValidateOutput(content json.RawMessage) error`.
  - `func New[In, Out any](s Spec, h func(ctx context.Context, userID int64, in In) (Out, error)) Tool`
  - `type Enumerated interface { Values() []string }`
  - `type Money struct { Amount string `json:"amount"`; Currency string `json:"currency"` }`; `func MoneyOf(m money.Money) Money`
  - `type Date struct{ time.Time }` with `MarshalText`/`UnmarshalText` in `2006-01-02`; `func DateOf(t time.Time) Date`
  - `func (m money.Money) Decimal() string` (`"-1234.56"`); `String` becomes `currency + " " + Decimal()`.

- [ ] **Step 1: Write the failing tests**

`TestMoneyDecimal`: BRL `-123456` → `"-1234.56"`; BRL `5` → `"0.05"`; `money.NewOf(150, "MXRF11", 0)` → `"150"`; BRL `0` → `"0.00"`. Existing `String` tests stay unchanged and keep passing.

`TestMoneyOf`: `MoneyOf(BRL -123456)` equals `Money{Amount: "-1234.56", Currency: "BRL"}`.

`TestDateJSON`: `json.Marshal(struct{D Date `json:"d"`}{DateOf(2026-10-20)})` → `{"d":"2026-10-20"}`; unmarshal `"2026-13-01"` returns an error; zero `Date` with `omitzero` is omitted.

`TestNewInfersSchemas` (semantic JSON compare: unmarshal both sides to `any`, `reflect.DeepEqual`):

```go
type kind string
func (kind) Values() []string { return []string{"asset", "expense"} }
type in struct {
	Query string `json:"query" jsonschema:"text to find"`
	Kind  kind   `json:"kind,omitzero"`
	From  Date   `json:"from,omitzero"`
	Limit int    `json:"limit,omitzero"`
}
type out struct {
	Total Money `json:"total"`
}
```

Expected input schema:

```json
{"type":"object","additionalProperties":false,"required":["query"],"properties":{
 "query":{"type":"string","description":"text to find"},
 "kind":{"type":"string","enum":["asset","expense"]},
 "from":{"type":"string","format":"date"},
 "limit":{"type":"integer"}}}
```

Expected output schema: `{"type":"object","additionalProperties":false,"required":["total"],"properties":{"total":{"type":"object","additionalProperties":false,"required":["amount","currency"],"properties":{"amount":{"type":"string"},"currency":{"type":"string"}}}}}`.

`TestNewRejects` (table; each case asserts `New` panics, recovered with a message containing the given text):

| Case | Text |
|---|---|
| name `Search` | `name` |
| name `9x` | `name` |
| name of 65 characters | `name` |
| empty description | `description` |
| zero `Effect` | `effect` |
| `In = string` | `object` |
| `In` with a `*string` field | `keyword` or `type` |
| `In` with a `map[string]int` field | `additionalProperties` |
| `Out = []int` | `object` |

`TestValidateOutput`: `{"total":{"amount":"1.00","currency":"BRL"}}` passes; `{"total":{"amount":1}}` fails.

- [ ] **Step 2: Run** `go test ./internal/platform/tool/ ./internal/platform/money/` — Expected: FAIL (package `tool` missing, `Decimal` undefined).

- [ ] **Step 3: Implement.**
  - `go get github.com/google/jsonschema-go@v0.4.3`.
  - `New` builds `jsonschema.ForOptions.TypeSchemas` by walking the struct types of `In` and `Out` recursively: `Date` → `{type: string, format: date}`; a named string type implementing `Enumerated` → `{type: string, enum: Values()}`. Then `jsonschema.For[In]`, `jsonschema.For[Out]`.
  - Clear `PropertyOrder` on every schema node when inference sets it (not in the keyword list).
  - Keyword check: marshal each schema, walk the JSON, panic on a key outside the list, an `additionalProperties` other than `false`, or a non-string `type`.
  - Resolve both schemas once in `New` (`Schema.Resolve(nil)`); `ValidateOutput` unmarshals into `any` and calls `Resolved.Validate`.
  - The erased call function decodes validated arguments into `In` with `json.Unmarshal` (v2), runs the handler and returns `Out` as `any`.

- [ ] **Step 4: Run** `go test ./internal/platform/tool/ ./internal/platform/money/` — Expected: PASS.

- [ ] **Step 5: Run** `make check`, then commit `feat(platform): define tools with schemas inferred from Go types`.

### Task 2: Registry and call

**Files:**
- Create: `internal/platform/tool/registry.go` (Registry, Set, Group, NewRegistry, Select, Call), `internal/platform/tool/error.go` (Error, FieldError, FromProblem, sentinels)
- Test: `internal/platform/tool/registry_test.go`

**Interfaces:**
- Consumes: `Tool`, `Spec`, `New` (Task 1); `auth.UserID`, `auth.WithUserID`; `problem.Details`.
- Produces:
  - `const MaxResultBytes = 32 << 10`
  - `var ErrNoUser = errors.New("tool call without a user")`, `var ErrUnknownTool = errors.New("unknown tool")`
  - `type FieldError struct { Field string `json:"field"`; Message string `json:"message"` }`
  - `type Error struct { Code string `json:"code"`; Detail string `json:"detail"`; Errors []FieldError `json:"errors,omitzero"` }`, with `func (e *Error) Error() string`. A handler returns `*Error` for argument values it cannot use.
  - `type Group struct { Tools []Tool; Errors func(error) (Error, bool) }`
  - `func FromProblem(m func(error) (problem.Details, bool)) func(error) (Error, bool)`
  - `type Result struct { Content json.RawMessage; IsError bool }`
  - `func NewRegistry(log *slog.Logger, groups ...Group) (*Registry, error)`
  - `func (r *Registry) Tools() []Tool` (sorted by name), `func (r *Registry) Tool(name string) (Tool, bool)`
  - `func (r *Registry) Select(names ...string) (Set, error)`
  - `func (r *Registry) Call(ctx context.Context, name string, args json.RawMessage) (Result, error)`
  - `type Set struct` (unexported fields); `func (s Set) Tools() []Tool`; `func (s Set) Call(ctx context.Context, name string, args json.RawMessage) (Result, error)`

- [ ] **Step 1: Write the failing tests** — `TestRegistry` subtests over a registry with one `echo` tool (`In{Text string; Limit int omitzero}`, `Out{Text string}`) and one `fail` tool whose handler returns the error named in its input. The logger writes to a buffer.

| Subtest | Assertion |
|---|---|
| duplicate | `NewRegistry` with two tools named `echo` returns an error containing `duplicate tool echo` |
| select unknown | `Select("nope")` → `errors.Is(err, ErrUnknownTool)` |
| unknown tool | `Call(ctx, "nope", …)` → `ErrUnknownTool` |
| no user | context without `auth.WithUserID` → `ErrNoUser` |
| ok | `{"text":"hi"}` → `IsError false`, content `{"text":"hi"}`; log line has `tool=echo`, `outcome=ok`, `effect=read_only`, `user_id=7`, `bytes=13`, and not `hi` |
| null and empty arguments | `nil`, `null` and `{}` on a tool whose input has no required field return the same content |
| missing required | `{}` on `echo` → `IsError`, code `invalid_arguments`, detail mentions `text` |
| unknown member | `{"text":"a","x":1}` → `invalid_arguments` |
| wrong type | `{"text":1}` → `invalid_arguments` |
| not an object | `[1]` → `invalid_arguments` |
| handler `*Error` | `fail` returns `&Error{Code: "invalid_arguments", Detail: "d", Errors: […{Field: "account_id"}]}` → that exact JSON |
| mapped error | group mapper maps `errNotFound` to `Error{Code: "not_found", Detail: "resource not found"}` → that code and detail; log `outcome=not_found` |
| unmapped | plain `errors.New("pq: secret")` → code `internal_error`, detail `the tool failed; the error is in the server log`, content does not contain `pq`, log contains `pq: secret` |
| canceled | handler returns `ctx.Err()` after cancel → Go error, `errors.Is(err, context.Canceled)` |
| too large | output of 40 000 bytes → code `result_too_large`, detail contains `32768` and `limit` |
| set boundary | `Select("echo").Call(ctx, "fail", …)` → `ErrUnknownTool` |
| FromProblem | `problem.New(404, "not_found", "x")` with one field error → `Error{Code: "not_found", Detail: "x", Errors: [...]}` |

- [ ] **Step 2: Run** `go test ./internal/platform/tool/ -run TestRegistry` — Expected: FAIL (undefined `NewRegistry`).

- [ ] **Step 3: Implement** following the order in spec "Package `internal/platform/tool`" and ADR T6 to T8, T13. Validation-failure detail is the validator's message. `result_too_large` detail: `fmt.Sprintf("the result has %d bytes, over the limit of %d; narrow the filters or lower limit", n, MaxResultBytes)`. Unmapped errors are logged at error level with `tool` and `err`.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Run** `make check`, then commit `feat(platform): add the tool registry with validated calls`.

### Task 3: Bridge to `llm.RunTools`

**Files:**
- Modify: `internal/platform/llm/tools.go` (ToolError, runTool)
- Create: `internal/platform/tool/llm.go`
- Test: `internal/platform/llm/tools_test.go`, `internal/platform/tool/llm_test.go`

**Interfaces:**
- Consumes: `Set`, `Result` (Task 2); `llm.Tool`, `llm.ToolHandler`, `llm.RunTools`, `llmtest.New`, `llm.ToolCall{ID, Name, Args}`, `llm.ToolResult{CallID, Name, Content, IsError}`.
- Produces: `type llm.ToolError struct { Content json.RawMessage }` with `Error() string` returning `string(Content)`; `func (s Set) LLM() ([]llm.Tool, map[string]llm.ToolHandler)`.

- [ ] **Step 1: Write the failing tests**
  - `llm`: `TestRunToolsToolError` — the handler returns `&llm.ToolError{Content: json.RawMessage(`{"code":"not_found"}`)}`; the tool result in the second request has `IsError true` and content exactly `{"code":"not_found"}`.
  - `tool`: `TestSetLLM` — `Set.LLM()` returns one `llm.Tool` per selected tool, `Parameters` semantically equal to `InputSchema()`. Through `llmtest`, a model step calls `echo` with `{"text":"hi"}`, then answers text; the tool result content is `{"text":"hi"}`. A second case calls `echo` with `{}` and the result has `IsError true`, code `invalid_arguments`. The context carries `auth.WithUserID(ctx, 7)`.
- [ ] **Step 2: Run** `go test ./internal/platform/llm/ ./internal/platform/tool/` — Expected: FAIL.
- [ ] **Step 3: Implement.** `runTool` checks `errors.AsType[*ToolError]` before `errorContent`. The `LLM()` handler maps `Result.IsError` to `&llm.ToolError{Content}` and passes Go errors through unchanged.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Run** `make check`, then commit `feat(platform): run registry tools in the language model loop`.

### Task 4: Ledger tools `list_accounts` and `get_balances`; registry wiring

**Files:**
- Create: `internal/ledger/internal/adapter/toolapi/toolapi.go` (`Tools`, `allAccounts`), `internal/ledger/internal/adapter/toolapi/accounts.go`
- Modify: `internal/ledger/internal/adapter/httpapi/errors.go` (rename `toProblem` → `ToProblem`; update its callers), `internal/ledger/ledger.go` (`Tools`), `internal/server/server.go` (`App.Tools`), `internal/apitest/apitest.go` (`Tool`, `ExpectToolError`)
- Test: `internal/ledger/tools_test.go`

**Interfaces:**
- Consumes: `tool.New`, `tool.Group`, `tool.FromProblem`, `tool.NewRegistry`, `tool.MoneyOf`, `tool.Date` (Tasks 1 and 2); `app.Service.ListAccounts`, `BalancesAt`, `Today`; `page.Request[app.AccountKey]`, `page.MaxLimit`.
- Produces:
  - `func toolapi.Tools(svc *app.Service) []tool.Tool`
  - `func allAccounts(ctx context.Context, svc *app.Service, userID int64) (map[uuid.UUID]domain.Account, []domain.Account, error)`, which reads every page with `Limit: page.MaxLimit`.
  - `func (m *ledger.Module) Tools() tool.Group`
  - `server.App.Tools *tool.Registry`
  - `func (h *Harness) Tool(name string, args any) tool.Result`: runs as `OwnerID()`, fails the test on a Go error, and checks a successful output with `ValidateOutput`.
  - `func (h *Harness) ExpectToolError(r tool.Result, code, field string)`: `field` is empty when no field error is expected.

Tool contracts (descriptions are written by the implementer; they state purpose, enum meanings and limits):

| Tool | Input | Output |
|---|---|---|
| `list_accounts` | `class` (enum `asset`, `liability`, `equity`, `income`, `expense`; optional), `include_closed` (bool) | `{"accounts":[{"id","name","class","kind","currency","parent_id"?,"parent_name"?,"closed"?}]}` ordered by class, then name |
| `get_balances` | `date` (optional, default ledger today), `basis` (enum `booked`, `settled`; default `booked`), `class` (optional) | `{"date","basis","balances":[{"account_id","account_name","class","balance": Money}]}`; zero balances omitted |

- [ ] **Step 1: Write the failing tests** (`apitest.New(t, apitest.Today("2026-10-20"))`)
  - `TestListAccountsTool`: create `Checking` (asset, checking), `Food` (expense), `Groceries` (expense, `parent_id` Food), `Old` (asset, checking, then closed through the API). `{"class":"expense"}` → exactly `Food` without a parent and `Groceries` with `parent_name` `Food`. `{"class":"asset"}` excludes `Old`; `{"class":"asset","include_closed":true}` includes `Old` with `closed: true`. `{"class":"cash"}` → `ExpectToolError(r, "invalid_arguments", "")`.
  - `TestGetBalancesTool`: record 2026-10-01 Checking −1000, Food +1000 (BRL). `{}` → `date` `2026-10-20`, `basis` `booked`, balances exactly Checking `{"amount":"-10.00","currency":"BRL"}` and Food `{"amount":"10.00","currency":"BRL"}`. `{"date":"2026-09-30"}` → `balances` empty. `{"basis":"cleared"}` → `invalid_arguments`.
- [ ] **Step 2: Run** `go test ./internal/ledger/ -run 'Tool$'` — Expected: FAIL (`h.Tool` undefined).
- [ ] **Step 3: Implement** the files listed; `server.New` builds `tool.NewRegistry(log, ledgerModule.Tools())` after the modules and returns its error.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Run** `make check`, then commit `feat(ledger): expose accounts and balances as tools`.

### Task 5: Ledger tool `search_transactions`

**Files:**
- Modify: `db/queries/ledger/reference.sql` (query `PayeeNames`), regenerated `internal/ledger/internal/adapter/postgres/*.gen.go` (`make gen`), `internal/ledger/internal/adapter/postgres/` repository method, `internal/ledger/internal/app/ports.go` (Repository method), `internal/ledger/internal/app/service.go` (`PayeeNames`)
- Create: `internal/ledger/internal/adapter/toolapi/transactions.go`
- Test: `internal/ledger/tools_test.go`

**Interfaces:**
- Consumes: `allAccounts` (Task 4); `app.Service.ListTransactions`, `app.TransactionQuery`, `app.TransactionCursor`; `page.Read`, `page.Next`.
- Produces:
  - SQL `-- name: PayeeNames :many` → `SELECT id, name FROM ledger_payee WHERE user_id = $1 AND id = ANY(@ids::uuid[]);`
  - `func (s *Service) PayeeNames(ctx context.Context, userID int64, ids []uuid.UUID) (map[uuid.UUID]string, error)`

Input: `query`, `account_id`, `payee_id`, `tag`, `from`, `to`, `uncategorized`, `limit` (1 to 50, default 20), `cursor`. Output: `{"transactions":[{"id","date","description","payee_name"?,"voided"?,"tags"?,"postings":[{"account_id","account_name","account_class","amount": Money,"memo"?}]}],"next_cursor"?}`, in the order of `ListTransactions`.

Unusable values return `*tool.Error` with code `invalid_arguments` and one field error: `account_id` and `payee_id` that are not UUIDs, `limit` outside 1 to 50, and a `cursor` that `page.Read` rejects.

- [ ] **Step 1: Write the failing tests**
  - `TestSearchTransactionsTool`: seed payee `Padaria Real`. Record 2026-10-01 `Mercado Central` (Checking −1000, Food +1000) and 2026-10-02 `x` with that payee and tag `trip` (Checking −250, Food +250). `{"query":"padaria"}` → exactly the second transaction with `payee_name` `Padaria Real`, `tags` `["trip"]`, postings `Checking`/`asset`/`-2.50` and `Food`/`expense`/`2.50`. `{"limit":1}` → one transaction plus `next_cursor`; calling again with that cursor returns the other one and no `next_cursor`.
  - `TestSearchTransactionsToolArguments` (table): `{"account_id":"x"}` → field `account_id`; `{"limit":0}` and `{"limit":51}` → field `limit`; `{"cursor":"bad"}` → field `cursor`.
  - `TestSearchTransactionsToolIsolation`: `other := h.Login("other@example.com")` records a transaction `Secret` through its own client. The owner's `{"query":"secret"}` returns `transactions` empty.
- [ ] **Step 2: Run** `go test ./internal/ledger/ -run 'SearchTransactionsTool'` — Expected: FAIL.
- [ ] **Step 3: Implement**, then run `make gen`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Run** `make check`, then commit `feat(ledger): search transactions through a tool`.

### Task 6: Reporting tool `get_category_totals`

**Files:**
- Modify: `internal/reporting/internal/app/categories.go` (`Name` in `CategoryRow` and `CategoryTotal`), `internal/reporting/internal/adapter/postgres/` (map `row.Name`), `internal/reporting/internal/adapter/httpapi/server.go` (rename `toProblem` → `ToProblem`), `internal/reporting/reporting.go` (`Tools`), `internal/server/server.go` (add the group)
- Create: `internal/reporting/internal/adapter/toolapi/toolapi.go`, `internal/reporting/internal/adapter/toolapi/categories.go`
- Test: `internal/reporting/tools_test.go`

**Interfaces:**
- Consumes: `tool.New`, `tool.Group`, `tool.FromProblem`, `tool.MoneyOf`, `tool.Date`; `app.Service.CategoryTotals`.
- Produces: `func toolapi.Tools(svc *app.Service) []tool.Tool`; `func (m *reporting.Module) Tools() tool.Group`.

Input: `class` (enum `income`, `expense`; required), `from`, `to` (required dates, at most 366 days). Output: `{"from","to","categories":[{"account_id","name","parent_id"?,"total": Money,"subtree_total": Money}]}`, in service order. Amounts are built with `money.New(amount, money.Currency(instrument))`.

- [ ] **Step 1: Write the failing tests** (`internal/reporting/tools_test.go`)
  - `TestCategoryTotalsTool`: Food (expense) with child Groceries; `Closed` (expense, closed, no postings). Record 2026-10-05 Checking −1000 / Groceries +1000, then `h.Dispatch()`. `{"class":"expense","from":"2026-10-01","to":"2026-10-31"}` → exactly Food total `0.00`, subtree `10.00`; Groceries total `10.00`, subtree `10.00`, `parent_id` Food. `Closed` is absent.
  - `{"class":"expense","from":"2026-01-01","to":"2027-01-10"}` → `ExpectToolError(r, "invalid_request", "to")`.
- [ ] **Step 2: Run** `go test ./internal/reporting/ -run CategoryTotalsTool` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Run** `make check`, then commit `feat(reporting): expose category totals as a tool`.

### Task 7: Exposure table, golden catalog, project rules

**Files:**
- Create: `internal/server/tools_test.go`, `internal/server/tool_exposure_test.go`, `internal/server/testdata/tools.json`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `apitest.New`, `App.Tools.Tools()`, `Tool.Spec()`, `InputSchema()`, `OutputSchema()`; `api.Contract` loaded with `openapi3.NewLoader().LoadFromData`.

`tool_exposure_test.go` declares `var exposure = map[string]string{…}` with one entry per `operationId`. A value is either a comma-separated list of tool names or an exclusion. Exclusions: `-session` (authentication), `-write` (non-GET operation, no write tool yet), `-binary` (file content or upload), `-pending` (GET without a tool yet). Mapped entries: `listAccounts` and `getAccount` → `list_accounts`; `listBalances` and `getAccountBalance` → `get_balances`; `listTransactions` and `getTransaction` → `search_transactions`; `getCategoryTotals` → `get_category_totals`. The other entries are generated from each operation's method, then reviewed by hand.

- [ ] **Step 1: Write the failing tests**
  - `TestToolExposure`: every `operationId` has an entry; every entry names an existing `operationId`; every tool name in an entry exists in the registry; every registry tool appears in at least one entry; every exclusion is one of the four values. The failure message for a missing entry is `operation %s has no tool exposure entry in tool_exposure_test.go`.
  - `TestToolCatalog`: marshal `[{name, description, effect, idempotent, input_schema, output_schema}]` sorted by name, indented with two spaces. Compare with `testdata/tools.json`; `-update` rewrites the file.
- [ ] **Step 2: Run** `go test ./internal/server/ -run 'TestTool'` — Expected: FAIL (missing entries, missing golden file).
- [ ] **Step 3: Complete the exposure table; run with `-update` once; read `testdata/tools.json` and check every description and schema by hand.**
- [ ] **Step 4: Edit `CLAUDE.md`:**
  - Module internals line: `internal/adapter/{postgres,httpapi,toolapi}`.
  - Code section: `Tools for language models are declared in adapter/toolapi and composed in internal/server (ADR 012).`
  - Definition of done: `5. A new operation in api/openapi.yaml has an entry in internal/server/tool_exposure_test.go.`
- [ ] **Step 5: Run** `make check`, then commit `test(server): keep the tool catalog aligned with the API contract`.
