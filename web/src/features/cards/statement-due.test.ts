import { describe, expect, it } from "vitest";

import { paidShare, statementDue } from "@/features/cards/statement-due";

describe("statementDue", () => {
  it.each([
    ["2026-10-25", "2026-10-29", -4, "danger"],
    ["2026-10-29", "2026-10-29", 0, "warning"],
    ["2026-11-01", "2026-10-29", 3, "warning"],
    ["2026-11-02", "2026-10-29", 4, "info"],
    ["2026-11-05", "2026-10-29", 7, "info"],
  ])("due %s seen on %s is %i days away, %s", (due, today, days, status) => {
    expect(statementDue(due, today)).toEqual({ days, status });
  });
});

describe("paidShare", () => {
  it("adds what was due and what was paid across the statements", () => {
    const unpaid = [statement(200000, 50000), statement(80000, 80000)] as never;

    expect(paidShare(unpaid)).toEqual({ paid: 150000, total: 280000 });
  });

  it("counts no payment on a statement owing more than its amount due", () => {
    const unpaid = [statement(100000, 120000)] as never;

    expect(paidShare(unpaid)).toEqual({ paid: 0, total: 100000 });
  });
});

function statement(due: number, unpaid: number) {
  return {
    amount_due: { amount: due, currency: "BRL" },
    unpaid: { amount: unpaid, currency: "BRL" },
  };
}
