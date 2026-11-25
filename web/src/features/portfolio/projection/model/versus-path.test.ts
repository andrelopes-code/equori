import { describe, expect, it } from "vitest";

import { versusPath } from "@/features/portfolio/projection/model/versus-path";

const baseline = { date: "2025-10-15", value: 10000 };
const changes = [{ month: "2025-10-01", amount: 1000 }];

describe("versusPath", () => {
  it("runs the line from the first recorded month, through the baseline month, to the last", () => {
    const points = [
      { date: "2025-09-30", value: 9000, flows: 0 },
      { date: "2025-10-31", value: 10500, flows: 800 },
      { date: "2025-11-30", value: 11500, flows: 1200 },
      { date: "2025-12-31", value: 10800, flows: 500 },
    ];

    // A plan with no return. The line starts on 9000; October, the baseline month, takes the
    // recorded 800: 9800; November and December take the planned 1000: 10800, 11800. Difference
    // 10800 - 11800 = -1000; two of the three months after the first are above (10500 > 9800,
    // 11500 > 10800); the mean of the flows after the baseline month is (1200 + 500) / 2 = 850.
    expect(versusPath(baseline, changes, 0, 0, points)).toEqual({
      points,
      line: [9000, 9800, 10800, 11800],
      figures: {
        difference: -1000,
        differenceShare: -1000 / 11800,
        monthsAbove: 2,
        months: 3,
        averageContribution: 850,
      },
    });
  });

  it("compares a plan saved this month over the whole history, with no average contribution", () => {
    const points = [
      { date: "2025-09-30", value: 9000, flows: 0 },
      { date: "2025-10-31", value: 10500, flows: 800 },
    ];

    expect(versusPath(baseline, changes, 0, 0, points)?.figures).toEqual({
      difference: 700,
      differenceShare: 700 / 9800,
      monthsAbove: 1,
      months: 1,
      averageContribution: null,
    });
  });

  it("returns null under two recorded months", () => {
    const points = [{ date: "2025-10-31", value: 10500, flows: 0 }];

    expect(versusPath(baseline, changes, 0, 0, points)).toBeNull();
  });
});
