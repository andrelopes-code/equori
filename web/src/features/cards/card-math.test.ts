import { describe, expect, it } from "vitest";

import {
  anticipation,
  financingInterest,
  purchaseInterest,
  usedShare,
} from "@/features/cards/card-math";

describe("purchaseInterest", () => {
  it("S07 returns count x installment - total", () => {
    expect(purchaseInterest(10, 22254, 200000)).toBe(22540);
  });

  it("returns a negative value when the installments sum below the total", () => {
    expect(purchaseInterest(3, 33333, 100000)).toBe(-1);
  });
});

describe("financingInterest", () => {
  it("S11 returns count x installment - unpaid", () => {
    expect(financingInterest(6, 36340, 200000)).toBe(18040);
  });
});

describe("anticipation", () => {
  it("S15 sums the installments and subtracts the amount paid", () => {
    expect(anticipation(Array<number>(6).fill(22254), 126000)).toEqual({
      sum: 133524,
      discount: 7524,
    });
  });

  it("returns zero for no installments", () => {
    expect(anticipation([], 0)).toEqual({ sum: 0, discount: 0 });
  });
});

describe("usedShare", () => {
  it.each([
    [100000, 500000, 20],
    [600000, 500000, 100],
    [100000, undefined, 0],
    [-5000, 500000, 0],
    [100000, 0, 0],
    [1, 3, 33],
    [2, 3, 66],
    [499999, 500000, 99],
    [1, 1000, 0],
  ] as const)("usedShare(%i, %s) is %i", (debt, limit, want) => {
    expect(usedShare(debt, limit)).toBe(want);
  });
});
