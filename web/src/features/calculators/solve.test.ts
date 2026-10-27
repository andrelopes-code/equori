import { describe, expect, it } from "vitest";

import { bisect } from "@/features/calculators/solve";

describe("bisect", () => {
  it("finds x for f(x) = target within the tolerance", () => {
    const x = bisect((v) => v * v, 0, 10, 2);
    expect(x).not.toBeNull();
    expect(Math.abs((x ?? 0) ** 2 - 2)).toBeLessThan(0.000001 * 2);
  });

  it("solves a decreasing function", () => {
    const x = bisect((v) => 10 - v, 0, 10, 4);
    expect(x).toBeCloseTo(6, 5);
  });

  it("returns null for a target outside the range", () => {
    expect(bisect((v) => v * v, 0, 10, 200)).toBeNull();
  });
});
