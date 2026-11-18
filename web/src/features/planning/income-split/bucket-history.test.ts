import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  cellStatus,
  targetKey,
  trackDetail,
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
    unallocated: brl(received - needs - free),
    retained: brl(0),
    buckets: [
      { id: "needs", real: brl(needs), goal_paid: brl(0), covered: brl(0) },
      { id: "free", real: brl(free), goal_paid: brl(0), covered: brl(0) },
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
        unallocated: brl(25000),
        retained: brl(0),
        buckets: [
          { id: "needs", real: brl(40000), goal_paid: brl(0), covered: brl(0) },
          { id: "free", real: brl(30000), goal_paid: brl(0), covered: brl(0) },
          { id: "extra", real: brl(5000), goal_paid: brl(0), covered: brl(0) },
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
      counted: 0,
      covered: 0,
      goalPaid: 0,
      deposited: undefined,
      withdrawn: undefined,
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
          unallocated: brl(100000),
          retained: brl(0),
          buckets: [],
        },
      ],
    };

    expect(trackMonth(ended, "2026-11", "2026-06")).toEqual({
      received: 100000,
      unallocated: 100000,
      retained: 0,
      rows: [],
      missed: undefined,
    });
  });
});

describe("trackMonth unallocated", () => {
  it("returns the unallocated income of the month on screen", () => {
    const rest: History = {
      ...history,
      months: history.months.map((m) =>
        m.month === "2026-10" ? { ...m, unallocated: brl(-21300) } : m,
      ),
    };

    expect(trackMonth(rest, "2026-10", "2026-06").unallocated).toBe(-21300);
    expect(trackMonth(rest, "2026-11", "2026-06").unallocated).toBe(0);
  });
});

// Planning coherence A254: a ceiling bucket is judged without what its accumulated balance and
// the goals paid, the goals bucket on its deposits.
describe("trackMonth verdict figures", () => {
  const goalsBucket = {
    ...buckets[1],
    id: "goals",
    name: "Goals",
    takes_savings: false,
    takes_goals: true,
  } as (typeof buckets)[number];
  const withGoals: History = {
    currency: "BRL",
    methods: [
      {
        from: "2026-06",
        buckets: [
          { ...buckets[0], share_bp: 5000 } as (typeof buckets)[number],
          { ...goalsBucket, share_bp: 5000 },
        ],
      },
    ],
    months: [
      {
        month: "2026-10",
        from: "2026-06",
        received: brl(100000),
        outside: brl(0),
        unallocated: brl(0),
        retained: brl(3000),
        buckets: [
          {
            id: "needs",
            real: brl(240000),
            goal_paid: brl(10000),
            covered: brl(190000),
          },
          {
            id: "goals",
            real: brl(-450000),
            goal_paid: brl(0),
            covered: brl(0),
            deposited: brl(50000),
            withdrawn: brl(500000),
          },
        ],
      },
    ],
  };

  it("judges a ceiling bucket without the covered and goal-paid spending", () => {
    const needs = trackMonth(withGoals, "2026-10", "2026-06").rows[0];

    // 2,400.00 − 100.00 − 1,900.00 = 400.00 against a target of 500.00.
    expect(needs?.cell.counted).toBe(40000);
    expect(needs?.status).toEqual({ kind: "left", amount: 10000 });
    expect(needs?.months[0]?.state).toBe("kept");
    expect(needs === undefined ? undefined : trackDetail(needs)).toEqual({
      key: "track.realBoth",
      amounts: { amount: 240000, covered: 190000, paid: 10000 },
    });
  });

  it("judges the goals bucket on its deposits", () => {
    const track = trackMonth(withGoals, "2026-10", "2026-06");
    const goals = track.rows[1];

    expect(goals?.real).toBe(-450000);
    expect(goals?.status).toEqual({ kind: "reached", amount: 50000 });
    expect(goals?.months[0]?.state).toBe("kept");
    expect(goals === undefined ? undefined : trackDetail(goals)).toEqual({
      key: "track.depositedWithdrawn",
      amounts: { deposited: 50000, withdrawn: 500000 },
    });
    expect(track.retained).toBe(3000);
    expect(track.missed).toBe(0);
  });

  it("writes the real amount and its share without other figures", () => {
    const needs = trackMonth(history, "2026-10", "2026-06").rows[0];

    expect(needs === undefined ? undefined : trackDetail(needs)).toEqual({
      key: "track.real",
      amounts: { amount: 90000 },
      shareBp: 9000,
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
      trackVerdict({
        received: 1,
        unallocated: 0,
        retained: 0,
        rows: [],
        missed: 1,
        since: undefined,
      }),
    ).toEqual({
      key: "track.verdict.one",
    });
  });
});

describe("cellStatus", () => {
  const cell = (target: number | undefined, real: number) => ({
    month: "2026-10",
    target,
    real,
    counted: real,
    covered: 0,
    goalPaid: 0,
    deposited: undefined,
    withdrawn: undefined,
    kept: undefined,
    state: "none" as const,
    changed: false,
  });

  it("reads a cell the way the row reads its month", () => {
    expect(cellStatus("ceiling", cell(3000, 2800))).toEqual({
      kind: "left",
      amount: 200,
    });
    expect(cellStatus("ceiling", cell(3000, 3200))).toEqual({
      kind: "over",
      amount: 200,
    });
    expect(cellStatus("savings", cell(2000, 1800))).toEqual({
      kind: "short",
      amount: 200,
    });
    expect(cellStatus("floor", cell(2000, 2500))).toEqual({
      kind: "reached",
      amount: 2500,
    });
    expect(cellStatus("goals", cell(2000, 500))).toEqual({
      kind: "toGo",
      amount: 1500,
    });
  });

  it("has no status without a target", () => {
    expect(cellStatus("ceiling", cell(undefined, 100))).toBeUndefined();
  });
});
