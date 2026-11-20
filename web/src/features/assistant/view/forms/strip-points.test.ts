import { describe, expect, it } from "vitest";

import {
  lanes,
  ratioPosition,
} from "@/features/assistant/view/forms/strip-points";

describe("ratioPosition", () => {
  it("places the median, a tenth and twenty times on the log axis", () => {
    expect(ratioPosition(1000)).toBe(0);
    expect(ratioPosition(10000)).toBeCloseTo((1 / Math.log10(200)) * 100);
    expect(ratioPosition(200000)).toBe(100);
    expect(ratioPosition(900000)).toBe(100);
  });
});

describe("lanes", () => {
  it("moves a point that would cover its neighbour to another lane", () => {
    expect(lanes([10, 11, 30, 11.5, 50])).toEqual([0, -7, 0, 7, 0]);
  });
});
