# LLM Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `internal/platform/llm`: provider-neutral language model calls with chain rotation on quota exhaustion, tool calling, and a Gemini API adapter.

**Architecture:** `llm` holds neutral types, the `Provider` port, a `Router` with one in-memory cooldown table, per-use `Client` chains and the `RunTools` executor. `llm/aistudio` translates neutral requests to `generateContent` over `net/http`. `llm/llmtest` provides a scripted provider for tests here and in future modules.

**Tech Stack:** Go standard library only (`net/http`, `encoding/json`, `log/slog`, `sync`).

**Spec:** `docs/superpowers/specs/2026-10-16-llm-foundation-design.md`

## Global Constraints

- No new module dependency; `go.mod` is unchanged.
- The API key travels only in the `x-goog-api-key` header; it never appears in a URL, log record or error string (N16).
- No log record carries message content.
- Tests in `make check` never reach the network; the live test needs the `live` build tag.
- `context.Context` is the first parameter of every function doing I/O.
- Run the check as `COMPOSE_PROJECT_NAME=equori make check` inside this worktree; the default project name starts a second Postgres on port 54329 and fails.
- Commit messages: `feat(platform): ...`, `docs: ...`; no AI attribution.

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| L1 | The adapter drops response parts with `thought: true` instead of keeping their signature. | `generateContent` returns thought parts only when `includeThoughts` is set, and the adapter never sets it; signatures arrive on `functionCall` and text parts, which are kept. |
| L2 | Test fixtures for the adapter are built from the `generateContent` reference (ai.google.dev/api/generate-content, read 2026-10-16) and the Google API error model (`google.rpc.RetryInfo`), not captured. The live test confirms them against the API. | No API key is available while building. |
| L3 | `Part` kind: a part with `ToolCall` set is a call, with `ToolResult` set is a result, otherwise it is text (possibly empty, carrying only a signature). | Gemini may attach a signature to an empty final text part. |

## Review Focus

1. Two goroutines calling one `Client` while a target enters cooldown: no data race, and both observe the cooldown (`TestClientConcurrentCalls`, Task 1).
2. A caller context cancelled while the chain is walked: the error is the context error and no target is cooled down (`TestClientContextCancelled`, Task 1).
3. A JSON-schema request answered with `FinishLength` and a truncated body: `ErrMalformedOutput`, not a broken unmarshal at the caller (`TestClientMalformedOutput`, Task 2).
4. A model response with two function calls: both handlers run and one `RoleTool` message carries both results in call order (`TestRunToolsParallelCalls`, Task 2).
5. A 429 whose body has no `RetryInfo`, or a fractional `retryDelay` (`"0.5s"`): `RetryAfter` is 0 or 500ms, never a parse error (`TestGenerateErrors`, Task 4).

---

### Task 1: Neutral types, Router and rotation

**Files:**
- Create: `internal/platform/llm/message.go` (Role, Message, Part, ToolCall, ToolResult, Signature)
- Create: `internal/platform/llm/request.go` (Request, Tool, Response, FinishReason, Usage, Target)
- Create: `internal/platform/llm/provider.go` (Provider)
- Create: `internal/platform/llm/errors.go` (sentinels, QuotaError, ExhaustedError)
- Create: `internal/platform/llm/router.go` (Router, Client, cooldown)
- Create: `internal/platform/llm/llmtest/provider.go`
- Test: `internal/platform/llm/router_test.go`

