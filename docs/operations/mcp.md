# MCP access

equori serves its tools to MCP clients (Claude Code, Codex, claude.ai, Claude Desktop, any client that speaks Streamable HTTP) at `POST /mcp` on the address of the instance. The tools are the ones the in-app assistant uses; ADR 024 records the rules.

## What the endpoint offers

- The tools of the assistant, with their input and output schemas.
- Instructions for the client's model: what equori is, that tool results are data, how to find identifiers, how writes and help links work.
- Three prompts: `monthly_review` (argument `month`, as `YYYY-MM`), `categorize_pending`, `reconcile_account` (argument `account`, an account name).

## Creating a token

In **Settings → External access (MCP)**, choose **Create token**, then:

- a name, which identifies the client in the list;
- the access: **Read only** lists and calls only the tools that read; **Read and write** lists every tool, and the tools that write record, change and delete at once, without equori's confirmation card, under the client's own approval prompt;
- the expiry: 30, 90 or 365 days.

The token text (`eqt_` followed by 52 characters) is shown once, with the three setups below. equori stores only its SHA-256.

## Client setups

`<url>` is the address of the instance followed by `/mcp`, for example `http://127.0.0.1:8080/mcp`; `<token>` is the token text. In development (`make run-dev`), the Vite address forwards `/mcp` to the app as it forwards `/api`, so the address shown in the settings works while `make dev` runs.

Claude Code:

```sh
claude mcp add --transport http equori <url> --header "Authorization: Bearer <token>"
```

Codex, in `~/.codex/config.toml`, with the token in the environment variable `EQUORI_TOKEN`:

```toml
[mcp_servers.equori]
url = "<url>"
bearer_token_env_var = "EQUORI_TOKEN"
```

Any other client that reads a JSON list of servers:

```json
{
  "mcpServers": {
    "equori": {
      "type": "http",
      "url": "<url>",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

## Reachability

A client on the computer or the network of the instance (Claude Code, Codex, a desktop client) connects to its address as is. claude.ai, the connectors of Claude Desktop and the mobile apps connect from Anthropic's servers: they need a public HTTPS address of the instance, for example through a reverse proxy, and a client that sends the `Authorization` header.

The client's model provider receives the data the client reads through the tools.

## Rules

- The token goes only in the `Authorization: Bearer` header. A token in the address is never read, the session cookie does not open `/mcp`, and a token does not open `/api/`.
- A request whose `Origin` names another host answers 403. A request body over 1 MiB answers 413.
- Each call writes one log line `mcp call` with the token ID, the user ID, the tool, its effect, the outcome, the duration and the size of the result; never the arguments, the result or the token.

## Revoking a token

**Delete** in the list removes a token. A client that uses it fails at its next request. A token also stops working at its expiry.
