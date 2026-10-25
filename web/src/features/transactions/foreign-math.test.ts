import { describe, expect, it } from "vitest";

import {
  chargeOf,
  differenceBP,
  ratioText,
} from "@/features/transactions/foreign-math";
import { grossOf } from "@/features/transactions/trade-math";

describe("foreign purchase arithmetic", () => {
  // S16: 100.00 USD at 5.4830 with a charge of 350 bp.
  it("converts and charges as the server does", () => {
    const converted = grossOf(10000, 2, "5.4830", 2);
    expect(converted).toBe(54830);
    expect(chargeOf(converted, 350)).toBe(1919);
  });

  it("rounds half to even", () => {
    // 0.5 and 1.5 and 2.5 minor units of a charge of 50 bp.
    expect(chargeOf(100, 50)).toBe(0);
    expect(chargeOf(300, 50)).toBe(2);
    expect(chargeOf(500, 50)).toBe(2);
    expect(chargeOf(54830, 0)).toBe(0);
  });
});

describe("exchange arithmetic", () => {
  // S17: 1,000.00 USD for 5,483.00 BRL.
  it("gives the effective rate in both directions", () => {
    expect(ratioText(548300, 2, 100000, 2)).toBe("5.4830");
    expect(ratioText(100000, 2, 548300, 2)).toBe("0.182382");
  });

  it("compares with a stored price in basis points", () => {
    expect(differenceBP("5.4830", "5.5000")).toBe(-31);
    expect(differenceBP("5.5000", "5.5000")).toBe(0);
    expect(differenceBP("5.5550", "5.5000")).toBe(100);
  });
});
