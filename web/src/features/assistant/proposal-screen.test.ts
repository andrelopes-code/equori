import { describe, expect, it } from "vitest";

import { proposalScreen } from "@/features/assistant/proposal-screen";

describe("proposalScreen", () => {
  it.each([
    ["record_transaction", { transaction_id: "t1" }, "/transactions/t1"],
    [
      "change_transaction",
      { transaction_id: "t2", version: 2 },
      "/transactions/t2",
    ],
    ["manage_schedule", { schedule_id: "s1" }, "/planning/schedules/s1"],
    ["manage_rule", { rule_id: "r1" }, "/categories/rules/r1"],
    ["manage_budget_or_goal", { budget_id: "b1" }, "/planning/budgets/b1"],
    ["reconcile_account", { account_id: "a1" }, "/accounts/a1"],
    ["manage_card", { account_id: "a2" }, "/cards/a2"],
  ])("%s opens its record", (tool, result, path) => {
    expect(proposalScreen(tool, result)).toBe(path);
  });

  it("has no screen for an unknown tool or a result without the field", () => {
    expect(
      proposalScreen("update_profile", { language: "pt" }),
    ).toBeUndefined();
    expect(
      proposalScreen("record_transaction", { date: "2026-10-23" }),
    ).toBeUndefined();
    expect(proposalScreen("record_transaction", null)).toBeUndefined();
  });
});

describe("proposalScreen of a deletion", () => {
  it("links no record the proposal deleted", () => {
    expect(
      proposalScreen("manage_budget_or_goal", {
        budget_id: "b1",
        deleted: true,
      }),
    ).toBeUndefined();
  });
});
