import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  goalSubtree,
  holdsInvestments,
  monthlyEquivalent,
  scheduledContribution,
} from "@/features/goals/goal-contribution";

type Schedule = components["schemas"]["Schedule"];
type Account = components["schemas"]["Account"];

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };
const account = (id: string, parent?: string): Account =>
  ({
    ...base,
    id,
    name: id,
    class: "asset",
    kind: "checking",
    ...(parent === undefined ? {} : { parent_id: parent }),
  }) as Account;

const accounts = [
  account("checking"),
  account("broker"),
  account("cash", "broker"),
  account("shares", "broker"),
];

function schedule(
  over: Partial<Schedule> & {
    amount?: number;
    currency?: string;
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
  } = {},
): Schedule {
  const {
    amount = 100000,
    currency = "BRL",
    frequency = "monthly",
    interval = 1,
    ...rest
  } = over;
  return {
    id: "s1",
    kind: "savings",
    calendar: "br_banking",
    account_id: "checking",
    counterpart_id: "cash",
    description: "Monthly savings",
    match_tolerance_bp: 0,
    grace_days: 0,
    terms: [
      {
        effective_from: "2026-01-01",
        amount: { amount, currency },
        recurrence: { frequency, interval, start: "2026-01-05" },
      },
    ],
    pauses: [],
    ...rest,
  } as Schedule;
}

const goal = {
  account_ids: ["broker"],
  target: { amount: 1, currency: "BRL" },
};

describe("goal contribution", () => {
  it("turns each recurrence into an amount per month", () => {
    const r = (
      frequency: "daily" | "weekly" | "monthly" | "yearly",
      interval: number,
    ) => ({ frequency, interval, start: "2026-01-05" }) as const;
    expect(monthlyEquivalent(100000, r("monthly", 1))).toBe(100000);
    expect(monthlyEquivalent(300000, r("monthly", 3))).toBe(100000);
    expect(monthlyEquivalent(120000, r("yearly", 1))).toBe(10000);
    expect(monthlyEquivalent(10000, r("weekly", 1))).toBe(43333);
    expect(monthlyEquivalent(1000, r("daily", 1))).toBe(30417);
  });

  it("holds the goal's accounts and their sub-accounts", () => {
    expect([...goalSubtree(goal.account_ids, accounts)].sort()).toEqual([
      "broker",
      "cash",
      "shares",
    ]);
  });

  it("sums savings and transfers into the goal from outside it", () => {
    const schedules = [
      schedule(),
      schedule({
        id: "s2",
        kind: "transfer",
        counterpart_id: "shares",
        amount: 50000,
      }),
    ];
    expect(scheduledContribution(goal, schedules, accounts, "2026-10-17")).toBe(
      150000,
    );
  });

  it("leaves out what is not an aporte of this goal", () => {
    const left = [
      schedule({ id: "other", counterpart_id: "checking" }),
      schedule({ id: "inside", account_id: "cash", counterpart_id: "shares" }),
      schedule({ id: "bill", kind: "bill" }),
      schedule({ id: "usd", currency: "USD" }),
      schedule({ id: "ended", ends_on: "2026-10-01" }),
      schedule({
        id: "paused",
        pauses: [{ from: "2026-10-01", to: "2026-10-31" }],
      }),
    ];
    expect(scheduledContribution(goal, left, accounts, "2026-10-17")).toBe(0);
  });

  it("reads the terms in force today", () => {
    const changed = schedule({
      terms: [
        {
          effective_from: "2026-01-01",
          amount: { amount: 100000, currency: "BRL" },
          recurrence: {
            frequency: "monthly",
            interval: 1,
            start: "2026-01-05",
            adjustment: "none",
          },
        },
        {
          effective_from: "2026-09-01",
          amount: { amount: 200000, currency: "BRL" },
          recurrence: {
            frequency: "monthly",
            interval: 1,
            start: "2026-09-05",
            adjustment: "none",
          },
        },
        {
          effective_from: "2027-01-01",
          amount: { amount: 900000, currency: "BRL" },
          recurrence: {
            frequency: "monthly",
            interval: 1,
            start: "2027-01-05",
            adjustment: "none",
          },
        },
      ],
    });
    expect(scheduledContribution(goal, [changed], accounts, "2026-10-17")).toBe(
      200000,
    );
  });

  it("tells a goal that holds investments from one that holds cash", () => {
    const broker = { ...account("broker"), kind: "brokerage" } as Account;
    const reserve = { ...account("reserve"), yield_mode: "auto" } as Account;
    const all = [
      account("checking"),
      broker,
      account("cash", "broker"),
      reserve,
    ];
    expect(holdsInvestments(["checking"], all)).toBe(false);
    expect(holdsInvestments(["broker"], all)).toBe(true);
    expect(holdsInvestments(["reserve"], all)).toBe(true);
  });
});
