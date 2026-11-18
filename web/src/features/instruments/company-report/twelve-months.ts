import type { components } from "@/api/schema.gen";

type Period = components["schemas"]["CompanyReportPeriod"];

const YEAR_MONTHS = 12;

export type FlowAccount = "net_income" | "revenue";

export interface TwelveMonths {
  // In minor units.
  value: number;
  // The last day of the window.
  to: string;
}

// CR7. Periods newest first.
export function twelveMonths(
  periods: Period[],
  account: FlowAccount,
): TwelveMonths | null {
  const year = periods.find((p) => p.months === YEAR_MONTHS);

  if (year?.[account] == null) {
    return null;
  }

  const quarter = periods.find(
    (p) =>
      p.months < YEAR_MONTHS &&
      monthIndex(p.period) - p.months === monthIndex(year.period),
  );

  if (quarter === undefined) {
    return { value: year[account], to: year.period };
  }

  const before = periods.find(
    (p) =>
      p.months === quarter.months && p.period === yearBefore(quarter.period),
  );

  if (quarter[account] == null || before?.[account] == null) {
    return null;
  }

  return {
    value: year[account] + quarter[account] - before[account],
    to: quarter.period,
  };
}

function monthIndex(date: string): number {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

function yearBefore(date: string): string {
  return `${String(Number(date.slice(0, 4)) - 1)}${date.slice(4)}`;
}
