import { describe, expect, it } from "vitest";

import { ratesAnswer } from "@/features/calculators/rates-calculator/rates-answer";

describe("ratesAnswer", () => {
  const cases = [
    {
      name: "a monthly rate gives the annual one",
      input: { rate: 0.01, period: "month", inflation: null, ofIndex: null },
      want: { equivalent: 0.12682503013196977, real: null, ofIndex: null },
    },
    {
      name: "an annual rate gives the monthly one and the rate after inflation",
      input: { rate: 0.1, period: "year", inflation: 0.04, ofIndex: null },
      want: {
        equivalent: 0.007975,
        real: 0.057692,
        ofIndex: null,
      },
    },
    {
      name: "the rate of the index stands without a rate",
      input: { rate: null, period: "year", inflation: 0.04, ofIndex: 0.12 },
      want: { equivalent: null, real: null, ofIndex: 0.12 },
    },
  ] as const;

  it.each(cases)("$name", ({ input, want }) => {
    const got = ratesAnswer(input);

    expect(got.equivalent).toBeCloseTo(want.equivalent ?? 0, 5);
    expect(got.equivalent === null).toBe(want.equivalent === null);
    expect(got.real === null).toBe(want.real === null);
    if (want.real !== null) expect(got.real).toBeCloseTo(want.real, 5);
    expect(got.ofIndex).toBe(want.ofIndex);
  });
});