**Interfaces:**
- Produces:
  - Types exactly as the spec section "Neutral types", plus `func (r Response) Text() string` (concatenated text parts) and `func (t Target) String() string` (`"provider/model"`).
  - `type Role string` with `RoleUser = "user"`, `RoleModel = "model"`, `RoleTool = "tool"`; `type FinishReason string` with `FinishStop = "stop"`, `FinishLength = "length"`, `FinishToolCalls = "tool_calls"`, `FinishBlocked = "blocked"`, `FinishOther = "other"`.
  - `type Provider interface { Name() string; Generate(ctx context.Context, model string, req Request) (Response, error) }`
  - Sentinels: `ErrQuota`, `ErrTransient`, `ErrInvalidRequest`, `ErrUnauthorized`, `ErrUnavailable`, `ErrExhausted`, `ErrMalformedOutput`, `ErrTooManySteps`.
  - `type QuotaError struct{ RetryAfter time.Duration }`, `Is(target error) bool` matches `ErrQuota`.
  - `type ExhaustedError struct{ RetryAt time.Time }`, `Is` matches `ErrExhausted`.
  - `func NewRouter(clk *clock.Clock, log *slog.Logger, providers ...Provider) *Router`
  - `func (r *Router) Providers() []string` (registered names, sorted)
  - `func (r *Router) Client(chain ...Target) *Client`
  - `func (c *Client) Generate(ctx context.Context, req Request) (Response, error)`
  - `llmtest.New(name string, steps ...llmtest.Step) *llmtest.Provider`; `type Step struct{ Model string; Response llm.Response; Err error }`. `Generate` pops the next step, fails the test-visible way (returns an error naming the unexpected model) when the model differs or no step is left. `func (p *Provider) Requests() []llmtest.Call` with `type Call struct{ Model string; Request llm.Request }`. Safe for concurrent use.

- [ ] **Step 1: Write the failing tests** in `router_test.go`, package `llm_test`, with `clock.New(time.UTC, func() time.Time { return now })` where `now := time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)` and the `now` variable advanced by the test where noted. Logs go to `slog.NewJSONHandler(&buf, nil)`.

`TestClientGenerate`, table-driven; each case lists provider steps, the chain, and the expected outcome:

| Case | Chain | Steps | Expected |
|---|---|---|---|
| first target answers | `a/m1`, `a/m2` | `m1` → text "ok" | `Response.Text() == "ok"`, `Target == {a, m1}`, one call |
| quota moves to next | `a/m1`, `a/m2` | `m1` → `&QuotaError{RetryAfter: 30*time.Second}`; `m2` → "ok" | `Target == {a, m2}` |
| transient moves to next | `a/m1`, `b/m1` | `a/m1` → `fmt.Errorf("x: %w", ErrTransient)`; `b/m1` → "ok" | `Target == {b, m1}` |
| invalid stops | `a/m1`, `a/m2` | `m1` → `fmt.Errorf("x: %w", ErrInvalidRequest)` | `errors.Is(err, ErrInvalidRequest)`, one call |
| unauthorized stops | `a/m1`, `a/m2` | `m1` → `fmt.Errorf("x: %w", ErrUnauthorized)` | `errors.Is(err, ErrUnauthorized)`, one call |
| unregistered provider skipped | `z/m1`, `a/m1` | `a/m1` → "ok" | `Target == {a, m1}` |
| no registered provider | `z/m1` | none | `errors.Is(err, ErrUnavailable)` |
| empty chain | none | none | `errors.Is(err, ErrUnavailable)` |
| all exhausted | `a/m1`, `a/m2` | `m1` → `&QuotaError{RetryAfter: 30s}`; `m2` → `&QuotaError{}` | `errors.As(err, &ex)`, `ex.RetryAt == now.Add(30*time.Second)` |

`TestClientCooldown`:
- Step `m1` → `&QuotaError{RetryAfter: 30s}`, `m2` → "ok"; second `Generate` at `now + 29s` calls only `m2` (scripted `m2` → "ok"); third at `now + 30s` calls `m1` again (scripted "ok"). Assert the model of each recorded call: `["m1","m2","m2","m1"]`.
- Transient cooldown: `m1` → `ErrTransient`; at `now + 9s` `m1` is skipped; at `now + 10s` it is called.
- Quota without `RetryAfter`: skipped at `now + 59s`, called at `now + 60s`.
- Cooldown is shared across clients: `router.Client(a/m1, a/m2)` puts `m1` in cooldown; `router.Client(a/m1, a/m3).Generate` calls `m3`.

