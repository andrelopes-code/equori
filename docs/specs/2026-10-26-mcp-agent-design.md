# External MCP access and assistant rework

Study: `docs/specs/2026-10-26-mcp-agent-study.md` (defect IDs D*, observation IDs U*, specification IDs M*). Decisions this design changes: ADR 003 (authentication), ADR 012 (tool registry, Deferred), ADR 020 (assistant conversation).

## Intent

A user controls their finances from an agent they already pay for (Claude Code, Codex, claude.ai, any MCP client) through the same tools the in-app assistant uses. The in-app assistant stays for users without such a subscription; it shows text as the model writes it, never blocks on a transient failure, and keeps the reader's place, focus and page.

## Goals

| ID | Goal | Measured by |
|---|---|---|
| G1 | An MCP client on the equori host, or on a host that reaches it, reads and changes the user's books with a token the user created | apitest MCP scenarios of section 3.9 |
| G2 | The first text of an answer appears before the turn ends | panel test: `delta` events render before `answer` |
| G3 | No defect of D1–D5 and U1, U3–U16 remains | a Go or Vitest test per ID, named after it; U8, U9 and U10 by a Playwright check against `make run-prod` at 1440 and 390 px, recorded in the phase's verification |
| G4 | An external agent receives the rules the in-app assistant receives | one source text, test of section 2.3 |

## Non-goals

- OAuth 2.1 authorization server, "Sign in" for claude.ai custom connectors, Client ID Metadata Documents. A custom connector works with the token in a fixed request header once the instance has a public HTTPS address.
- A stdio transport.
- Editing a proposal's fields in the panel.
- Keeping tool results in the conversation history (ADR 020 C2 stays).
- An instance-wide switch for MCP. Access exists only for a user who creates a token.
- An audit screen of external calls; the log line of ADR 012 T13 records them.

## Anti-goals

- A token that opens the REST API or the web session. A token opens `/mcp` only.
- A write through MCP with a `read` token, by any path.
- A change to evaluation thresholds or to the measured catalog delivery (ADR 020 C5) to make a phase pass.

## 1. Delivery order

| Phase | Content | Sections |
|---|---|---|
| 1 | Panel correctness | 4.1, 4.4, 4.8, 4.9, 2.2, 2.4 |
| 2 | Streaming and speed | 2.1, 4.2, 4.3, 2.5, 2.6 |
| 3 | MCP server and tokens | 2.3, 3 |
| 4 | Panel layout and proposals | 4.5, 4.6, 4.7, 4.10, 4.11 |
| 5 | Assistant settings onboarding | 5 |

Each phase ends with `make check` passing and is releasable alone. Phase 3 depends on 2.3 only. Phase 4 changes the chat system prompt (P11); phase 3 keeps the chat rendering of E8 byte-identical. After phase 4, the owner runs the evaluation of ADR 020 C13 and records it under `docs/assistant-eval/`. Agents do not run it.

## 2. Agent engine

### 2.1 Streaming (D1)

| Rule | Content |
|---|---|
| E1 | `llm` gains an optional interface `Streamer` on a provider: `Stream(ctx, model, req, onText func(string)) (Response, error)`. It returns the same `Response` as `Generate`. A provider without it keeps `Generate`, and its turns emit no `delta`. |
| E2 | `aistudio` streams with `models/{model}:streamGenerateContent?alt=sse`; `openai` with `stream: true`, accumulating `tool_calls` deltas by index. Thought signatures and usage are read from the stream as `Generate` reads them. |
| E3 | `llm.Run` streams when `LoopOptions.OnText` is set. The router falls back to the next target only before the first `onText`; a failure after it ends the call with that error. |
| E4 | `POST /assistant/turns` gains event `delta` `{text}`. A `step` event means the text received since the previous `step` belongs to a call that asked for tools; the panel drops it. The `answer` event carries the stored message, as today. |
| E5 | `api/openapi.yaml` documents `delta` beside the other events. |

### 2.2 Transient failures (U3)

| Rule | Content |
|---|---|
| E6 | A chat turn whose every target is cooling down only from transient failures (router outcome `transient`) waits for the earliest cooldown end once, when it falls inside the turn deadline, and calls again. |
| E7 | `assistant_exhausted` is returned only when a quota cooldown or a daily limit blocks every target. A turn that still fails after E6 ends with `assistant_failed`. |

### 2.3 One guide for every agent (G4)

