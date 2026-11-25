import { describe, expect, it } from "vitest";

import { project } from "@/features/portfolio/projection/model/project";
import { yearRows } from "@/features/portfolio/projection/model/year-rows";

// The six months of project.test.ts: 2026-11 and 2026-12, then 2027-01 to 2027-04.
const rows = project({
  start: 100000,
  monthlyRate: 0.01,
  months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  changes: [{ month: "2026-11-01", amount: 1000 }],
  withdrawalFrom: "2027-02",
  income: 60000,
});

describe("yearRows", () => {
  it("sums each calendar year and carries the contributed total", () => {
    const years = yearRows(rows, "1994-03-10");

    expect(years).toHaveLength(2);
    // 2026: contributions 1000 + 1000, gains 1000 + 1020, value 104020; age on 2026-12-31 is 32.
    expect(years[0]).toMatchObject({
      year: 2026,
      age: 32,
      contributions: 2000,
      contributed: 2000,
    });
    expect(years[0]?.gains).toBeCloseTo(2020, 6);
    expect(years[0]?.withdrawals).toBe(0);
    expect(years[0]?.value).toBeCloseTo(104020, 6);
    // 2027: contribution 1000, gains 1040.2 + 1060.602 + 471.20802, withdrawals 60000 + 47592.01002,
    // value 0 (104020 + 1000 + 2572.01002 - 107592.01002); age on 2027-12-31 is 33.
    expect(years[1]).toMatchObject({
      year: 2027,
      age: 33,
      contributions: 1000,
      contributed: 3000,
    });
    expect(years[1]?.gains).toBeCloseTo(2572.01002, 5);
    expect(years[1]?.withdrawals).toBeCloseTo(107592.01002, 5);
    expect(years[1]?.value).toBe(0);
  });

  it("is empty without rows", () => {
    expect(yearRows([], "1994-03-10")).toEqual([]);
  });
});
