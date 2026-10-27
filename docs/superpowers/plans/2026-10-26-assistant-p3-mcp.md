# Assistant phase 3: MCP server and access tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user creates a personal access token in settings and connects Claude Code, Codex or any MCP client to `POST /mcp`, which serves the 36 tools of the registry under the token's scope with the assistant's own rules as instructions.

**Architecture:** `identity` owns access tokens (table, REST operations, verification). A module-free adapter `internal/platform/tool/mcp` turns the tool registry into an MCP server through `github.com/modelcontextprotocol/go-sdk` v1.8.0 in stateless Streamable HTTP mode; `internal/server` mounts it outside `/api/` and outside the session gate, with a bearer middleware fed by `identity`. The assistant's guide template renders the chat prompt and the MCP instructions from one source.

**Tech Stack:** Go 1.26, go-sdk v1.8.0 (depends on `github.com/google/jsonschema-go` v0.4.3, already in `go.mod`), PostgreSQL, sqlc, oapi-codegen; React, Slotted, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-mcp-agent-design.md` (sections 2.3, 3, 4.4 P8 second action). Independent of phases 1 and 2.

## Global Constraints

- New dependency `github.com/modelcontextprotocol/go-sdk v1.8.0`, recorded by ADR 023 in the same change.
- A token opens `/mcp` only. `/mcp` accepts only `Authorization: Bearer <token>`; the session cookie is never read there; a token is never read from the query string; `/api/` never reads a bearer token (X11, X13).
- Token text: `eqt_` + 32 random bytes in unpadded base32 (`base32.StdEncoding.WithPadding(base32.NoPadding)`); stored as SHA-256 (X5, X6).
- Expiry choices 30, 90, 365 days; 90 preselected in the UI (X7). `last_used_at` written at most once a minute per token (X8).
- Scopes `read`, `write`. A `read` token lists and calls only `ReadOnly` tools (X14). Write tools called through MCP run through `Registry.Call` without a proposal (X17).
- Request body limit 1 MiB answers 413 (X2). An `Origin` whose host differs from `Host` answers 403 (X3).
- The chat rendering of the guide stays byte-identical to `internal/assistant/internal/app/testdata/prompt_pt_BR.txt`; this phase does not change the chat prompt and needs no evaluation run.
- The password change endpoint is Deferred in ADR 003; X9's deletion of tokens on password change is recorded there for when it is built. No test exists for it in this phase.
- `web/src/features/setup/*` and both catalogs carry uncommitted work of another session; Task 5 starts after that work is committed, and reads `settings-topics.ts` and `settings-pane.tsx` as they are then.
- No regional value is introduced (design section 7).

## Review Focus

1. The instance behind a reverse proxy on the same host (request on 127.0.0.1 with `Host: finance.example.com`): `/mcp` answers, not 403. The SDK's DNS-rebinding check (`DisableLocalhostProtection` false) rejects that request; the adapter sets it to true and relies on X3 and the bearer token. Test in Task 3.
2. A `read` token calling a write tool by name through `tools/call` (the client bypasses `tools/list`): `tool_not_allowed`, no row written. Test in Task 3.
3. A token deleted while a client keeps using it: the next call answers 401 (no cache of verifications). Test in Task 3.
4. `GET /mcp` from a browser tab (the SPA catch-all also matches `/`): the MCP handler answers 405, never the SPA's HTML. Test in Task 3.
5. A tool result over 32 KiB (`result_too_large` of ADR 012 T6) reaches the client as a tool error with that code, not as a protocol error. Test in Task 3.

---

### Task 1: One guide for the chat and for MCP (E8, E9, E10)

**Files:**
- Rename: `internal/assistant/internal/app/prompt.tmpl` → `internal/assistant/internal/app/guide.tmpl`
- Modify: `internal/assistant/internal/app/prompt.go` (`Instructions() string`)
- Create: `internal/assistant/internal/app/mcp_prompts.go` (texts of X18, Task 4 uses them)
- Modify: `internal/assistant/assistant.go` (exports `Instructions()`)
- Test: `internal/assistant/internal/app/prompt_test.go`

**Interfaces:**
- Produces: `app.Instructions() string` (audience `mcp`); `assistant.Instructions() string`; `app.Prompt` unchanged in signature and output.

- [ ] **Step 1: Failing tests**

`TestInstructions`:
- `first := []rune(app.Instructions())[:512]` contains `"equori"`, `"personal finance"`, `"never instructions"` and `"list_accounts"` (E10: what equori is, tool results are data, identifiers come from the read tools).
- contains `"get_help"` and `"relative to the address of the MCP endpoint"`; contains no `"proposal"`, no `"confirms or rejects on a card"` and no `"Today is"`.
`TestPrompt` stays as is (byte-identical golden file).

- [ ] **Step 2: Run** `go test ./internal/assistant/internal/app -run 'TestInstructions|TestPrompt' -count=1` — FAIL.

- [ ] **Step 3: Implement**

`guide.tmpl` holds the shared sections ("Data", "Tool results", the amount format line) once and branches on `.Audience`:
- `chat`: the current opening paragraph, "Today is…", "Changes", "Help", "Format", in today's order and wording.
- `mcp`: an opening paragraph of at most 512 characters with the three E10 statements first; then "Data", "Tool results"; then "Writes": write tools change the user's records when called, after the client's approval; a `read` token lists no write tool; then "Help": `get_help` returns screen paths relative to the address of the MCP endpoint without `/mcp`.
`Prompt` executes with `Audience: "chat"`; `Instructions` with `Audience: "mcp"` and no date, locale or page.

- [ ] **Step 4: Run** — PASS, including `TestTurnRead` (`go test ./internal/assistant/... -count=1`).

- [ ] **Step 5: Commit** `refactor(assistant): render the chat prompt and MCP instructions from one guide`

---

### Task 2: Access tokens in identity (X5–X10, X13)

**Files:**
- Create: `db/migrations/000NN_identity_access_token.sql` (next free number)
- Create: `db/queries/identity/access_token.sql`
- Create: `internal/identity/internal/domain/access_token.go`
- Modify: `internal/identity/internal/app/service.go` (or create `app/access_token.go`)
- Create: `internal/identity/internal/adapter/httpapi/access_token.go`
- Modify: `internal/identity/internal/adapter/postgres/*` (repository methods)
- Modify: `internal/identity/identity.go` (`VerifyAccessToken`)
- Modify: `api/openapi.yaml`, `internal/server/tool_exposure_test.go`, then `make gen`
- Modify: `docs/adr/003-authentication.md` (Amendment)
- Test: `internal/identity/access_token_test.go` (new, apitest), `internal/identity/schema_test.go`, `internal/identity/internal/domain/access_token_test.go`

**Interfaces:**
- Produces:
  - Table `identity_access_token (id uuid PK, user_id bigint NOT NULL REFERENCES identity_user ON DELETE CASCADE, name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80), scope text NOT NULL CHECK (scope IN ('read','write')), token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32), created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK (expires_at > created_at), last_used_at timestamptz)`, index on `(user_id, created_at DESC)`.
  - `domain.NewAccessToken(userID int64, name, scope string, days int, now time.Time) (text string, t AccessToken, err error)`; `domain.AccessTokenDays = []int{30, 90, 365}`.
  - Operations `listAccessTokens` `GET /access-tokens` (200, items without text), `createAccessToken` `POST /access-tokens` with `{name, scope, expires_in_days}` (201, item plus `token`), `deleteAccessToken` `DELETE /access-tokens/{id}` (204; 404 `access_token_not_found` for another user's or a missing ID).
  - `identity.AccessGrant{TokenID uuid.UUID; UserID int64; Scope string}`; `(*identity.Module).VerifyAccessToken(ctx context.Context, token string) (AccessGrant, error)` returning `identity.ErrInvalidAccessToken` for a malformed, unknown or expired token.

- [ ] **Step 1: Failing tests**

Domain: the text matches `^eqt_[A-Z2-7]{52}$`; `HashToken(text)` equals `t.TokenHash`; days `7` → `ErrValidation` on field `expires_in_days`; scope `admin` → field `scope`; empty name → field `name`.
Schema (`TestSchema` style): duplicate `token_hash` → unique violation; scope `admin` → check violation; `expires_at = created_at` → check violation.
API (`internal/identity/access_token_test.go`):
- create `{name: "Claude Code", scope: "read", expires_in_days: 90}` → 201, body `token` matches the pattern, `expires_at` 90 days after `created_at`; list → one item without a `token` field.
- user B lists → empty; user B deletes A's ID → 404 `access_token_not_found` (ADR 003 user filtering).
- delete → 204; list → empty.
- `expires_in_days: 7` → 422 `validation_failed` with field `expires_in_days` (`identity`'s `ToProblem` for a `FieldError`; the OpenAPI schema types it `integer` without `enum`, so the domain rule answers).
- `GET /api/v1/accounts` with `Authorization: Bearer <created token>` and no cookie → 401 (X13).
- `VerifyAccessToken`: valid → grant with user and scope; after `UPDATE identity_access_token SET expires_at = created_at + interval '1 second', created_at = created_at - interval '2 days'` → `ErrInvalidAccessToken`; two verifications within a minute leave `last_used_at` equal to the first (X8).
`tool_exposure_test.go`: the three operation IDs map to `"-secret"`.

- [ ] **Step 2: Run** `go test ./internal/identity/... ./internal/server -run 'AccessToken|TestSchema|TestToolExposure' -count=1` — FAIL.

- [ ] **Step 3: Implement** migration, queries (every one filters by `user_id`, except the lookup by `token_hash` used by verification), domain, app, handlers, `make gen`. `VerifyAccessToken` reads by hash, rejects `expires_at <= now`, and updates `last_used_at` only when it is NULL or more than one minute old.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: ADR 003 amendment**: access tokens per X5–X9, X11, X13; under Deferred, the password change endpoint also deletes the user's access tokens.

- [ ] **Step 6: Commit** `feat(identity): add personal access tokens`

---

### Task 3: The MCP endpoint (X1–X4, X11–X17, X19)

**Files:**
- Modify: `go.mod`, `go.sum` (`go get github.com/modelcontextprotocol/go-sdk@v1.8.0`)
- Create: `internal/platform/tool/mcp/mcp.go` (handler, servers per scope, result mapping)
- Create: `internal/platform/tool/mcp/bearer.go` (authentication and origin middleware)
- Modify: `internal/server/server.go` (mount before the session gate)
- Create: `docs/adr/023-mcp-server.md`; modify `docs/adr/012-tool-registry.md` (Deferred "MCP transport" resolved; T13 extended)
- Test: `internal/platform/tool/mcp/mcp_test.go`, `internal/server/mcp_test.go` (apitest scenarios of design 3.9)

**Interfaces:**
- Consumes: `tool.Registry` (`Tools`, `Tool`, `Call`), `tool.Spec.Effect`, `Tool.InputSchema()`, `Tool.OutputSchema()`; `identity.VerifyAccessToken`; `assistant.Instructions()`.
- Produces:
  ```go
  package mcp
  type Grant struct { TokenID string; UserID int64; Write bool }
  type Verify func(ctx context.Context, token string) (Grant, error) // any error answers 401
  type Config struct {
      Registry     *tool.Registry
      Names        []string // the chat set's tool names
      Instructions string
      Prompts      []Prompt // Task 4
      Version      string
      Verify       Verify
      Log          *slog.Logger
  }
  func New(cfg Config) http.Handler
  ```
  `server.Config` gains nothing; `internal/server` adapts `identity.AccessGrant` to `mcp.Grant` (`Write: g.Scope == "write"`).

- [ ] **Step 1: Failing API tests** (`internal/server/mcp_test.go`; a helper connects `mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)` with `&mcp.StreamableClientTransport{Endpoint: h.URL() + "/mcp", HTTPClient: &http.Client{Transport: bearer(token)}, DisableStandaloneSSE: true}`, where `bearer` is a `RoundTripper` that sets the header):
- read token: `ListTools` → exactly the 19 `ReadOnly` names of `h.App.Tools`, each with `Annotations.ReadOnlyHint == true`.
- write token: 36 tools; each `Destructive` tool has `DestructiveHint` pointing to true; `IdempotentHint` equals `Spec().Idempotent`.
- `CallTool("list_accounts", {})` → `StructuredContent` equal (JSON-compared) to the `list_accounts` result of `h.App.Tools.Call` for the same user, and one text content holding the same JSON (X16).
- write token, `record_transaction` with the arguments of an existing tool test for that tool → `IsError == false`; `GET /api/v1/transactions` lists the transaction (X17).
- Review Focus 2: read token, `CallTool("record_transaction", …)` → `IsError == true`, text JSON with `"code":"tool_not_allowed"`; no transaction.
- no header, `Bearer eqt_unknown`, an expired token, a deleted token (Review Focus 3), the token only in `?token=` → raw `POST /mcp` with an `initialize` body answers 401 with header `WWW-Authenticate` starting `Bearer`.
- session cookie only (`h.Client`) → 401.
- `Origin: https://evil.example` with a valid token → 403; `Origin` equal to the harness's own origin → 200.
- body of 1 MiB + 1 byte with a valid token → 413.
- Review Focus 4: `GET /mcp` with a valid token → 405; with the session cookie → 401; the body is not the SPA's HTML.
- Review Focus 1: a request whose `Host` is `finance.example.com` arriving on the loopback listener with a valid token → not 403.
- Review Focus 5: an extra test tool (`apitest.ExtraTools`) returning 40 KiB → `IsError`, code `result_too_large`.
- user A's token never returns user B's account names through `list_accounts` (ADR 003).
- instructions: the `InitializeResult.Instructions` the client session holds equals `assistant.Instructions()`.
- log: after a call, `h.Logs()` holds one `msg="mcp call"` line with `token_id=`, `tool=list_accounts`, `outcome=ok`, and no argument text (X19).

- [ ] **Step 2: Run** `go test ./internal/server -run TestMCP -count=1` — FAIL (no route).

- [ ] **Step 3: Implement the adapter**

- `New` builds two `*mcp.Server` values (read, write) with `ServerOptions{Instructions}`, each registering its tools: `&mcp.Tool{Name, Description, InputSchema: t.InputSchema(), OutputSchema: t.OutputSchema(), Annotations: &mcp.ToolAnnotations{ReadOnlyHint: effect == tool.ReadOnly, DestructiveHint: ptr(effect == tool.Destructive), IdempotentHint: spec.Idempotent}}`.
- The tool handler calls `Registry.Call(ctx, name, req.Params.Arguments)` and returns `CallToolResult{StructuredContent: json.RawMessage(res.Content), Content: []mcp.Content{&mcp.TextContent{Text: string(res.Content)}}, IsError: res.IsError}`; a Go error from `Registry.Call` returns as the handler's error.
- The read server adds a receiving middleware: `tools/call` for a name outside its list returns a result with `IsError` and `{"code":"tool_not_allowed","detail":"the token's scope does not include this tool"}`.
- `mcp.NewStreamableHTTPHandler(getServer, &mcp.StreamableHTTPOptions{Stateless: true, MaxRequestBodyBytes: 1 << 20, DisableLocalhostProtection: true, Logger: cfg.Log})`; `getServer` picks the server by the grant in the request context.
- `bearer.go`: rejects an `Origin` whose host differs from `r.Host` (403, plain text); reads only the `Authorization` header with prefix `Bearer `; on any `Verify` error answers 401 with `WWW-Authenticate: Bearer`; on success sets `auth.WithUserID(ctx, grant.UserID)` and the grant.
- One `Info` log line `mcp call` per `tools/call` with `token_id`, `user_id`, `tool`, `effect`, `outcome` (`ok` or the tool error code), `duration`, `bytes`.
- `internal/server`: an outer `http.ServeMux` routes `/mcp` to `mcp.New(...)` and `/` to the current chain; both stay inside `httpserver.Middleware`.

- [ ] **Step 4: Run** `go test ./internal/platform/tool/... ./internal/server -count=1` — PASS; `make vuln` — no finding for the new module.

- [ ] **Step 5: ADR 023** (Status accepted, date of the commit): X1–X19, the scopes, the write policy of X17 with the client's own approval prompt as the human in the loop, the dependency, the `DisableLocalhostProtection` choice with Review Focus 1 as its reason, and the non-goals of the design. ADR 012: Deferred "MCP transport" resolved by ADR 023; T13 gains the `mcp call` line.

- [ ] **Step 6: Commit** `feat(server): serve the tool registry over MCP with access tokens`

---

### Task 4: MCP prompts (X18)

**Files:**
- Modify: `internal/assistant/internal/app/mcp_prompts.go` (texts), `internal/assistant/assistant.go` (`Prompts() []assistant.Prompt`, with `type Prompt struct { Name, Description string; Arguments []PromptArgument; Render func(args map[string]string) (string, error) }` and `type PromptArgument struct { Name, Description string; Required bool }`; the module does not import the SDK)
- Modify: `internal/platform/tool/mcp/mcp.go` (`type Prompt` with the same fields; registers each with `AddPrompt` on both servers)
- Modify: `internal/server/server.go` (maps one to the other)
- Test: `internal/server/mcp_test.go`

- [ ] **Step 1: Failing test** `TestMCPPrompts`: `ListPrompts` → `categorize_pending`, `monthly_review`, `reconcile_account`; `GetPrompt("monthly_review", {"month": "2026-09"})` → one user message whose text contains `2026-09` and the tool names `get_category_totals` and `search_transactions` (names from the registry; the test checks each named tool exists in `h.App.Tools`); `month: "2026-13"` → an error; `reconcile_account` without `account` → an error.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** the three English texts beside the guide; each names the read tools to call first and, for `categorize_pending` and `reconcile_account`, the write tools the client confirms.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit** `feat(assistant): offer MCP prompts for common reviews`

---

### Task 5: Settings section "Acesso externo (MCP)" and documentation (3.6, 3.7, P8)

**Files:**
- Create: `web/src/features/setup/settings-external-access.tsx`, `web/src/features/setup/access-token-dialog.tsx`, `web/src/features/setup/client-snippets.ts` (`clientSnippets(endpoint: string, token: string): { claudeCode: string; codex: string; json: string }`), `web/src/features/setup/is-private-origin.ts` (`isPrivateOrigin(origin: string): boolean`: loopback, RFC 1918, link-local, `.local`, `localhost`)
- Modify: `web/src/features/setup/api.ts` (queries and mutations of `/access-tokens`), `settings-topics.ts` (topic `external_access`, group `connections`, after `assistant`), `settings-pane.tsx`, `settings-search.ts` when it indexes topic text
- Modify: `web/src/features/assistant/assistant-panel.tsx` (P8 second action "Usar Claude ou Codex" → `/settings?section=external_access`)
- Modify: both catalogs
- Create: `docs/operations/mcp.md`
- Test: `web/src/features/setup/client-snippets.test.ts`, `web/src/features/setup/is-private-origin.test.ts`, `web/src/features/setup/settings-external-access.test.tsx`, `web/src/features/assistant/assistant-panel.test.tsx`

- [ ] **Step 1: Failing tests**

- `clientSnippets("https://f.example/mcp", "eqt_X")`:
  - `claudeCode` === `claude mcp add --transport http equori https://f.example/mcp --header "Authorization: Bearer eqt_X"`
  - `codex` === `[mcp_servers.equori]\nurl = "https://f.example/mcp"\nbearer_token_env_var = "EQUORI_TOKEN"` (the token goes to the environment variable, never into the file)
  - `json` parses to `{ mcpServers: { equori: { type: "http", url: "https://f.example/mcp", headers: { Authorization: "Bearer eqt_X" } } } }`.
- `isPrivateOrigin`: true for `http://127.0.0.1:8080`, `http://localhost:8080`, `http://192.168.0.10`, `http://10.1.2.3`, `http://172.20.0.1`, `http://nas.local`; false for `https://finance.example.com`, `http://172.32.0.1`.
- Section: empty list shows the empty state and "Criar token"; creating with name `Claude Code`, scope `Somente leitura` preselected, expiry `90 dias` preselected posts `{name: "Claude Code", scope: "read", expires_in_days: 90}`; the result shows the token once and the three snippets built from `window.location.origin + "/mcp"`; closing the dialog and reopening the section shows the token in the list without its text; deleting asks for confirmation and sends `DELETE`.
- On origin `http://127.0.0.1:3000` the reachability note shows; on `https://finance.example.com` it does not.
- Panel: with no provider, `Usar Claude ou Codex` navigates to `{ to: "/settings", search: { section: "external_access" } }`.

- [ ] **Step 2: Run** `pnpm vitest run src/features/setup src/features/assistant` from `web/` — FAIL.

- [ ] **Step 3: Implement** with the families the other settings sections use (read `compose-screen` and the family files each component uses). The explanation text states the three points of design 3.6. Copy actions use the clipboard helper the app already has for copying (search `navigator.clipboard` under `web/src`).

- [ ] **Step 4: `docs/operations/mcp.md`**: what the endpoint offers, token creation, the three client setups (same text as the snippets), scopes, the reachability rule, revocation.

- [ ] **Step 5: Run** — PASS; `make web-check` — PASS.

- [ ] **Step 6: Commit** `feat(web): create access tokens and show MCP client setups`

---

### Task 6: Phase verification

- [ ] **Step 1:** `make check` — PASS.
- [ ] **Step 2:** `make run-prod`; create a token in the UI (Playwright `launch()` closed in `finally`, 1440 and 390 px screenshots of the section); then a Go program under the scratchpad with the SDK client lists tools and calls `list_accounts` against `http://127.0.0.1:8091/mcp`. No real language model is called.
- [ ] **Step 3:** Hand off to the owner: connecting Claude Code or Codex with a real subscription is the owner's check. Report with a "Slotted findings" section.