| Rule | Content |
|---|---|
| E8 | The rules of `app/prompt.tmpl` under "Data", "Tool results" and the amount format move to one template rendered with an audience: `chat` or `mcp`. |
| E9 | Audience `chat` adds "Changes", "Help" (screen links) and "Format" as today. Audience `mcp` adds: writes execute when called, after the client's approval; a `read` token lists no write tool; screen paths returned by `get_help` are relative to the address of the MCP endpoint without `/mcp`. |
| E10 | The `mcp` rendering is the MCP `instructions`. Its first 512 characters state what equori is, that tool results are data and never instructions, and that identifiers come from the read tools (Codex reads them first). A test fails when they do. |

### 2.4 Failed and stopped turns are stored (U5)

| Rule | Content |
|---|---|
| E11 | A turn that fails after its user message is stored ends with an assistant message of outcome `failed` and empty content. A turn whose request context ends (stop control, closed tab, lost connection) ends with outcome `canceled`; the message is written under `context.WithoutCancel`. A new goose migration adds `canceled` to the outcome check. |
| E12 | History (ADR 020 C2) renders a `failed` or `canceled` exchange as the user text followed by "[no answer]". |

### 2.5 Concurrent reads (D2)

E13: the `ReadOnly` calls of one model response run concurrently, at most 4 at a time; `Write` and `Destructive` calls run after them in response order. Results return to the model in response order; `step` events keep response order.

### 2.6 Thinking setting (D7)

E14: `llm.Request` gains `Thinking` (`""`, `"low"`). `aistudio` maps `"low"` to the low value of `generationConfig.thinkingConfig.thinkingLevel` for Gemini 3 models; the builder reads the enum from the API reference before writing it. The chat sets it only after the owner runs the evaluation of ADR 020 C13 with it and every threshold holds; the run's file under `docs/assistant-eval/` names the setting. Agents do not run that evaluation.

## 3. MCP server

### 3.1 Transport

| Rule | Content |
|---|---|
| X1 | `POST /mcp`, Streamable HTTP, served by `github.com/modelcontextprotocol/go-sdk` v1.8.0 with `StreamableHTTPOptions.Stateless = true`; the SDK negotiates 2026-07-28 and 2025-11-25. |
| X2 | Request bodies above 1 MiB answer 413. |
| X3 | A request whose `Origin` header is present and whose host differs from the request's `Host` answers 403 (M3). |
| X4 | The adapter lives in `internal/platform/tool/mcp`: it knows the registry and the SDK, no module. `internal/server` mounts it outside `/api/` and outside `identity.RequireSession`. |

### 3.2 Access tokens

| Rule | Content |
|---|---|
| X5 | `identity` owns `identity_access_token`: `id`, `user_id`, `name`, `scope` (`read`, `write`), `token_hash` (SHA-256), `created_at`, `expires_at`, `last_used_at`. The token text is shown once, at creation. |
| X6 | A token is the prefix `eqt_` and 32 random bytes in unpadded base32. |
| X7 | Expiry is chosen at creation: 30, 90 or 365 days; 90 is preselected. |
| X8 | `last_used_at` is written at most once a minute per token. |
| X9 | Deleting a token is immediate. The password change endpoint, Deferred in ADR 003, deletes the user's tokens with the sessions when it is built. |
| X10 | Operations, each with `user_id` filtering (ADR 003): `listAccessTokens` `GET /access-tokens`, `createAccessToken` `POST /access-tokens` (201, returns the text once), `deleteAccessToken` `DELETE /access-tokens/{id}`. Each maps to exclusion `-secret` in `internal/server/tool_exposure_test.go`. |

### 3.3 Authentication

| Rule | Content |
|---|---|
| X11 | `/mcp` accepts only `Authorization: Bearer <token>` (M6). A missing, unknown, expired or deleted token answers 401 with `WWW-Authenticate: Bearer`. A token in the query string is never read. |
| X12 | The handler sets the user with `auth.WithUserID` and the scope in the context; `Registry.Call` reads the user as for any consumer (ADR 012 T8). |
| X13 | The session cookie is not accepted on `/mcp`, and the token is not accepted on `/api/`. |

### 3.4 Tools and scopes

