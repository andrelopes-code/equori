import { describe, expect, it } from "vitest";

import {
  effectiveAnnualCost,
  impliedRate,
  monthlyDates,
  presentValue,
} from "@/features/calculators/credit-math";
import { roundHalfEven } from "@/features/calculators/round";

// The CET is shown in percent with 2 decimals (CMN 4.881, art. 4).
const twoDecimals = (c: number | null) =>
  c === null ? null : roundHalfEven(c * 10000) / 10000;

describe("credit math", () => {
  it("finds the rate implied by installments against a cash price", () => {
    const j = impliedRate(100000, 10, 11000, false);
    expect(typeof j).toBe("number");
    // The solver stops within 0.000001 of the cash price, about 2e-7 of the rate.
    expect(Math.abs((j as number) - 0.01771543)).toBeLessThan(5e-7);
  });

  it("counts the first installment at once when it is due now", () => {
    const later = impliedRate(100000, 10, 11000, false) as number;
    const now = impliedRate(100000, 10, 11000, true) as number;
    expect(now).toBeGreaterThan(later);
  });

  it("discounts the installments at a chosen rate", () => {
    expect(presentValue(10, 11000, 0.01, false)).toBe(104184);
    expect(presentValue(10, 11000, 0, true)).toBe(110000);
  });

  it("no interest", () => {
    expect(impliedRate(100000, 10, 10000, false)).toBe("no_interest");
    expect(impliedRate(100000, 10, 9000, false)).toBe("no_interest");
  });

  it("adds calendar months, a missing day becoming the month's last", () => {
    expect(monthlyDates("2026-01-31", 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("computes the effective annual cost of CMN 4.881", () => {
    const flows = monthlyDates("2026-02-10", 12).map((date) => ({
      date,
      amount: 88849,
    }));
    expect(
      twoDecimals(effectiveAnnualCost(1000000, 20000, "2026-01-10", flows)),
    ).toBe(0.1714);
    expect(
      twoDecimals(effectiveAnnualCost(1000000, 0, "2026-01-10", flows)),
    ).toBe(0.1274);
  });
});
