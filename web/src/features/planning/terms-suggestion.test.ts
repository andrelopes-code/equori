import { describe, expect, it } from "vitest";

import { suggestTermsAmount } from "@/features/planning/terms-suggestion";

describe("suggestTermsAmount", () => {
  it.each([
    {
      name: "each of the 3 differs by less than 100 bp",
      actuals: [275000, 274900, 275100],
      want: null,
    },
    {
      name: "the 3 sit below the expected amount",
      actuals: [250000, 251000, 249000],
      want: 250000,
    },
    {
      name: "the direction is mixed",
      actuals: [250000, 290000, 249000],
      want: null,
    },
    { name: "fewer than 3", actuals: [250000, 251000], want: null },
    {
      name: "a fourth, older actual is ignored",
      actuals: [250000, 251000, 249000, 275200],
      want: 250000,
    },
  ])("returns $want when $name", ({ actuals, want }) => {
    expect(suggestTermsAmount(275200, actuals)).toBe(want);
  });
});
