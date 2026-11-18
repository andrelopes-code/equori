import { describe, expect, it } from "vitest";

import {
  horizonMonths,
  type IndexData,
  type Security,
} from "@/features/calculators/indexer-comparison/security";
import {
  expectedIndexRate,
  expectedRate,
  rateAtIndex,
} from "@/features/calculators/indexer-comparison/security-rate";
import { indexCurrency } from "@/features/calculators/rate-source/index-catalog";
import type { IndexRate } from "@/features/calculators/rate-source/index-rates";

describe("expectedRate", () => {
  it("adds the spread to a monthly index under its expected path", () => {
    const security: Security = {
      form: "spread",
      index: "ipca",
      rate: 0.065,
      taxed: true,
    };

    expect(expectedRate(security, monthly(), 14)).toBeCloseTo(0.11877392, 8);
  });

  it("returns the typed rate of a fixed security", () => {
    const security: Security = { form: "fixed", rate: 0.12, taxed: true };

    expect(expectedRate(security, undefined, 24)).toBe(0.12);
  });

  it("takes a percent of a daily index with no point at its current rate", () => {
    expect(expectedRate(percentOfCdi(), daily(), 24)).toBeCloseTo(
      0.04224949,
      8,
    );
  });

  it("is null without data or without a rate", () => {
    expect(expectedRate(percentOfCdi(), undefined, 24)).toBeNull();
    expect(
      expectedRate({ ...percentOfCdi(), rate: null }, daily(), 24),
    ).toBeNull();
    expect(
      expectedRate({ form: "fixed", rate: null, taxed: true }, undefined, 24),
    ).toBeNull();
  });
});

describe("rateAtIndex", () => {
  it("holds a percent of a daily index at a constant index", () => {
    expect(rateAtIndex(percentOfCdi(), daily(), 0.08)).toBeCloseTo(
      0.11375688,
      8,
    );
  });

  it("compounds the spread with a monthly index held constant", () => {
    const security: Security = {
      form: "spread",
      index: "ipca",
      rate: 0.06,
      taxed: true,
    };

    expect(rateAtIndex(security, monthly(), 0.05)).toBeCloseTo(0.113, 8);
  });
});

describe("expectedIndexRate", () => {
  it("is the rate of the index under its expected path", () => {
    expect(expectedIndexRate(daily(), 24)).toBeCloseTo(0.03, 8);
    expect(expectedIndexRate(monthly(), 2)).toBeCloseTo(0.05344843, 8);
  });
});

describe("horizonMonths", () => {
  it.each([
    [720, 24],
    [30, 1],
    [1, 1],
  ])("takes %i days to %i months", (days, months) => {
    expect(horizonMonths(days)).toBe(months);
  });
});

describe("indexCurrency", () => {
  it.each([
    ["cdi", "BRL"],
    ["sofr", "USD"],
    ["xx", undefined],
  ])("gives %s the currency %s", (id, currency) => {
    expect(indexCurrency(id)).toBe(currency);
  });
});

function percentOfCdi(): Security {
  return { form: "percent", index: "cdi", rate: 1.4, taxed: true };
}

// 252 stored days in the year before 2026-11-13, at 1.03^(1/252) - 1, and no point.
function daily(): IndexData {
  const day = 86_400_000;
  const start = Date.UTC(2025, 10, 13);
  const dates = Array.from({ length: 253 }, (_, i) =>
    new Date(start + Math.round((i * 365) / 252) * day)
      .toISOString()
      .slice(0, 10),
  );
  const rates: IndexRate[] = dates.map((date) => ({
    date,
    rate: 1.03 ** (1 / 252) - 1,
  }));

  return {
    id: "cdi",
    period: "day",
    rates,
    points: [],
    surveyDate: "2026-11-13",
    dailySpread: false,
  };
}

// Ten months of 2026 accumulating 4.2%; the expectations of 2026 and 2027.
function monthly(): IndexData {
  const rates: IndexRate[] = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-${String(i + 1).padStart(2, "0")}-01`,
    rate: i === 9 ? 0.042 : 0,
  }));

  return {
    id: "ipca",
    period: "month",
    rates,
    points: [
      { date: "2026-12-31", rate: 0.051082 },
      { date: "2027-12-31", rate: 0.05 },
    ],
    surveyDate: "2026-11-13",
    dailySpread: false,
  };
}
