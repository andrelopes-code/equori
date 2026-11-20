import { describe, expect, it } from "vitest";

import { compareRows } from "@/features/assistant/view/forms/bars/compare-rows";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("compareRows", () => {
  it("draws both periods against the largest value of either", () => {
    const rows = compareRows({
      periods: [
        { from: "2026-09-01", to: "2026-09-30" },
        { from: "2026-10-01", to: "2026-10-31" },
      ],
      items: [
        {
          account_id: "a",
          name: "Mercado",
          before: brl(118460),
          after: brl(149700),
        },
        {
          account_id: "b",
          name: "Lazer",
          before: brl(52000),
          after: brl(30200),
        },
      ],
      difference: brl(9440),
    });

    expect(rows[0]).toMatchObject({
      beforeWidth: (118460 / 149700) * 100,
      afterWidth: 100,
      delta: 31240,
    });
    expect(rows[1]).toMatchObject({
      afterWidth: (30200 / 149700) * 100,
      delta: -21800,
    });
  });
});
