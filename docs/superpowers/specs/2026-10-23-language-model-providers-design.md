# Language model providers configured by each user

- Date: 2026-10-23
- Amends: ADR 009 (M2, M3, M6), ADR 014 (L6)
- New ADR: 019

## Intent

equori is self-hosted, mostly by one person, sometimes shared with a household. Each language model use (capture suggestions today, a conversational agent next) runs on free quotas, which differ per provider and change often. The owner chooses providers and models on the settings screen instead of environment variables, adds any service that speaks the OpenAI chat completions API, and sees, per provider, whether the free tier uses the submitted data.

## Goals

- G1. Two adapter kinds: the existing Gemini adapter (`aistudio`) and a new adapter for the OpenAI chat completions API (`openai`), which serves Groq, OpenRouter, Mistral, Ollama, LM Studio, vLLM and any compatible host.
- G2. Each user keeps a list of providers. A provider is a preset or a custom endpoint, with an optional key sealed under ADR 008.
- G3. A use is declared in code by the module that calls the model: a stable ID, required capabilities, whether it sends financial data, and a default chain. A new use appears on the settings screen without changes to the provider layer or the screen.
- G4. Each user may replace the chain of a use with an ordered list of (provider, model) targets. A use without a user chain resolves its default chain against the user's providers.
- G5. A privacy notice per provider: `trains` (the free tier uses submitted content), `local` (data stays on the configured host) or `provider_terms` (the owner reads the provider's terms).
- G6. Listing the models of a provider through its API, which also checks the key.
- G7. Defaults: the agent use (`assistant.chat`) starts on Gemini Flash; capture (`capture.suggest`) stays on Gemini Flash-Lite.

## Non-goals

- The conversational agent: chat screen, tool loop for a user, confirmation of writes. It is the next project and consumes the `assistant.chat` use.
- Paid-tier billing, token accounting per user, spending limits.
- Provider-native APIs other than Gemini and the OpenAI chat completions API.
- Instance-wide provider administration through the web interface.

## Anti-goals

- A key returned in any response, log or problem detail (N16).
- Financial data sent to a provider whose notice the owner has not been shown.
- A user's provider, key or cooldown affecting another user.

## Decisions

### Ownership and module

- D1. New module `assistant` owns the providers and the user chains (tables `assistant_provider`, `assistant_chain_target`). Every row carries `user_id` (ADR 003). The next project adds the conversation to the same module.
- D2. Providers belong to a user, not to the instance. A household member configures their own provider, so each person consents to sending their own data. The environment provider (`EQUORI_GEMINI_API_KEY`) stays: it appears to every user as a read-only provider with ID `aistudio`, preset `gemini` and notice `trains`. Existing instances keep working without configuration.

### Presets

- D3. A preset is a fixed record in code (`assistant/internal/domain/preset.go`): ID, adapter kind, default base URL, whether a key is required, notice and suggested models with their capabilities. Presets: `gemini`, `groq`, `openrouter`, `mistral`, `ollama`, `lmstudio`, `custom`. Preset IDs follow `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in the API, so a new preset needs no migration.
- D4. Initial suggested models, each checked by a live test before release:

| Preset | Base URL | Key | Notice | Models (capabilities) |
|---|---|---|---|---|
| gemini | `https://generativelanguage.googleapis.com` | required | trains | `gemini-3.5-flash` (tools, structured), `gemini-3.5-flash-lite` (tools, structured) |
| groq | `https://api.groq.com/openai/v1` | required | provider_terms | `openai/gpt-oss-120b` (tools, structured) |
| openrouter | `https://openrouter.ai/api/v1` | required | provider_terms | none: the free list changes; the owner picks from the API listing |
| mistral | `https://api.mistral.ai/v1` | required | provider_terms | `mistral-small-latest` (tools, structured) |
| ollama | `http://127.0.0.1:11434/v1` | optional | local | `qwen3:32b` (tools, structured) |
| lmstudio | `http://127.0.0.1:1234/v1` | optional | local | none |
| custom | none | optional | provider_terms | none |

- D5. Capabilities form a closed set: `tools`, `structured_output`, `image_input`. A model named by its preset takes the preset's capabilities. Any other model takes the capabilities the owner asserts on its chain target.

### Uses and chains

- D6. `llm.Use` is `{ID, Needs []Capability, SendsFinancialData bool, Default []DefaultTarget}`. A `DefaultTarget` names a preset and a model. Modules export their uses. `internal/server` collects them and passes the list to the router and to `assistant`.
- D7. Resolution for a user and a use:
  1. The user's chain rows for the use, in position order.
  2. Without rows: for each default target, every provider of the user with that preset, in creation order. The `aistudio` instance provider counts as a `gemini` provider and comes after the user's own.
  3. A target whose model lacks a needed capability is skipped. A provider whose key does not open (rotation without the key) is skipped and logged.
- D8. Saving a chain validates that every target belongs to the user and that each model has every capability the use needs. An empty list deletes the rows and restores the default.
- D9. A cooldown is keyed by (provider row ID, model). The instance provider keeps the fixed ID `aistudio`, so its cooldown is shared by every user, as its quota is.

### Router

- D10. `llm.NewRouter` takes a `Resolver` besides the instance providers. `Resolver.Resolve(ctx, use) ([]Binding, error)` returns the ordered targets of a use, each with a ready `Provider`. `Router.Use(use)` returns a client that resolves on every `Generate`; `Router.Client(chain...)` keeps serving fixed chains over the instance providers. M3 to M7 keep their behavior on the resolved list.
- D11. `assistant` implements `Resolver`. It reads the user from `auth.UserID(ctx)`; a call without a user resolves only the instance providers.

### Adapters

- D12. The `openai` adapter posts to `{base}/chat/completions` with `net/http`. The key goes in `Authorization: Bearer`, only when set. Mapping: system prompt as the first message; `model` role as `assistant` with `tool_calls`; tool results as role `tool` with `tool_call_id`; `Schema` as `response_format` of type `json_schema`; `MaxOutputTokens` as `max_tokens`.
- D13. Status mapping: 429 is `QuotaError` with the `Retry-After` header in seconds when present; 401 and 403 are `ErrUnauthorized`; 400, 404, 413 and 422 are `ErrInvalidRequest`; 5xx and transport failures are `ErrTransient`. Response bodies of failures are never logged or returned.
- D14. Both adapters implement `llm.ModelLister` (`Models(ctx) ([]string, error)`): `GET {base}/models` for `openai`, `GET {base}/v1beta/models` filtered to `generateContent` for `aistudio`.
- D15. A base URL must be `http` or `https` with a host and no query, user info or fragment. Requests go only to it (N17 per provider). Loopback and private addresses are accepted, because local models run there.

### API (tag `assistant`)

| Operation | Method and path |
|---|---|
| listPresets | `GET /api/assistant/presets` |
| listProviders | `GET /api/assistant/providers` |
| createProvider | `POST /api/assistant/providers` |
| updateProvider | `PATCH /api/assistant/providers/{id}` (name, base URL, key; a missing key keeps the stored one) |
| deleteProvider | `DELETE /api/assistant/providers/{id}` (also deletes its chain targets) |
| listProviderModels | `GET /api/assistant/providers/{id}/models` (calls the provider) |
| listUses | `GET /api/assistant/uses` (needs, financial-data flag, effective chain, whether it is the default) |
| setUseChain | `PUT /api/assistant/uses/{use}/chain` |

A provider response carries `has_key`, never the key.

Problem codes: `provider_not_found` (404), `use_not_found` (404), `key_required` (422), `capability_missing` (422), `secret_key_missing` (409, a key sent while `EQUORI_SECRET_KEY` is unset), `provider_unauthorized` (502), `provider_unavailable` (502, quota, transient or transport failure on the model listing).

None of these operations is exposed as a tool: they handle credentials and endpoints.

### Interface

- D16. The settings page gains an "Assistant" section with two parts. Providers: list with name, preset, notice badge and key state; add (preset first, then key), edit, delete, and "list models", which shows the result or the error. Uses: each use with its needs, a notice line when a target's provider has notice `trains` and the use sends financial data, and its chain, ordered and editable, with "restore default".
- D17. Texts live in `catalog.en.ts` and `catalog.pt-BR.ts`. The screen follows `web/CLAUDE.md`.

### Changes to existing code

- D18. `capture` declares `capture.suggest` (needs `structured_output`, sends financial data, default `gemini/gemini-3.5-flash-lite`) and calls `router.Client(use)`. ADR 014 L6 becomes "the chain of the `capture.suggest` use".
- D19. `equori secrets rotate` reseals `assistant_provider.sealed_key` in its own database transaction after the integration credentials (ADR 002 forbids a transaction across modules).
- D20. `server.Config` carries the instance providers (`LLMProviders`) instead of a router; `internal/server` builds the router. `apitest.LLM` keeps its signature, so existing capture tests keep their setup.

## Acceptance criteria

| ID | Criterion |
|---|---|
| A1 | A provider is created from each preset; the response has `has_key` and no key; the stored key is sealed with associated data of table, user and row. |
| A2 | A preset that requires a key rejects a request without one with `key_required`. |
| A3 | A key sent while `EQUORI_SECRET_KEY` is unset returns `secret_key_missing`; a keyless `ollama` provider is created. |
| A4 | User B cannot read, change, delete or list models of user A's provider (`provider_not_found`). |
| A5 | `listUses` returns `capture.suggest` and `assistant.chat` with their default chains resolved against the user's providers and the instance provider. |
| A6 | `setUseChain` with a model lacking a needed capability returns `capability_missing`; with an empty list it restores the default. |
| A7 | A capture preview with a user chain calls the user's provider; on a quota error it moves to the next target. |
| A8 | A quota error on user A's provider does not cool down user B's provider of the same preset and model. |
| A9 | The `openai` adapter maps a tool round trip, a schema request and every status of D13 (tested against `httptest`). |
| A10 | `listProviderModels` returns the model IDs; a 401 from the provider returns `provider_unauthorized`. |
| A11 | Deleting a provider removes its chain targets; the use falls back to its default. |
| A12 | `equori secrets rotate` reseals provider keys. |

## Region-dependent values

None. Presets are services, not regional values.

## Left to the builder

- Table layout beyond the columns named here, indexes and constraint names.
- The visual composition of the settings section within the Slotted guidelines.

## Amendment U: usage and limits (2026-10-23)

### Intent

The owner sees, per provider and model, how much was sent today and in the last 30 days, the daily limit the owner declared, and the models in cooldown with the instant they return.

### Decisions

- U1. `llm.Recorder` receives one `llm.Attempt` per provider call of a use client: use ID, target, outcome (`ok`, `quota`, `transient`, `invalid`, `unauthorized`, `error`, `canceled`), token usage and cooldown end. A `Resolver` that also implements `Recorder` receives them. Fixed-chain clients record nothing. A recording failure is logged and never fails the call.
- U2. `assistant_usage` holds one row per (user, day, provider ID, model, use) with counters: requests (every attempt sent), errors (every outcome but `ok`), quota errors, input tokens, output tokens, and the latest cooldown end. An attempt is one `INSERT … ON CONFLICT DO UPDATE` on the primary key: one statement, no read, and the table grows by at most one row per combination per day. A call without a user in the context is not recorded.
- U3. The day is the instance's (`clock.Today`). Providers reset quotas on their own schedule (Gemini at midnight Pacific time), so the daily figure approximates the provider's count; the screen says "today" without claiming the provider's window.
- U4. `assistant_usage_limit` holds the owner's declared limits per (user, provider ID, model): requests per day and tokens per day, each optional. No limit is shipped in code: free quotas change and the published numbers are third-party estimates.
- U5. Provider IDs in both tables are text: a provider row's UUID or an instance provider's name. Deleting a provider deletes its usage and limits in the same transaction. The instance provider shows only the user's own usage (ADR 003), though its quota is shared.
- U6. API: `GET /assistant/usage` (rows for every provider and model with usage in the last 30 days or a declared limit), `PUT /assistant/usage/limits` (`provider_id`, `model`, `requests_per_day`, `tokens_per_day`; both absent clear the limit). Neither is a tool (`-llm`).
- U7. The settings section gains a "Usage" group: per row, today's requests and tokens, the 30-day totals, the limit, a tag when today's figure reaches 80 percent of a limit or the model is cooling down, and an action that edits the limits.

### Acceptance

| ID | Criterion |
|---|---|
| U-A1 | Two calls through a use, one answered and one refused for quota, give one row with requests 2, errors 1, quota errors 1, the answered call's tokens and the cooldown end. |
| U-A2 | A call without a user records nothing; a fixed-chain call records nothing. |
| U-A3 | `GET /assistant/usage` returns today's and the 30-day figures, the declared limit and the cooldown end; another user's usage never appears. |
| U-A4 | `PUT /assistant/usage/limits` on another user's provider returns `provider_not_found`; on the instance provider it is accepted; negative values are refused. |
| U-A5 | Deleting a provider removes its usage and limits. |
