import { describe, expect, it } from "vitest";

import { breakEven } from "@/features/calculators/indexer-comparison/break-even/break-even";
import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";
import type { IndexRate } from "@/features/calculators/rate-source/index-rates";

describe("breakEven", () => {
  it("equals the net of a fixed reference, both taxed alike", () => {
    expect(
      breakEven({
        security: percentOfCdi(),
        data: daily(),
        reference: fixed(0.08, true),
        referenceRate: 0.08,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeCloseTo(0.056514, 5);
  });

  it("equals the net of an exempt reference", () => {
    expect(
      breakEven({
        security: percentOfCdi(),
        data: daily(),
        reference: fixed(0.08, false),
        referenceRate: 0.08,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeCloseTo(0.067838, 5);
  });

  it("solves a spread over a monthly index", () => {
    expect(
      breakEven({
        security: { form: "spread", index: "ipca", rate: 0.06, taxed: true },
        data: monthly(),
        reference: fixed(0.12, true),
        referenceRate: 0.12,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeCloseTo(0.056604, 5);
  });

  it("is null without a root in the interval", () => {
    expect(
      breakEven({
        security: percentOfCdi(),
        data: daily(),
        reference: fixed(50, true),
        referenceRate: 50,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeNull();
  });

  it("is null for a fixed security", () => {
    expect(
      breakEven({
        security: fixed(0.1, true),
        data: daily(),
        reference: fixed(0.08, true),
        referenceRate: 0.08,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeNull();
  });

  it("is null when the reference floats on the same index", () => {
    expect(
      breakEven({
        security: percentOfCdi(),
        data: daily(),
        reference: { ...percentOfCdi(), rate: 1.1 },
        referenceRate: 0.07,
        days: 720,
        taxBp: 1750,
      }),
    ).toBeNull();
  });
});

function fixed(rate: number, taxed: boolean): Security {
  return { form: "fixed", rate, taxed };
}

function percentOfCdi(): Security {
  return { form: "percent", index: "cdi", rate: 1.4, taxed: true };
}

// 252 stored days in the year before 2026-11-13, at 1.03^(1/252) - 1, and no point.
function daily(): IndexData {
  const day = 86_400_000;
  const start = Date.UTC(2025, 10, 13);
  const rates: IndexRate[] = Array.from({ length: 253 }, (_, i) => ({
    date: new Date(start + Math.round((i * 365) / 252) * day)
      .toISOString()
      .slice(0, 10),
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

function monthly(): IndexData {
  const rates: IndexRate[] = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-${String(i + 1).padStart(2, "0")}-01`,
    rate: 0,
  }));

  return {
    id: "ipca",
    period: "month",
    rates,
    points: [{ date: "2026-12-31", rate: 0.05 }],
    surveyDate: "2026-11-13",
    dailySpread: false,
  };
}
