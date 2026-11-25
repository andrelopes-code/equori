import { describe, expect, it } from "vitest";

import { planLine } from "@/features/portfolio/projection/model/plan-line";

describe("planLine", () => {
  it("grows the recorded flows at the plan's rate until the baseline month, then the plan", () => {
    const points = [
      { date: "2026-08-31", value: 100000, flows: 0 },
      { date: "2026-09-30", value: 0, flows: 2000 },
      { date: "2026-10-31", value: 0, flows: -500 },
      { date: "2026-11-30", value: 0, flows: 9999 },
    ];
    const changes = [{ month: "2026-10-01", amount: 1000 }];

    // Nominal rate: 1268.25 bp a year is 1% a month. The line starts on the first recorded value.
    // September and October (the baseline month) take the recorded flows:
    // 100000 * 1.01 + 2000 = 103000; 103000 * 1.01 - 500 = 103530. November takes the
    // contribution of the plan, raised one month with inflation from its change:
    // 103530 * 1.01 + 1000 * 1.01 = 105575.3.
    const line = planLine(points, "2026-10", changes, 0, 1268.25);

    expect(line).toHaveLength(4);
    expect(line[0]).toBe(100000);
    expect(line[1]).toBeCloseTo(103000, 2);
    expect(line[2]).toBeCloseTo(103530, 2);
    expect(line[3]).toBeCloseTo(105575.3, 2);
  });

  it("compounds the real return and the inflation", () => {
    const points = Array.from({ length: 13 }, () => ({
      date: "2026-11-30",
      value: 100000,
      flows: 0,
    }));

    // (1 + 0.05)(1 + 0.1) = 1.155 a year; 100000 * 1.155 over 12 months.
    const line = planLine(points, "2026-11", [], 500, 1000);

    expect(line[12]).toBeCloseTo(115500, 4);
  });

  it("follows a change of contribution after the baseline month", () => {
    const points = ["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31"].map(
      (date) => ({ date, value: 0, flows: 7 }),
    );
    const changes = [
      { month: "2026-11-01", amount: 1000 },
      { month: "2026-12-01", amount: 500 },
    ];

    // Rate 0: the line is the running sum of the contributions in force.
    expect(planLine(points, "2026-10", changes, 0, 0)).toEqual([
      0, 1000, 1500, 2000,
    ]);
  });

  it("PX7: raises a contribution with inflation from its change or the baseline month", () => {
    const points = ["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31"].map(
      (date) => ({ date, value: 0, flows: 0 }),
    );
    const changes = [
      { month: "2026-01-01", amount: 1000 },
      { month: "2026-12-01", amount: 500 },
    ];

    // A real return of 1/1.01 cancels the growth of the line, so each month is what it adds:
    // November 1000 * 1.01 (one month from the baseline month); December 500 (the month of its
    // change); January 500 * 1.01.
    const real = (1 / 1.1268250301319698 - 1) * 10000;
    const line = planLine(points, "2026-10", changes, real, 1268.250301319698);

    expect(line[1]).toBeCloseTo(1010, 6);
    expect(line[2]).toBeCloseTo(1510, 6);
    expect(line[3]).toBeCloseTo(2015, 6);
  });
});
