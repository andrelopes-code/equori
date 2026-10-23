# Language model providers implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each user configures language model providers (Gemini or any OpenAI-compatible API) and the chain of each use on the settings screen.

**Architecture:** `internal/platform/llm` gains uses, capabilities and a `Resolver`; a new `openai` adapter sits beside `aistudio`. A new module `assistant` stores providers and chains per user, implements `Resolver`, and serves the settings API. `internal/server` builds the router from the instance providers and the `assistant` resolver.

**Tech Stack:** Go standard library, pgx/sqlc, oapi-codegen strict server, React + Slotted (`web/`).

**Spec:** `docs/superpowers/specs/2026-10-23-language-model-providers-design.md`

## Global Constraints

- Keys are never in responses, logs or problem details (N16); sealed with `platform/secret`, associated data = `assistant_provider`, user ID, row ID (ADR 008 K3).
- Every table has `user_id`; every query filters by it (ADR 003).
- Preset IDs and use IDs: `^[a-z0-9_.]{2,40}$` for uses, `^[a-z0-9_]{2,40}$` for presets, as `pattern` in `api/openapi.yaml` and `CHECK` in SQL.
- Capabilities are the closed set `tools`, `structured_output`, `image_input`.
- No new dependency.
- Tests: table-driven, real Postgres from `pgtest.New(t)`, HTTP tests through `internal/apitest`, each `Problem.code` triggered through the API.

## Review Focus

- A base URL with a trailing slash or a path suffix (`.../v1/`) must produce `.../v1/chat/completions`, not a double slash. Test in Task 2.
- A provider deleted while a chain references it must leave the use on its default, not on an empty chain. Test in Task 6 (A11).
- `PATCH` without `key` must keep the stored key; `PATCH` with `key: ""` on a preset that requires a key must fail with `key_required`. Test in Task 6.
- A `Retry-After` header in HTTP-date form or absent must yield `QuotaError{RetryAfter: 0}`, not a parse failure. Test in Task 2.
- A model listing that returns hundreds of IDs is returned sorted and deduplicated. Test in Task 2.

---

## Slice 1

### Task 1: Uses, capabilities and resolution in `llm`

**Files:**
- Create: `internal/platform/llm/use.go`
- Modify: `internal/platform/llm/router.go`, `internal/platform/llm/router_test.go`, `internal/platform/tool/llm_test.go`, `internal/platform/llm/tools_test.go` (constructor call sites)

**Interfaces:**
- Produces:
  - `type Capability string` with `CapTools = "tools"`, `CapStructuredOutput = "structured_output"`, `CapImageInput = "image_input"`; `func Capabilities() []Capability`.
  - `type DefaultTarget struct{ Preset, Model string }`
  - `type Use struct{ ID string; Needs []Capability; SendsFinancialData bool; Default []DefaultTarget }`
  - `type Binding struct{ Target Target; Provider Provider }`
  - `type Resolver interface{ Resolve(ctx context.Context, use Use) ([]Binding, error) }`
  - `type ModelLister interface{ Models(ctx context.Context) ([]string, error) }`
  - `func NewRouter(clk *clock.Clock, log *slog.Logger, res Resolver, providers ...Provider) *Router` (`res` may be nil)
  - `func (r *Router) Use(u Use) *Client`
  - `func (r *Router) Instance() []Provider` (sorted by name), replacing `Providers() []string`

- [ ] **Step 1: Write failing tests in `router_test.go`**
  - `TestClientUse`: a fake `Resolver` returning bindings `[{u1/m1, a}, {u2/m1, b}]`; `a` answers `QuotaError{RetryAfter: 30s}`; assert `resp.Target == {u2, m1}`, then a second `Generate` calls only `b` (cooldown keyed by `Target`, not by provider name).
  - `TestClientUseResolveError`: resolver error is returned wrapped; `errors.Is(err, sentinel)`.
  - `TestClientUseEmpty`: resolver returns no binding → `ErrUnavailable`.
  - `TestClientUseNilResolver`: `NewRouter(clk, log, nil, a).Use(u)` → `ErrUnavailable`.