`TestClientContextCancelled`: provider step `m1` returns `context.Canceled` with a cancelled ctx; `errors.Is(err, context.Canceled)`; a second `Generate` with a live ctx calls `m1` (no cooldown).

`TestClientConcurrentCalls`: 8 goroutines call `Generate` on one client over a chain `a/m1`, `a/m2`, with a provider whose `m1` always returns `&QuotaError{RetryAfter: time.Minute}` and `m2` returns "ok"; all succeed with `Target.Model == "m2"`. Uses a thread-safe ad hoc provider in the test file (llmtest steps are ordered). Run under `-race`.

`TestClientLogs`: after "quota moves to next", the buffer holds two JSON records: `{"msg":"llm call","provider":"a","model":"m1","outcome":"quota","cooldown_until":"2026-10-16T12:00:30Z"}` and `{"provider":"a","model":"m2","outcome":"ok","input_tokens":3,"output_tokens":5}` (subset match on these keys; scripted usage 3/5). Neither record contains the request text `"secret prompt"` used as the user message.

`TestRouterProviders`: `NewRouter(clk, log, llmtest.New("b"), llmtest.New("a")).Providers()` equals `["a","b"]`.

- [ ] **Step 2: Run to verify failure**

Run: `go test -race ./internal/platform/llm/...`
Expected: FAIL, build errors for undefined `llm.NewRouter`, `llmtest.New`.

- [ ] **Step 3: Implement the types, errors, `llmtest.Provider`, `NewRouter`, `Client` and `Generate`**

The cooldown table is `map[Target]time.Time` behind a `sync.Mutex` on `Router`. Cooldown constants: `quotaCooldown = 60 * time.Second`, `transientCooldown = 10 * time.Second`. Walk the chain per the spec section "Router and Client"; a provider error with `ctx.Err() != nil` returns `ctx.Err()` wrapped with the target and sets no cooldown. Other errors are wrapped `fmt.Errorf("generate with %s: %w", target, err)`. Log one record per provider attempt: `Info` on success, `Warn` on failure, message `"llm call"`, attributes `provider`, `model`, `outcome` (`ok`, `quota`, `transient`, `invalid`, `unauthorized`, `canceled`, `error`), `duration`, and `input_tokens`/`output_tokens` on success or `cooldown_until` when set.

- [ ] **Step 4: Run to verify pass**

Run: `go test -race ./internal/platform/llm/...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/llm
COMPOSE_PROJECT_NAME=equori git commit -m "feat(platform): route language model calls through rotating chains"
```

---

### Task 2: Structured output check and tool executor

**Files:**
- Modify: `internal/platform/llm/router.go` (JSON check in `Generate`)
- Create: `internal/platform/llm/tools.go`
- Test: `internal/platform/llm/router_test.go`, `internal/platform/llm/tools_test.go`

**Interfaces:**
- Consumes: Task 1 types, `Client.Generate`, `llmtest`.
- Produces:
  - `type ToolHandler func(ctx context.Context, args json.RawMessage) (json.RawMessage, error)`
  - `func RunTools(ctx context.Context, client *Client, req Request, handlers map[string]ToolHandler, maxSteps int) (Response, []Message, error)`

- [ ] **Step 1: Write the failing tests**

`TestClientMalformedOutput` (router_test.go), table-driven, all with `Request.Schema = json.RawMessage(`{"type":"object"}`)`:
- text `{"a":1}` → no error, `Text() == `{"a":1}``.
- text split over two parts `{"a":` and `1}` → no error.
- text `{"a":` with `FinishLength` → `errors.Is(err, ErrMalformedOutput)`; one provider call (no rotation).
- Without `Schema`, text `{"a":` → no error.

