import { describe, expect, it } from "vitest";

import {
  amountNeeded,
  sustainedIncome,
  wayShare,
} from "@/features/portfolio/projection/model/amount-needed";

describe("amountNeeded", () => {
  it("is the present value of the income over the months", () => {
    // 1000 * (1 - 1.01^-2) / 0.01 = 1000 * 1.9703951 = 1970.3951 (1970.40 to 2 places).
    expect(amountNeeded(1000, 2, 0.01)).toBeCloseTo(1970.3951, 4);
  });

  it("is the income times the months at a rate of zero", () => {
    expect(amountNeeded(1000, 2, 0)).toBe(2000);
  });

  it("grows above income times months at a negative rate", () => {
    // 1000 * (1 - 0.99^-2) / -0.01 = 1000 * 2.0304... : 0.99^-2 = 1.020304, (1 - 1.020304) / -0.01
    expect(amountNeeded(1000, 2, -0.01)).toBeCloseTo(2030.4, 1);
  });
});

describe("amountNeeded with a tax on the gain", () => {
  it("PX14: covers the gross of each withdrawal", () => {
    // Half of the value is gain in both months: 900 / 0.9 = 1000 each.
    expect(
      amountNeeded(900, 2, 0, { rate: 0.2, basisShare: 0.5, inflation: 0 }),
    ).toBeCloseTo(2000, 6);
  });

  it("PX14: reads the gain share after the growth of the month", () => {
    // One month at 25%: the basis is 0.5 of 1.25, a gain share of 0.6; 900 / 0.88 / 1.25.
    expect(
      amountNeeded(900, 1, 0.25, { rate: 0.2, basisShare: 0.5, inflation: 0 }),
    ).toBeCloseTo(818.1818, 3);
  });

  it("is the untaxed amount when nothing is gain", () => {
    expect(
      amountNeeded(900, 2, 0, { rate: 0.2, basisShare: 1, inflation: 0 }),
    ).toBeCloseTo(1800, 6);
  });
});

describe("sustainedIncome", () => {
  it("is the value times the yearly rate over 12", () => {
    // 1200000 * 400 / 10000 / 12 = 48000 / 12
    expect(sustainedIncome(1200000, 400)).toBe(4000);
  });
});

describe("wayShare", () => {
  it("is today over the amount needed", () => {
    expect(wayShare(155671.48, 1607628.55)).toBeCloseTo(0.0968, 4);
  });

  it.each([null, 0])("is null when the amount needed is %s", (needed) => {
    expect(wayShare(155671.48, needed)).toBeNull();
  });
});
