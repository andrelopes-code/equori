import { describe, expect, it } from "vitest";

import {
  positionResult,
  positionTotals,
} from "@/features/instruments/position-totals";

const position = (
  quantity: number,
  cost: number,
  average: string | undefined,
  value: number | undefined,
  currency = "BRL",
) => ({
  account_id: "a",
  instrument: "PETR4",
  quantity: { amount: quantity, currency: "PETR4" },
  cost_basis: { amount: cost, currency },
  ...(average === undefined ? {} : { average_cost: average }),
  ...(value === undefined
    ? {}
    : { market_value: { amount: value, currency: "BRL" } }),
});

describe("positionResult", () => {
  it.each([
    [position(100, 300000, "30", 400000), { amount: 100000, bp: 3333 }],
    [position(100, 200000, "20", 150000), { amount: -50000, bp: -2500 }],
    [position(100, 0, undefined, 150000), { amount: 150000, bp: null }],
  ])("reads the result of %j", (p, result) => {
    expect(positionResult(p)).toEqual(result);
  });

  it("is empty without a price", () => {
    expect(positionResult(position(100, 300000, "30", undefined))).toBeNull();
  });

  it("is empty when the cost and the value hold different currencies", () => {
    expect(
      positionResult(position(100, 300000, "30", 400000, "USD")),
    ).toBeNull();
  });
});

describe("positionTotals", () => {
  const gain = position(100, 300000, "30", 400000);
  const flat = position(50, 200000, "40", 200000);
  const rows = [gain, flat];

  it("adds quantity, cost and value and reads the result", () => {
    const totals = positionTotals(rows, "BRL");

    expect(totals?.quantity).toEqual({ amount: 150, currency: "PETR4" });
    expect(totals?.cost).toEqual({ amount: 500000, currency: "BRL" });
    expect(totals?.marketValue).toEqual({ amount: 600000, currency: "BRL" });
    expect(totals?.result).toEqual({ amount: 100000, bp: 2000 });
    expect(totals?.blocked).toBeNull();
    expect(totals?.averageCost).toBeCloseTo(33.3333, 4);
  });

  it("names the missing price when a position has none", () => {
    const totals = positionTotals(
      [gain, position(50, 200000, "40", undefined)],
      "BRL",
    );

    expect(totals?.marketValue).toBeNull();
    expect(totals?.result).toBeNull();
    expect(totals?.blocked).toBe("price");
  });

  it("names the currencies when cost and value differ", () => {
    const totals = positionTotals(
      [position(10, 5000, "5", 90000, "USD")],
      "USD",
    );

    expect(totals?.result).toBeNull();
    expect(totals?.blocked).toBe("currency");
    expect(totals?.cost).toEqual({ amount: 5000, currency: "USD" });
  });

  it("draws no average cost in a currency other than the quote", () => {
    expect(positionTotals(rows, "USD")?.averageCost).toBeNull();
  });

  it("draws no average cost when a position has none", () => {
    const totals = positionTotals(
      [gain, position(0, 0, undefined, undefined)],
      "BRL",
    );

    expect(totals?.averageCost).toBeNull();
  });

  it("is empty without positions", () => {
    expect(positionTotals([], "BRL")).toBeNull();
  });
});
