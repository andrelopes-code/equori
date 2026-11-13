import { describe, expect, it } from "vitest";

import { holdingTrend } from "@/features/portfolio/holdings/holding-trend";

const point = (date: string, value: string) => ({ date, value });

describe("holdingTrend", () => {
  it.each([
    [
      "a rise",
      [
        point("2026-08-01", "10"),
        point("2026-09-01", "11"),
        point("2026-10-01", "12.5"),
      ],
      { data: [10, 11, 12.5], first: 10, direction: "in" },
    ],
    [
      "a fall",
      [
        point("2026-08-01", "10"),
        point("2026-09-01", "9"),
        point("2026-10-01", "8"),
      ],
      { data: [10, 9, 8], first: 10, direction: "out" },
    ],
    [
      "the same price at both ends",
      [
        point("2026-08-01", "10"),
        point("2026-09-01", "12"),
        point("2026-10-01", "10"),
      ],
      { data: [10, 12, 10], first: 10, direction: "none" },
    ],
  ])("reads %s", (_name, points, want) => {
    expect(holdingTrend(points)).toEqual(want);
  });

  it("draws nothing below three points", () => {
    expect(
      holdingTrend([point("2026-08-01", "10"), point("2026-09-01", "11")]),
    ).toBeNull();
    expect(holdingTrend([])).toBeNull();
  });

  it("orders the points by date", () => {
    expect(
      holdingTrend([
        point("2026-10-01", "12"),
        point("2026-08-01", "10"),
        point("2026-09-01", "11"),
      ]),
    ).toEqual({ data: [10, 11, 12], first: 10, direction: "in" });
  });
});
