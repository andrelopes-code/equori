import { describe, expect, it } from "vitest";

import type { IndicatorMonth, Indicators } from "@/features/overview";
import {
  activeFrom,
  amountSeries,
  positionRows,
  ratioSeries,
} from "@/features/reports/indicator-series";

const savings = [1000, -500, 2000, 0, 1500, 500, 2500, 1000, 800];

describe("activeFrom", () => {
  it("is the first month with a non-zero amount", () => {
    expect(activeFrom(report())).toBe(3);
  });

  it("is 12 when every amount is zero", () => {
    expect(activeFrom(report({ active: 12 }))).toBe(12);
  });
});

describe("ratioSeries", () => {
  it("leaves a gap before the first active month", () => {
    expect(ratioSeries(report(), "liquidity", false)).toEqual([
      null,
      null,
      null,
      30300,
      30400,
      30500,
      30600,
      30700,
      30800,
      30900,
      31000,
      31100,
    ]);
  });

  it("reads the savings rate of a complete last month", () => {
    expect(ratioSeries(report(), "savings_rate", false)[11]).toBe(800);
  });

  it("leaves the savings rate of an incomplete last month out", () => {
    expect(ratioSeries(report(), "savings_rate", true)[11]).toBeNull();
  });

  it("keeps the other ratios of an incomplete last month", () => {
    expect(ratioSeries(report(), "liquidity", true)[11]).toBe(31100);
  });

  it("gives null for a ratio with a reason", () => {
    const withReason = report({
      last: { liquidity: { reason: "insufficient_history" } },
    });

    expect(ratioSeries(withReason, "liquidity", false)[11]).toBeNull();
  });
});

describe("amountSeries", () => {
  it("leaves a gap before the first active month", () => {
    expect(amountSeries(report(), "income")).toEqual([
      null,
      null,
      null,
      ...Array<number>(9).fill(100000),
    ]);
  });
});

describe("positionRows", () => {
  it("places the savings rate among the other months", () => {
    const row = positionRows(report(), false)[0];

    expect(row).toEqual({
      kind: "savings_rate",
      value: 800,
      state: {
        kind: "strip",
        min: -500,
        max: 2500,
        dots: [3, 4, 5, 6, 7, 8, 9, 10].map((index) => ({
          index,
          bp: savings[index - 3],
        })),
        band: [-500, 2500],
        flat: false,
        current: 800,
        markerHidden: false,
        mean: 1200,
      },
    });
  });

  it("hides the marker of an incomplete month and keeps its value", () => {
    const row = positionRows(report(), true)[0];

    expect(row?.value).toBe(800);
    expect(row?.state).toMatchObject({ kind: "strip", markerHidden: true });
  });

  it("flags a band that holds one value", () => {
    const row = positionRows(report(), false)[2];

    expect(row?.kind).toBe("committed_share");
    expect(row?.state).toMatchObject({
      kind: "strip",
      flat: true,
      band: [0, 0],
      current: 1744,
      max: 1744,
    });
  });

  it("says no debt when the ratio is zero in every drawn month", () => {
    const row = positionRows(report(), false)[3];

    expect(row).toEqual({
      kind: "debt_service_share",
      value: 0,
      state: { kind: "none" },
    });
  });

  it("carries the reason of the asked month", () => {
    const withReason = report({
      last: { liquidity: { reason: "insufficient_history" } },
    });
    const row = positionRows(withReason, false)[1];

    expect(row).toEqual({
      kind: "liquidity",
      value: null,
      state: { kind: "reason", reason: "insufficient_history" },
    });
  });

  it("is short with fewer than three drawn months", () => {
    const row = positionRows(report({ active: 10 }), false)[1];

    expect(row?.state).toEqual({ kind: "short" });
  });
});

interface ReportOptions {
  // Index of the first month with amounts; the months before it hold zeros.
  active?: number;
  last?: Partial<IndicatorMonth>;
}

function report({ active = 3, last = {} }: ReportOptions = {}): Indicators {
  const months = Array.from({ length: 12 }, (_, i) =>
    i < active ? idleMonth(i) : activeMonth(i),
  );

  return {
    currency: "BRL",
    months: months.map((m, i) => (i === 11 ? { ...m, ...last } : m)),
  };
}

function idleMonth(index: number): IndicatorMonth {
  return {
    month: monthName(index),
    income: brl(0),
    expense: brl(0),
    committed: brl(0),
    debt_service: brl(0),
    liquid_balance: brl(0),
    liabilities: brl(0),
    savings_rate: { bp: 0 },
    trailing_savings_rate: { bp: 0 },
    liquidity: { bp: 0 },
    committed_share: { bp: 0 },
    debt_service_share: { bp: 0 },
  };
}

function activeMonth(index: number): IndicatorMonth {
  return {
    ...idleMonth(index),
    income: brl(100000),
    expense: brl(80000),
    liquid_balance: brl(500000),
    savings_rate: { bp: savings[index - 3] ?? 800 },
    trailing_savings_rate: index === 11 ? { bp: 1200 } : { bp: 900 },
    liquidity: { bp: 30000 + 100 * index },
    committed_share: { bp: index === 11 ? 1744 : 0 },
  };
}

function monthName(index: number): string {
  const month = ((10 + index) % 12) + 1;
  const year = 2025 + Math.floor((10 + index) / 12);

  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

function brl(amount: number) {
  return { amount, currency: "BRL" };
}
