# LLM foundation design

- Date: 2026-10-16
- Branch: `feat/ai-gateway` (based on `feat/p6-pluggy`)
- Decision record to write: ADR 009

## Intent

Future modules (`classification`, `reporting`, `ingestion`, a conversational channel) will call large language models. This work delivers only the foundation those calls go through: a provider-neutral Go package that sends a request to an ordered list of models, falls through the list on quota exhaustion, and supports tool calling. No use case is built here.

A *target* is a pair (provider, model), for example (`aistudio`, `gemini-3.5-flash-lite`). A *chain* is the ordered list of targets one use declares.

## Goals

| ID | Goal |
|---|---|
| G1 | Text generation from a system instruction and a list of messages. |
| G2 | JSON output constrained by a JSON Schema supplied by the caller. |
| G3 | Tool calling in two layers: a single-step primitive and an executor that runs the loop. |
| G4 | Rotation: on quota exhaustion or transient failure of one target, the call moves to the next target of the chain. |
| G5 | When every target of the chain is cooling down, the call returns an error at once, carrying the earliest instant a target becomes available. |
| G6 | One provider adapter: Google AI Studio (Gemini API), written with `net/http`. |
| G7 | Each call reports the target that answered and its token usage. |

## Non-goals

- Streaming, server-side conversation state, media input (images, PDF), embeddings.
- HTTP endpoints, changes to `api/openapi.yaml`, frontend.
- Database tables. Cooldown state lives in process memory; a restart clears it.
- Per-user provider credentials. The key is instance configuration.
- Privacy policy enforcement. Each use decides what content it sends (see Constraints, C5).
- Proactive rate counting. Rotation reacts to provider responses only.
- Overriding a chain through environment variables.
- Any concrete use (classification prompts, chatbot).

## Anti-goals

The work fails, even when it runs, if any of these holds:

- The foundation blocks waiting for quota.
- The API key appears in a log line, an error string or a URL.
- Message content appears in a log line.
- A provider-specific type appears in a module's `app` or `domain` package.
- A test in `make check` reaches the network.

## Constraints

| ID | Constraint | Source |
|---|---|---|
| C1 | Infrastructure without business rules lives in `internal/platform/`. | ADR 002 |
| C2 | Standard library first; no SDK dependency. | CONTRIBUTING.md, user decision |
| C3 | No global mutable state; the cooldown table is an instance passed through constructors. | CONTRIBUTING.md |
| C4 | Gemini API rate limits apply per Google Cloud project and per model, in three dimensions (RPM, TPM, RPD); any of them returns HTTP 429 `RESOURCE_EXHAUSTED`. RPD resets at midnight Pacific time. | ai.google.dev/gemini-api/docs/rate-limits |
| C5 | On unpaid quota, Google uses submitted content and responses to improve its products, and human reviewers may read them. Paid quota excludes that use. | ai.google.dev/gemini-api/terms |
| C6 | Gemini 3 models attach an opaque `thoughtSignature` to response parts. A stateless client resends every part with its signature unchanged; when the model changes within a conversation, the previous model's signatures are still resent. | ai.google.dev/gemini-api/docs/thinking, section "Stateless mode" |
| C7 | Gemma models served by the Gemini API accept `systemInstruction` and `functionDeclarations` on `generateContent`. | ai.google.dev/gemma/docs/core/gemma_on_gemini_api |
| C8 | The application contacts only configured addresses. | N17 |
| C9 | Logs never contain credentials. | N16 |

## Decisions

### Packages

```
internal/platform/llm/            neutral types, Router, Client, cooldown table, tool executor, errors
internal/platform/llm/aistudio/   Gemini API adapter (generateContent over net/http)
internal/platform/llm/llmtest/    scripted Provider for tests in this package and in future modules
```

A future module declares its own port in `app` (for example `Categorizer`), and an adapter of that module implements the port with an `*llm.Client`. The module's `app` and `domain` packages never import `llm`.

### Neutral types

Names below are binding; field sets are the minimum.

