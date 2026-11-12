import { describe, expect, it } from "vitest";

import { reconcile } from "@/features/portfolio/return/reconciliation";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("reconcile", () => {
  it.each([
    {
      name: "mixed",
      opening: 100000,
      closing: 140000,
      flows: [
        { date: "2026-03-10", amount: brl(50000) },
        { date: "2026-04-05", amount: brl(-20000) },
      ],
      want: { deposits: 50000, withdrawals: 20000, result: 10000, excluded: 0 },
    },
    {
      name: "no flows",
      opening: 100000,
      closing: 103000,
      flows: [],
      want: { deposits: 0, withdrawals: 0, result: 3000, excluded: 0 },
    },
    {
      name: "deposits only",
      opening: 0,
      closing: 10500,
      flows: [{ date: "2026-03-10", amount: brl(10000) }],
      want: { deposits: 10000, withdrawals: 0, result: 500, excluded: 0 },
    },
    {
      name: "withdrawals only",
      opening: 100000,
      closing: 69000,
      flows: [{ date: "2026-03-10", amount: brl(-30000) }],
      want: { deposits: 0, withdrawals: 30000, result: -1000, excluded: 0 },
    },
    {
      name: "other currency",
      opening: 100000,
      closing: 150000,
      flows: [
        { date: "2026-03-10", amount: brl(50000) },
        { date: "2026-03-11", amount: { amount: 999, currency: "USD" } },
      ],
      want: { deposits: 50000, withdrawals: 0, result: 0, excluded: 1 },
    },
  ])("$name", ({ opening, closing, flows, want }) => {
    expect(
      reconcile({ opening: brl(opening), closing: brl(closing), flows }),
    ).toEqual({ opening, closing, ...want });
  });
});
