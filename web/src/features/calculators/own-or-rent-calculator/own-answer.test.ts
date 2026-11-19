import { describe, expect, it } from "vitest";

import { ownAnswer } from "@/features/calculators/own-or-rent-calculator/own-answer";

// Price 500,000.00 is 50,000,000 minor units. Forgone 10% = 5,000,000; property tax 1% = 500,000;
// deduction 0; maintenance 1.5% = 750,000; appreciation 4% = -2,000,000; risk premium 2% =
// 1,000,000. Owning costs 5,250,000 a year.
const home = {
  price: 50_000_000,
  rent: 4_800_000,
  rates: {
    riskFree: 0.1,
    propertyTax: 0.01,
    maintenance: 0.015,
    appreciation: 0.04,
    riskPremium: 0.02,
    deductibleTax: 0,
    mortgage: 0.11,
  },
};

describe("ownAnswer", () => {
  it("names the cheaper option and the yearly difference by integer subtraction", () => {
    expect(ownAnswer(home)).toMatchObject({
      kind: "solved",
      lead: "rent",
      own: 5_250_000,
      rent: 4_800_000,
      // 5,250,000 - 4,800,000.
      difference: 450_000,
      components: {
        forgone: 5_000_000,
        propertyTax: 500_000,
        deduction: 0,
        maintenance: 750_000,
        appreciation: -2_000_000,
        riskPremium: 1_000_000,
      },
    });
  });

  it("leads with owning when it costs less, by the absolute difference", () => {
    // 5,250,000 owning against 6,000,000 of rent: 750,000 less.
    expect(ownAnswer({ ...home, rent: 6_000_000 })).toMatchObject({
      lead: "own",
      difference: 750_000,
    });
  });

  it("is equal when both cost the same", () => {
    expect(ownAnswer({ ...home, rent: 5_250_000 })).toMatchObject({
      lead: "equal",
      difference: 0,
    });
  });

  it("draws a negative component as a zero part, keeping the order", () => {
    const got = ownAnswer(home);
    if (got.kind !== "solved") throw new Error("expected a solved answer");

    expect(got.parts).toEqual([5_000_000, 500_000, 0, 750_000, 0, 1_000_000]);
  });

  it("names every input still missing, in screen order", () => {
    expect(
      ownAnswer({
        price: null,
        rent: 4_800_000,
        rates: { ...home.rates, riskFree: null, mortgage: null },
      }),
    ).toEqual({ kind: "missing", missing: ["price", "riskFree", "mortgage"] });
  });
});
