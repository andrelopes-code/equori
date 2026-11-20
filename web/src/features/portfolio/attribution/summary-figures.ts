import type { components } from "@/api/schema.gen";

type AttributionYear = components["schemas"]["AttributionYear"];
type AttributionCompare = components["schemas"]["AttributionCompare"];

export interface SummaryLine {
  kind: "portfolio" | "rate" | "inflation";
  index?: string;
  // The last day of a comparison that ends before the year.
  until?: string;
  bp?: number;
  amount: number;
}

export interface SummaryFigures {
  lines: SummaryLine[];
  // The ends of the axis in basis points; low ≤ 0 ≤ high.
  low: number;
  high: number;
  // The portfolio's money less the same money at the rate index, over the index's days (AT10).
  rateDiff?: { amount: number; index: string; until?: string };
  real?: { bp: number; index: string; until?: string };
}

// The year beside the same money at the CDI and the IPCA: one line each on one axis, the
// difference in money from the CDI and the real return (AT8, AT10 to AT12).
export function summaryFigures(year: AttributionYear): SummaryFigures {
  const lines: SummaryLine[] = [
    {
      kind: "portfolio",
      ...(year.return_bp === undefined ? {} : { bp: year.return_bp }),
      amount: year.result?.amount ?? 0,
    },
  ];

  if (year.rate !== undefined) lines.push(indexLine("rate", year.rate, year));
  if (year.inflation !== undefined)
    lines.push(indexLine("inflation", year.inflation, year));

  const values = lines.flatMap((l) => (l.bp === undefined ? [] : [l.bp]));
  const figures: SummaryFigures = {
    lines,
    low: Math.min(0, ...values),
    high: Math.max(0, ...values),
  };

  if (year.rate !== undefined)
    figures.rateDiff = {
      amount: year.rate.result.amount - year.rate.index_result.amount,
      index: year.rate.index,
      ...untilOf(year.rate, year),
    };

  if (year.inflation?.real_bp !== undefined)
    figures.real = {
      bp: year.inflation.real_bp,
      index: year.inflation.index,
      ...untilOf(year.inflation, year),
    };

  return figures;
}

// The tone a figure is written in: a gain in success, a loss in danger, zero in the text colour.
export function signTone(value: number): "success" | "danger" | "default" {
  if (value > 0) return "success";
  if (value < 0) return "danger";

  return "default";
}

function indexLine(
  kind: "rate" | "inflation",
  c: AttributionCompare,
  year: AttributionYear,
): SummaryLine {
  return {
    kind,
    index: c.index,
    ...untilOf(c, year),
    bp: c.index_bp,
    amount: c.index_result.amount,
  };
}

function untilOf(
  c: AttributionCompare,
  year: AttributionYear,
): { until?: string } {
  return c.until === year.to ? {} : { until: c.until };
}