- `Request`: `System string`, `Messages []Message`, `Tools []Tool`, `Schema json.RawMessage` (JSON Schema; nil means free text), `MaxOutputTokens int` (0 means provider default), `Temperature *float64`.
- `Message`: `Role` (`RoleUser`, `RoleModel`, `RoleTool`), `Parts []Part`.
- `Part`: exactly one of `Text string`, `ToolCall *ToolCall`, `ToolResult *ToolResult`; plus `Signature *Signature`.
- `ToolCall`: `ID`, `Name string`, `Args json.RawMessage`.
- `ToolResult`: `CallID`, `Name string`, `Content json.RawMessage`, `IsError bool`.
- `Signature`: `Provider string`, `Data []byte`. An adapter sends a signature only when `Provider` equals its own name and ignores the others (C6).
- `Tool`: `Name`, `Description string`, `Parameters json.RawMessage` (JSON Schema).
- `Response`: `Message Message` (role `RoleModel`), `FinishReason` (`FinishStop`, `FinishLength`, `FinishToolCalls`, `FinishBlocked`, `FinishOther`), `Usage{InputTokens, OutputTokens int}`, `Target Target`.
- `Target`: `Provider`, `Model string`.

### Provider port

```go
type Provider interface {
	Name() string
	Generate(ctx context.Context, model string, req Request) (Response, error)
}
```

An adapter classifies every failure into one of these errors, defined in `llm`:

| Error | Meaning | Router action |
|---|---|---|
| `*QuotaError` (matches `ErrQuota`), field `RetryAfter time.Duration` (0 when the provider gives none) | HTTP 429 | Cooldown the target, try the next one |
| `ErrTransient` (wrapped) | HTTP 500, 502, 503, 504, network error, adapter timeout | Cooldown the target, try the next one |
| `ErrInvalidRequest` (wrapped) | HTTP 400, 404; request rejected as malformed | Return to the caller, no rotation |
| `ErrUnauthorized` (wrapped) | HTTP 401, 403 | Return to the caller, no rotation |

A context cancellation or deadline from the caller is returned unchanged, without cooldown.

### Router and Client

- `llm.NewRouter(clk *clock.Clock, log *slog.Logger, providers ...Provider) *Router` holds the providers and one cooldown table keyed by `Target`. The table is guarded by a mutex; concurrent calls are allowed.
- `(*Router).Client(chain ...Target) *Client` returns the handle one use keeps. Chains are declared in code by the consuming module.
- `(*Client).Generate(ctx, req) (Response, error)` walks the chain in order:
  1. Skip a target whose provider is not registered, or whose cooldown ends after `clk.Now()`.
  2. Call the provider.
  3. On success, return the response with `Target` set.
  4. On `ErrQuota`: cooldown until `now + RetryAfter`, or `now + 60s` when `RetryAfter` is 0.
  5. On `ErrTransient`: cooldown until `now + 10s`.
  6. On any other error: return it, wrapped with the target.
- When no target answered:
  - If no target of the chain has a registered provider, return `ErrUnavailable`.
  - Otherwise return `*ExhaustedError` (matches `ErrExhausted`), field `RetryAt time.Time` = earliest cooldown end among the chain's targets.
- The cooldown key is `Target`, not (credential, target): one provider instance holds one key, and the Gemini API counts quota per project (C4).

### Tool executor

`llm.RunTools(ctx, client *Client, req Request, handlers map[string]ToolHandler, maxSteps int) (Response, []Message, error)`

- `ToolHandler` is `func(ctx context.Context, args json.RawMessage) (json.RawMessage, error)`.
- Each step calls `client.Generate`; rotation applies per step.
- For each `ToolCall` in the response, the executor runs the handler and appends a `RoleTool` message with one `ToolResult` per call, in call order.
- A handler error becomes a `ToolResult` with `IsError: true` and content `{"error": "<message>"}`, so the model can recover. A context error from the handler aborts the loop.
- An unknown tool name becomes a `ToolResult` with `IsError: true`.
- The loop ends when a response carries no tool call; it returns that response and the full message history, including the model messages with their signatures.
- After `maxSteps` model calls without a final response, it returns `ErrTooManySteps`.

### Structured output

When `Request.Schema` is set, the adapter requests JSON output with that schema. `Client.Generate` checks `json.Valid` on the concatenated text parts and returns `ErrMalformedOutput` (no rotation) when it fails. Validation against the schema is the caller's job: it unmarshals into its own type and checks the fields. Full JSON Schema validation would need a dependency (C2).

### AI Studio adapter

