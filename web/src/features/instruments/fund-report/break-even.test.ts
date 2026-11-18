import { describe, expect, it } from "vitest";

import type { MarketCurve } from "@/features/calculators";

import {
  breakEvenGrowth,
  referenceRate,
} from "@/features/instruments/fund-report/break-even";

describe("breakEvenGrowth", () => {
  it.each([
    [0.08, 0.07, -0.009259],
    [0.06, 0.075, 0.014151],
    [0.07, 0.07, 0],
  ])("FR10 y %s r %s gives %s", (y, r, expected) => {
    expect(breakEvenGrowth(y, r)).toBeCloseTo(expected, 6);
  });
});

describe("referenceRate", () => {
  it("FR11 takes the latest maturity of the first real curve", () => {
    expect(referenceRate([nominal(), real()], "BRL")).toEqual({
      curve: "br_tesouro_ipca",
      maturity: "2045-05-15",
      baseDate: "2026-11-16",
      rate: 0.069,
    });
  });

  it("FR11 ignores a curve of another currency", () => {
    expect(referenceRate([nominal(), real()], "USD")).toBeNull();
  });

  it("FR11 without a real curve is null", () => {
    expect(referenceRate([nominal()], "BRL")).toBeNull();
  });

  it("FR11 without a point is null", () => {
    expect(
      referenceRate([nominal(), { ...real(), points: [] }], "BRL"),
    ).toBeNull();
  });
});

function nominal(): MarketCurve {
  return {
    id: "br_tesouro_prefixado",
    kind: "nominal",
    index: null,
    currency: "BRL",
    baseDate: "2026-11-16",
    points: [{ maturity: "2031-01-01", rate: 0.13 }],
  };
}

function real(): MarketCurve {
  return {
    id: "br_tesouro_ipca",
    kind: "real",
    index: "ipca",
    currency: "BRL",
    baseDate: "2026-11-16",
    points: [
      { maturity: "2029-05-15", rate: 0.071 },
      { maturity: "2045-05-15", rate: 0.069 },
    ],
  };
}
