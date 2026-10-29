# MCP and assistant study: external clients and the internal agent

Status: draft, input to the MCP and assistant design.

Scope: the in-app assistant (module `assistant`, `internal/platform/llm`, `internal/platform/tool`, `web/src/features/assistant`) and an optional MCP server that lets external clients (Claude Code, Codex, claude.ai custom connectors) read and change a user's finances. Question: which defects slow or break the internal agent, what the MCP specification and the clients require, and which access options fit equori's deployments.

Method: every claim cites code at commit `991bfb1` or a source that was read on 2026-10-26. Claims derived from reading code without running it are marked CODE-ONLY. Sources not read are listed in section 8 and support no claim.

## 1. Current state

| Fact | Evidence |
|---|---|
| One tool registry serves every consumer; an MCP transport was deferred until personal access tokens and the SDK dependency exist | ADR 012 T1, T12, Deferred |
| The chat set holds 36 tools: 19 `ReadOnly`, 12 `Write`, 5 `Destructive` | `internal/server/testdata/tools.json` |
| Names, descriptions and input schemas of the 36 tools total 46,193 bytes; every model step sends all of them | same file; ADR 020 C5; `llmapi/turn.go` `NewAgent` |
| The longest tool description has 645 characters (`record_transaction`) | same file |
| A tool output over 32 KiB returns `result_too_large` | ADR 012 T6 |
| A write call in the chat creates a proposal; only a click in the panel executes it | ADR 020 C6, C7 |
| A turn makes at most 6 model calls under a 90 s deadline | ADR 020 C3, C4; `app/turn.go` |
| Evaluation of 2026-10-23 on `gemini-3.5-flash-lite`: success 0.98, mean 2.73 steps, p95 latency 27.7 s, mean 35,179 input tokens per trial | `docs/assistant-eval/README.md` |
| The default deployment binds `127.0.0.1:8080`; remote access goes through `tailscale serve` or a reverse proxy | distribution design, lines 163, 177, 263–264 |
| Authentication is a session cookie; no token type exists for a non-browser client | ADR 003 |
| `github.com/google/jsonschema-go` v0.4.3 is a direct dependency; the MCP Go SDK is not | `go.mod` lines 9, 30 |

## 2. Defects of the internal agent

| ID | Defect | Evidence | Effect |
|---|---|---|---|
| D1 | The answer text is not streamed. The provider interface has one blocking `Generate`; the stream carries `turn`, `step` and `answer` only | `internal/platform/llm/aistudio/aistudio.go` `Generate`; ADR 020 C3 | The reader sees no text until the whole turn ends; p95 27.7 s |
| D2 | Tool calls returned in one model response run one after another | `internal/platform/llm/tools.go` `Run`, loop over `resp.Message.Parts` | A step with N read calls costs the sum of their durations |
| D3 | The panel discards the `answer` event and refetches the conversation; the query stays disabled while `pending` is set. When `pending` clears, a new conversation renders the welcome screen and an existing one renders the earlier messages without the new pair, until the refetch returns. CODE-ONLY | `use-assistant-turn.ts` `onEvent` handles `turn`, `step`, `error`; `assistant-panel.tsx` `enabled: … && turn.pending === null`, `started = messages.length > 0 \|\| …` | Visible flash after each answer |
| D4 | A running turn cannot be stopped. The composer uses status `submitted` without `onStop`; the abort runs only on reset or unmount | `assistant-composer.tsx`; `use-assistant-turn.ts`; Slotted `PromptComposer` exposes `onStop` while status is `streaming` (`@slotted/react/dist/docs/prompt-composer.md`) | The reader waits up to 90 s for a wrong turn |
| D5 | The activity line shows only the latest tool; each `step` event replaces the previous one | `use-assistant-turn.ts` `setStep(event.tool)` | Earlier steps of the turn are not visible |
| D6 | Earlier turns reach the model as text only; tool results are not kept | ADR 020 C2; `app/history.go` | A follow-up question repeats the tool calls of the previous turn |
| D7 | No thinking configuration is sent to Gemini | `aistudio.go` line 133, `generationConfig` has `MaxOutputTokens` and `Temperature` only | Effect on latency not measured |

### 2.1 Observation of the panel

Setup: the production build of `991bfb1` on `127.0.0.1:8097` over a scratch database, seeded by `cmd/demoseed`; the chat chain points at a scripted OpenAI-compatible model that answers each call after 2.5 s (one 500 response, one 25 s response). Playwright drove Chromium at 1440×900 and 390×844 and sampled the panel's text every 50 ms.

