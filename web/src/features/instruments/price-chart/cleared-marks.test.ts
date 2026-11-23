import { describe, expect, it } from "vitest";

import { withClearedMarks } from "@/features/instruments/price-chart/cleared-marks";

describe("withClearedMarks", () => {
  it("empties the band and the lines of a series that has none", () => {
    expect(withClearedMarks({ grid: 1, series: [{ type: "line" }] })).toEqual({
      grid: 1,
      series: [
        { type: "line", markArea: { data: [] }, markLine: { data: [] } },
      ],
    });
  });

  it("keeps the band of a chosen period and the lines of an annotation", () => {
    const marks = { markArea: { data: [1] }, markLine: { data: [2] } };

    expect(withClearedMarks({ series: [marks] })).toEqual({ series: [marks] });
  });

  it("leaves an option without series as it is", () => {
    const option = { grid: {} };

    expect(withClearedMarks(option)).toBe(option);
  });
});