- [ ] **Step 2:** `go test ./internal/platform/llm/` → FAIL (undefined `Use`).
- [ ] **Step 3: Implement.** `Client` holds either a fixed chain or a `*Use`; `Generate` first builds `[]Binding` (fixed chain: look up instance providers by `Target.Provider`; use: `r.res.Resolve`), then runs the existing loop over bindings. `earliestEnd` takes the bindings. Update every `NewRouter` call site with `nil` resolver; replace `Providers()` callers (`cmd/equori/main.go:83`) with names from `Instance()`.
- [ ] **Step 4:** `go test -race ./internal/platform/llm/... ./internal/platform/tool/...` → PASS.

### Task 2: OpenAI-compatible adapter and model listing

**Files:**
- Create: `internal/platform/llm/openai/openai.go`, `wire.go`, `errors.go`, `openai_test.go`, `live_test.go` (build tag `live`)
- Modify: `internal/platform/llm/aistudio/aistudio.go` (add `Models`), `aistudio_test.go`

**Interfaces:**
- Produces: `func openai.New(baseURL, apiKey string, client *http.Client) *Provider`; `Name() == "openai"`; implements `llm.Provider` and `llm.ModelLister`. `(*aistudio.Provider).Models(ctx) ([]string, error)`.

- [ ] **Step 1: Write failing tests in `openai_test.go`** against `httptest.Server`:
  - `TestGenerateText`: request body has `model`, `messages[0] == {role: system}`, `max_tokens`, `temperature`; header `Authorization: Bearer k`; response `choices[0].message.content = "ok"`, `finish_reason = "stop"`, `usage{prompt_tokens: 3, completion_tokens: 1}` → `Text() == "ok"`, `FinishStop`, `Usage{3, 1}`.
  - `TestGenerateNoKey`: `apiKey == ""` → no `Authorization` header.
  - `TestGenerateToolRoundTrip`: request with history `[user, model{ToolCall{ID:"c1", Name:"f", Args:{"x":1}}}, tool{ToolResult{CallID:"c1"}}]` encodes `assistant.tool_calls[0] = {id:"c1", type:"function", function:{name:"f", arguments:"{\"x\":1}"}}` and `{role:"tool", tool_call_id:"c1", content:...}`; response with `tool_calls` → `Part.ToolCall{ID, Name, Args}` and `FinishToolCalls`.
  - `TestGenerateSchema`: `Schema` set → `response_format == {type:"json_schema", json_schema:{name:"answer", schema: <schema>}}`.
  - `TestGenerateStatus` (table): 429 with `Retry-After: 7` → `QuotaError{7s}`; 429 with HTTP-date or no header → `QuotaError{0}`; 401, 403 → `ErrUnauthorized`; 400, 404, 413, 422 → `ErrInvalidRequest`; 500, 503 → `ErrTransient`; closed server → `ErrTransient`. Assert the error string does not contain the response body text `"secret-body"`.
  - `TestBaseURLSlash`: `New(srv.URL+"/v1/", ...)` posts to `/v1/chat/completions`.
  - `TestModels`: `GET /v1/models` returning `{"data":[{"id":"b"},{"id":"a"},{"id":"a"}]}` → `["a","b"]`; 401 → `ErrUnauthorized`.
  - `aistudio_test.go` `TestModels`: `GET /v1beta/models` returns two models, one without `generateContent` in `supportedGenerationMethods` → only the other, `models/` prefix stripped.
- [ ] **Step 2:** `go test ./internal/platform/llm/...` → FAIL.
- [ ] **Step 3: Implement** with `net/http` and `encoding/json`, mirroring `aistudio` structure (`wire.go` types, `errors.go` status mapping per spec D13). Role `model` → `assistant`; finish `content_filter` → `FinishBlocked`; other unknown → `FinishOther`. Response bodies of failures are read (limit 64 KiB) and discarded. `live_test.go` reads `EQUORI_OPENAI_LIVE_URL`, `EQUORI_OPENAI_LIVE_KEY`, `EQUORI_OPENAI_LIVE_MODEL` and skips when unset; it runs one text call, one schema call and one tool round trip.
- [ ] **Step 4:** `go test -race ./internal/platform/llm/...` → PASS.
- [ ] **Step 5: Checkpoint** `.claude/progress/current.md`.

## Slice 2

### Task 3: `assistant` domain