`TestRunTools` (tools_test.go), with `llmtest` steps:
- **final answer after one tool**: step 1 returns a `RoleModel` message with `ToolCall{ID: "c1", Name: "balance", Args: {"account":"x"}}` and `Signature{Provider: "a", Data: []byte{1}}`, `FinishToolCalls`; step 2 returns text "R$ 10". Handler `balance` returns `{"amount":"10.00"}`. Assert: final `Text() == "R$ 10"`; history has 4 messages: the user message, the model message with the call and its signature unchanged, a `RoleTool` message with `ToolResult{CallID: "c1", Name: "balance", Content: {"amount":"10.00"}}`, the final model message; the second recorded request carries the first three messages.
- **handler error**: handler returns `errors.New("account not found")` → the tool message has `IsError: true`, `Content` equal to `{"error":"account not found"}`; the loop continues.
- **unknown tool**: call to `"missing"` → `IsError: true`, `Content` equal to `{"error":"unknown tool missing"}`.
- **too many steps**: every step returns a tool call, `maxSteps = 3` → `errors.Is(err, ErrTooManySteps)` after exactly 3 provider calls.
- **handler context error**: handler returns `context.Canceled` → `errors.Is(err, context.Canceled)`, no further provider call.

`TestRunToolsParallelCalls`: one response with calls `c1` (`a`) and `c2` (`b`); both handlers run; one `RoleTool` message holds two results ordered `c1`, `c2`.

- [ ] **Step 2: Run to verify failure**

Run: `go test -race ./internal/platform/llm/ -run 'TestClientMalformedOutput|TestRunTools'`
Expected: FAIL, `RunTools` undefined and the malformed case returns no error.

- [ ] **Step 3: Implement** the `json.Valid(Response.Text())` check in `Generate` when `req.Schema != nil`, returning `fmt.Errorf("generate with %s: %w", target, ErrMalformedOutput)` without cooldown; and `RunTools` per the spec section "Tool executor". The error content is built with `json.Marshal(map[string]string{"error": msg})`.

- [ ] **Step 4: Run to verify pass**

Run: `go test -race ./internal/platform/llm/...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/llm
COMPOSE_PROJECT_NAME=equori git commit -m "feat(platform): run language model tool calls and check json output"
```

---

### Task 3: Gemini API adapter, request and response mapping

**Files:**
- Create: `internal/platform/llm/aistudio/aistudio.go` (Provider, New, Generate)
- Create: `internal/platform/llm/aistudio/wire.go` (unexported JSON types of `generateContent`)
- Create: `internal/platform/llm/aistudio/testdata/*.json` (L2 fixtures)
- Test: `internal/platform/llm/aistudio/aistudio_test.go`

**Interfaces:**
- Consumes: Task 1 types and errors.
- Produces: `func New(baseURL, apiKey string, client *http.Client) *Provider`; `(*Provider).Name() string` returns `"aistudio"`; `(*Provider).Generate(ctx context.Context, model string, req llm.Request) (llm.Response, error)`.

- [ ] **Step 1: Write the failing tests** against `httptest.NewServer`; the handler records method, path, `x-goog-api-key`, raw query and body, then serves a fixture.

`TestGenerateRequest`, table-driven over neutral requests; each case asserts the request body the server received, compared as decoded JSON (`map[string]any`) against the expected document:
- system + user text → `{"systemInstruction":{"parts":[{"text":"S"}]},"contents":[{"role":"user","parts":[{"text":"hi"}]}]}`; path `/v1beta/models/gemini-x:generateContent`; method POST; header `x-goog-api-key: k`; raw query empty.
- schema + limits (`MaxOutputTokens: 256`, `Temperature: 0.2`) → `generationConfig` equal to `{"responseMimeType":"application/json","responseJsonSchema":{"type":"object"},"maxOutputTokens":256,"temperature":0.2}`.
- tools → `"tools":[{"functionDeclarations":[{"name":"balance","description":"d","parametersJsonSchema":{"type":"object"}}]}]`.
- history with a model call carrying `Signature{Provider:"aistudio", Data:[]byte("sig")}`, a second part carrying `Signature{Provider:"other"}`, and a tool result → model part `{"functionCall":{"id":"c1","name":"balance","args":{"account":"x"}},"thoughtSignature":"c2ln"}`, the other-provider part has no `thoughtSignature`, tool message becomes role `"user"` with `{"functionResponse":{"id":"c1","name":"balance","response":{"amount":"10.00"}}}`.
- tool result with non-object content `"ok"` → `"response":{"result":"ok"}`.

