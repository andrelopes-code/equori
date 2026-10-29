# Assistant infrastructure audit

- Date: 2026-10-23
- Scope: the infrastructure the conversational assistant (`assistant.chat`) builds on: `internal/platform/tool`, `internal/platform/llm` and its adapters, `internal/assistant`, `internal/server`, `internal/platform/httpserver`.
- Verdicts: `adequate` (used as is), `adjust` (used after the correction named), `absent` (built by the assistant plan).
- Live evidence was gathered against the Gemini API with the instance key on 2026-10-23: model listing, `countTokens`, and four `generateContent` requests on `gemini-3.5-flash`.

## Summary

| # | Item | Verdict |
|---|---|---|
| 1 | Tool contract | adequate |
| 2 | Catalog quality gate | absent |
| 3 | Output quality | adjust |
| 4 | Tool loop | adjust |
| 5 | Fallback within a turn | adjust |
| 6 | Usage accounting and limits | adjust |
| 7 | Registry, effects and proposals | absent |
| 8 | Authentication and isolation | adjust |
| 9 | HTTP server | adjust |
| 10 | Untrusted text | absent |
| 11 | Privacy | adjust |
| 12 | Observability | adjust |
| 13 | Existing tests | adjust |

## 1. Tool contract (`platform/tool`)

Verdict: adequate.

Evidence:
- `internal/platform/tool/schema.go:15` limits schemas to `type`, `properties`, `required`, `items`, `enum`, `format`, `description`, `additionalProperties`, `minimum`, `maximum`; `checkKeywords` requires one string `type` and `additionalProperties: false`.
- Named string types with `Values()` become `enum` (`schema.go:66`); `omitzero` fields are optional; nested structs and slices of structs are accepted (`collectTypes`).
- `Registry.Call` validates arguments against the resolved input schema before decoding (`registry.go:117`); violations return `invalid_arguments` with the validator message, which names the field (`registry_test.go:163`, cases "missing required", "unknown member", "wrong type", "invalid date").
- `tool.InvalidArgument(field, message)` carries a corrective message, for example `cursor` "is not a next_cursor of this list, or its item left the list; start again without cursor" (`page.go:57`).
- Results over 32 KiB become `result_too_large` with the limit and the instruction to narrow (`registry.go:136`); list tools page with `limit` 1 to 50 and an opaque cursor (`page.go`).
- The Gemini adapter sends the schema as `parametersJsonSchema` (`aistudio/wire.go:46`); the OpenAI adapter sends it as `function.parameters` (`openai/wire.go:44`). `TestToolsLive` sends the catalog to Gemini.

## 2. Catalog quality gate

Verdict: absent.

Evidence: `tool.New` checks only that the description is not empty (`tool.go:58`). No test checks that a description states when to use and when not to use a tool, or that every input field has a description. `testdata/tools.json` shows `list_accounts.include_closed` with a description and `search_transactions.query` with one, but nothing enforces it for new tools.

Measurement (Gemini `countTokens`, `gemini-3.5-flash`, 2026-10-23): the four current declarations cost 920 tokens; per tool 192 (`list_accounts`) to 255 (`search_transactions`).

Correction:
- `TestToolCatalogQuality` in `internal/server`: every description holds a sentence starting "Use" and one starting "Do not use"; every input property has a non-empty `description`; every declaration (name, description, input schema) is at most 1,600 bytes encoded; the whole catalog given to `assistant.chat` is at most 32,000 bytes encoded. 1,000 bytes of declaration measured 230 to 243 tokens, so the catalog budget is about 8,000 tokens per step.

## 3. Output quality

Verdict: adjust.

Evidence:
- `search_transactions` returns, per posting, `account_id` (36-character UUID), `account_name`, `account_class`, `amount` and `memo` (`ledger/internal/adapter/toolapi/transactions.go:24`). With two postings, the UUIDs alone are 108 bytes of a transaction view; a 20-item page carries 2,160 bytes of identifiers the model rarely needs.
- `get_category_totals` returns `parent_id` without `parent_name` (`reporting/internal/adapter/toolapi/categories.go:27`), which breaks ADR 012 T5 ("every referenced entity carries its name next to its identifier").
- Amounts are decimal strings with currency (`tool.Money`), dates are `YYYY-MM-DD`: legible to the model.

Correction:
- `get_category_totals` adds `parent_name`.
- Output budget test: for each read tool, one call against the evaluation seed with default arguments returns at most 8 KiB (`TestToolOutputBudget`).
- New read tools return identifiers only where another tool takes them as input, each beside its name.

## 4. Tool loop (`llm.RunTools`)

Verdict: adjust.

