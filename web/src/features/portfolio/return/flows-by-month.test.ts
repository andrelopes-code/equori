import { describe, expect, it } from "vitest";

import { flowsByMonth } from "@/features/portfolio/return/flows-by-month";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("flowsByMonth", () => {
  it("groups the flows by month, newest first, with the magnitude of the withdrawals", () => {
    const flows = [
      { date: "2026-03-10", amount: brl(50000) },
      { date: "2026-03-20", amount: brl(-5000) },
      { date: "2026-04-05", amount: brl(-20000) },
    ];

    expect(flowsByMonth(flows, "BRL")).toEqual([
      { month: "2026-04", deposits: 0, withdrawals: 20000 },
      { month: "2026-03", deposits: 50000, withdrawals: 5000 },
    ]);
  });

  it("skips a flow in another currency", () => {
    const flows = [
      { date: "2026-03-10", amount: brl(50000) },
      { date: "2026-05-02", amount: { amount: 999, currency: "USD" } },
    ];

    expect(flowsByMonth(flows, "BRL")).toEqual([
      { month: "2026-03", deposits: 50000, withdrawals: 0 },
    ]);
  });
});
