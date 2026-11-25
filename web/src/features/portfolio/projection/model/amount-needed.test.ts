import { describe, expect, it } from "vitest";

import {
  amountNeeded,
  sustainedIncome,
  sustainedTotal,
  wayShare,
} from "@/features/portfolio/projection/model/amount-needed";

describe("amountNeeded", () => {
  it("is the present value of the income over the months", () => {
    // 1000 * (1 - 1.01^-2) / 0.01 = 1000 * 1.9703951 = 1970.3951 (1970.40 to 2 places).
    expect(amountNeeded(Array<number>(2).fill(1000), 0.01)).toBeCloseTo(
      1970.3951,
      4,
    );
  });

  it("is the income times the months at a rate of zero", () => {
    expect(amountNeeded(Array<number>(2).fill(1000), 0)).toBe(2000);
  });

  it("grows above income times months at a negative rate", () => {
    // 1000 * (1 - 0.99^-2) / -0.01 = 1000 * 2.0304... : 0.99^-2 = 1.020304, (1 - 1.020304) / -0.01
    expect(amountNeeded(Array<number>(2).fill(1000), -0.01)).toBeCloseTo(
      2030.4,
      1,
    );
  });
});

describe("amountNeeded with a tax on the gain", () => {
  it("PX14: covers the gross of each withdrawal", () => {
    // Half of the value is gain in both months: 900 / 0.9 = 1000 each.
    expect(
      amountNeeded(Array<number>(2).fill(900), 0, {
        rate: 0.2,
        basisShare: 0.5,
        inflation: 0,
      }),
    ).toBeCloseTo(2000, 6);
  });

  it("PX14: reads the gain share after the growth of the month", () => {
    // One month at 25%: the basis is 0.5 of 1.25, a gain share of 0.6; 900 / 0.88 / 1.25.
    expect(
      amountNeeded(Array<number>(1).fill(900), 0.25, {
        rate: 0.2,
        basisShare: 0.5,
        inflation: 0,
      }),
    ).toBeCloseTo(818.1818, 3);
  });

  it("is the untaxed amount when nothing is gain", () => {
    expect(
      amountNeeded(Array<number>(2).fill(900), 0, {
        rate: 0.2,
        basisShare: 1,
        inflation: 0,
      }),
    ).toBeCloseTo(1800, 6);
  });
});

describe("amountNeeded of amounts that change", () => {
  it("PX5: is the present value of each month", () => {
    // 100 / 1.01 + 300 / 1.01^2 = 99.00990 + 294.08881.
    expect(amountNeeded([100, 300], 0.01)).toBeCloseTo(393.0987, 4);
    expect(amountNeeded([100, 0, 300], 0)).toBe(400);
  });

  it("PX5, PX14: is zero when nothing is due, with or without a tax", () => {
    const tax = { rate: 0.2, basisShare: 0.5, inflation: 0 };

    expect(amountNeeded([0, 0], 0.01)).toBe(0);
    expect(amountNeeded([0, 0], 0.01, tax)).toBe(0);
  });
});

describe("sustainedTotal", () => {
  it("PX20: is the highest total the value and the other incomes pay", () => {
    // 36 X - 12 * 200 = 13000: X = 427.7778, above the 200 of the second year.
    const others = [
      ...Array<number>(12).fill(0),
      ...Array<number>(12).fill(200),
      ...Array<number>(12).fill(0),
    ];

    expect(sustainedTotal(13000, others, 0)).toBeCloseTo(15400 / 36, 6);
  });

  it("PX20: what exceeds the total in a month is not added to the others", () => {
    // Only the first month asks the portfolio: 1300, not (1300 + 5000) / 2.
    expect(sustainedTotal(1300, [0, 5000], 0)).toBeCloseTo(1300, 6);
  });

  it("PX20: is the lowest other income without a value", () => {
    expect(sustainedTotal(0, [300, 200], 0.01)).toBeCloseTo(200, 6);
  });

  it("PX14, PX20: is net of the tax", () => {
    // All of the value is gain: 1000 pays 800 net, over two months beside 100 each.
    const tax = { rate: 0.2, basisShare: 0, inflation: 0 };

    expect(sustainedTotal(1000, [100, 100], 0, tax)).toBeCloseTo(500, 6);
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
