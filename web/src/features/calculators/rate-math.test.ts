import { describe, expect, it } from "vitest";

import {
  annualToMonthly,
  monthlyToAnnual,
  realRate,
} from "@/features/calculators/rate-math";

describe("rate math", () => {
  it("converts a monthly rate to an annual one (M5)", () => {
    expect(Math.abs(monthlyToAnnual(0.01) - 0.126825)).toBeLessThan(1e-6);
  });

  it("converts an annual rate to a monthly one (M5)", () => {
    expect(Math.abs(annualToMonthly(0.12) - 0.009489)).toBeLessThan(1e-6);
  });

  it("discounts inflation from a nominal rate (M6)", () => {
    expect(Math.abs(realRate(0.1, 0.04) - 0.057692)).toBeLessThan(1e-6);
  });
});
