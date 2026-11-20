import type { components } from "@/api/schema.gen";
import { maxExcludedBP } from "@/features/portfolio/risk/risk-figures";

type RiskReport = components["schemas"]["RiskReport"];
type RiskSeries = components["schemas"]["RiskSeries"];

// The deepest fall of the portfolio (RK8): the month of its bottom, the last month at the peak
// before it, and how it ended. "recovered" names the first month back at the peak; "below" says
// the portfolio has not reached it again; "unmeasured" says a month without a figure (RK3) broke
// the run before it did.
export interface Fall {
  bp: number;
  month: string;
  peak: string | undefined;
  end:
    | { kind: "recovered"; month: string }
    | { kind: "below" }
    | { kind: "unmeasured" };
}

export function deepestFall(report: RiskReport): Fall | undefined {
  const months = report.portfolio.months;
  let bottom = -1;

  for (const [i, m] of months.entries()) {
    const deepest = bottom < 0 ? 0 : (months[bottom]?.drawdown_bp ?? 0);
    if (m.drawdown_bp !== undefined && m.drawdown_bp < deepest) bottom = i;
  }

  const low = months[bottom];
  if (low?.drawdown_bp === undefined) return undefined;

  return {
    bp: low.drawdown_bp,
    month: low.month,
    peak: lastPeak(months.slice(0, bottom)),
    end: endOf(months.slice(bottom + 1)),
  };
}

// The months that count for a volatility (RK3, RK7): known, one month long and leaving out at
// most a tenth of the value.
export function countedMonths(report: RiskReport): number {
  return report.portfolio.months.filter(
    (m) =>
      m.state === "known" &&
      (m.span_months ?? 1) === 1 &&
      (m.excluded_bp ?? 0) <= maxExcludedBP,
  ).length;
}

// The class that carries the largest share of the portfolio's swing (RK10).
export function riskLeader(report: RiskReport): RiskSeries | undefined {
  let leader: RiskSeries | undefined;

  for (const c of report.classes) {
    if ((c.risk_share_bp ?? 0) > (leader?.risk_share_bp ?? 0)) leader = c;
  }

  return leader;
}

function endOf(after: RiskReport["portfolio"]["months"]): Fall["end"] {
  for (const m of after) {
    if (m.drawdown_bp === undefined) return { kind: "unmeasured" };
    if (m.drawdown_bp === 0) return { kind: "recovered", month: m.month };
  }

  return { kind: "below" };
}

function lastPeak(
  before: RiskReport["portfolio"]["months"],
): string | undefined {
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i]?.drawdown_bp === 0) return before[i]?.month;
  }

  return undefined;
}
