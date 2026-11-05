import { describe, expect, it } from "vitest";

import { quantile } from "@/features/forecast/quantile";

describe("quantile", () => {
  it.each([
    { values: [3, 1, 2], p: 0.5, want: 2 },
    { values: [1, 2, 3, 4], p: 0.5, want: 2.5 },
    { values: [1, 2, 3, 4, 5], p: 0.25, want: 2 },
    { values: [1, 2, 3, 4], p: 0.75, want: 3.25 },
    { values: [7], p: 0.25, want: 7 },
  ])("reads $p of $values as $want", ({ values, p, want }) => {
    expect(quantile(values, p)).toBe(want);
  });

  it("reads nothing as zero", () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});
