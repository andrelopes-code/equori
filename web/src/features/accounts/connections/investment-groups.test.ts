import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { investmentGroups } from "@/features/accounts/connections/investment-groups";

type Investment = components["schemas"]["ExternalInvestment"];
type Movement = components["schemas"]["InvestmentMovement"];

function movement(
  id: string,
  date: string,
  proposal: string,
  state = "pending",
): Movement {
  return {
    id,
    investment_id: "i",
    kind: "buy",
    date,
    amount: { amount: 100, currency: "BRL" },
    state,
    proposal,
  } as Movement;
}

describe("investmentGroups", () => {
  it("MB1: batches pending application, contribution and sale by date, not income", () => {
    const groups = investmentGroups([
      {
        id: "i",
        name: "CDB",
        movements: [
          movement("c", "2026-11-12", "contribution"),
          movement("i", "2026-11-10", "income"),
          movement("d", "2026-11-13", "sale", "confirmed"),
          movement("a", "2026-11-03", "application"),
        ],
      } as Investment,
    ]);

    expect(groups.map((g) => g.movements.map((m) => m.id))).toEqual([
      ["a", "i", "c", "d"],
    ]);
    expect(groups.map((g) => g.batch.map((m) => m.id))).toEqual([["a", "c"]]);
  });

  it("orders the groups by name and drops an investment without movements", () => {
    const groups = investmentGroups([
      {
        id: "2",
        name: "LCI",
        movements: [movement("x", "2026-11-01", "none")],
      },
      { id: "3", name: "Empty", movements: [] },
      {
        id: "1",
        name: "CDB",
        movements: [movement("y", "2026-11-01", "none")],
      },
    ] as Investment[]);

    expect(groups.map((g) => g.name)).toEqual(["CDB", "LCI"]);
  });
});
