import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import { companyFigures } from "@/features/instruments/company-report/company-figures";

type Period = components["schemas"]["CompanyReportPeriod"];
type Report = components["schemas"]["CompanyReport"];

describe("companyFigures", () => {
  it("CR8 divides the net income of twelve months by the latest equity", () => {
    const figures = companyFigures(
      report([
        period("2026-09-30", 9, { net_income: 9000, equity: 100000 }),
        period("2025-12-31", 12, { net_income: 10000 }),
        period("2025-09-30", 9, { net_income: 7000 }),
      ]),
    );

    expect(figures?.returnOnEquity).toBeCloseTo(0.12, 4);
    expect(figures?.window).toBe("2026-09-30");
    expect(figures?.balance).toBe("2026-09-30");
  });

  it("CR8 and CR9 with a zero equity have no ratio", () => {
    const figures = companyFigures(
      report([
        period("2025-12-31", 12, {
          net_income: 12000,
          equity: 0,
          short_debt: 0,
          long_debt: 0,
          cash: 0,
          short_investments: 0,
        }),
      ]),
    );

    expect(figures?.returnOnEquity).toBeNull();
    expect(figures?.netDebtToEquity).toBeNull();
  });

  it("CR9 divides the net income by the revenue of twelve months", () => {
    const figures = companyFigures(
      report([
        period("2026-09-30", 9, { net_income: 9000, revenue: 60000 }),
        period("2025-12-31", 12, { net_income: 10000, revenue: 70000 }),
        period("2025-09-30", 9, { net_income: 7000, revenue: 50000 }),
      ]),
    );

    expect(figures?.netMargin).toBeCloseTo(0.15, 4);
  });

  it("CR9 with a zero revenue has no net margin", () => {
    const figures = companyFigures(
      report([period("2025-12-31", 12, { net_income: 12000, revenue: 0 })]),
    );

    expect(figures?.netMargin).toBeNull();
  });

  it("CR9 divides the net debt by the equity", () => {
    const figures = companyFigures(
      report([
        period("2025-12-31", 12, {
          short_debt: 10000,
          long_debt: 30000,
          cash: 5000,
          short_investments: 5000,
          equity: 100000,
        }),
      ]),
    );

    expect(figures?.netDebtToEquity).toBeCloseTo(0.3, 4);
  });

  it("CR9 with more cash than debt has a negative net debt", () => {
    const figures = companyFigures(
      report([
        period("2025-12-31", 12, {
          short_debt: 0,
          long_debt: 0,
          cash: 10000,
          short_investments: 0,
          equity: 100000,
        }),
      ]),
    );

    expect(figures?.netDebtToEquity).toBeCloseTo(-0.1, 4);
  });

  it("CR10 counts the positive years among the five latest", () => {
    const figures = companyFigures(
      report([
        period("2025-12-31", 12, { net_income: 1000 }),
        period("2024-12-31", 12, { net_income: -500 }),
        period("2023-12-31", 12, { net_income: 300 }),
        period("2022-12-31", 12, { net_income: 0 }),
        period("2021-12-31", 12, { net_income: 700 }),
        period("2020-12-31", 12, { net_income: 900 }),
      ]),
    );

    expect(figures?.positiveYears).toEqual({ positive: 3, count: 5 });
  });

  it("CR10 with two stored years counts two", () => {
    const figures = companyFigures(
      report([
        period("2025-12-31", 12, { net_income: 1000 }),
        period("2024-12-31", 12, { net_income: 700 }),
      ]),
    );

    expect(figures?.positiveYears).toEqual({ positive: 2, count: 2 });
  });

  it("CR9 for the chart other has no margin or debt ratio and keeps the return", () => {
    const figures = companyFigures(
      report(
        [
          period("2025-12-31", 12, {
            net_income: 12000,
            equity: 100000,
            revenue: 80000,
          }),
        ],
        "other",
      ),
    );

    expect(figures?.netMargin).toBe("notApplicable");
    expect(figures?.netDebtToEquity).toBe("notApplicable");
    expect(figures?.returnOnEquity).toBeCloseTo(0.12, 4);
  });

  it("has no figures without a period", () => {
    expect(companyFigures(report([]))).toBeNull();
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

function report(periods: Period[], plan = "standard"): Report {
  return {
    source: "br_cvm_cia",
    source_url: "https://example.test",
    identifier: "1",
    name: "Company",
    consolidated: true,
    plan,
    currency: "BRL",
    periods,
  };
}
