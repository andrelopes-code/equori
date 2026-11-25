import { describe, expect, it } from "vitest";

import {
  expectedInflation,
  longestRealRate,
} from "@/features/portfolio/projection/plan-section/plan-references";

const curve = {
  id: "br_tesouro_ipca",
  kind: "real",
  index: "ipca",
  currency: "BRL",
  baseDate: "2026-11-19",
  points: [
    { maturity: "2040-08-15", rate: 0.0754 },
    { maturity: "2032-08-15", rate: 0.0782 },
  ],
};

describe("longestRealRate", () => {
  it("PX17: is the longest point of the real curve in the currency of the plan", () => {
    const nominal = { ...curve, id: "br_tesouro", kind: "nominal" };

    expect(longestRealRate([nominal, curve], "BRL")).toEqual({
      index: "ipca",
      year: 2040,
      rate: 0.0754,
    });
  });

  it.each([
    { name: "no curve in the currency", curves: [curve], currency: "USD" },
    {
      name: "a curve with no point",
      curves: [{ ...curve, points: [] }],
      currency: "BRL",
    },
    {
      name: "a curve over no index",
      curves: [{ ...curve, index: null }],
      currency: "BRL",
    },
  ])("PX17: is null for $name", ({ curves, currency }) => {
    expect(longestRealRate(curves, currency)).toBeNull();
  });
});

describe("expectedInflation", () => {
  it("PX17: is the last point of the survey", () => {
    expect(
      expectedInflation("ipca", [
        { date: "2030-12-31", rate: 0.0395 },
        { date: "2027-12-31", rate: 0.0512 },
      ]),
    ).toEqual({ index: "ipca", year: 2030, rate: 0.0395 });
    expect(expectedInflation("ipca", [])).toBeNull();
  });
});
