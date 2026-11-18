import type { components } from "@/api/schema.gen";

type FundReport = components["schemas"]["FundReport"];
type FundReportPeriod = components["schemas"]["FundReportPeriod"];

const YEAR_MONTHS = 12;
const STALE_MONTHS = 2;
const STALE_DAYS = 20;

export interface FundFigures {
  // The newest period and its delivery date, as the API states them.
  period: string;
  delivered: string | null;
  // In units of the report's currency.
  unitBookValue: number | null;
  // Minor units of the report's currency.
  netAssets: number | null;
  holders: number | null;
  // Fractions.
  adminFee: number | null;
  monthYield: number | null;
  // FR7.
  priceToBook: number | null;
  // FR8 summed over twelve months, in units of the report's currency.
  yearDistribution: number | null;
  // FR9.
  yearYield: number | null;
}

// The figures of a report against a price in the report's currency; null without a price.
export function fundFigures(
  report: FundReport,
  price: number | null,
): FundFigures | null {
  const newest = report.periods[0];

  if (newest === undefined) {
    return null;
  }

  const unitBookValue = toNumber(newest.unit_book_value);
  const distribution = yearDistribution(report.periods);
  const hasPrice = price !== null && price > 0;

  return {
    period: newest.period,
    delivered: newest.delivered,
    unitBookValue,
    netAssets: newest.net_assets,
    holders: newest.holders,
    adminFee: toNumber(newest.admin_fee),
    monthYield: toNumber(newest.month_yield),
    priceToBook:
      hasPrice && unitBookValue !== null && unitBookValue > 0
        ? price / unitBookValue
        : null,
    yearDistribution: distribution,
    yearYield: hasPrice && distribution !== null ? distribution / price : null,
  };
}

// FR8: null when the period lacks the yield or the book value.
export function monthDistribution(period: FundReportPeriod): number | null {
  const monthYield = toNumber(period.month_yield);
  const unitBookValue = toNumber(period.unit_book_value);

  if (monthYield === null || unitBookValue === null) {
    return null;
  }

  return monthYield * unitBookValue;
}

// FR9: the sum of FR8 over the twelve newest periods; null when they are not twelve consecutive
// months or one lacks FR8. periods is newest first.
export function yearDistribution(periods: FundReportPeriod[]): number | null {
  const year = periods.slice(0, YEAR_MONTHS);

  if (year.length < YEAR_MONTHS || !consecutive(year)) {
    return null;
  }

  let sum = 0;

  for (const period of year) {
    const amount = monthDistribution(period);

    if (amount === null) {
      return null;
    }

    sum += amount;
  }

  return sum;
}

// FR3: whether today is after the period plus two months and 20 days. Dates are ISO texts.
export function reportStale(period: string, today: string): boolean {
  const start = new Date(`${period}T00:00:00Z`);
  const limit = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + STALE_MONTHS,
      start.getUTCDate(),
    ),
  );
  limit.setUTCDate(limit.getUTCDate() + STALE_DAYS);

  return today > limit.toISOString().slice(0, 10);
}

function consecutive(periods: FundReportPeriod[]): boolean {
  return periods.every((p, i) => {
    const next = periods[i + 1];

    return (
      next === undefined || monthIndex(p.period) - monthIndex(next.period) === 1
    );
  });
}

function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