`TestGenerateResponse`, table-driven over fixtures:
- `text.json` (`candidates[0].content.parts:[{"text":"Olá"}]`, `finishReason:"STOP"`, `usageMetadata:{promptTokenCount:7,candidatesTokenCount:2,thoughtsTokenCount:3}`) → `Text() == "Olá"`, `FinishStop`, `Usage{InputTokens: 7, OutputTokens: 5}`.
- `function_call.json` (part `{"functionCall":{"id":"c1","name":"balance","args":{"account":"x"}},"thoughtSignature":"c2ln"}`, `finishReason:"STOP"`) → one part with `ToolCall{ID:"c1", Name:"balance", Args: {"account":"x"}}`, `Signature{Provider:"aistudio", Data: []byte("sig")}`, `FinishToolCalls`.
- `thought_part.json` (parts `[{"thought":true,"text":"t"},{"text":"a"}]`) → one part, text "a" (L1).
- `max_tokens.json` → `FinishLength`; `safety.json` (`finishReason:"SAFETY"`) → `FinishBlocked`.
- `prompt_blocked.json` (`{"promptFeedback":{"blockReason":"SAFETY"}}`, no candidates) → `FinishBlocked`, no parts, no error.
- `empty.json` (`{}`) → `FinishOther`, no parts, no error.

- [ ] **Step 2: Run to verify failure**

Run: `go test -race ./internal/platform/llm/aistudio/`
Expected: FAIL, `aistudio.New` undefined.

- [ ] **Step 3: Implement** the wire types and the mapping tables of the spec section "AI Studio adapter". `thoughtSignature` is standard base64 (`[]byte` fields marshal that way). Non-2xx responses return `fmt.Errorf("aistudio %s: status %d: %w", model, code, llm.ErrInvalidRequest)` for now; Task 4 refines the classification.

- [ ] **Step 4: Run to verify pass**

Run: `go test -race ./internal/platform/llm/aistudio/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/llm/aistudio
COMPOSE_PROJECT_NAME=equori git commit -m "feat(platform): call the gemini api generateContent method"
```

---

### Task 4: Gemini API error classification and key hygiene

**Files:**
- Modify: `internal/platform/llm/aistudio/aistudio.go`
- Create: `internal/platform/llm/aistudio/errors.go` (status mapping, `RetryInfo` parsing)
- Create: `internal/platform/llm/aistudio/testdata/error_*.json`
- Test: `internal/platform/llm/aistudio/errors_test.go`

**Interfaces:**
- Consumes: Task 3 `Provider`; Task 1 errors.
- Produces: error classification per the spec table "Provider port".

- [ ] **Step 1: Write the failing tests**

`TestGenerateErrors`, table-driven (status, fixture → assertion):
- 429 `error_quota.json` (`{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"quota","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure"},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}`) → `errors.As(err, &q)` with `q.RetryAfter == 37*time.Second`.
- 429 with `retryDelay: "0.5s"` → `500*time.Millisecond`.
- 429 without `RetryInfo` → `RetryAfter == 0`.
- 429 with a non-JSON body → `RetryAfter == 0`, still `ErrQuota`.
- 400, 404 → `ErrInvalidRequest`, and the error string contains the Google `message` field.
- 401, 403 → `ErrUnauthorized`.
- 500, 502, 503, 504 → `ErrTransient`.
- server closed before the call (`srv.Close()`) → `ErrTransient`.
- a handler that blocks until the request context ends, with an `http.Client{Timeout: 50*time.Millisecond}` → `ErrTransient`.
- caller context cancelled before the call → `errors.Is(err, context.Canceled)`.

