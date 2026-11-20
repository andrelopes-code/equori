import { describe, expect, it } from "vitest";

import { seriesCols } from "@/features/assistant/view/forms/charts/series-cols";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("seriesCols", () => {
  it("draws months against the largest and places the average", () => {
    const { cols, average } = seriesCols({
      months: [
        { month: "2026-09", amount: brl(732000), partial: false },
        { month: "2026-10", amount: brl(985000), partial: false },
        { month: "2026-11", amount: brl(511500), partial: true },
      ],
      average: brl(858500),
      focus: "2026-10",
    });

    expect(cols.map((c) => c.height)).toEqual([
      (732000 / 985000) * 100,
      100,
      (511500 / 985000) * 100,
    ]);
    expect(cols[1]?.focus).toBe(true);
    expect(cols[2]?.partial).toBe(true);
    expect(average).toBeCloseTo((858500 / 985000) * 100);
  });
});
