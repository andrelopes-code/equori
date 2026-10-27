import { describe, expect, it } from "vitest";

import {
  fitToRoom,
  fromShare,
  largestRemainder,
  planShare,
  planTotals,
  suggestion,
} from "@/features/planning/plan-math";
import type { PlanDraftRow } from "@/features/planning/plan-math";

const brl = (amount: number) => ({ amount, currency: "BRL" });

function row(
  id: string,
  draft: number,
  extra: Partial<PlanDraftRow> = {},
): PlanDraftRow {
  return {
    category_id: id,
    planned: brl(draft),
    last_month: brl(0),
    average: brl(0),
    counted: true,
    draft,
    ...extra,
  };
}

describe("largestRemainder", () => {
  it("gives the units left over to the largest weights", () => {
    expect(largestRemainder(3, [5, 4, 3, 2, 1])).toEqual([1, 1, 1, 0, 0]);
  });

  it("breaks ties by position", () => {
    expect(largestRemainder(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });

  it("returns zeros when no weight is above zero", () => {
    expect(largestRemainder(500, [0, 0])).toEqual([0, 0]);
  });

  it("keeps the sum exact for amounts past the float range", () => {
    const parts = largestRemainder(9_007_199_254_740_000, [3, 3, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9_007_199_254_740_000);
  });
});

describe("fitToRoom", () => {
  it("scales the proposals down to the room", () => {
    expect(
      fitToRoom(
        new Map([
          ["a", 600],
          ["b", 400],
        ]),
        500,
      ),
    ).toEqual(
      new Map([
        ["a", 300],
        ["b", 200],
      ]),
    );
  });

  it("leaves proposals that fit", () => {
    const proposed = new Map([
      ["a", 600],
      ["b", 400],
    ]);
    expect(fitToRoom(proposed, 2000)).toEqual(proposed);
  });

  it("zeroes the proposals when there is no room", () => {
    expect(fitToRoom(new Map([["a", 600]]), -10)).toEqual(new Map([["a", 0]]));
  });
});

describe("shares", () => {
  it("reads an amount as basis points of the reference", () => {
    expect(planShare(283000, 850000)).toBe(3329);
  });

  it("has no share without a reference above zero", () => {
    expect(planShare(1, 0)).toBeUndefined();
  });

  it("turns basis points back into an amount", () => {
    expect(fromShare(1200, 850000)).toBe(102000);
    expect(fromShare(1, 5)).toBe(0);
    expect(fromShare(1000, 5)).toBe(1);
  });
});

describe("suggestion", () => {
  it("proposes the basis where it differs from the draft", () => {
    const rows = [
      row("same", 450, { average: brl(450) }),
      row("zero", 0),
      row("up", 180, { average: brl(205), last_month: brl(192) }),
      row("new", 0, { average: brl(21000) }),
    ];
    expect(suggestion(rows, "average")).toEqual(
      new Map([
        ["up", 205],
        ["new", 21000],
      ]),
    );
    expect(suggestion(rows, "last_month")).toEqual(
      new Map([
        ["same", 0],
        ["up", 192],
      ]),
    );
  });
});

describe("planTotals", () => {
  it("subtracts commitments and counted budgets from the reference", () => {
    const rows = [
      row("housing", 283000),
      row("food", 150000),
      row("transport", 50000),
      row("leisure", 39000),
      row("health", 48000),
      row("market", 110000, { counted: false }),
    ];
    expect(
      planTotals(rows, { reference: 850000, installments: 64000, savings: 0 }),
    ).toEqual({ planned: 570000, unassigned: 216000 });
  });

  it("has no unassigned amount without a reference", () => {
    expect(
      planTotals([row("a", 1)], {
        reference: undefined,
        installments: 0,
        savings: 0,
      }),
    ).toEqual({ planned: 1, unassigned: undefined });
  });
});
