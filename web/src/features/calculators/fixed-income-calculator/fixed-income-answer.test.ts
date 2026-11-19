import { describe, expect, it } from "vitest";

import {
  fixedIncomeAnswer,
  taxBasisPoints,
} from "@/features/calculators/fixed-income-calculator/fixed-income-answer";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";

describe("fixedIncomeAnswer", () => {
  const base = { amount: 1000000, annualRate: 0.12, days: 400, taxBp: 1750 };

  it("splits the yield into net and tax and gives the rate of the other kind", () => {
    const got = fixedIncomeAnswer({ ...base, exempt: false });

    expect(got?.gross).toBe(132238);
    expect(got?.tax).toBe(23142);
    expect(got?.net).toBe(109096);
    expect(got?.equivalent).toBeCloseTo(0.12 * (1 - 0.175), 10);
  });

  it("takes no tax from an exempt security and gives the taxed rate", () => {
    const got = fixedIncomeAnswer({ ...base, exempt: true });

    expect(got?.tax).toBe(0);
    expect(got?.net).toBe(132238);
    expect(got?.equivalent).toBeCloseTo(0.12 / (1 - 0.175), 10);
  });

  it.each([
    { name: "no amount", input: { ...base, amount: null } },
    { name: "an amount of zero", input: { ...base, amount: 0 } },
    { name: "no rate", input: { ...base, annualRate: null } },
    { name: "no days", input: { ...base, days: null } },
    { name: "no tax", input: { ...base, taxBp: null } },
  ])("is null with $name", ({ input }) => {
    expect(fixedIncomeAnswer({ ...input, exempt: false })).toBeNull();
  });
});

describe("taxBasisPoints", () => {
  const cases = [
    {
      name: "the rule of the region",
      rules: "BR",
      days: 400,
      typed: null,
      want: 1750,
    },
    {
      name: "the rule over the typed rate",
      rules: "DE",
      days: 400,
      typed: 0.1,
      want: 2637.5,
    },
    {
      name: "the typed rate without a rule",
      rules: "ES",
      days: 400,
      typed: 0.175,
      want: 1750,
    },
    {
      name: "no typed rate without a rule",
      rules: "ES",
      days: 400,
      typed: null,
      want: null,
    },
    {
      name: "a typed rate of 100%",
      rules: "ES",
      days: 400,
      typed: 1,
      want: null,
    },
    { name: "no days", rules: "BR", days: null, typed: null, want: null },
  ] as const;

  it.each(cases)("takes $name", ({ rules, days, typed, want }) => {
    expect(taxBasisPoints(fixedIncomeRules(rules), days, typed)).toBe(want);
  });
});