- Endpoint: `POST {baseURL}/v1beta/models/{model}:generateContent`.
- The key goes in the `x-goog-api-key` header, never in the query string: `*url.Error` strings include the URL (C9).
- `aistudio.New(baseURL, apiKey string, httpClient *http.Client) *Provider`; `Name()` returns `"aistudio"`.

Request mapping:

| Neutral | Gemini API |
|---|---|
| `System` | `systemInstruction.parts[].text` |
| `RoleUser`, `RoleTool` | `contents[].role = "user"` |
| `RoleModel` | `contents[].role = "model"` |
| `Part.Text` | `parts[].text` |
| `Part.ToolCall` | `parts[].functionCall{id, name, args}` |
| `Part.ToolResult` | `parts[].functionResponse{id, name, response}`; non-object content is wrapped as `{"result": ...}`; `IsError` content is sent as given |
| `Part.Signature` (provider `aistudio`) | `parts[].thoughtSignature` (base64) |
| `Tools` | `tools[0].functionDeclarations[]{name, description, parametersJsonSchema}` |
| `Schema` | `generationConfig.responseMimeType = "application/json"`, `generationConfig.responseJsonSchema` |
| `MaxOutputTokens`, `Temperature` | `generationConfig.maxOutputTokens`, `generationConfig.temperature` |

Response mapping:

- `candidates[0].content.parts[]` become `Parts`; parts with `thought: true` keep only their signature.
- `finishReason`: `STOP` → `FinishStop` (or `FinishToolCalls` when a `functionCall` part is present); `MAX_TOKENS` → `FinishLength`; `SAFETY`, `RECITATION`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `SPII` → `FinishBlocked`; others → `FinishOther`.
- No candidate with `promptFeedback.blockReason` set → `FinishBlocked`.
- `usageMetadata.promptTokenCount` → `InputTokens`; `candidatesTokenCount + thoughtsTokenCount` → `OutputTokens`.

Error mapping: HTTP status per the Provider port table. For 429, `RetryAfter` comes from the `google.rpc.RetryInfo` entry of `error.details[].retryDelay` (duration string such as `"37s"`) when present. The exact body shape is confirmed from a captured response before the parser is written; the 60-second default covers its absence.

### Configuration and wiring

| Variable | Default | Effect |
|---|---|---|
| `EQUORI_GEMINI_API_KEY` | empty | Empty: the `aistudio` provider is not registered; every other feature works. |
| `EQUORI_GEMINI_URL` | `https://generativelanguage.googleapis.com` | Base URL of the Gemini API, the only address the adapter contacts (C8). |

`config.Config` gains `GeminiAPIKey` and `GeminiURL`. `cmd/equori` builds the `Router` and passes it in `server.Config.LLM`. The startup log lists the registered provider names, never the key.

### Logging

One `slog` record per provider attempt, at `Info` for success and `Warn` for failure, with: provider, model, outcome (`ok`, `quota`, `transient`, `invalid`, `unauthorized`), duration, input and output tokens, cooldown end when set. No message content, no key.

### Tests

| Layer | Method |
|---|---|
| Router, cooldown, `ErrExhausted`, `ErrUnavailable`, executor | `llmtest.Provider` with scripted responses and errors; fixed `clock.Clock`; table-driven; no network, no sleep. |
| AI Studio adapter | `httptest.Server` serving captured Gemini API bodies: text answer, JSON answer, function call with `thoughtSignature`, 429 with `RetryInfo`, 400, 401, 503, blocked prompt. Assertions on the request body the server receives (mapping table above) and on the mapped `Response` or error. |
| Secret hygiene | A test asserts that the key appears in no log record and no error string across the 401 and 429 cases. |
| Live API | One test file behind the build tag `live`, run manually with `EQUORI_GEMINI_API_KEY` set; excluded from `make check`. |

### ADR 009

Records: the package layout, the target and chain model, reactive rotation with in-memory cooldown, the immediate `ErrExhausted`, `net/http` instead of the SDK, `generateContent` instead of the Interactions API, and C5 as a constraint every use evaluates before sending financial data.

## Left to the builder

- Names of unexported helpers and file split inside each package (one concept per file).
- The `llmtest.Provider` scripting API.
- The `http.Client` timeout for the adapter, within the caller's context deadline.
- Capturing the Gemini API bodies used as test fixtures, with the key and any personal data removed.
