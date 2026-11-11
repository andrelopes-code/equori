// The setups of design 2026-10-26 section 3.6 for an MCP endpoint and a token. Codex reads the token
// from an environment variable, so its file never holds it.
export function clientSnippets(
  endpoint: string,
  token: string,
): { claudeCode: string; codex: string; json: string } {
  return {
    claudeCode: `claude mcp add --transport http equori ${endpoint} --header "Authorization: Bearer ${token}"`,
    codex: `[mcp_servers.equori]\nurl = "${endpoint}"\nbearer_token_env_var = "EQUORI_TOKEN"`,
    json: JSON.stringify(
      {
        mcpServers: {
          equori: {
            type: "http",
            url: endpoint,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    ),
  };
}