**Files:**
- Create: `internal/assistant/internal/domain/preset.go`, `provider.go`, `chain.go`, `errors.go`, and their `_test.go`

**Interfaces:**
- Produces:
  - `type Notice string` (`NoticeTrains = "trains"`, `NoticeLocal = "local"`, `NoticeProviderTerms = "provider_terms"`); `type API string` (`APIGemini = "gemini"`, `APIOpenAI = "openai"`).
  - `type PresetModel struct{ ID string; Capabilities []llm.Capability }` — `domain` may import only stdlib and `platform/money`, so capabilities are `[]string` here and converted in `app`.
  - `type Preset struct{ ID string; API API; BaseURL string; KeyRequired bool; Notice Notice; Models []PresetModel }`; `func Presets() []Preset` (spec D4 table, in that order); `func FindPreset(id string) (Preset, bool)`.
  - `type Provider struct{ ID uuid.UUID; UserID int64; Preset string; Name, BaseURL string; SealedKey []byte; CreatedAt time.Time }`
  - `func NewProvider(id uuid.UUID, userID int64, preset, name, baseURL string, hasKey bool, now time.Time) (Provider, error)` — name 1–60 runes; empty `baseURL` takes the preset's; URL rule of D15; `custom` requires a base URL; `KeyRequired && !hasKey` → `ErrKeyRequired`.
  - `func ValidateBaseURL(raw string) (string, error)` — returns the URL without trailing slash.
  - `type ChainTarget struct{ ProviderID uuid.UUID; Model string; Capabilities []string }`
  - `func ModelCapabilities(preset, model string, asserted []string) []string` — preset capabilities when the preset names the model, else `asserted`.
  - `func Missing(needs, have []string) []string`
  - Errors: `ErrKeyRequired`, `ErrCapabilityMissing`, `ErrProviderNotFound`, `ErrUseNotFound`, and `*InvalidError{Field, Reason}` as in `ingestion/internal/domain`.
- [ ] **Step 1: Failing tests:** `TestPresets` (every ID matches `^[a-z0-9_]{2,40}$`, IDs unique, `gemini` has `gemini-3.5-flash` and `gemini-3.5-flash-lite` with `tools` and `structured_output`); `TestNewProvider` (table: groq without key → `ErrKeyRequired`; ollama without key → ok with base URL `http://127.0.0.1:11434/v1`; custom without URL → invalid `base_url`; `ftp://x`, `http://u:p@h`, `http://h/?q=1`, `http://h/#f` → invalid `base_url`; `https://h/v1/` → `https://h/v1`; name of 61 runes → invalid `name`); `TestModelCapabilities`; `TestMissing`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `go test ./internal/assistant/...` → PASS.

### Task 4: Schema, queries and repository

**Files:**
- Create: `db/migrations/00052_assistant.sql`, `db/queries/assistant/provider.sql`, `db/queries/assistant/chain.sql`, `internal/assistant/internal/adapter/postgres/repository.go`, `repository_test.go`, `schema_test.go`
- Modify: `sqlc.yaml` (entry for `assistant`), `.golangci.yml` (deny `internal/assistant` in platform)

**Interfaces:**
- Tables: `assistant_provider(id uuid PK, user_id bigint NOT NULL REFERENCES identity_user, preset text NOT NULL CHECK (preset ~ '^[a-z0-9_]{2,40}$'), name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60), base_url text NOT NULL, sealed_key bytea, created_at timestamptz NOT NULL)`; `assistant_chain_target(user_id bigint NOT NULL REFERENCES identity_user, use_id text NOT NULL CHECK (use_id ~ '^[a-z0-9_.]{2,40}$'), position int NOT NULL CHECK (position >= 0), provider_id uuid NOT NULL REFERENCES assistant_provider ON DELETE CASCADE, model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200), capabilities text[] NOT NULL, PRIMARY KEY (user_id, use_id, position))`, plus a constraint that the provider's `user_id` equals the row's (composite FK `(provider_id, user_id)` → `assistant_provider(id, user_id)` with a unique index on it).
- Produces (port declared in Task 5, implemented here): `ListProviders(ctx, userID) ([]domain.Provider, error)`, `GetProvider(ctx, userID, id) (domain.Provider, error)` (`domain.ErrProviderNotFound`), `InsertProvider(ctx, p) error`, `UpdateProvider(ctx, p) error`, `DeleteProvider(ctx, userID, id) error`, `Chain(ctx, userID, useID) ([]domain.ChainTarget, error)`, `ReplaceChain(ctx, userID, useID string, targets []domain.ChainTarget) error` (one transaction), `ResealKeys(ctx, reseal func(userID int64, id uuid.UUID, sealed []byte) ([]byte, error)) (int, error)` (one transaction).
- [ ] **Step 1: Failing tests:** schema tests reject each `CHECK` with direct SQL and reject a chain target pointing at another user's provider; repository tests for every method, including user isolation and `ON DELETE CASCADE` of chain targets.
- [ ] **Step 2:** `make gen` then run → FAIL. **Step 3:** implement. **Step 4:** `go test -race ./internal/assistant/...` → PASS.