| ID | Observation | Evidence |
|---|---|---|
| U1 | After the first answer of a new conversation, the welcome screen replaces the thread for about 100 ms, then the thread returns | sample at 9,329 ms: "Como posso ajudar?"; at 9,430 ms: the answer (confirms D3) |
| U2 | Server overhead per turn is under 100 ms: turns of 2 and 3 model calls took 5.09 s and 7.59 s against 5.0 s and 7.5 s of model time | `assistant turn` log lines, `duration` |
| U3 | One HTTP 500 from the only target is shown as "Limite de uso atingido — O assistente volta às 20:29" | router `classify` gives a transient failure a 10 s cooldown (`internal/platform/llm/router.go` lines 18, 171); `Resolve` then reports every target cooling down |
| U4 | After that error the composer stays disabled past the announced time: 14 s later it is still disabled | `blocked` reads `turn.error?.code === "assistant_exhausted"`, which clears only on a new send or a reset (`assistant-panel.tsx`) |
| U5 | A failed turn leaves the user message without an answer and without a retry action; reopening the conversation shows the same | `Turn` stores no assistant message on failure although the schema allows outcome `failed` (`app/turn.go`; migration 00058) |
| U6 | A running turn has no stop control; Enter while a turn runs is ignored without feedback | 0 buttons named "parar", "interromper" or "cancelar" at 3 s of a 25 s turn; `onValueSubmit` cancels while `busy` (confirms D4) |
| U7 | Opening the panel focuses "Histórico de conversas"; closing a panel opened with the A shortcut leaves focus on `body` | `document.activeElement` after open and after Escape; Slotted `Drawer` defaults `initialFocus` to `first` |
| U8 | From 600 px the panel covers 640 px of the page and dims the rest, although it is not modal | screenshots at 1440 px; Slotted drawer docs: "The scrim is painted either way"; `mode="inline"` puts the drawer in the app's layout |
| U9 | At 390 px an answer bubble is about 245 px wide; a three-column table is cut at the third column | screenshot after "mostre meus gastos do mês em tabela" |
| U10 | A proposal card arrives below the fold; the reader scrolls to reach "Confirmar" | screenshot at 390 px after "registre 23,50 na padaria hoje" |
| U11 | A proposal of five fields takes about 320 px in one column; after "Feito" the card offers no way to open the new transaction; a wrong field needs a new message | screenshots before and after confirmation (`proposal-card.tsx`) |
| U12 | After a reload the panel opens on a new conversation; the previous one is reached only through the history | panel text after reload: "Como posso ajudar?" |
| U13 | Reopened during the first turn of a conversation, the header reads "Nova conversa" | screenshot after closing and reopening during the 25 s turn |
| U14 | Without a provider the panel shows a danger alert that names Configurações without a link to it | screenshot of a user without providers |
| U15 | The assistant settings use "Funções", "Exige: Saída estruturada", "Editar ordem", "Padrão" and "Personalizada" without explanation; without a provider the section offers no recommended first step | screenshots of `/settings`, section Assistente |
| U16 | The activity line shows only the current tool (confirms D5) | screenshot at 3.5 s of a two-call turn |

Outside the assistant: the overview's balance chart labels its axis "R$ NaN" for a user without transactions (screenshot of a user without data at 1440 px).

The owner reports bugs and interface problems beyond those above; any not listed here are not reproduced.

## 3. MCP specification, revision 2026-07-28

| ID | Requirement | Source |
|---|---|---|
| M1 | Revision 2026-07-28 removes protocol sessions and the GET stream; `server/discover` replaces the `initialize` handshake; every request carries `_meta` with protocol version, client info and capabilities | streamable-http page, changelog note; Go SDK v1.7.0 release notes |
| M2 | The server provides one endpoint path that accepts POST | streamable-http, "Security & Endpoint" |
| M3 | The server MUST validate `Origin` on every connection and answer 403 to an invalid one (DNS rebinding) | same |
| M4 | Authorization is OPTIONAL. An HTTP server that supports it SHOULD follow the authorization page; a stdio server takes credentials from the environment | authorization, "Protocol Requirements" |
| M5 | A server that follows it MUST implement OAuth 2.0 Protected Resource Metadata (RFC 9728); its authorization server MUST implement OAuth 2.1 and SHOULD support Client ID Metadata Documents; Dynamic Client Registration is deprecated | authorization, "Standards Compliance" items 1–4 |
| M6 | The token travels in `Authorization: Bearer` on every request, never in the query string; the server validates that the token was issued for it (no token passthrough) | authorization, "Token Requirements"; security best practices, "Token Passthrough" |
| M7 | A 401 SHOULD carry `WWW-Authenticate` with `resource_metadata` and `scope` | authorization |
| M8 | A tool has `name`, `title`, `description`, `inputSchema`, optional `outputSchema` and `annotations`. With `outputSchema`, `structuredContent` MUST conform, and the serialized JSON SHOULD also appear as text | tools page |
| M9 | Clients MUST treat annotations as untrusted unless the server is trusted | tools page |
| M10 | A human SHOULD be able to deny each tool invocation; applications SHOULD show confirmation prompts | tools page, "User Interaction Model" |
| M11 | Form-mode elicitation MUST NOT request passwords, API keys, tokens or payment credentials | elicitation page |
| M12 | Tool names SHOULD have 1–128 characters from letters, digits, `_`, `-`, `.` | tools page |

