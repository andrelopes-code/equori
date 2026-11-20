import { describe, expect, it } from "vitest";

import { waterfallBars } from "@/features/assistant/view/forms/waterfall-steps";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("waterfallBars", () => {
  it("floats each flow from the level before it", () => {
    const bars = waterfallBars({
      month: "2026-10",
      steps: [
        { kind: "start", amount: brl(482000) },
        { kind: "income", amount: brl(1240000) },
        { kind: "expense", amount: brl(-819105) },
        { kind: "other", amount: brl(0) },
        { kind: "end", amount: brl(902895) },
      ],
    });
    const top = 1722000;

    expect(bars[0]).toMatchObject({
      from: 0,
      height: (482000 / top) * 100,
      total: true,
    });
    expect(bars[1]).toMatchObject({
      from: (482000 / top) * 100,
      height: (1240000 / top) * 100,
    });
    expect(bars[2]?.from).toBeCloseTo((902895 / top) * 100);
    expect(bars[2]?.height).toBeCloseTo((819105 / top) * 100);
    expect(bars[3]?.height).toBe(0);
    expect(bars[4]).toMatchObject({ from: 0, total: true });
  });
});
