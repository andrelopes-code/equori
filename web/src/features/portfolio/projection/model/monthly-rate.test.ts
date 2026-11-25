import { describe, expect, it } from "vitest";

import { monthlyRate } from "@/features/portfolio/projection/model/monthly-rate";

describe("monthlyRate", () => {
  it("converts the annual rate to the monthly rate that compounds back to it", () => {
    // 1.01^12 is 1.12682503, so 1268.25 bp is 0.01 within 5e-9.
    expect(monthlyRate(1268.25)).toBeCloseTo(0.01, 8);
  });

  it("is zero for a rate of zero", () => {
    expect(monthlyRate(0)).toBe(0);
  });

  it("is negative for a negative rate", () => {
    // (1 - 0.1)^(1/12) - 1 = 0.9^(0.083333) - 1 = -0.008742...
    expect(monthlyRate(-1000)).toBeCloseTo(-0.0087416, 6);
  });
});
