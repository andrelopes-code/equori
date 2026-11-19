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

  it("scales the positive components to the net cost, the remainder on the last", () => {
    const got = ownAnswer(home);
    if (got.kind !== "solved") throw new Error("expected a solved answer");

    // The positive components total 7,250,000; the net is 5,250,000. Each part is
    // floor(component * 5,250,000 / 7,250,000): 3,620,689, 362,068, 543,103 and 724,137, which
    // add to 5,249,997. The remainder of 3 goes to the last positive part: 724,140.
    expect(got.parts).toEqual([3_620_689, 362_068, 0, 543_103, 0, 724_140]);
    expect(got.parts.reduce((sum, part) => sum + part, 0)).toBe(got.own);
  });

  it("draws no bar when the appreciation exceeds the costs", () => {
    // Appreciation of 20% is -10,000,000; the other components total 7,250,000: the net is
    // -2,750,000.
    const got = ownAnswer({
      ...home,
      rates: { ...home.rates, appreciation: 0.2 },
    });
    if (got.kind !== "solved") throw new Error("expected a solved answer");

    expect(got.own).toBe(-2_750_000);
    expect(got.parts).toEqual([0, 0, 0, 0, 0, 0]);
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
