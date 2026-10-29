# ADR 024: The MCP server

- Status: accepted
- Date: 2026-10-27
- Design: `docs/specs/2026-10-26-mcp-agent-design.md` (sections 2.3 and 3; its "ADR 023" is this record, 023 being taken)
- Amends: ADR 003 (access tokens), ADR 012 (Deferred "MCP transport", T13)

## Context

A user who pays for an agent (Claude Code, Codex, claude.ai, any MCP client) controls their finances from it with the tools the in-app assistant uses. The registry of ADR 012 already holds every tool with its schemas and effect.

## Decision

| ID | Rule |
| --- | --- |
| X1 | `POST /mcp` speaks Streamable HTTP through `github.com/modelcontextprotocol/go-sdk` v1.8.0 with `Stateless: true`. |
| X2 | A request body over 1 MiB answers 413. |
| X3 | A request whose `Origin` is present and whose host differs from the request's `Host` answers 403. |
| X4 | The adapter is `internal/platform/tool/mcp`: it knows the registry and the SDK, no module. `internal/server` mounts it outside `/api/` and outside the session gate. |
| X11 | `/mcp` accepts only `Authorization: Bearer <token>` of ADR 003's access tokens. A missing, unknown, expired or deleted token answers 401 with `WWW-Authenticate: Bearer`. A token in the query string is never read; the session cookie is not accepted. |
| X12 | The handler sets the token's user with `auth.WithUserID`; `Registry.Call` reads it as for any consumer. |
| X14 | A `read` token lists and calls only `ReadOnly` tools; a `write` token every tool of the chat set. A call outside the token's list answers the tool error `tool_not_allowed`. |
| X15 | Each tool keeps its name, description, input and output schemas. Annotations: `readOnlyHint` for `ReadOnly`, `destructiveHint` for `Destructive`, `idempotentHint` from `Idempotent`. |
| X16 | A result carries `structuredContent` and the same JSON as one text block. A tool error carries `isError: true` and the `{code, detail, errors}` object of ADR 012 T7. |
| X17 | A write tool called through MCP executes through `Registry.Call`, without a proposal. The human in the loop is the client's own approval prompt. |
| X18 | Three prompts: `monthly_review`, `categorize_pending`, `reconcile_account`. |
| X19 | One log line `mcp call` per call with token ID, user ID, tool, effect, outcome, duration and size; never arguments, results or the token. |
| X20 | The instructions are the `mcp` rendering of the assistant's guide (design E8 to E10). |

The SDK's DNS rebinding check (`DisableLocalhostProtection` false) refuses a request that arrives on a loopback listener with another `Host`, which is every request behind a reverse proxy on the same host. The adapter disables it; X3 and the bearer token guard the endpoint instead.

## Consequences

- The SDK is a dependency, with `golang.org/x/oauth2` and `golang.org/x/time` as indirect ones.
- A `write` token lets the client record and delete without equori's confirmation card.

## Not covered

- An OAuth 2.1 authorization server and "Sign in" for claude.ai custom connectors.
- A stdio transport.
- An instance-wide switch for MCP: access exists only for a user who creates a token.
- An audit screen of external calls; the X19 log line records them.

## Revisit criterion

A client the owner uses that cannot send a fixed `Authorization` header, or an MCP protocol version the SDK pinned here does not negotiate.
