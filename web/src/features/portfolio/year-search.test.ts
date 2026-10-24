import { describe, expect, it } from "vitest";

import { validateYearSearch } from "@/features/portfolio/year-search";

describe("validateYearSearch", () => {
  it("keeps a year of the contract's range, as a number or as text", () => {
    expect(validateYearSearch({ year: 2025 })).toEqual({ year: 2025 });
    expect(validateYearSearch({ year: "2025" })).toEqual({ year: 2025 });
    expect(validateYearSearch({ year: 1900 })).toEqual({ year: 1900 });
    expect(validateYearSearch({ year: 2200 })).toEqual({ year: 2200 });
  });

  it("drops a year out of range, fractional or not a number", () => {
    for (const year of [1899, 2201, 1800, 2025.5, "abc", "", null])
      expect(validateYearSearch({ year })).toEqual({});
  });

  it("keeps the income tab only", () => {
    expect(validateYearSearch({ tab: "income" })).toEqual({ tab: "income" });
    expect(validateYearSearch({ tab: "realized" })).toEqual({});
  });
});