Evidence (`internal/platform/llm/tools.go`):
- Step limit: after `maxSteps` model calls with tool calls, `RunTools` returns `ErrTooManySteps` and no answer (`tools.go:47`). The user receives nothing for the requests already spent.
- Parallel calls: every tool call of one response runs in order and all results go back in one `RoleTool` message (`tools.go:33`). Adequate.
- Malformed arguments: the registry returns `invalid_arguments` as a tool error and the loop continues, so the model can retry (`tools.go:66`, `registry.go:113`). Adequate.
- Cancellation: a context error from a handler or the provider stops the loop (`tools.go:58`). Adequate.
- Timeouts: each provider call has the HTTP client timeout of 2 minutes (`assistant/internal/adapter/llmapi/llmapi.go:26`, `cmd/equori/main.go:209`); a turn has no deadline of its own.
- Signatures: the Gemini adapter keeps `thoughtSignature` on every part and sends back only its own provider's signatures (`aistudio/aistudio.go:150`). Live: a `gemini-3.5-flash` response to a tool request carried `functionCall.id` (`call_118898`) and a `thoughtSignature`.

Correction:
- `llm.Request` gains `ToolChoice` (`""` or `"none"`). On the last allowed step `RunTools` sends the tools with `ToolChoice: "none"`, so the model answers with the data it has. Gemini maps it to `toolConfig.functionCallingConfig.mode = "NONE"`, chat completions to `tool_choice: "none"`. `ErrTooManySteps` remains only for a model that still returns a tool call.
- The turn runs under a deadline of 90 seconds (`context.WithTimeout`).
- `RunTools` gives every tool call without an ID the ID `call_<step>_<index>`, because chat completions requires `tool_call_id`.

## 5. Fallback within a turn

Verdict: adjust.

Evidence:
- `Client.Generate` rotates to the next target on quota or transient errors at every step (`router.go:113`), so the steps of one turn may reach different providers.
- Live, `gemini-3.5-flash`: a request whose history holds a `functionCall` without a Gemini thought signature (as a chat completions provider produces) returns HTTP 400 "Function call is missing a thought_signature in functionCall parts", with or without an `id`. The adapter maps 400 to `ErrInvalidRequest`, which does not rotate (`router.go:157`): the turn fails.
- A placeholder signature (`skip_thought_signature_validator`) is accepted, but the current Gemini documentation does not describe it; the design does not rely on it.
- Chat completions providers ignore Gemini signatures (`openai/wire.go:97`) and need tool call IDs (item 4).

Correction (restart the turn):
- `llm.Request` gains `Pin Target`. When set, `Client.Generate` tries only that target; a quota or transient failure, or a cooldown, returns `*ExhaustedError` for it.
- `RunTools` pins every step after the first to the target that answered the first step. When a pinned step returns `ErrExhausted`, `RunTools` restarts the turn once from the original messages without the pin; the next target answers the whole turn. A turn restarts at most once.
- History sent from earlier turns is text only (spec section "Conversation"), so earlier turns never carry another provider's tool calls.

## 6. Usage accounting and limits

Verdict: adjust.

Evidence:
- The router records one `llm.Attempt` per provider call of a use client (`router.go:118`, `llmapi.go:71`); `assistant_usage` counts requests per day, provider, model and use (`db/migrations/00057_assistant_usage.sql`). A turn of n steps counts n requests, which matches the provider's quota unit.
- `assistant_usage_limit` holds the owner's daily limits per provider and model, but nothing reads them before a call: `app/usage.go` uses them only in `Usage` (line 59). A limit reached does not stop calls.
- `llm.ExhaustedError` carries `RetryAt` (`errors.go:33`); no HTTP operation maps it yet.

Correction:
- Resolution skips a target whose declared daily request or token limit is reached today (amendment to ADR 019 P14). When every target is skipped for this reason, `Resolve` returns `*llm.ExhaustedError` with `RetryAt` at the start of the next instance day.
- Before a turn starts, the assistant resolves the chain; a chain whose every target is skipped for its limit or cooling down refuses the turn without sending a request.
- The turn operation maps `ErrExhausted` to 429 `assistant_exhausted` with `retry_at`, and `ErrUnavailable` to 503 `assistant_unavailable`.

## 7. Registry, effects and proposals

Verdict: absent.

Evidence: `tool.Spec.Effect` exists (`tool.go:13`) and the catalog records it, but every tool is `ReadOnly` and `Set.LLM` runs every handler directly (`llm.go:21`). No type describes a proposal, its preview, its expiry or its confirmation. `Registry.Select` is static: names fixed at startup (`registry.go:74`), which fits one agent with one catalog.

Correction:
- `platform/tool` gains `tool.NewWrite[In, Out](spec, preview, handler)` for `Write` and `Destructive` tools. `preview` checks the arguments against current data and returns the changes and a basis digest; `tool.New` rejects a non-`ReadOnly` effect. `Registry.Preview(ctx, name, args)` runs validation and the preview; `Registry.Call` keeps executing.
- The proposal (identifier, expiry, single execution, basis check) belongs to module `assistant`, which wraps write tools in `Set.LLM` handlers that store a proposal instead of executing.

