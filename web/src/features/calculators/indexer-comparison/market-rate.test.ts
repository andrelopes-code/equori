import { describe, expect, it } from "vitest";

import {
  curveRateAt,
  impliedInflation,
} from "@/features/calculators/indexer-comparison/market-rate";

describe("curveRateAt", () => {
  const points = [
    { maturity: "2028-01-01", rate: 0.128 },
    { maturity: "2030-01-01", rate: 0.134 },
  ];

  it("is linear by calendar days between the surrounding points", () => {
    // 366 of 731 days.
    expect(curveRateAt(points, "2029-01-01")).toBeCloseTo(0.131004, 6);
  });

  it("takes the rate of a point on its own date", () => {
    expect(curveRateAt(points, "2028-01-01")).toBe(0.128);
  });

  it.each([["2031-01-01"], ["2027-06-01"]])(
    "has no rate for %s, outside the points",
    (maturity) => {
      expect(curveRateAt(points, maturity)).toBeNull();
    },
  );

  it("has no rate without points", () => {
    expect(curveRateAt([], "2029-01-01")).toBeNull();
  });
});

describe("impliedInflation", () => {
  it("divides the nominal factor by the real factor", () => {
    expect(impliedInflation(0.13, 0.07)).toBeCloseTo(0.056075, 6);
  });
});
