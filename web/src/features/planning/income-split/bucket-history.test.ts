import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  targetKey,
  trackMonth,
  trackVerdict,
} from "@/features/planning/income-split/bucket-history";

type History = components["schemas"]["BudgetBucketHistory"];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const buckets = [
  {
    id: "needs",
    name: "Needs",
    share_bp: 6000,
    takes_savings: false,
    takes_goals: false,
    at_least: false,
    category_ids: [],
  },
  {
    id: "free",
    name: "Freedom",
    share_bp: 4000,
    takes_savings: true,
    takes_goals: false,
    at_least: false,
    category_ids: [],
  },
];

function month(m: string, received: number, needs: number, free: number) {
  return {
    month: m,
    received: brl(received),
    outside: brl(0),
    buckets: [
      { id: "needs", real: brl(needs) },
      { id: "free", real: brl(free) },
    ],
  };
}

const history: History = {
  currency: "BRL",
  buckets,
  months: [
    month("2026-06", 100000, 50000, 50000),
    month("2026-07", 100000, 70000, 30000),
    month("2026-08", 0, 10000, -10000),
    month("2026-09", 100001, 60001, 40000),
    month("2026-10", 100000, 90000, 10000),
    month("2026-11", 100000, 20000, 80000),
  ],
};

describe("trackMonth", () => {
  it("states each bucket against its share of the income received", () => {
    const got = trackMonth(history, "2026-10");

    expect(got.received).toBe(100000);
    expect(got.missed).toBe(2);
    expect(got.rows.map((r) => [r.id, r.target, r.real, r.status])).toEqual([
      ["needs", 60000, 90000, { kind: "over", amount: 30000 }],
      ["free", 40000, 10000, { kind: "short", amount: 30000 }],
    ]);
    expect(got.rows[0]?.shareBp).toBe(9000);
  });

  it("reads what is left and what was kept", () => {
    const got = trackMonth(history, "2026-11");

    expect(got.missed).toBe(0);
    expect(got.rows.map((r) => r.status)).toEqual([
      { kind: "left", amount: 40000 },
      { kind: "saved", amount: 80000 },
    ]);
  });

  it("marks the six months, a month without income having no target", () => {
    const got = trackMonth(history, "2026-10");

    expect(got.rows[0]?.months.map((m) => m.kept)).toEqual([
      true,
      false,
      undefined,
      true,
      false,
      true,
    ]);
    // 100,001 at 60% is 60,000.6: the largest remainder gives the unit to Needs.
    expect(got.rows[0]?.months[3]?.target).toBe(60001);
  });

  it("judges a floor bucket by reaching its target", () => {
    // Needs as a floor: 50% of R$1,000.00 is R$500.00 in October; R$900.00 reached it, and in
    // November R$200.00 falls R$300.00 short.
    const floor: History = {
      ...history,
      buckets: history.buckets.map((b, i) =>
        i === 0
          ? { ...b, share_bp: 5000, at_least: true }
          : { ...b, share_bp: 5000 },
      ),
    };

    const october = trackMonth(floor, "2026-10").rows[0];
    const november = trackMonth(floor, "2026-11").rows[0];

    expect(october?.status).toEqual({ kind: "reached", amount: 90000 });
    expect(october?.months[4]?.state).toBe("kept");
    expect(november?.status).toEqual({ kind: "toGo", amount: 30000 });
    expect(november?.months[5]?.state).toBe("missed");
    expect(targetKey(october?.measure ?? "ceiling")).toBe("track.targetFloor");
  });

  it("gives no target and no verdict without income", () => {
    const got = trackMonth(history, "2026-08");

    expect(got.received).toBe(0);
    expect(got.missed).toBeUndefined();
    expect(got.rows.map((r) => [r.target, r.status, r.shareBp])).toEqual([
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ]);
  });
});

describe("trackVerdict", () => {
  it("names the buckets that missed, or why nothing is judged", () => {
    expect(trackVerdict(trackMonth(history, "2026-10"))).toEqual({
      key: "track.verdict.missed",
      count: 2,
    });
    expect(trackVerdict(trackMonth(history, "2026-11"))).toEqual({
      key: "track.verdict.kept",
    });
    expect(trackVerdict(trackMonth(history, "2026-08"))).toEqual({
      key: "track.verdict.noIncome",
    });
    expect(trackVerdict({ received: 1, rows: [], missed: 1 })).toEqual({
      key: "track.verdict.one",
    });
  });
});
