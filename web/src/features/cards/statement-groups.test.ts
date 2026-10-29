import { describe, expect, it } from "vitest";

import { groupStatements, neighbours } from "@/features/cards/statement-groups";
import type { Statement } from "@/features/cards/statement-groups";

function statement(reference: string, status: Statement["status"]): Statement {
  const zero = { amount: 0, currency: "BRL" };
  return {
    id: `id-${reference}`,
    account_id: "card",
    reference,
    closing_date: `${reference}-05`,
    due_date: `${reference}-12`,
    opening: zero,
    charges: zero,
    credits: zero,
    amount_due: zero,
    payments: zero,
    unpaid: zero,
    settled: zero,
    prior_credits: zero,
    early_payments: zero,
    billed_amount: zero,
    open_amount: zero,
    status,
    reconciled: false,
  };
}

const mixed = [
  statement("2026-10", "paid"),
  statement("2026-11", "closed"),
  statement("2026-12", "open"),
  statement("2027-01", "open"),
];

describe("groupStatements", () => {
  it("splits around the earliest open statement", () => {
    const groups = groupStatements(mixed);
    expect(groups.current?.reference).toBe("2026-12");
    expect(groups.upcoming.map((s) => s.reference)).toEqual(["2027-01"]);
    expect(groups.past.map((s) => s.reference)).toEqual(["2026-11", "2026-10"]);
  });

  it("puts every statement in past, newest first, when none is open", () => {
    const groups = groupStatements([
      statement("2026-09", "paid"),
      statement("2026-10", "paid"),
    ]);
    expect(groups.current).toBeUndefined();
    expect(groups.upcoming).toEqual([]);
    expect(groups.past.map((s) => s.reference)).toEqual(["2026-10", "2026-09"]);
  });

  it("returns empty groups for no statements", () => {
    expect(groupStatements([])).toEqual({ upcoming: [], past: [] });
  });
});

describe("neighbours", () => {
  it("returns the ids of the adjacent statements", () => {
    expect(neighbours(mixed, "id-2026-11")).toEqual({
      previous: "id-2026-10",
      next: "id-2026-12",
    });
  });

  it("has no previous for the first statement", () => {
    expect(neighbours(mixed, "id-2026-10")).toEqual({ next: "id-2026-11" });
  });

  it("has no next for the last statement", () => {
    expect(neighbours(mixed, "id-2027-01")).toEqual({ previous: "id-2026-12" });
  });

  it("returns nothing for an unknown id", () => {
    expect(neighbours(mixed, "missing")).toEqual({});
  });
});
