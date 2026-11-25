import { describe, expect, it } from "vitest";

import { versusFigures } from "@/features/portfolio/projection/model/versus-figures";

describe("versusFigures", () => {
  it("compares the recorded points with the plan line", () => {
    const points = [
      { value: 110, flows: 5 },
      { value: 120, flows: 7 },
    ];

    // Difference 120 - 125 = -5; share -5 / 125 = -0.04; month 1 above (110 > 105), month 2
    // below; average flows of the months under the plan (5 + 7) / 2 = 6.
    expect(versusFigures(points, [105, 125], points)).toEqual({
      difference: -5,
      differenceShare: -0.04,
      monthsAbove: 1,
      months: 2,
      averageContribution: 6,
    });
  });

  it("averages only the months under the plan, and none of them is no average", () => {
    const points = [
      { value: 110, flows: 5 },
      { value: 120, flows: 7 },
    ];

    expect(
      versusFigures(points, [105, 125], points.slice(1))?.averageContribution,
    ).toBe(7);
    expect(
      versusFigures(points, [105, 125], [])?.averageContribution,
    ).toBeNull();
  });

  it("counts a month equal to the line as not above", () => {
    expect(
      versusFigures([{ value: 100, flows: 0 }], [100], [])?.monthsAbove,
    ).toBe(0);
  });

  it("is null without points", () => {
    expect(versusFigures([], [], [])).toBeNull();
  });
});
