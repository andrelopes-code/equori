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
    from: "2026-06",
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
  methods: [{ from: "2026-06", buckets }],
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
    const got = trackMonth(history, "2026-10", "2026-06");

    expect(got.received).toBe(100000);
    expect(got.missed).toBe(2);
    expect(got.rows.map((r) => [r.id, r.target, r.real, r.status])).toEqual([
      ["needs", 60000, 90000, { kind: "over", amount: 30000 }],
      ["free", 40000, 10000, { kind: "short", amount: 30000 }],
    ]);
    expect(got.rows[0]?.shareBp).toBe(9000);
  });

  it("reads what is left and what was kept", () => {
    const got = trackMonth(history, "2026-11", "2026-06");

    expect(got.missed).toBe(0);
    expect(got.rows.map((r) => r.status)).toEqual([
      { kind: "left", amount: 40000 },
      { kind: "saved", amount: 80000 },
    ]);
  });

  it("marks the six months, a month without income having no target", () => {
    const got = trackMonth(history, "2026-10", "2026-06");

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
      methods: [
        {
          from: "2026-06",
          buckets: buckets.map((b, i) =>
            i === 0
              ? { ...b, share_bp: 5000, at_least: true }
              : { ...b, share_bp: 5000 },
          ),
        },
      ],
    };

    const october = trackMonth(floor, "2026-10", "2026-06").rows[0];
    const november = trackMonth(floor, "2026-11", "2026-06").rows[0];

    expect(october?.status).toEqual({ kind: "reached", amount: 90000 });
    expect(october?.months[4]?.state).toBe("kept");
    expect(november?.status).toEqual({ kind: "toGo", amount: 30000 });
    expect(november?.months[5]?.state).toBe("missed");
    expect(targetKey(october?.measure ?? "ceiling")).toBe("track.targetFloor");
  });

  it("gives no target and no verdict without income", () => {
    const got = trackMonth(history, "2026-08", "2026-06");

    expect(got.received).toBe(0);
    expect(got.missed).toBeUndefined();
    expect(got.rows.map((r) => [r.target, r.status, r.shareBp])).toEqual([
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ]);
  });
});

describe("trackMonth across versions", () => {
  const first = buckets.map((b) => ({
    ...b,
    share_bp: b.id === "needs" ? 6000 : 4000,
  }));
  const second = [
    ...buckets.map((b) => ({
      ...b,
      share_bp: b.id === "needs" ? 5000 : 3000,
    })),
    {
      id: "extra",
      name: "Extra",
      share_bp: 2000,
      takes_savings: false,
      takes_goals: false,
      at_least: false,
      category_ids: [],
    },
  ];
  const across: History = {
    currency: "BRL",
    methods: [
      { from: "2026-06", buckets: first },
      { from: "2026-09", buckets: second },
    ],
    months: [
      month("2026-06", 100000, 50000, 50000),
      month("2026-07", 100000, 70000, 30000),
      month("2026-08", 100000, 10000, 10000),
      {
        month: "2026-09",
        from: "2026-09",
        received: brl(100000),
        outside: brl(0),
        buckets: [
          { id: "needs", real: brl(40000) },
          { id: "free", real: brl(30000) },
          { id: "extra", real: brl(5000) },
        ],
      },
      { ...month("2026-10", 100000, 0, 0), from: "2026-09" },
      { ...month("2026-11", 100000, 0, 0), from: "2026-09" },
    ],
  };

  it("marks a bucket absent in the months before it joined the split", () => {
    const extra = trackMonth(across, "2026-11", "2026-06").rows[2];

    expect(extra?.id).toBe("extra");
    expect(extra?.months.map((m) => m.state).slice(0, 3)).toEqual([
      "absent",
      "absent",
      "absent",
    ]);
    expect(extra?.months[0]).toEqual({
      month: "2026-06",
      target: undefined,
      real: 0,
      kept: undefined,
      state: "absent",
      changed: false,
    });
    expect(extra?.months[3]?.target).toBe(20000);
  });

  it("judges each month against the share of its own version", () => {
    const needs = trackMonth(across, "2026-11", "2026-06").rows[0];

    expect(needs?.months[0]?.target).toBe(60000);
    expect(needs?.months[5]?.target).toBe(50000);
  });

  it("returns no row for a month without a split", () => {
    const ended: History = {
      ...across,
      months: [
        ...across.months.slice(0, 5),
        {
          month: "2026-11",
          received: brl(100000),
          outside: brl(0),
          buckets: [],
        },
      ],
    };

    expect(trackMonth(ended, "2026-11", "2026-06")).toEqual({
      received: 100000,
      rows: [],
      missed: undefined,
    });
  });
});

describe("trackMonth since and changed", () => {
  const second = { from: "2026-11", buckets };
  const two: History = {
    ...history,
    methods: [{ from: "2026-09", buckets }, second],
    months: [
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ].map((m) => ({
      ...month(m, 100000, 0, 0),
      from: m >= "2026-11" ? "2026-11" : "2026-09",
    })),
  };

  it("marks only the month a later version starts in", () => {
    const got = trackMonth(two, "2026-11", "2026-09");

    expect(got.since).toEqual({ from: "2026-11", first: false });
    expect(got.rows[0]?.months.map((c) => c.changed)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("names the first version and marks nothing for one method", () => {
    const got = trackMonth(history, "2026-11", "2026-06");

    expect(got.since).toEqual({ from: "2026-06", first: true });
    expect(got.rows[0]?.months.some((c) => c.changed)).toBe(false);
  });
});

describe("trackVerdict", () => {
  it("names the buckets that missed, or why nothing is judged", () => {
    expect(trackVerdict(trackMonth(history, "2026-10", "2026-06"))).toEqual({
      key: "track.verdict.missed",
      count: 2,
    });
    expect(trackVerdict(trackMonth(history, "2026-11", "2026-06"))).toEqual({
      key: "track.verdict.kept",
    });
    expect(trackVerdict(trackMonth(history, "2026-08", "2026-06"))).toEqual({
      key: "track.verdict.noIncome",
    });
    expect(
      trackVerdict({ received: 1, rows: [], missed: 1, since: undefined }),
    ).toEqual({
      key: "track.verdict.one",
    });
  });
});
