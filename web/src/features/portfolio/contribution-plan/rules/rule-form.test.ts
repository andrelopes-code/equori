import { describe, expect, it } from "vitest";

import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  emptyForm,
  formOfRule,
  ruleOfForm,
  yearProblem,
} from "@/features/portfolio/contribution-plan/rules/rule-form";
import type { RuleForm } from "@/features/portfolio/contribution-plan/rules/rule-form";

describe("ruleOfForm", () => {
  it("writes no condition for a form of every choice any", () => {
    expect(ruleOfForm(emptyForm)).toEqual({});
  });

  it("writes the chosen conditions only", () => {
    const form: RuleForm = {
      ...emptyForm,
      type: "fixed_income",
      kind: "inflation",
      from: 2031,
      liquidity: "no",
    };

    expect(ruleOfForm(form)).toEqual({
      instrument_type: "fixed_income",
      return_kind: "inflation",
      matures_from_year: 2031,
      daily_liquidity: false,
    });
  });

  it("drops the return kind a type other than fixed income does not take", () => {
    const form: RuleForm = {
      ...emptyForm,
      type: "stock",
      kind: "rate",
    };

    expect(ruleOfForm(form)).toEqual({ instrument_type: "stock" });
  });

  it("round-trips a rule through its form", () => {
    const rule: Rule = {
      instrument_type: "fund",
      subtypes: ["fii"],
      quote_currency: "USD",
      matures_to_year: 2040,
      guarantee: "uncovered",
    };

    expect(ruleOfForm(formOfRule(rule))).toEqual(rule);
  });
});

describe("yearProblem", () => {
  it.each([
    [{ from: 1899, to: null }, "yearRange"],
    [{ from: null, to: 2201 }, "yearRange"],
    [{ from: 2035, to: 2030 }, "yearOrder"],
    [{ from: 2030, to: 2030 }, undefined],
    [{ from: null, to: null }, undefined],
  ])("%j gives %s", (years, expected) => {
    expect(yearProblem(years)).toBe(expected);
  });
});
