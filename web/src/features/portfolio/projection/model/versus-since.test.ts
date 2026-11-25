import { describe, expect, it } from "vitest";

import { versusSince } from "@/features/portfolio/projection/model/versus-since";

const baseline = { date: "2025-10-15", value: 10000 };
const changes = [{ month: "2025-10-01", amount: 1000 }];

describe("versusSince", () => {
  it("compares the points after the baseline month with the plan line", () => {
    const points = [
      { date: "2025-10-31", value: 10500, flows: 0 },
      { date: "2025-11-30", value: 11500, flows: 1000 },
      { date: "2025-12-31", value: 10800, flows: 500 },
    ];

    // The October point is in the month of the baseline and is left out. The line of a plan with
    // no return grows by the contribution: 10000 + 1000 = 11000, then 12000. Difference
    // 10800 - 12000 = -1200, share -0.1, one month above (11500 > 11000), mean flows 750.
    expect(versusSince(baseline, changes, 0, 0, points)).toEqual({
      since: points.slice(1),
      line: [11000, 12000],
      figures: {
        difference: -1200,
        differenceShare: -0.1,
        monthsAbove: 1,
        months: 2,
        averageContribution: 750,
      },
    });
  });

  it("returns null while no point follows the baseline month", () => {
    const points = [{ date: "2025-10-31", value: 10500, flows: 0 }];

    expect(versusSince(baseline, changes, 0, 0, points)).toBeNull();
  });
});
