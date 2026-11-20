import type { components } from "@/api/schema.gen";

type RiskReport = components["schemas"]["RiskReport"];
type RiskSeries = components["schemas"]["RiskSeries"];

// The key of the portfolio's line beside the class keys, which are instrument types.
export const portfolioKey = "portfolio";

// The window of a volatility (RK7): below it the figure is a short sample.
export const fullWindow = 36;

// The largest share of value, in basis points, a month may leave out and still count (RK3).
export const maxExcludedBP = 1000;

export interface RiskRow {
  month: string;
  values: Readonly<Record<string, number | undefined>>;
}

export interface RiskNotes {
  // Months of the portfolio left out for a stale or missing price over more than a tenth of its
  // value, and the classes with a holding left out in them.
  unknownMonths: number;
  unknownClasses: readonly string[];
  // Months the last volatility rests on, when fewer than the window.
  shortSample: number | undefined;
  // Known months, when the portfolio has no volatility yet.
  belowFloor: number | undefined;
}

// The classes whose volatility the chart draws: those with at least one month of volatility.
export function volatilityKeys(report: RiskReport): string[] {
  return report.classes
    .filter((c) => c.months.some((m) => m.volatility_bp !== undefined))
    .map((c) => c.key);
}

// One row per month with the volatility of the portfolio and of each class (RK7); a month
// without a volatility leaves its value undefined, a gap in the line.
export function volatilityRows(report: RiskReport): RiskRow[] {
  const classes = report.classes.filter((c) =>
    volatilityKeys(report).includes(c.key),
  );

  return report.portfolio.months.map((m, i) => {
    const values: Record<string, number | undefined> = {
      [portfolioKey]: m.volatility_bp,
    };
    for (const c of classes) values[c.key] = c.months[i]?.volatility_bp;

    return { month: m.month, values };
  });
}

// One row per month with the drawdown of the portfolio (RK8).
export function drawdownRows(report: RiskReport): RiskRow[] {
  return report.portfolio.months.map((m) => ({
    month: m.month,
    values: { [portfolioKey]: m.drawdown_bp },
  }));
}

// The month of the deepest fall of the portfolio; undefined without a fall.
export function deepestFall(
  report: RiskReport,
): { month: string; bp: number } | undefined {
  let deepest: { month: string; bp: number } | undefined;

  for (const m of report.portfolio.months) {
    if (m.drawdown_bp !== undefined && m.drawdown_bp < (deepest?.bp ?? 0)) {
      deepest = { month: m.month, bp: m.drawdown_bp };
    }
  }

  return deepest;
}

// The sentences under the section: months without a fresh price, a short sample (RK3, RK7).
export function riskNotes(report: RiskReport): RiskNotes {
  const leftOut = report.portfolio.months.flatMap((m, i) =>
    m.state === "stale" ||
    m.state === "missing" ||
    (m.excluded_bp ?? 0) > maxExcludedBP
      ? [i]
      : [],
  );
  const known = report.portfolio.months.filter(
    (m) => m.state === "known",
  ).length;
  const months = report.portfolio.volatility_months;

  return {
    unknownMonths: leftOut.length,
    unknownClasses: report.classes
      .filter((c) => leftOut.some((i) => leftOutOf(c, i)))
      .map((c) => c.key),
    shortSample:
      months !== undefined && months < fullWindow ? months : undefined,
    belowFloor:
      report.portfolio.volatility_bp === undefined && known > 0
        ? known
        : undefined,
  };
}

// A class leaves out some value in month i: a holding of it lacks a fresh price.
function leftOutOf(c: RiskSeries, i: number): boolean {
  const m = c.months[i];

  return (
    m !== undefined &&
    (m.state === "stale" || m.state === "missing" || (m.excluded_bp ?? 0) > 0)
  );
}

// The first of ids whose line holds a value in the record named key: the series a chart reads a
// month on when the other chart points at it.
export function seriesWithValue(
  records: readonly Readonly<Record<string, unknown>>[],
  ids: readonly string[],
): (key: string) => string | undefined {
  return (key) => {
    const record = records.find((r) => r.name === key);

    return ids.find((id) => record?.[id] !== undefined && record[id] !== null);
  };
}
