import { describe, expect, it } from "vitest";

import { budgetRows } from "@/features/assistant/view/forms/bars/budget-rows";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("budgetRows", () => {
  const rows = budgetRows({
    month: "2026-11",
    day: 19,
    days: 30,
    items: [
      {
        budget_id: "m",
        name: "Mercado",
        spent: brl(151230),
        limit: brl(140000),
        over: brl(11230),
      },
      {
        budget_id: "l",
        name: "Lazer",
        spent: brl(9500),
        limit: brl(40000),
        over: brl(0),
      },
    ],
  });

  it("scales every row to the largest of spent and limit", () => {
    expect(rows[0]).toMatchObject({
      fill: (140000 / 151230) * 100,
      tick: (140000 / 151230) * 100,
    });
    expect(rows[0]?.overWidth).toBeCloseTo((11230 / 151230) * 100);
    expect(rows[1]).toMatchObject({
      fill: (9500 / 151230) * 100,
      overWidth: 0,
    });
  });

  it("puts the pace mark at the day's share of the limit", () => {
    expect(rows[1]?.pace).toBeCloseTo((40000 / 151230) * 100 * (19 / 30));
  });

  it("draws no pace before the month starts", () => {
    const [row] = budgetRows({
      month: "2026-12",
      day: 0,
      days: 31,
      items: [
        {
          budget_id: "l",
          name: "Lazer",
          spent: brl(0),
          limit: brl(40000),
          over: brl(0),
        },
      ],
    });

    expect(row?.pace).toBeUndefined();
  });
});
