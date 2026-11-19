import { describe, expect, it } from "vitest";

import {
  axisMax,
  barWidths,
} from "@/features/calculators/calculator-frame/axis";

describe("axisMax", () => {
  it.each([
    [102319789, 120000000],
    [35999966, 36000000],
    [100000000, 100000000],
    [0, 0],
  ])("rounds %i up to %i", (largest, expected) => {
    expect(axisMax(largest)).toBe(expected);
  });
});

describe("barWidths", () => {
  it("returns each part as a percent of the axis", () => {
    expect(barWidths([30000000, 72319789], 120000000)).toEqual([
      "25%",
      "60.26649083333333%",
    ]);
  });

  it("returns 0% for every part when the axis is zero", () => {
    expect(barWidths([5, 0], 0)).toEqual(["0%", "0%"]);
  });
});
