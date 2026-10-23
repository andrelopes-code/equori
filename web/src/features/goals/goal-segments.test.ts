import { describe, expect, it } from "vitest";

import { goalSegments } from "@/features/goals/goal-segments";

describe("goal segments", () => {
  it("fills one segment per 5 per cent, rounded down", () => {
    expect(goalSegments(0)).toBe(0);
    expect(goalSegments(499)).toBe(0);
    expect(goalSegments(500)).toBe(1);
    expect(goalSegments(3361)).toBe(6);
  });

  it("fills the last segment only when the goal is reached", () => {
    expect(goalSegments(9999)).toBe(19);
    expect(goalSegments(10000)).toBe(20);
  });
});
