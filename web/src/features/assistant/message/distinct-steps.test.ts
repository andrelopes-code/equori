import { describe, expect, it } from "vitest";

import { distinctSteps } from "@/features/assistant/message/distinct-steps";

describe("distinctSteps", () => {
  it.each([
    { name: "no steps", steps: [], want: [] },
    {
      name: "distinct tools keep their order",
      steps: ["list_accounts", "get_balances"],
      want: ["list_accounts", "get_balances"],
    },
    {
      name: "a repeated tool is listed once",
      steps: [
        "list_accounts",
        "list_accounts",
        "search_transactions",
        "search_transactions",
        "search_transactions",
      ],
      want: ["list_accounts", "search_transactions"],
    },
    {
      name: "a tool called again moves to its last call",
      steps: ["list_accounts", "search_transactions", "list_accounts"],
      want: ["search_transactions", "list_accounts"],
    },
  ])("$name", ({ steps, want }) => {
    expect(distinctSteps(steps)).toEqual(want);
  });
});
