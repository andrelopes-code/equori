import { describe, expect, it } from "vitest";

import { planIDs, planProgress } from "@/features/cards/card-plans";

const money = (amount: number) => ({ amount, currency: "BRL" });

function line(plan: string | undefined) {
  return {
    transaction_id: "t",
    date: "2026-10-01",
    description: "x",
    card_role: "charge" as const,
    amount: money(-100),
    ...(plan === undefined
      ? {}
      : { installment: { plan_id: plan, number: 1, count: 3 } }),
  };
}

describe("planIDs", () => {
  it("lists each plan of the statements once, in the order first met", () => {
    expect(
      planIDs([
        { postings: [line("p2"), line(undefined), line("p1")] },
        { postings: [line("p1"), line("p3")] },
      ]),
    ).toEqual(["p2", "p1", "p3"]);
  });
});

describe("planProgress", () => {
  it("counts the installments billed up to the open statement and what remains after it", () => {
    const plan = {
      id: "p",
      transaction_id: "t",
      account_id: "a",
      status: "active" as const,
      count: 4,
      installments: [
        {
          number: 1,
          statement: "2026-09",
          amount: money(2500),
          reversed: false,
        },
        {
          number: 2,
          statement: "2026-10",
          amount: money(2500),
          reversed: false,
        },
        {
          number: 3,
          statement: "2026-11",
          amount: money(2500),
          reversed: false,
        },
        {
          number: 4,
          statement: "2026-12",
          amount: money(2500),
          reversed: true,
        },
      ],
    };
    expect(planProgress(plan, "2026-10")).toEqual({
      billed: 2,
      remaining: money(2500),
      each: money(2500),
      last: "2026-12",
    });
  });
});

describe("planProgress without installments", () => {
  it("returns no amount", () => {
    const plan = {
      id: "p",
      transaction_id: "t",
      account_id: "a",
      status: "active" as const,
      count: 0,
      installments: [],
    };
    const progress = planProgress(plan, "2026-10");
    expect(progress.each).toBeUndefined();
    expect(progress.remaining).toBeUndefined();
  });
});
