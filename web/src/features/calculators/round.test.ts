import { describe, expect, it } from "vitest";

import { roundHalfEven } from "@/features/calculators/round";

describe("roundHalfEven", () => {
  it.each([
    [0.5, 0],
    [1.5, 2],
    [2.5, 2],
    [-2.5, -2],
    [112682.5, 112682],
    [112682.51, 112683],
  ])("rounds %d to %d", (x, want) => {
    expect(roundHalfEven(x)).toBe(want);
  });

  it("returns 0 for -0", () => {
    expect(Object.is(roundHalfEven(-0.4), 0)).toBe(true);
  });
});
