import { describe, expect, it } from "vitest";

import { clientSnippets } from "@/features/setup/client-snippets";

describe("clientSnippets", () => {
  const s = clientSnippets("https://f.example/mcp", "eqt_X");

  it("adds the server to Claude Code with the header", () => {
    expect(s.claudeCode).toBe(
      'claude mcp add --transport http equori https://f.example/mcp --header "Authorization: Bearer eqt_X"',
    );
  });

  it("keeps the token out of the Codex file", () => {
    expect(s.codex).toBe(
      '[mcp_servers.equori]\nurl = "https://f.example/mcp"\nbearer_token_env_var = "EQUORI_TOKEN"',
    );
    expect(s.codex).not.toContain("eqt_X");
  });

  it("writes a generic JSON entry", () => {
    expect(JSON.parse(s.json)).toEqual({
      mcpServers: {
        equori: {
          type: "http",
          url: "https://f.example/mcp",
          headers: { Authorization: "Bearer eqt_X" },
        },
      },
    });
  });
});
