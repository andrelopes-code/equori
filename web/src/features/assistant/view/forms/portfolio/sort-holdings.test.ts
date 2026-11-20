import { describe, expect, it } from "vitest";

import { sortHoldings } from "@/features/assistant/view/forms/portfolio/sort-holdings";

const row = (
  instrument: string,
  value: number,
  result: number,
  weight: number,
) => ({
  account: "XP",
  instrument,
  quantity: "1",
  cost: { amount: value, currency: "BRL" },
  value: { amount: value, currency: "BRL" },
  result_bp: result,
  weight_bp: weight,
});

describe("sortHoldings", () => {
  const rows = [
    row("A", 100, -50, 2000),
    row("B", 300, 900, 6000),
    row("C", 100, 2100, 2000),
  ];

  it("orders by result, largest first", () => {
    expect(sortHoldings(rows, "result").map((r) => r.instrument)).toEqual([
      "C",
      "B",
      "A",
    ]);
  });

  it("orders by value and keeps ties in their order", () => {
    expect(sortHoldings(rows, "value").map((r) => r.instrument)).toEqual([
      "B",
      "A",
      "C",
    ]);
  });
});
