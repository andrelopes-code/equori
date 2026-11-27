import { describe, expect, it } from "vitest";

import { operationIcon } from "@/features/assistant/proposal/ticket/operation-icon";

describe("operationIcon", () => {
  it.each([
    ["record_investment", "record_investment.buy", "buy"],
    ["record_investment", "record_investment.opening", "buy"],
    ["record_investment", "record_investment.correct", "pencil"],
    ["transfer_custody", "transfer_custody", "swap"],
    ["record_corporate_action", "record_corporate_action.split", "split"],
    ["void_transaction", "void_transaction", "ban"],
    ["manage_rule", "manage_rule.create_rule", "wand"],
  ])("draws %s %s as %s", (tool, action, want) => {
    expect(operationIcon({ tool, preview: { action, changes: [] } })).toBe(
      want,
    );
  });
});
