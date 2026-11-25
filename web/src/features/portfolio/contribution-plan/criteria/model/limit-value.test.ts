import { describe, expect, it } from "vitest";

import type { LimitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import {
  limitCriteria,
  limitCriterion,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import {
  limitBounds,
  limitHolds,
  limitNumber,
  limitText,
} from "@/features/portfolio/contribution-plan/criteria/model/limit-value";

const of = (key: string): LimitCriterion => {
  const found = limitCriterion(key);
  if (found === undefined) throw new Error(key);

  return found;
};

describe("limit values", () => {
  it.each([
    ["roe_min", "0.12", 12],
    ["roe_min", "0.1234", 12.34],
    ["roe_min", "-0.05", -5],
    ["price_earnings_max", "15", 15],
    ["net_debt_equity_max", "0", 0],
    ["positive_years_min", "5", 5],
  ])("%s stores %s and draws %d", (key, limit, value) => {
    expect(limitNumber(of(key), limit)).toBe(value);
    expect(limitText(of(key), value)).toBe(limit);
  });

  it("reads an empty limit as an empty field", () => {
    expect(limitNumber(of("roe_min"), "")).toBeNull();
    expect(limitText(of("roe_min"), null)).toBe("");
    expect(limitText(of("roe_min"), Number.NaN)).toBe("");
  });

  it.each([
    [12.34567, "0.1235"],
    [0.001, "0"],
    [-0.001, "0"],
    [100, "1"],
  ])("keeps four decimals of %d%%", (value, limit) => {
    expect(limitText(of("roe_min"), value)).toBe(limit);
  });

  it.each([
    ["price_earnings_max", "", false],
    ["price_earnings_max", "0", false],
    ["price_earnings_max", "0.01", true],
    ["price_earnings_max", "1000", true],
    ["price_earnings_max", "1000.1", false],
    ["positive_years_min", "2.5", false],
    ["positive_years_min", "5", true],
    ["positive_years_min", "6", false],
    ["roe_min", "-1", true],
    ["roe_min", "-1.01", false],
  ])("%s with the limit %s holds: %s", (key, limit, holds) => {
    expect(limitHolds(of(key), limit)).toBe(holds);
  });

  it("draws the bounds in the unit of the field", () => {
    expect(limitBounds(of("roe_min"))).toEqual({ min: -100, max: 1000 });
    expect(limitBounds(of("positive_years_min"))).toEqual({ min: 1, max: 5 });
  });

  it("names ten criteria, each once", () => {
    expect(new Set(limitCriteria.map((c) => c.key)).size).toBe(10);
    expect(limitCriterion("piotroski_p1")).toBeUndefined();
    expect(limitCriterion("")).toBeUndefined();
  });
});
