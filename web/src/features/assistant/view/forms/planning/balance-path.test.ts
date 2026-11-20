import { describe, expect, it } from "vitest";

import { balanceGeometry } from "@/features/assistant/view/forms/planning/balance-path";

const brl = (amount: number) => ({ amount, currency: "BRL" });

describe("balanceGeometry", () => {
  it("steps from the opening to each event and marks the lowest point", () => {
    const g = balanceGeometry({
      account: "Itaú",
      from: "2026-12-01",
      to: "2026-12-31",
      opening: brl(100000),
      points: [
        {
          date: "2026-12-16",
          description: "Aluguel",
          amount: brl(-80000),
          balance: brl(20000),
        },
      ],
      low: {
        date: "2026-12-16",
        description: "Aluguel",
        amount: brl(-80000),
        balance: brl(20000),
      },
    });

    expect(g.path).toBe("M0 0.0 H150.0 V96.0 H300");
    expect(g.low).toEqual({ x: 150, y: 96 });
    expect(g.zero).toBeUndefined();
  });

  it("draws the zero line when the balance goes below it", () => {
    const g = balanceGeometry({
      account: "Itaú",
      from: "2026-12-01",
      to: "2026-12-31",
      opening: brl(10000),
      points: [
        {
          date: "2026-12-11",
          description: "x",
          amount: brl(-20000),
          balance: brl(-10000),
        },
      ],
      low: {
        date: "2026-12-11",
        description: "x",
        amount: brl(-20000),
        balance: brl(-10000),
      },
    });

    expect(g.zero).toBe(60);
  });
});
