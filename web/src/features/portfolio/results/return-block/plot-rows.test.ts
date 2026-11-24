import { describe, expect, it } from "vitest";

import { historySeries } from "@/testing/portfolio-api";

import {
  plotRows,
  timeFormat,
} from "@/features/portfolio/results/return-block/plot-rows";

describe("plotRows", () => {
  it("joins the portfolio and the indexes by date and reads null where a series has no point", () => {
    const rows = plotRows(
      [...historySeries.points, { date: "2026-01-31", value: 1, flows: 0 }],
      [
        {
          index: "cdi",
          period: "day",
          points: [
            { date: "2025-12-31", return_bp: 100 },
            { date: "2025-11-30", return_bp: 50 },
          ],
        },
      ],
    );

    expect(rows).toEqual([
      { date: "2025-11-30", portfolio: 0.01, cdi: 0.005 },
      { date: "2025-12-31", portfolio: 0.0302, cdi: 0.01 },
    ]);
  });

  it("keeps a date held by an index only", () => {
    const rows = plotRows(
      [],
      [
        {
          index: "cdi",
          period: "day",
          points: [{ date: "2025-12-31", return_bp: 100 }],
        },
      ],
    );

    expect(rows).toEqual([{ date: "2025-12-31", portfolio: null, cdi: 0.01 }]);
  });
});

describe("timeFormat", () => {
  it.each([
    [184, { day: "2-digit", month: "short" }],
    [185, { month: "short", year: "2-digit" }],
    [1100, { month: "short", year: "2-digit" }],
    [1101, { year: "numeric" }],
  ])("%i days", (days, expected) => {
    expect(timeFormat(days)).toEqual(expected);
  });
});
