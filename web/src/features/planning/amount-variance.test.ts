import { describe, expect, it } from "vitest";

import { amountVariance } from "@/features/planning/amount-variance";

describe("amountVariance", () => {
  it.each([
    { expected: 275200, actual: 275142, want: { bp: -2, differs: true } },
    { expected: 275200, actual: 275200, want: { bp: 0, differs: false } },
    { expected: 10000, actual: 12500, want: { bp: 2500, differs: true } },
    { expected: 0, actual: 500, want: { bp: 0, differs: true } },
  ])("compares $actual with $expected", ({ expected, actual, want }) => {
    expect(amountVariance(expected, actual)).toEqual(want);
  });
});