### Task 5: `assistant` app, resolver and module root

**Files:**
- Create: `internal/assistant/internal/app/service.go`, `ports.go`, `resolve.go`, `service_test.go`, `resolve_test.go`; `internal/assistant/assistant.go`
- Modify: `cmd/equori/secrets.go`

**Interfaces:**
- Consumes: Task 1 types, Task 2 constructors, Task 3 domain, Task 4 repository.
- Produces:
  - `type Config struct{ SecretKey, PreviousSecretKey string; Instance []llm.Provider; Uses []llm.Use; Clock clock.Clock; HTTPClient *http.Client }`
  - `func assistant.New(pool *pgxpool.Pool, cfg Config, log *slog.Logger) (*Module, error)`
  - `(*Module).Resolver() llm.Resolver`, `(*Module).RegisterRoutes(mux *http.ServeMux)`, `(*Module).RotateSecrets(ctx) (int, error)`
  - `assistant.ChatUse llm.Use` = `{ID: "assistant.chat", Needs: [tools], SendsFinancialData: true, Default: [{gemini, gemini-3.5-flash}, {groq, openai/gpt-oss-120b}, {mistral, mistral-small-latest}, {ollama, qwen3:32b}]}`
  - App service methods: `Presets()`, `Providers(ctx, userID)`, `CreateProvider(ctx, userID, in ProviderInput)`, `UpdateProvider(ctx, userID, id, in ProviderPatch)`, `DeleteProvider(ctx, userID, id)`, `ProviderModels(ctx, userID, id) ([]string, error)`, `Uses(ctx, userID) ([]UseView, error)`, `SetChain(ctx, userID, useID string, targets []domain.ChainTarget) error`, `Resolve(ctx, use) ([]llm.Binding, error)`.
  - `ProviderInput{Preset, Name, BaseURL string; Key string}`; `ProviderPatch{Name, BaseURL *string; Key *string}`.
  - `UseView{Use llm.Use; Default bool; Targets []TargetView}`; `TargetView{ProviderID string; ProviderName, Preset string; Notice domain.Notice; Model string; Capabilities []string}`. The instance provider appears with `ProviderID "aistudio"`, name `"aistudio"`, preset `gemini`.
  - Errors: `ErrSecretKeyMissing`; `*ProviderError{Unauthorized bool}` for model listing failures.
- [ ] **Step 1: Failing tests** (`pgtest.New(t)`, `llmtest` providers injected through a factory field `NewProvider func(api domain.API, baseURL, key string) llm.Provider` on the service):
  - `TestResolveDefault`: user with a `groq` provider, instance `aistudio`; use `assistant.chat` → bindings `[{aistudio, gemini-3.5-flash}, {<groq id>, openai/gpt-oss-120b}]` (default order first; within a preset, user providers by creation time, then the instance provider).
  - `TestResolveUserChain`: stored chain is returned in position order; a target whose model lacks a needed capability is skipped.
  - `TestResolveWithoutUser`: no user in context → instance bindings only.
  - `TestResolveUnreadableKey`: a sealed key under another secret key → provider skipped, no error.
  - `TestCreateProviderSecretKeyMissing`: key sent, no box → `ErrSecretKeyMissing`; keyless ollama → created.
  - `TestUpdateProviderKeepsKey`, `TestSetChainCapabilityMissing`, `TestSetChainEmptyRestoresDefault`, `TestRotateSecrets`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; `cmd/equori/secrets.go` calls `app.Assistant.RotateSecrets` after ingestion and prints both counts. **Step 4:** `go test -race ./internal/assistant/...` → PASS.
