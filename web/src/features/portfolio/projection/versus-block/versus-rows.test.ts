import { describe, expect, it } from "vitest";

import { versusRows } from "@/features/portfolio/projection/versus-block/versus-rows";

describe("versusRows", () => {
  it("fills between the lines in the ahead range above and the behind range below", () => {
    const baseline = { date: "2025-10-15", value: 10000 };
    const since = [
      { date: "2025-11-30", value: 11000, flows: 0 },
      { date: "2025-12-31", value: 10800, flows: 0 },
    ];

    // The first row starts both lines on the baseline value with empty ranges. November is above
    // the line (110 over 105): ahead 105 to 110, behind 105 to 105. December is below (108 under
    // 112): ahead 112 to 112, behind 108 to 112.
    expect(versusRows(baseline, since, [10500, 11200], 2)).toEqual([
      {
        date: "2025-10-15",
        value: 100,
        plan: 100,
        aheadLower: 100,
        aheadUpper: 100,
        behindLower: 100,
        behindUpper: 100,
      },
      {
        date: "2025-11-30",
        value: 110,
        plan: 105,
        aheadLower: 105,
        aheadUpper: 110,
        behindLower: 105,
        behindUpper: 105,
      },
      {
        date: "2025-12-31",
        value: 108,
        plan: 112,
        aheadLower: 112,
        aheadUpper: 112,
        behindLower: 108,
        behindUpper: 112,
      },
    ]);
  });
});