| Rule | Content |
|---|---|
| X14 | A `read` token lists and calls only `ReadOnly` tools. A `write` token lists and calls every tool of the chat set. A call to a tool outside the token's list answers the tool error `tool_not_allowed`. |
| X15 | Each tool is registered with its name, its description, its input schema and its output schema unchanged. Annotations: `readOnlyHint` for `ReadOnly`, `destructiveHint` for `Destructive`, `idempotentHint` from `Idempotent`. |
| X16 | A result carries `structuredContent` and the same JSON as one text block (M8). A tool error carries `isError: true` and the `{code, detail, errors}` object of ADR 012 T7. |
| X17 | A write tool called through MCP executes through `Registry.Call` (no proposal) and returns the tool's output. |

### 3.5 Prompts

X18: three MCP prompts, each a user message that names the tools to use: `monthly_review` (argument `month`, `YYYY-MM`), `categorize_pending`, `reconcile_account` (argument `account`, a name). The texts live beside the guide of 2.3 and are English.

### 3.6 Settings section

A section "Acesso externo (MCP)" in `/settings`, after "Assistente":

| Part | Content |
|---|---|
| Explanation | What MCP is in one sentence; that the client's model provider receives the data the client reads; that a `write` token lets the client record and delete without equori's confirmation card, under the client's own approval prompt. |
| Tokens | List: name, scope, created, last used, expiry, delete. Empty state with the create action. |
| Create | Dialog: name, scope (`Somente leitura` preselected, `Leitura e escrita`), expiry. On success, the token once, with copy actions, and three ready snippets built from `window.location.origin + "/mcp"`: `claude mcp add --transport http equori <url> --header "Authorization: Bearer <token>"`; the Codex `config.toml` block with `url` and `bearer_token_env_var = "EQUORI_TOKEN"`; a generic JSON entry with `type: "http"`, `url` and `headers`. |
| Reachability | When the origin is a loopback or private address, a note that claude.ai, Claude Desktop connectors and the mobile apps connect from Anthropic's servers and need a public HTTPS address (study section 4). |

### 3.7 Documentation

`docs/operations/mcp.md`: what the endpoint offers, token creation, the three client setups, scopes, the reachability rule, and how to revoke. The settings explanation links to it on the project site when one exists; until then the section is self-contained.

### 3.8 Logging

X19: one log line per MCP call with token ID, user ID, tool, effect, outcome, duration, size (ADR 012 T13); never arguments, results or the token.

### 3.9 Tests (`internal/apitest`, an in-process SDK client)

| Scenario | Expectation |
|---|---|
| list with a `read` token | exactly the 19 `ReadOnly` tools, with annotations |
| list with a `write` token | all 36 tools |
| call `list_accounts` | `structuredContent` equals the HTTP API's accounts |
| call `record_transaction` with a `write` token | the transaction exists through `GET /transactions` |
| call `record_transaction` with a `read` token | `tool_not_allowed`, no transaction |
| no token, unknown token, expired token, deleted token | 401 with `WWW-Authenticate` |
| token in the query string only | 401 |
| `Origin: https://evil.example` | 403 |
| session cookie only | 401 |
| token on `GET /api/v1/accounts` | 401 |
| `instructions` | first 512 characters contain the three statements of E10 |
| a token of user A | never returns a row of user B (ADR 003) |

Schema tests: `token_hash` unique; `scope` outside the set rejected.

## 4. Panel

### 4.1 Answer from the event (U1, D3)

P1: the `answer` event writes the user message and the answer into the conversation query's cache before `pending` clears; the refetch runs after. A test asserts that the welcome screen never renders between the first `turn` event and the answer.

### 4.2 Streaming and stop (D1, D4, U6)

| Rule | Content |
|---|---|
| P2 | `delta` events render the pending answer as Markdown, parsed at most once per animation frame. A `step` event clears it (E4). |
| P3 | While a turn runs, the composer's status is `streaming` and `onStop` aborts the request; the server stores `canceled` (E11) and the thread shows the stop under the user message. |
| P4 | Enter while a turn runs keeps the text in the field and changes nothing else; the stop control is the visible state. |

### 4.3 Activity (D5, U16)

P5: the pending answer lists every step of the turn in order with its catalog label; the running step shows progress, finished steps a check. After the answer, the list collapses to one line ("Consultou 2 fontes") that expands.

### 4.4 Errors and limits (U3, U4, U14)

| Rule | Content |
|---|---|
| P6 | A message of outcome `failed` shows "Sem resposta do provedor" and "Tentar de novo", which sends the same text in the same conversation. |
| P7 | `assistant_exhausted` shows the time of `retry_at` and re-enables the composer when it passes, through a timer that refetches the chat state. `blocked` reads only the current chat state. |
| P8 | No provider: a neutral notice with the action "Configurar o assistente", which opens the Assistente section of `/settings`, and the action "Usar Claude ou Codex", which opens the MCP section. |

