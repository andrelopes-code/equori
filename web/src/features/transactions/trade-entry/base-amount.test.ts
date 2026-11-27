import { describe, expect, it } from "vitest";

import {
  baseAmount,
  tradeBaseAmount,
} from "@/features/transactions/trade-entry/base-amount";

describe("baseAmount", () => {
  // FC3: each part converted on its own, half to even, then summed.
  it("converts each part before summing", () => {
    expect(baseAmount([500000, 100], 2, "5.20", 2)).toBe(2600520);
  });

  it("rounds a half to the even minor unit", () => {
    expect(baseAmount([1], 2, "2.50", 2)).toBe(2);
    expect(baseAmount([3], 2, "2.50", 2)).toBe(8);
    expect(baseAmount([1, 1], 2, "2.50", 2)).toBe(4);
  });

  it("keeps the sign of each part", () => {
    expect(baseAmount([-500000, -100], 2, "5.20", 2)).toBe(-2600520);
  });
});

describe("tradeBaseAmount", () => {
  const parts = { gross: 500000, fees: 100, taxes: 50 };

  it("converts the cash effect of a purchase and of a sale", () => {
    expect(tradeBaseAmount("buy", parts, 2, "5.20", 2)).toBe(-2600520);
    expect(tradeBaseAmount("sell", parts, 2, "5.20", 2)).toBe(2599220);
  });

  it("converts the cost of an opening", () => {
    expect(tradeBaseAmount("opening", parts, 2, "5.20", 2)).toBe(2600520);
  });
});
