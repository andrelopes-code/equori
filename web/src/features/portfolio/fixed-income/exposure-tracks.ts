import type { components } from "@/api/schema.gen";

type Money = components["schemas"]["Money"];
type Report = Pick<
  components["schemas"]["IssuerExposureReport"],
  "issuers" | "guarantee"
>;

export interface ExposureTrack {
  issuer: string | undefined;
  // Percents of the scale, two decimals.
  covered: number;
  excess: number;
  uncovered: number;
  limit: number | undefined;
  // What the end of the row states.
  figure: "excess" | "covered" | "uncovered" | "value";
  amount: Money;
}

// The scale leaves a tenth after the largest issuer, so its bar never touches the figure.
const headroom = 1.1;

export function exposureTracks(report: Report): ExposureTrack[] {
  const scale =
    Math.max(0, ...report.issuers.map((i) => i.market_value.amount)) * headroom;
  const pct = (minor: number) =>
    scale === 0 ? 0 : Math.round((minor * 10000) / scale) / 100;

  return report.issuers.map((i) => {
    const limit = report.guarantee === undefined ? undefined : i.limit?.amount;
    const excess = i.excess?.amount ?? 0;
    const covered = limit === undefined ? 0 : i.covered_value.amount - excess;
    const uncovered =
      limit === undefined ? i.market_value.amount : i.uncovered_value.amount;

    return {
      issuer: i.issuer,
      covered: pct(covered),
      excess: pct(excess),
      uncovered: pct(uncovered),
      limit: limit === undefined ? undefined : pct(limit),
      figure: figureOf(limit, excess, i.covered_value.amount),
      amount:
        limit === undefined ? i.market_value : (i.excess ?? i.market_value),
    };
  });
}

function figureOf(
  limit: number | undefined,
  excess: number,
  covered: number,
): ExposureTrack["figure"] {
  if (limit === undefined) return "value";
  if (excess > 0) return "excess";
  if (covered === 0) return "uncovered";

  return "covered";
}
