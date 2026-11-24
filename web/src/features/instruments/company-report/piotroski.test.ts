import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import {
  piotroskiSignals,
  type SignalID,
} from "@/features/instruments/company-report/piotroski";

type Period = components["schemas"]["CompanyReportPeriod"];

describe("piotroskiSignals", () => {
  it("CR11 holds the nine signals of the years of CR12", () => {
    const signals = piotroskiSignals(years({}), "standard");

    expect(signals?.year).toBe("2025-12-31");
    expect(signals?.prior).toBe("2024-12-31");
    expect(signals?.signals.map((s) => s.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
    ]);
    expectSignal(signals, "p1", "yes", 0.07, null);
    expectSignal(signals, "p2", "yes", 0.0818, null);
    expectSignal(signals, "p3", "yes", 0.07, 0.05);
    expectSignal(signals, "p4", "yes", 0.0818, 0.07);
    expectSignal(signals, "p5", "yes", 0.2435, 0.2857);
    expectSignal(signals, "p6", "yes", 2.25, 2);
    expectSignal(signals, "p7", "yes", 100, 100);
    expectSignal(signals, "p8", "yes", 0.32, 0.3);
    expectSignal(signals, "p9", "yes", 0.9091, 0.9);
  });

  it("CR11 fails P7 and P8 with more shares and an equal gross margin", () => {
    const signals = piotroskiSignals(
      years({ shares_issued: 110, gross_profit: 30000 }),
      "standard",
    );

    expectSignal(signals, "p7", "no", 110, 100);
    expectSignal(signals, "p8", "no", 0.3, 0.3);
  });

  it("CR11 without t-2 has no data for P3, P5 and P9", () => {
    const signals = piotroskiSignals(years({}).slice(0, 2), "standard");

    for (const id of ["p3", "p5", "p9"] as const) {
      expectSignal(signals, id, "missing", null, null);
    }

    expectSignal(signals, "p1", "yes", 0.07, null);
    expectSignal(signals, "p8", "yes", 0.32, 0.3);
  });

  it("CR11 with one fiscal year has no signals", () => {
    expect(piotroskiSignals(years({}).slice(0, 1), "standard")).toBeNull();
  });

  it("CR11 of another chart holds the signals every chart answers", () => {
    const signals = piotroskiSignals(years({}), "other");

    expect(signals?.signals.map((s) => s.id)).toEqual(["p1", "p3", "p7"]);
    expectSignal(signals, "p3", "yes", 0.07, 0.05);
  });
});

// The years of CR12, newest first; `over` overrides the accounts of t.
function years(over: Partial<Period>): Period[] {
  return [
    period("2025-12-31", 12, {
      net_income: 7700,
      operating_cash_flow: 9000,
      total_assets: 120000,
      long_debt: 28000,
      current_assets: 45000,
      current_liabilities: 20000,
      shares_issued: 100,
      revenue: 100000,
      gross_profit: 32000,
      ...over,
    }),
    period("2024-12-31", 12, {
      net_income: 5000,
      operating_cash_flow: 6000,
      total_assets: 110000,
      long_debt: 30000,
      current_assets: 40000,
      current_liabilities: 20000,
      shares_issued: 100,
      revenue: 90000,
      gross_profit: 27000,
    }),
    period("2023-12-31", 12, { total_assets: 100000 }),
  ];
}

function expectSignal(
  signals: ReturnType<typeof piotroskiSignals>,
  id: SignalID,
  state: string,
  current: number | null,
  prior: number | null,
) {
  const signal = signals?.signals.find((s) => s.id === id);

  expect(signal?.state).toBe(state);
  expectClose(signal?.current, current);
  expectClose(signal?.prior, prior);
}

function expectClose(
  actual: number | null | undefined,
  expected: number | null,
) {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }

  expect(actual).toBeCloseTo(expected, 4);
}

function period(
  date: string,
  months: number,
  accounts: Partial<Period>,
): Period {
  return {
    period: date,
    months,
    delivered: null,
    total_assets: null,
    current_assets: null,
    cash: null,
    short_investments: null,
    current_liabilities: null,
    short_debt: null,
    long_debt: null,
    equity: null,
    revenue: null,
    gross_profit: null,
    net_income: null,
    operating_cash_flow: null,
    shares_issued: null,
    shares_treasury: null,
    ...accounts,
  };
}
