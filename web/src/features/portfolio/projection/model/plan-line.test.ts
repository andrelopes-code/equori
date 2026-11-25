import { describe, expect, it } from "vitest";

import { planLine } from "@/features/portfolio/projection/model/plan-line";

describe("planLine", () => {
  it("grows the baseline by the nominal monthly rate and adds the contribution in force", () => {
    const baseline = { date: "2026-10-15", value: 100000 };
    const changes = [{ month: "2026-10-01", amount: 1000 }];

    // Nominal rate: 1268.25 bp a year is 1% a month. 100000 * 1.01 + 1000 = 102000;
    // 102000 * 1.01 + 1000 = 104020.
    const line = planLine(baseline, changes, 0, 1268.25, [
      "2026-11",
      "2026-12",
    ]);

    expect(line).toHaveLength(2);
    expect(line[0]).toBeCloseTo(102000, 2);
    expect(line[1]).toBeCloseTo(104020, 2);
  });

  it("compounds the real return and the inflation", () => {
    const baseline = { date: "2026-10-15", value: 100000 };

    // (1 + 0.05)(1 + 0.1) = 1.155 a year; 100000 * 1.155 over 12 months.
    const line = planLine(
      baseline,
      [],
      500,
      1000,
      Array.from({ length: 12 }, () => "2026-11"),
    );

    expect(line[11]).toBeCloseTo(115500, 4);
  });

  it("follows a change of contribution", () => {
    const baseline = { date: "2026-10-15", value: 0 };
    const changes = [
      { month: "2026-11-01", amount: 1000 },
      { month: "2026-12-01", amount: 500 },
    ];

    // Rate 0: the line is the running sum of the contributions in force.
    expect(
      planLine(baseline, changes, 0, 0, ["2026-11", "2026-12", "2027-01"]),
    ).toEqual([1000, 1500, 2000]);
  });
});
