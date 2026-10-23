# ADR 009: Language model calls

- Status: accepted, amended by ADR 019 (M2, M3, M6)
- Date: 2026-10-16

## Context

Classification, reporting, ingestion and a future conversational channel will call large language models. The first provider is the Gemini API of Google AI Studio, whose free quota is small and counted per project and per model in requests per minute, tokens per minute and requests per day; any exhausted limit returns HTTP 429 `RESOURCE_EXHAUSTED`. Spreading calls over several models raises the usable rate.

## Decision

| ID | Rule |
|---|---|
| M1 | Calls go through `internal/platform/llm`: provider-neutral messages, a `Provider` port, and a `Router`. A provider adapter lives in a subpackage (`llm/aistudio`). Module `app` and `domain` packages never import `llm`; a module declares its own port and implements it in an adapter with an `*llm.Client`. |
| M2 | A target is a (provider, model) pair; a chain is the ordered list of targets one use declares in code. `Router.Client(chain...)` returns that use's client. |
| M3 | Rotation is reactive. A quota error cools the target down for the provider's `retryDelay`, or 60 s without one; a transient error (5xx, transport failure) for 10 s. The cooldown table is in process memory, shared by every chain, and cleared by a restart. Invalid requests and rejected credentials go back to the caller without rotation. |
| M4 | When every target of a chain is cooling down, `Generate` returns `ErrExhausted` at once with the earliest retry instant; the caller decides whether to wait, defer the work or answer 503. A chain without a configured provider returns `ErrUnavailable`. |
| M5 | Tool calling has two layers: `Client.Generate` is one model step; `RunTools` runs the loop with Go handlers and a step limit. Opaque provider signatures (Gemini thought signatures) travel back unchanged inside the neutral messages. |
| M6 | The Gemini adapter uses `generateContent` over `net/http` (standard library, no SDK). The key is read from `EQUORI_GEMINI_API_KEY`, sent only in the `x-goog-api-key` header, and never logged (N16); requests go only to `EQUORI_GEMINI_URL` (N17). |
| M7 | Logs record provider, model, outcome, duration, token counts and cooldown end per attempt, never message content. |

## Consequences

- On unpaid quota, Google uses submitted content to improve its products and human reviewers may read it (Gemini API Additional Terms, "Unpaid Services"). The foundation does not filter content: each use decides what it sends, and a use that sends financial data documents that choice.
- A restart forgets cooldowns; the first calls after it may hit 429 once per exhausted target.
- Structured output is checked for JSON syntax only; schema validation is the caller's.

## Revisit criterion

More than one process serving the instance, which would need a shared cooldown table, or a provider whose quota signal is not an HTTP status.

## Amendment (ADR 019)

- M2: a use is declared as an `llm.Use` with default targets by preset; each user may replace its chain. `Router.Client(chain...)` remains for fixed chains over the instance providers.
- M3: the cooldown key is (provider row ID, model); the in-memory table is still shared by every chain.
- M6: the environment key is the instance provider; each user adds providers whose keys are sealed under ADR 008, and requests go only to each provider's configured URL.
