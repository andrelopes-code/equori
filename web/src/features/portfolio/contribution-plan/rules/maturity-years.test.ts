import { describe, expect, it } from "vitest";

import { maturityYears } from "@/features/portfolio/contribution-plan/rules/maturity-years";

describe("maturityYears", () => {
  it("lists this year and the forty after it", () => {
    const years = maturityYears("2026-10-17", []);

    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(2066);
    expect(years).toHaveLength(41);
  });

  it("keeps a chosen year outside the span, in order", () => {
    const years = maturityYears("2026-10-17", [2020, null, 2080]);

    expect(years[0]).toBe(2020);
    expect(years[1]).toBe(2026);
    expect(years.at(-1)).toBe(2080);
    expect(years).toHaveLength(43);
  });
});
