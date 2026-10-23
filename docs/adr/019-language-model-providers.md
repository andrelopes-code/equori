# ADR 019: Language model providers configured by each user

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 009 (M2, M3, M6), ADR 014 (L6)
- Design: `docs/superpowers/specs/2026-10-23-language-model-providers-design.md`

## Context

ADR 009 reads one Gemini key from the environment, and every use names its chain of (provider, model) targets in code. Free quotas differ per provider and change often. Several providers expose the OpenAI chat completions API: Groq, OpenRouter, Mistral, and local servers such as Ollama and LM Studio. An instance is shared by a household, and each member's financial data reaches the provider that member's uses call.

## Decision

| ID | Rule |
|---|---|
| P1 | Module `assistant` owns `assistant_provider` and `assistant_chain_target`. Every row carries `user_id`. A provider's key is sealed under ADR 008 with associated data `assistant_provider|<user id>|<row id>`, and no response, log or problem detail carries it. |
| P2 | A provider is a preset with a name, a base URL and an optional key. Presets are fixed in code (`assistant/internal/domain/preset.go`): `gemini`, `groq`, `openrouter`, `mistral`, `ollama`, `lmstudio`, `custom`. Each states its API (`gemini` or `openai`), its default base URL, whether a key is required, its notice and its suggested models with their capabilities. Preset IDs follow `^[a-z0-9_]{2,40}$`. |
| P3 | A notice states what happens to submitted data: `trains` (the free tier uses it), `local` (it stays on the configured host) or `provider_terms`. The settings screen shows it on each provider and on each use that sends financial data to a `trains` provider. |
| P4 | Capabilities are `tools`, `structured_output` and `image_input`. A model a preset names takes the preset's capabilities; any other model takes those the owner asserts on its chain target. |
| P5 | A module declares each use as an `llm.Use` (ID, needs, whether it sends financial data, default targets as preset and model). `internal/server` passes every use to `assistant`, and the settings screen lists them. Uses today: `capture.suggest`, `assistant.chat`. |
| P6 | Resolution for a user: the user's chain for the use, in order; without one, for each default target, the user's providers of that preset in creation order, then the instance providers of that preset. A target whose capabilities miss a need is left out; a provider whose key does not open is left out and logged. Without a user in the context, only instance providers resolve. |
| P7 | `llm.NewRouter` takes a `Resolver`; `Router.Use(use)` resolves on every call. The cooldown key is (provider row ID, model), so one user's quota error never cools another user's provider. The instance provider keeps its adapter name (`aistudio`) as its ID and shares its cooldown with every user, as its quota is shared. |
| P8 | `internal/platform/llm/openai` speaks the chat completions API over `net/http`: the key travels as `Authorization: Bearer`, only when set; 429 is a quota error with `Retry-After` in seconds; 401 and 403 are unauthorized; 400, 404, 413 and 422 are invalid; 5xx and transport failures are transient. Failure bodies are discarded. Both adapters list models (`llm.ModelLister`). |
| P9 | A base URL is `http` or `https`, with a host and without credentials, query or fragment. Loopback and private hosts are accepted, because local models run there. Redirects are refused: a request goes only to the configured address. |
| P10 | None of the `assistant` operations is a tool for a language model (exclusion `-llm`, ADR 012 T14). |
| P11 | `equori secrets rotate` reseals provider keys in their own transaction, after the integration credentials (ADR 002 forbids a transaction across modules). |
| P12 | The router hands every attempt of a use client to the resolver when it implements `llm.Recorder`: use, target, outcome, tokens and cooldown end. Recording runs after the provider call, never fails it, and skips calls without a user and fixed-chain calls. |
| P13 | `assistant_usage` keeps one row per user, day, provider ID, model and use, with requests, errors, quota errors, tokens and the latest cooldown end. An attempt is one `INSERT … ON CONFLICT DO UPDATE`, without a read; the table grows by at most one row per combination per day. The day is the instance's: providers reset quotas on their own schedule. |
| P14 | Daily limits are the owner's declaration per provider and model (`assistant_usage_limit`); none ships in code. Deleting a provider deletes its usage and limits in the same transaction. The usage view sums today and the last 30 days, and flags a limit reached, 80 percent of a limit, and a model in cooldown. |

## Consequences

- `EQUORI_GEMINI_API_KEY` keeps working without configuration: it is the instance provider of every user.
- An explicit chain references only the user's own providers; the instance provider enters a chain only through the defaults.
- A user who enters a key on the settings screen consents to sending the data of the uses that resolve to that provider (ADR 014 consequence).
- A member may point a provider at any host the server reaches; failure bodies are not returned, so the response says only whether the host answered.

## Revisit criterion

A provider whose API is neither Gemini nor chat completions, or an administrator who must set providers for every user.