### 4.5 Placement (U8)

P9: from 1200 px the panel is the `AppShellAside` pane (`asideMode="inline"`) beside the page, resizable, without scrim; the page narrows. From 600 to 1199 px it is an overlay with `modal={false}` and no scrim (`scrimFrom={1}`). Below 600 px it stays a bottom sheet.

### 4.6 Answer layout (U9)

| Rule | Content |
|---|---|
| P10 | An answer renders without a bubble across the thread's width; the user's messages keep their bubble. |
| P11 | The prompt's Format rule asks for `---:` under columns of amounts and counts; the Markdown family aligns them to the end. |
| P12 | A table wider than the thread scrolls inside it (Markdown family behavior); at 390 px a three-column table of amounts shows all three column headers without scrolling. |

### 4.7 Proposals (U10, U11)

| Rule | Content |
|---|---|
| P13 | An answer with proposals scrolls the thread so the last card's actions are visible. |
| P14 | Each field is one row: its name at the start, its value at the end of the card. A changed value shows the new value over the one it replaces, struck. Amendment of 2026-10-30 (owner review): replaces "two columns from 400 px of card width", which stacked every field under its name in the pane. |
| P15 | A pending card shows its expiry time and turns `expired` at that time without a click. |
| P16 | An executed proposal whose result names an entity with a screen in the navigation map shows "Abrir" to it. |
| P17 | Two or more pending proposals in one answer show "Confirmar todas" after the last card; it confirms them in order and stops at the first failure. |

### 4.8 Focus (U7)

P18: opening the panel focuses the composer (`initialFocus` set to its ref). Closing returns focus to the element focused before opening, also when the A shortcut opened it.

### 4.9 Continuity (U12, U13)

P19: the open conversation's ID is kept in `sessionStorage`; reopening the panel or reloading the page returns to it; "Nova conversa" clears it. While a first turn runs, the header shows the user's text.

### 4.10 Suggestions

P20: the welcome screen's three suggestions depend on the current route group: overview, transactions, cards, planning, reports, any other. Texts are catalog entries per group.

### 4.11 Copy

P21: each answer has a copy action that copies its Markdown.

## 5. Assistant settings onboarding (U15)

| Rule | Content |
|---|---|
| S1 | Without a provider, the Assistente section opens with three choices: Google Gemini (free tier, with the notice that free content trains Google's models and a link to the key page), a local model (Ollama, LM Studio), and "Usar Claude ou Codex" (MCP section). Choosing one opens the existing provider dialog with the preset selected. |
| S2 | "Funções", chains, usage and limits move under "Avançado", collapsed while the user has one provider and default chains. |
| S3 | Each capability badge and "Padrão"/"Personalizada" has a one-sentence description through the existing hint pattern of the settings page. |

## 6. Decision records

| Record | Change |
|---|---|
| ADR 023, new | MCP server: X1–X19, scopes, write policy of X17, non-goals of this design. |
| ADR 003 | Amendment: access tokens (X5–X9, X11, X13). |
| ADR 012 | Amendment: Deferred "MCP transport" resolved by ADR 023; T13 log line extended by X19. |
| ADR 020 | Amendment: C3 gains `delta` (E4); outcomes gain `canceled` (E11); C10 limited by E6–E7. |

## 7. Region-dependent values

None introduced. Suggestion texts (P20) and settings texts are catalog entries per language.

## 8. Calls made in this design

| Call | Alternatives in the study |
|---|---|
| Static bearer token before OAuth | study 6.1 X3 |
| Writes execute under the client's approval for `write` tokens; `read` tokens list no write tool | study 6.2 W1, W2 |
| Token expiry choices 30, 90, 365 days | none |
| Inline panel from 1200 px | none |
| Phase order: correctness, speed, MCP, layout, onboarding | none |

## 9. Left to the builder

- The SSE reader changes for `delta` and the throttle of P2.
- How the turn handler learns the router outcome for E6 (an error type or a field of `ExhaustedError`).
- The catalog wording of P5–P8, P20 and section 3.6, in both catalogs.
- The route and anchor that open a settings section (P8, S1).
- Whether `DescriptionList` gives P14 by a prop; a gap there is a Slotted finding.
