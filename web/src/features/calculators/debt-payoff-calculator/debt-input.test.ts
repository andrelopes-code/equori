import { describe, expect, it } from "vitest";

import { readDebts } from "@/features/calculators/debt-payoff-calculator/debt-input";

const row = (rate: string, minimum = "5000") => ({
  name: "Visa",
  balance: "100000",
  rate,
  minimum,
  account: undefined,
});

describe("readDebts", () => {
  it("reads a monthly rate as typed", () => {
    expect(readDebts([row("3")], "month", false)).toEqual([
      { name: "Visa", balance: 100000, rate: 0.03, minimum: 5000 },
    ]);
  });

  it("divides a nominal annual rate by 12", () => {
    // 12% / 12 = 1% a month.
    expect(readDebts([row("12")], "year", true)?.[0]?.rate).toBeCloseTo(0.01);
  });

  it("is null when any row is incomplete", () => {
    expect(readDebts([row("3"), row("")], "month", false)).toBeNull();
    expect(readDebts([row("3", "")], "month", false)).toBeNull();
  });

  it("is null without rows", () => {
    expect(readDebts([], "month", false)).toBeNull();
  });
});
