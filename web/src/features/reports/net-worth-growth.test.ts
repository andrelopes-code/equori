import { describe, expect, it } from "vitest";

import {
  categoryRuns,
  classTotal,
  netWorthGrowth,
} from "@/features/reports/net-worth-growth";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("netWorthGrowth", () => {
  it("NP3, NP4: states the change, its percent and the part the result does not explain", () => {
    expect(netWorthGrowth(80000, 100500, 150000)).toEqual({
      change: 20500,
      changeBP: 2563,
      result: 150000,
      other: -129500,
    });
  });

  it("NP3: leaves the percent out when the opening is zero", () => {
    expect(netWorthGrowth(0, 5000, undefined)).toEqual({ change: 5000 });
  });

  it("NP3: reads the percent over the magnitude of a negative opening", () => {
    expect(netWorthGrowth(-10000, -5000, undefined)).toEqual({
      change: 5000,
      changeBP: 5000,
    });
  });
});

describe("categoryRuns", () => {
  it("NP4: splits a period into runs of at most 366 days", () => {
    expect(categoryRuns("2024-01-01", "2026-01-10")).toEqual([
      { from: "2024-01-01", to: "2024-12-31" },
      { from: "2025-01-01", to: "2026-01-01" },
      { from: "2026-01-02", to: "2026-01-10" },
    ]);
  });

  it("NP4: keeps a short period whole", () => {
    expect(categoryRuns("2026-03-01", "2026-03-17")).toEqual([
      { from: "2026-03-01", to: "2026-03-17" },
    ]);
  });
});

describe("classTotal", () => {
  it("NP4: sums each category's own total, not its subtree", () => {
    expect(
      classTotal([
        { account_id: "a", total: brl(1000), subtree_total: brl(4000) },
        { account_id: "b", total: brl(3000), subtree_total: brl(3000) },
      ]),
    ).toBe(4000);
  });
});