- [ ] **Step 5: Checkpoint.**

## Slice 3

### Task 6: HTTP API, server wiring and capture migration

**Files:**
- Modify: `api/openapi.yaml` (tag `assistant`, 8 operations of spec), `internal/server/server.go`, `internal/server/tool_exposure_test.go`, `internal/apitest/apitest.go`, `cmd/equori/main.go`, `internal/capture/capture.go`, `internal/capture/internal/adapter/llmapi/suggester.go`, `docs/adr/014-capture-category-suggestions.md` (L6)
- Create: `internal/assistant/internal/adapter/httpapi/{oapi-codegen.yaml,server.go,providers.go,uses.go}`, `internal/assistant/providers_test.go`, `internal/assistant/uses_test.go`

**Interfaces:**
- `server.Config.LLM *llm.Router` becomes `LLMProviders []llm.Provider`; `server.App` gains `Assistant *assistant.Module` and `LLM *llm.Router`.
- `capture.SuggestUse llm.Use` = `{ID: "capture.suggest", Needs: [structured_output], SendsFinancialData: true, Default: [{gemini, gemini-3.5-flash-lite}]}`; `capture.New(..., router *llm.Router, ...)` always builds the suggester; `llmapi.New(r)` uses `r.Use(capture.SuggestUse)` (the var lives in `llmapi` and is re-exported by the root).
- Server order: assistant module (with `Uses: []llm.Use{capture.SuggestUse, assistant.ChatUse}`) → `llm.NewRouter(clk, log, assistantModule.Resolver(), cfg.LLMProviders...)` → capture.
- Problems: `provider_not_found` 404, `use_not_found` 404, `key_required` 422, `capability_missing` 422 (detail names the model and missing capabilities), `secret_key_missing` 409, `provider_unauthorized` 502, `provider_unavailable` 502.
- [ ] **Step 1: Failing apitest tests** named by acceptance ID (A1–A8, A10, A11), including the Review Focus cases on `PATCH`. A7 and A8 inject providers through a test hook `apitest.LLMFactory(func(api, baseURL, key string) llm.Provider)` that the harness passes to `assistant.Config`.
- [ ] **Step 2:** `make gen`; run `go test ./internal/assistant/ ./internal/capture/` → FAIL.
- [ ] **Step 3: Implement** handlers with `auth.MustUserID(ctx)`; exposure entries with reason `"configures language model credentials"`; update existing capture tests only where `server.Config.LLM` was referenced.
- [ ] **Step 4:** `make test-race` → PASS; `make lint` → PASS.
- [ ] **Step 5: Checkpoint.**

## Slice 4

### Task 7: Settings section "Assistant"

**Files:**
- Create: `web/src/features/setup/settings-assistant.tsx`, `settings-assistant.test.tsx`, `web/src/features/setup/assistant-api.ts`
- Modify: `web/src/features/setup/settings-page.tsx`, `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts`, `web/src/testing/account-api.ts` (mock routes)

- [ ] **Step 1:** Read `web/CLAUDE.md`; invoke `compose-screen`.
- [ ] **Step 2: Failing tests:** providers list renders name, preset and notice badge, never a key; adding a `groq` provider without key shows the `key_required` field error; "list models" shows returned IDs and `provider_unauthorized` as an error message; a use whose chain includes a `trains` provider and `sends_financial_data: true` shows the notice; "restore default" sends `PUT` with `targets: []`.
- [ ] **Step 3:** implement per spec D16 and D17. **Step 4:** `make web-check` and the web tests → PASS.

### Task 8: Decision records

**Files:**
- Create: `docs/adr/019-language-model-providers.md`
- Modify: `docs/adr/009-language-model-calls.md` (M2, M3, M6 point to ADR 019), `CLAUDE.md` (layout list gains `assistant`)

- [ ] **Step 1:** write ADR 019 from spec decisions D1–D15 as rules `P1…`; amend ADR 009.
- [ ] **Step 2:** `make check` → PASS.
- [ ] **Step 3: Checkpoint.**
