import type { components } from "@/api/schema.gen";

import { twelveMonths } from "@/features/instruments/company-report/twelve-months";

type Report = components["schemas"]["CompanyReport"];

const YEAR_MONTHS = 12;
const YEARS_COUNTED = 5;

export interface CompanyFigures {
  // The window of CR7 for the net income; null without it.
  window: string | null;
  // The newest period: its date and its delivery.
  balance: string;
  delivered: string | null;
  // CR8; null without a figure.
  returnOnEquity: number | null;
  // CR9; "notApplicable" for the chart other.
  netMargin: number | null | "notApplicable";
  netDebtToEquity: number | null | "notApplicable";
  // CR10: years with a net income above zero among the fiscal years counted (at most 5, a null
  // net income not counted).
  positiveYears: { positive: number; count: number } | null;
}

export function companyFigures(report: Report): CompanyFigures | null {
  const newest = report.periods[0];

  if (newest === undefined) {
    return null;
  }

  const income = twelveMonths(report.periods, "net_income");
  const equity =
    newest.equity !== null && newest.equity > 0 ? newest.equity : null;
  const other = report.plan === "other";

  return {
    window: income?.to ?? null,
    balance: newest.period,
    delivered: newest.delivered,
    returnOnEquity:
      income !== null && equity !== null ? income.value / equity : null,
    netMargin: other ? "notApplicable" : netMargin(report),
    netDebtToEquity: other ? "notApplicable" : netDebtToEquity(report, equity),
    positiveYears: positiveYears(report),
  };
}

// CR9: both windows end on the same date and the revenue is above zero.
function netMargin(report: Report): number | null {
  const income = twelveMonths(report.periods, "net_income");
  const revenue = twelveMonths(report.periods, "revenue");

  if (income === null || revenue === null) {
    return null;
  }

  if (income.to !== revenue.to || revenue.value <= 0) {
    return null;
  }

  return income.value / revenue.value;
}

function netDebtToEquity(report: Report, equity: number | null): number | null {
  const { short_debt, long_debt, cash, short_investments } =
    report.periods[0] ?? {};

  if (
    equity === null ||
    short_debt == null ||
    long_debt == null ||
    cash == null ||
    short_investments == null
  ) {
    return null;
  }

  return (short_debt + long_debt - cash - short_investments) / equity;
}

function positiveYears(report: Report): CompanyFigures["positiveYears"] {
  const incomes = report.periods
    .filter((p) => p.months === YEAR_MONTHS)
    .slice(0, YEARS_COUNTED)
    .map((p) => p.net_income)
    .filter((income) => income !== null);

  if (incomes.length === 0) {
    return null;
  }

  return {
    positive: incomes.filter((income) => income > 0).length,
    count: incomes.length,
  };
}
