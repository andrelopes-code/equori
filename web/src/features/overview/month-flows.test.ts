import { describe, expect, it } from "vitest";

import { budgetPace, monthFlows } from "@/features/overview/month-flows";

const accounts = new Map([
  ["chk", { id: "chk", class: "asset" as const }],
  ["sav", { id: "sav", class: "asset" as const }],
  ["out", { id: "out", class: "asset" as const }],
  ["food", { id: "food", class: "expense" as const }],
  ["pay", { id: "pay", class: "income" as const }],
]);

function tx(postings: [string, number][], voided = false) {
  return {
    postings: postings.map(([account_id, amount]) => ({
      account_id,
      amount: { amount, currency: "BRL" },
    })),
    ...(voided ? { voided_at: "2026-10-02T00:00:00Z" } : {}),
  };
}

describe("monthFlows", () => {
  it("splits income, spending and transfers out of the scoped accounts", () => {
    const flows = monthFlows(
      [
        tx([
          ["chk", 840000],
          ["pay", -840000],
        ]),
        tx([
          ["chk", -15000],
          ["food", 15000],
        ]),
        tx([
          ["chk", -50000],
          ["sav", 50000],
        ]),
        tx([
          ["chk", -100000],
          ["out", 100000],
        ]),
        tx(
          [
            ["chk", -9900],
            ["food", 9900],
          ],
          true,
        ),
      ],
      new Set(["chk", "sav"]),
      accounts,
    );
    expect(flows).toEqual({ income: 840000, spending: 15000, moved: 100000 });
  });
});

describe("budgetPace", () => {
  it("reads overspent as danger and ahead of the month by more than 15 points as warning", () => {
    expect(budgetPace({ spent: 1300, planned: 1200, elapsed: 0.5 })).toBe(
      "over",
    );
    expect(budgetPace({ spent: 800, planned: 1200, elapsed: 0.5 })).toBe(
      "ahead",
    );
    expect(budgetPace({ spent: 700, planned: 1200, elapsed: 0.5 })).toBe("ok");
    expect(budgetPace({ spent: 0, planned: 0, elapsed: 0.5 })).toBe("ok");
  });
});
