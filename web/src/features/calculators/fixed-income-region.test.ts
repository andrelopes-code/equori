import { describe, expect, it } from "vitest";

import { fixedIncomeRules } from "@/features/calculators/fixed-income-region";

describe("fixedIncomeRules", () => {
  it("holds the Brazilian table of Lei 11.033/2004, art. 1", () => {
    const br = fixedIncomeRules("BR");
    expect(br).not.toBeNull();
    expect(
      [180, 181, 360, 361, 720, 721].map((days) => br?.taxBp(days)),
    ).toEqual([2250, 2000, 2000, 1750, 1750, 1500]);
    expect(br?.minimumDays).toBe(30);
    expect(br?.checkedOn).toBe("2026-10-26");
    expect(br?.sources.length).toBeGreaterThan(0);
  });

  it("has no rule for a region without a case", () => {
    expect(fixedIncomeRules("DE")).toBeNull();
  });
});