`TestKeyNeverExposed`: with key `"AIzaTESTKEY"`, run the 401, 429 and closed-server cases with a `slog` JSON buffer passed to an `llm.Router` over a chain containing only this provider; assert `strings.Contains` is false for the key in every error string and in the log buffer.

- [ ] **Step 2: Run to verify failure**

Run: `go test -race ./internal/platform/llm/aistudio/ -run 'TestGenerateErrors|TestKeyNeverExposed'`
Expected: FAIL, 429 not classified as `ErrQuota`.

- [ ] **Step 3: Implement** the classification. `retryDelay` is parsed with `time.ParseDuration`; a parse failure yields 0. Transport errors without a caller context error wrap `llm.ErrTransient`. The error body is read with `io.LimitReader(resp.Body, 64<<10)`.

- [ ] **Step 4: Run to verify pass**

Run: `go test -race ./internal/platform/llm/...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/llm/aistudio
COMPOSE_PROJECT_NAME=equori git commit -m "feat(platform): classify gemini api failures for rotation"
```

---

### Task 5: Configuration, wiring, live test and ADR 009

**Files:**
- Modify: `internal/platform/config/config.go`, `internal/platform/config/config_test.go`
- Modify: `internal/server/server.go` (`Config.LLM *llm.Router`)
- Modify: `cmd/equori/main.go` (`serve`, `serverConfig`)
- Create: `internal/platform/llm/aistudio/live_test.go` (`//go:build live`)
- Create: `docs/adr/009-language-model-calls.md`
- Modify: `CLAUDE.md` (layout line for `internal/platform/llm`)

**Interfaces:**
- Consumes: `llm.NewRouter`, `(*Router).Providers`, `aistudio.New`.
- Produces: `config.Config.GeminiAPIKey string`, `config.Config.GeminiURL string`; `server.Config.LLM *llm.Router`.

- [ ] **Step 1: Write the failing test** in `config_test.go`: the "defaults" case expects `GeminiURL: "https://generativelanguage.googleapis.com"` and empty `GeminiAPIKey`; the "explicit values" case sets `EQUORI_GEMINI_API_KEY=k`, `EQUORI_GEMINI_URL=http://127.0.0.1:9200` and expects both fields.

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/platform/config/`
Expected: FAIL on the missing fields.

- [ ] **Step 3: Implement** the config fields (comment: base URL is the only address Gemini requests go to, N17). In `serve`, build the providers (`aistudio.New(cfg.GeminiURL, cfg.GeminiAPIKey, &http.Client{Timeout: 2 * time.Minute})` only when the key is set), `llm.NewRouter(&clk, log, providers...)`, log `"llm providers"` with `providers` = `router.Providers()`, and pass the router through `serverConfig` to `server.Config.LLM`. Write `live_test.go`: `TestLive` reads `EQUORI_GEMINI_API_KEY` (fatal when empty) and `EQUORI_GEMINI_LIVE_MODEL` (default `gemini-3.5-flash-lite`), runs one text request, one JSON-schema request and one `RunTools` round trip with a `today` tool, and asserts non-empty text, valid JSON and a final answer after one tool call. Write ADR 009 with the content listed in the spec section "ADR 009". Add one bullet to the CLAUDE.md "Code" section: "Language model calls go through `internal/platform/llm` (ADR 009); each module declares its chain in code."

- [ ] **Step 4: Verify**

Run: `go test ./internal/platform/config/ && go vet -tags live ./internal/platform/llm/aistudio/ && COMPOSE_PROJECT_NAME=equori make check`
Expected: PASS; `make check` exit 0.

- [ ] **Step 5: Commit**

```bash
git add internal/platform/config internal/server/server.go cmd/equori/main.go internal/platform/llm/aistudio/live_test.go docs/adr/009-language-model-calls.md CLAUDE.md
COMPOSE_PROJECT_NAME=equori git commit -m "feat(platform): configure the gemini provider and record adr 009"
```