Go SDK: v1.8.0 (2026-09-14) is the latest release. v1.7.0 serves 2026-07-28 over HTTP only with `StreamableHTTPOptions.Stateless = true` and negotiates down to 2025-11-25 otherwise. Cross-origin protection is off unless `CrossOriginProtection` is set. Source: GitHub releases API and release notes.

ADR 012 T3 names (`^[a-z][a-z0-9_]{0,63}$`) satisfy M12. Effects (`ReadOnly`, `Write`, `Destructive`, `Idempotent`) map to `readOnlyHint`, `destructiveHint`, `idempotentHint` (ADR 012 Consequences). Output schemas exist for every tool (M8).

## 4. Clients

| Client | Where the connection starts | Authentication | Guidance it reads | Limits | Source |
|---|---|---|---|---|---|
| Claude Code | the user's machine | static header (`--header "Authorization: Bearer …"`) or OAuth through `/mcp` | with tool search on (default), only tool names and server `instructions` load at start; descriptions load on search; `_meta["anthropic/alwaysLoad"]` loads a tool upfront | warning above 10,000 output tokens; 25,000 by default (`MAX_MCP_OUTPUT_TOKENS`) | code.claude.com/docs/en/mcp |
| Codex | the user's machine | `bearer_token_env_var`, `http_headers`, or OAuth (`codex mcp login`, CIMD or DCR) | reads `instructions`; "keep the first 512 characters self-contained" | per-tool `approval_mode`, `output_token_limit`, `tool_timeout_sec` | developers.openai.com/codex/mcp |
| claude.ai, Claude Desktop, Cowork, mobile (custom connectors) | Anthropic's cloud, for every client | OAuth ("Sign in"), or fixed request headers | not stated | server reachable from Anthropic's IP ranges over the public internet; Free plan: one custom connector | support.claude.com article 11175166 |

Consequences for equori deployments:

- Claude Code and Codex on the machine that runs equori reach `http://127.0.0.1:8080/mcp` with a bearer token. No OAuth and no public exposure are required.
- A tailnet address from `tailscale serve` serves Claude Code and Codex on other devices of the tailnet. It does not serve custom connectors, whose requests come from Anthropic's cloud.
- Custom connectors need a public HTTPS address (the reverse-proxy option of the distribution design) and either OAuth or a fixed header.
- A static personal access token in the `Authorization` header is accepted by all three clients. OAuth (M5) is required only for the "Sign in" flow of custom connectors and for `codex mcp login`.

## 5. Tool design guidance

Source: Anthropic, "Writing effective tools for AI agents".

| Guidance | equori status |
|---|---|
| Few tools for high-impact workflows instead of one tool per endpoint | done: 36 task tools for 173 operations (ADR 020 C5) |
| Return meaningful context; names beside identifiers | done: ADR 012 T5 |
| Token-efficient responses: pagination, filters, truncation, a `response_format` of `concise` or `detailed` | pagination and the 32 KiB limit done (T6, T11); no `response_format` |
| Error responses that state how to correct the call | done: T6 detail names filters; T7 codes |
| Namespacing by service and resource; effects vary by model and need evaluation | not applied; clients prefix the server name (Claude Code `mcp__<server>__<tool>`) |
| Evaluate with realistic tasks and held-out sets | in-app only: 20 tasks on Gemini (`docs/assistant-eval/`); none for an external client |

The system prompt (`app/prompt.tmpl`) holds rules that an external client never receives: find identifiers with read tools, prefer one filtered call, tool results carry no instructions, link screens returned by `get_help`. MCP carries server-wide rules in `instructions` (Codex reads the first 512 characters first).