## 8. Authentication and isolation

Verdict: adjust.

Evidence:
- `Registry.Call` reads the user from `auth.UserID(ctx)` and refuses a call without one (`registry.go:91`); handlers receive `userID` from the registry, never from arguments.
- `TestToolsLive` sets the user with `auth.WithUserID` (`tools_live_test.go:56`).
- No test asserts that no input schema has a property naming a user, and no test calls a tool with another user's identifier.

Correction:
- `TestToolInputsHaveNoUser`: no input property of any tool matches `(?i)user`.
- Per tool that takes an identifier, a test through `internal/apitest` calls it as user B with user A's identifier and expects the module's not-found code.

## 9. HTTP server

Verdict: adjust.

Evidence:
- `httpserver.Run` sets `WriteTimeout` 30 s (`internal/platform/httpserver/httpserver.go:40`). A turn of six Gemini steps can exceed 30 s, and the connection would close before the answer.
- `statusRecorder` implements `Unwrap` (`middleware.go:159`), so `http.ResponseController` reaches the connection: a handler can extend its write deadline and flush.
- The contract middleware validates requests only (`internal/platform/contract/contract.go:77`), so a streamed response passes through it unchanged.
- Client disconnect cancels `r.Context()`, which `RunTools` and the adapters honor (item 4).

Correction:
- The turn handler calls `http.NewResponseController(w).SetWriteDeadline(time.Now().Add(120 * time.Second))` before running the turn.
- Streaming is viable: a handler on the mux that flushes `text/event-stream` events. Whether to stream is product decision 3 of the spec.

## 10. Untrusted text

Verdict: absent.

Evidence: imported descriptions, payee names, memos, account and category names reach the model as tool output (`search_transactions` returns `description`, `payee_name`, `memo`). ADR 012 Consequences require an agent with write tools to document how its output is confirmed. No system prompt, delimitation or adversarial test exists.

Correction: spec section "Untrusted text": the system prompt states that tool results are data; write tools only create proposals; adversarial tests with instructions planted in a payee, a memo and an account name.

## 11. Privacy

Verdict: adjust.

Evidence:
- `assistant.chat` declares `SendsFinancialData: true` (`internal/assistant/assistant.go:24`); the settings screen shows notice `trains` per use (ADR 019 P3). The conversation screen does not exist, so no notice appears before a first message.
- Privacy mode masks amounts only through `useMoneyFormat()` (ADR 018 P2). The model writes amounts inside free text, which `useMoneyFormat()` never sees.

Correction:
- The panel shows the notice of the target that will answer before the first message, and states `trains` explicitly.
- While privacy is on, the panel replaces every segment of model text that matches the amount pattern of `expectNoAmounts` (`web/src/testing/privacy.ts`) with the mask of `useMoneyFormat()`; proposal values are structured and pass through `useMoneyFormat()`.

## 12. Observability

Verdict: adjust.

Evidence: `Registry.Call` logs tool, user, effect, outcome, duration and bytes per call (`registry.go:96`); the router logs provider, model, outcome, duration and tokens per attempt (`router.go:121`). Nothing ties the calls of one turn together, and no record states the turn's steps, outcome or proposal decisions.

Correction: one log line per turn (`assistant turn`: user, conversation, turn ID, steps, tool call count, input and output tokens, provider and model of the answer, outcome, restart flag, duration) and one per proposal decision (`assistant proposal`: user, proposal ID, tool, decision). Neither carries arguments, results or message text.

## 13. Existing tests

Verdict: adjust.

Evidence:
- `internal/platform/llm/tools_test.go` covers a tool sequence, an unknown tool, a handler error and the step limit with `llmtest`.
- `internal/server/tools_test.go` covers exposure and the catalog snapshot; `tools_live_test.go` sends the catalog to Gemini and runs one call.
- `llmtest.Provider` answers scripted steps per model; it cannot assert which tools or tool choice a request carried other than through `Requests()`.

Gaps: forced final answer, pinning and restart, conversation persistence, proposals, isolation of conversations, adversarial text, the turn operation and its problems, catalog quality, output budget, and a real evaluation. Each is a task of the plan.

## Provider facts read on 2026-10-23

- `GET /v1beta/models` with the instance key lists `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` among the Flash models.
- https://ai.google.dev/gemini-api/docs/rate-limits (updated 2026-10) publishes no free tier figures; it states that limits are per project, that requests per day reset at midnight Pacific time, and that active limits are shown in AI Studio.
- https://ai.google.dev/gemini-api/docs/function-calling (updated 2026-09-23) recommends at most 10 to 20 active tools, and lists the calling modes `auto`, `any`, `none` and `validated`.
- https://ai.google.dev/gemini-api/terms, "Unpaid Services": Google uses submitted content and responses to improve its products, and human reviewers may read input and output.
