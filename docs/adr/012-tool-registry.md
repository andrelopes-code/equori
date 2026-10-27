# ADR 012: Tool registry for language model agents

- Status: accepted
- Date: 2026-10-20
- Amended by ADR 020: T9, T10, T14

## Context

ADR 009 gives modules `llm.RunTools`, which runs a tool loop over `[]llm.Tool` and a map of `llm.ToolHandler`. No module declares tools yet. Two consumers are expected: agents inside the binary that call Gemini through `internal/platform/llm`, and, possibly later, external clients over the Model Context Protocol (MCP). A tool is a named operation a language model can call with JSON arguments; its contract is a name, a description and JSON Schemas for input and output.

Without one contract, each agent and each transport declares its own tool list, and the lists drift from each other and from `api/openapi.yaml`. Tools wrapping every HTTP operation one to one cost model context on every step and lower tool selection accuracy ([Anthropic, "Writing effective tools for agents"](https://www.anthropic.com/engineering/writing-tools-for-agents)); `api/openapi.yaml` has 140 operations.

The official MCP Go SDK (`github.com/modelcontextprotocol/go-sdk` v1.7.0) infers and validates tool schemas with `github.com/google/jsonschema-go` v0.4.3 and accepts a precomputed schema through `Server.AddTool`.

## Decision

| ID | Rule |
|---|---|
| T1 | `internal/platform/tool` holds the tool contract: definition, registry and call. It knows no module and no transport other than the `llm` bridge (T10). |
| T2 | A tool is built with `tool.New[In, Out](spec, handler)`, where the handler is `func(ctx context.Context, userID int64, in In) (Out, error)`. Input and output schemas are inferred from `In` and `Out` with `github.com/google/jsonschema-go`: property names from `json` tags, descriptions from `jsonschema` tags, required properties from fields without `omitzero`. An invalid definition panics at construction, so a broken tool stops startup and every test that builds the server. |
| T3 | A tool name matches `^[a-z][a-z0-9_]{0,63}$`, reads verb then object (`search_transactions`), and is unique in the registry. The pattern is accepted by the MCP name rule and by the Gemini function name rule. |
| T4 | `In` and `Out` are structs whose fields are strings, integers, booleans, slices or structs; no pointers, maps or interfaces. A named string type with a `Values() []string` method becomes an `enum`. `tool.New` rejects a schema with a keyword outside a fixed list; a keyword joins the list after a Gemini request using it succeeds; `TestToolsLive` (`go test -tags live ./internal/server/`) sends the catalog to Gemini. |
| T5 | Monetary values are `tool.Money`: `amount` as a decimal string in the instrument's scale (`"-1234.56"`) and `currency`. Dates are `tool.Date` (`"2026-10-20"`). Identifiers are UUID strings, and every referenced entity carries its name next to its identifier. This differs from ADR 007 C7 on purpose: a scaled integer requires the model to apply the scale itself. |
| T6 | `Registry.Call` validates the arguments against the input schema, decodes them, runs the handler and encodes the output. An output over 32 KiB is replaced by error `result_too_large`, whose detail names the filters and the limit to narrow. |
| T7 | A failed call returns a tool error `{code, detail, errors[]}` with the vocabulary of `Problem.code` (ADR 004). Schema violations return `invalid_arguments` with the validator's message as `detail`. A module maps its errors through the function its HTTP adapter already uses (`tool.FromProblem`). An unmapped error returns `internal_error` and is logged. |
| T8 | The user comes from `auth.UserID(ctx)`. A call without a user returns `tool.ErrNoUser` to the caller as a Go error, never as a tool error. An agent without an HTTP session sets the user with `auth.WithUserID`. |
| T9 | Each tool declares its effect: `ReadOnly`, `Write` or `Destructive`, plus `Idempotent`. A consumer receives a `tool.Set` from `Registry.Select(names...)`, never the whole registry; an unknown name is an error at startup. |
| T10 | `Set.LLM()` returns the `[]llm.Tool` and the handler map for `llm.RunTools`. `llm` gains `ToolError`, whose content reaches the model unchanged with `IsError` set. |
| T11 | List tools paginate with `limit` (default 20, maximum 50) and an opaque `cursor` from `platform/page`. `tool.PageArgs` and `tool.PageOf` page a list a tool computes in full; the cursor names the last item, so a list that changed under it fails on `cursor`. |
| T12 | A module declares its tools in `internal/<module>/internal/adapter/toolapi`. The root package exposes `Tools() tool.Group`, which holds the module's tools and its error mapping. `internal/server` builds one `*tool.Registry` from every group and exposes it as `App.Tools`. |
| T13 | Logs record per call the tool name, user ID, effect, outcome code, duration and result size; never arguments or results. |
| T14 | Three tests keep the registry aligned with the API. Every `operationId` of `api/openapi.yaml` maps to tool names or to an exclusion reason, and a missing or stale entry fails. The catalog (names, descriptions, effects, schemas) is compared with `internal/server/testdata/tools.json`, which is regenerated with `-update`. Each tool has a test through `internal/apitest`, and so does each error code it returns. |

## Consequences

- New direct dependency: `github.com/google/jsonschema-go` v0.4.3, the version the MCP Go SDK v1.7.0 requires.
- An MCP transport later adds the SDK and passes the registry's schemas to `Server.AddTool` unchanged; `Effect` maps to the MCP annotations `readOnlyHint`, `destructiveHint` and `idempotentHint`.
- A new HTTP operation fails `make check` until its exposure entry exists.
- Imported descriptions and payee names reach the model as tool output. They are untrusted text; an agent that holds `Write` or `Destructive` tools documents how its output is confirmed.

## Deferred

- MCP transport at `/mcp`: resolved by ADR 024.
- Tools with effect `Write` or `Destructive`, each introduced with its first consuming agent.

## Revisit criterion

A model provider that rejects schemas produced under T4, or a tool whose input cannot be expressed in that subset.

## Amendment of 2026-10-27 (ADR 024)

- T13: a call through MCP also writes the line `mcp call` with the token ID beside the user ID, tool, effect, outcome, duration and size; never arguments, results or the token.