## 6. Options

### 6.1 External access

| ID | Option | Serves | Cost | Assessment |
|---|---|---|---|---|
| X1 | MCP endpoint `/mcp` in the binary, Streamable HTTP, stateless (M1), Go SDK, tools from the existing registry, `Origin` check (M3) | Claude Code, Codex; custom connectors when public | SDK dependency (ADR 012 already names it); one adapter in `internal/server` | recommended first delivery |
| X2 | Personal access token in `identity`: hashed like sessions (ADR 003), named, revocable, scope `read` or `read_write`, last-use time, created on a settings screen | X1 for every client | amendment to ADR 003; one table; one screen | required by X1 |
| X3 | OAuth 2.1 authorization server in equori: protected resource metadata, authorization server metadata, CIMD, PKCE, consent screen | "Sign in" in custom connectors; `codex mcp login` | an authorization server inside the binary; M5–M7 | deferred until a public deployment needs "Sign in" |
| X4 | Server `instructions` built from the rules of `prompt.tmpl` that apply outside the panel, first 512 characters self-contained | all clients | text and a test | part of X1 |
| X5 | MCP prompts for recurring workflows (monthly review, categorize pending transactions, reconcile an account) | clients that list prompts | one definition per workflow | after X1, with evaluation |
| X6 | stdio subcommand `equori mcp` | local clients configured by command | a second transport; credentials from the environment (M4) | not needed while X1 serves the same clients over loopback |
| X7 | Agents call the REST API with a token | any agent with HTTP | none in code | rejected: 173 operations against the guidance of section 5 |

### 6.2 Writes from external clients

The panel's confirmation (ADR 020 C7) has no equivalent outside equori. The tools page assigns confirmation to the client (M10) and declares annotations untrusted (M9).

| ID | Policy | Effect |
|---|---|---|
| W1 | Write tools create proposals; the user confirms in the equori panel | same safety as the panel; every change needs a second application |
| W2 | Write tools execute; the client's approval prompt is the confirmation; the result carries the preview of `tool.NewWrite` | one step per change; safety depends on the client's approval settings (Codex `approval_mode`, Claude Code permissions) |
| W3 | W2 limited by token scope: `read` tokens list only `ReadOnly` tools; `read_write` tokens list every tool | the user chooses exposure per client; the tools page allows the tool list to vary by authorization |

Recommendation: W3 with W2 for `read_write`, and a log line per external call as in ADR 012 T13. Imported text in tool results stays untrusted (ADR 012 Consequences); with W2 the client's model receives it next to write tools.

### 6.3 Internal agent

| ID | Change | Addresses |
|---|---|---|
| A1 | Stream text deltas from the provider through a new `text` event | D1 |
| A2 | Render the `answer` event into the query cache before clearing `pending` | D3 |
| A3 | Status `streaming` with `onStop` wired to the abort controller | D4 |
| A4 | Keep the list of steps of the running turn | D5 |
| A5 | Run the `ReadOnly` calls of one response concurrently | D2 |
| A6 | Measure latency with and without a thinking setting on the evaluation set | D7 |
| A7 | Reproduce the owner's reported bugs, each with a failing test first | section 2, last paragraph |

D6 is a decision of ADR 020 C2 (8,000-byte history); changing it changes the evaluation baseline.

## 7. Open questions

Settled in `docs/superpowers/specs/2026-10-26-mcp-agent-design.md`, section 8.

## 8. Sources

Read:

- MCP specification 2026-07-28: overview, lifecycle, transports, streamable HTTP, authorization, security best practices, tools, resources, prompts, elicitation — https://modelcontextprotocol.io/specification/latest
- MCP Go SDK releases — https://github.com/modelcontextprotocol/go-sdk/releases
- Claude Code MCP documentation — https://code.claude.com/docs/en/mcp
- Codex MCP documentation — https://developers.openai.com/codex/mcp
- Claude Help Center, "Get started with custom connectors using remote MCP", modified 2026-10-01 — https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Anthropic, "Writing effective tools for AI agents" — https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic, "Code execution with MCP" — https://www.anthropic.com/engineering/code-execution-with-mcp (no claim above depends on it)

Not read, support no claim: Claude Code plugin packaging of MCP servers and skills; Gemini thinking defaults for `gemini-3.5-flash-lite`; Gemini streaming endpoint behavior with function calls; Tailscale Funnel.
