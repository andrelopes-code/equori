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

// Why a run of months has no figure on a chart: part of the value lacked a price (RK3), or the
// portfolio had fewer than 12 counted months (RK7).
export type BandReason = "excluded" | "short";

export interface RiskBand {
  from: string;
  to: string;
  reason: BandReason;
}

// The runs of the portfolio's months without a volatility, and without a drawdown, with their
// reason. A month that holds nothing draws no band: there was no portfolio to measure.
export function riskBands(report: RiskReport): {
  volatility: RiskBand[];
  drawdown: RiskBand[];
} {
  const months = report.portfolio.months;

  return {
    volatility: runs(months, (m) =>
      m.volatility_bp === undefined ? reasonOf(m) : undefined,
    ),
    drawdown: runs(months, (m) =>
      m.drawdown_bp === undefined && m.state !== "nothing_held"
        ? "excluded"
        : undefined,
    ),
  };
}

type RiskMonth = RiskSeries["months"][number];

function reasonOf(m: RiskMonth): BandReason | undefined {
  if (m.state === "nothing_held") return undefined;

  const counted =
    m.state === "known" &&
    (m.span_months ?? 1) === 1 &&
    (m.excluded_bp ?? 0) <= maxExcludedBP;

  return counted ? "short" : "excluded";
}

function runs(
  months: readonly RiskMonth[],
  reason: (m: RiskMonth) => BandReason | undefined,
): RiskBand[] {
  const out: RiskBand[] = [];

  for (const m of months) {
    const r = reason(m);
    const last = out.at(-1);

    if (
      r !== undefined &&
      last?.reason === r &&
      last.to === previous(months, m)
    ) {
      last.to = m.month;
    } else if (r !== undefined) {
      out.push({ from: m.month, to: m.month, reason: r });
    }
  }

  return out;
}

function previous(
  months: readonly RiskMonth[],
  m: RiskMonth,
): string | undefined {
  return months[months.indexOf(m) - 1]?.month;
}
