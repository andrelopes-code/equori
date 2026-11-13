import { describe, expect, it } from "vitest";

import { seriesTrend } from "@/features/instruments/price-trend/series-trend";

describe("seriesTrend", () => {
  it.each([
    ["a rise", [10, 11, 12.5], { first: 10, direction: "in" }],
    ["a fall", [10, 9, 8], { first: 10, direction: "out" }],
    [
      "the same price at both ends",
      [10, 12, 10],
      { first: 10, direction: "none" },
    ],
    [
      "gaps before the first price",
      [null, null, 10, 11, 12],
      { first: 10, direction: "in" },
    ],
  ])("reads %s", (_name, data, want) => {
    expect(seriesTrend(data)).toEqual({ data, ...want });
  });

  it("draws nothing below three prices", () => {
    expect(seriesTrend([null, null, 10, 11])).toBeNull();
    expect(seriesTrend([])).toBeNull();
  });
});
