import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { trackStrip } from "@/features/planning/income-split/track-strip-parts";

type History = components["schemas"]["BudgetBucketHistory"];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const bucket = (id: string, savings = false, goals = false) => ({
  id,
  name: id,
  share_bp: 2500,
  takes_savings: savings,
  takes_goals: goals,
  at_least: false,
  category_ids: [],
});
const real = (id: string, amount: number) => ({
  id,
  real: brl(amount),
  goal_paid: brl(0),
  covered: brl(0),
});

function history(
  reals: number[],
  outside: number,
  unallocated: number,
): History {
  return {
    currency: "BRL",
    methods: [
      {
        from: "2026-06",
        buckets: [
          bucket("needs"),
          bucket("fun"),
          bucket("freedom", true),
          bucket("goals", false, true),
        ],
      },
    ],
    months: [
      {
        month: "2026-10",
        from: "2026-06",
        received: brl(500000),
        outside: brl(outside),
        unallocated: brl(unallocated),
        retained: brl(0),
        buckets: ["needs", "fun", "freedom", "goals"].map((id, i) =>
          real(id, reals[i] ?? 0),
        ),
      },
    ],
  };
}

describe("trackStrip", () => {
  it("splits the income received into where it went", () => {
    const got = trackStrip(
      history([200000, 50000, 100000, 50000], 20000, 80000),
      "2026-10",
    );

    expect(got.map((p) => [p.key, p.amount, p.shareBp])).toEqual([
      ["spent", 250000, 5000],
      ["setAside", 100000, 2000],
      ["goalDeposits", 50000, 1000],
      ["outside", 20000, 400],
      ["unallocated", 80000, 1600],
    ]);
    expect(got.reduce((sum, p) => sum + p.amount, 0)).toBe(500000);
  });

  it("writes a part below zero without a share and drops a part at zero", () => {
    const got = trackStrip(
      history([400000, 0, 0, -100000], 0, 200000),
      "2026-10",
    );

    expect(got.map((p) => [p.key, p.amount, p.shareBp])).toEqual([
      ["spent", 400000, 6667],
      ["goalDeposits", -100000, 0],
      ["unallocated", 200000, 3333],
    ]);
  });

  it("is empty for a month without a split", () => {
    expect(trackStrip(history([], 0, 0), "2026-09")).toEqual([]);
  });
});
