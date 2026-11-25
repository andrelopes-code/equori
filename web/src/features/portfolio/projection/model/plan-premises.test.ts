import { describe, expect, it } from "vitest";

import {
  premiseRanges,
  premisesFrom,
} from "@/features/portfolio/projection/model/plan-premises";

const rest = { withdrawalReturn: "", cautious: "", favorable: "", gainTax: "" };

describe("premisesFrom", () => {
  it("PJ7: leaves out the fields at rest", () => {
    expect(premisesFrom(rest, 500)).toEqual({});
  });

  it("PJ7: reads the typed values in basis points", () => {
    expect(
      premisesFrom(
        {
          withdrawalReturn: "-1",
          cautious: "3,5",
          favorable: "6.25",
          gainTax: "15",
        },
        500,
      ),
    ).toEqual({
      withdrawalReturnBp: -100,
      cautiousReturnBp: 350,
      favorableReturnBp: 625,
      gainTaxBp: 1500,
    });
  });

  it.each([
    { withdrawalReturn: "-10,01" },
    { withdrawalReturn: "30,01" },
    { cautious: "5" },
    { cautious: "-10,01" },
    { favorable: "5" },
    { favorable: "30,01" },
    { gainTax: "0" },
    { gainTax: "50,01" },
    { gainTax: "x" },
  ])("PJ7: refuses $withdrawalReturn$cautious$favorable$gainTax", (patch) => {
    expect(premisesFrom({ ...rest, ...patch }, 500)).toBeNull();
  });
});

describe("premiseRanges", () => {
  it("PJ7: names the range of each typed field outside it, around the plan's return", () => {
    expect(premiseRanges(rest, 500)).toEqual({});
    expect(
      premiseRanges(
        {
          withdrawalReturn: "31",
          cautious: "5",
          favorable: "5",
          gainTax: "51",
        },
        500,
      ),
    ).toEqual({
      withdrawalReturn: [-10, 30],
      cautious: [-10, 4.99],
      favorable: [5.01, 30],
      gainTax: [0.01, 50],
    });
  });

  it("names no case range while the plan's return is not a number", () => {
    expect(
      premiseRanges({ ...rest, cautious: "5", favorable: "5" }, null),
    ).toEqual({});
  });
});
