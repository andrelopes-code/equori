import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import { twelveMonths } from "@/features/instruments/company-report/twelve-months";

type Period = components["schemas"]["CompanyReportPeriod"];

describe("twelveMonths", () => {
  it("CR7 adds the quarter and subtracts the quarter of the year before", () => {
    const periods = [
      period("2026-09-30", 9, { net_income: 9000 }),
      period("2025-12-31", 12, { net_income: 10000 }),
      period("2025-09-30", 9, { net_income: 7000 }),
    ];

    expect(twelveMonths(periods, "net_income")).toEqual({
      value: 12000,
      to: "2026-09-30",
    });
  });

  it("CR7 without a quarter is the fiscal year", () => {
    const periods = [period("2025-12-31", 12, { net_income: 10000 })];

    expect(twelveMonths(periods, "net_income")).toEqual({
      value: 10000,
      to: "2025-12-31",
    });
  });

  it("CR7 with a quarter and without the quarter of the year before has none", () => {
    const periods = [
      period("2026-09-30", 9, { net_income: 9000 }),
      period("2025-12-31", 12, { net_income: 10000 }),
    ];

    expect(twelveMonths(periods, "net_income")).toBeNull();
  });

  it("CR7 ignores a quarter that does not start the day after the fiscal year", () => {
    const periods = [
      period("2026-06-30", 3, { net_income: 2000 }),
      period("2025-12-31", 12, { net_income: 10000 }),
    ];

    expect(twelveMonths(periods, "net_income")).toEqual({
      value: 10000,
      to: "2025-12-31",
    });
  });
});

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
