# Tool registry: design

Rules: ADR 012 (T1 to T14). This document fixes the scope of the first delivery and the shape of its code.

## Intent

One tool contract serves agents inside the binary, through `llm.RunTools` with Gemini, and an optional MCP transport later. The first delivery contains no agent and no transport. It delivers the registry, the `llm` bridge, four read-only tools and the tests that keep the catalog aligned with `api/openapi.yaml`.

## Goals

- `internal/platform/tool`: definition, registry, call, `Set`, `llm` bridge, `Money` and `Date`.
- Read-only tools in `ledger` and `reporting`, each tested through `internal/apitest`.
- The exposure table and the golden catalog (T14) in `internal/server`.
- `CONTRIBUTING.md` names `adapter/toolapi` in the module layout and adds the exposure entry to the definition of done.

## Non-goals

- MCP transport, personal access tokens, the MCP SDK dependency.
- Tools with effect `Write` or `Destructive`.
- An agent, a system prompt, a conversation store.

## Package `internal/platform/tool`

```go
type Effect int

const (
	ReadOnly Effect = iota + 1
	Write
	Destructive
)

type Spec struct {
	Name        string
	Description string
	Effect      Effect
	Idempotent  bool
}

func New[In, Out any](s Spec, h func(ctx context.Context, userID int64, in In) (Out, error)) Tool

type Group struct {
	Tools  []Tool
	Errors func(error) (Error, bool)
}

func FromProblem(m func(error) (problem.Details, bool)) func(error) (Error, bool)

func NewRegistry(log *slog.Logger, groups ...Group) (*Registry, error)
func (r *Registry) Tools() []Tool // sorted by name
func (r *Registry) Select(names ...string) (Set, error)
func (r *Registry) Call(ctx context.Context, name string, args json.RawMessage) (Result, error)

func (s Set) LLM() ([]llm.Tool, map[string]llm.ToolHandler)

type Result struct {
	Content json.RawMessage // the output, or the encoded Error when IsError
	IsError bool
}

type Error struct {
	Code   string       `json:"code"`
	Detail string       `json:"detail"`
	Errors []FieldError `json:"errors,omitzero"`
}
```

`Registry.Call` returns a Go error only for an unknown tool name, a missing user (`ErrNoUser`) and context cancellation. Every other failure is a `Result` with `IsError`.

Registry error codes: `invalid_arguments`, `result_too_large`, `internal_error`.

## Module side

```
internal/ledger/internal/adapter/toolapi/
  toolapi.go        Tools(svc *app.Service) []tool.Tool
  accounts.go       list_accounts, get_balances
  transactions.go   search_transactions
internal/reporting/internal/adapter/toolapi/
  toolapi.go
  categories.go     get_category_totals
```

The root package composes the group:

```go
func (m *Module) Tools() tool.Group {
	return tool.Group{Tools: toolapi.Tools(m.svc), Errors: tool.FromProblem(httpapi.ToProblem)}
}
```

`httpapi.toProblem` is exported as `httpapi.ToProblem` in each module that declares tools.

## First tools

| Tool | Service call | Input | Output |
|---|---|---|---|
| `list_accounts` | `ledger` `ListAccounts` | `class` (enum, optional), `include_closed`, `limit`, `cursor` | accounts with ID, name, class, kind, currency, parent ID and name, system role, closed flag; `next_cursor` |
| `get_balances` | `ledger` `BalancesAt` | `date` (optional, default today), `basis` (enum), `class` (`asset`, `liability`, `equity`), `limit`, `cursor` | per asset, liability or equity account with a non-zero balance, as `GET /balances`: ID, name, class, `Money`; `next_cursor` |
| `search_transactions` | `ledger` `ListTransactions` | `query` (also matches payee names), `account_id`, `tag`, `from`, `to`, `uncategorized`, `limit` (1 to 50; 0 or absent means 20), `cursor` | per transaction: ID, date, description, payee name, tags, postings with account name, account class and `Money` (a posting on an `income` or `expense` account is the category); `next_cursor` |
| `get_category_totals` | `reporting` `CategoryTotals` | `class` (enum), `from`, `to`, `limit`, `cursor` | per category with postings of its own in the period, and per ancestor of one: ID, name, parent ID, `Money` total and subtree total; `next_cursor` |

Descriptions state when to use the tool, the meaning of each enum value, and the limit of each filter.

## Tests

| Test | Location |
|---|---|
| Definition: inferred schemas, enums, rejected names, types and keywords (T2 to T4) | `internal/platform/tool/*_test.go`, no database |
| Registry: duplicate name, unknown selection, invalid arguments, unknown member, `result_too_large`, `internal_error`, `ErrNoUser`, context cancellation, log fields | `internal/platform/tool/*_test.go`, no database |
| Pagination: `tool.Limit`, `tool.Paginate`, `tool.PageOf`, `tool.PageArgs` schema (T11) | `internal/platform/tool/page_test.go`, no database |
| `llm` bridge: tool error reaches the model as `IsError` with its JSON content | `internal/platform/tool`, with `llm/llmtest` |
| Exposure table and golden catalog (T14) | `internal/server/tools_test.go`, `internal/server/testdata/tools.json` |
| Schema keywords against Gemini (T4) and one `llm.RunTools` round trip | `internal/server/tools_live_test.go`, `go test -tags live`, needs `EQUORI_GEMINI_API_KEY` |
| Each tool: exact output for seeded data, pagination, argument errors on their field, isolation between users, output valid against its output schema | `internal/ledger/tools_test.go`, `internal/reporting/tools_test.go` |

`apitest.Harness.Tool(name string, args any) tool.Result` calls `App.Tools` with the owner's user ID and checks every successful output against the tool's output schema.

## Left to the builder

- Exact output field names, within T5.
- Wording of descriptions.
- The exclusion reason vocabulary of the exposure table.
