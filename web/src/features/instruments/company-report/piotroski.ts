import type { components } from "@/api/schema.gen";

type Period = components["schemas"]["CompanyReportPeriod"];

const YEAR_MONTHS = 12;

export type SignalID =
  "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "p8" | "p9";
export type SignalState = "yes" | "no" | "missing";
export type SignalUnit = "percent" | "ratio2" | "ratio4" | "shares";

export interface Signal {
  id: SignalID;
  state: SignalState;
  unit: SignalUnit;
  // The value of t and the value it is compared with; null when an input is missing. P1 and P2
  // compare with zero: prior is null.
  current: number | null;
  prior: number | null;
}

export interface Signals {
  // The fiscal years t and t−1, as the period dates.
  year: string;
  prior: string;
  signals: Signal[];
}

// CR11. Null with fewer than two fiscal years.
export function piotroskiSignals(periods: Period[]): Signals | null {
  const [t, t1, t2] = periods.filter((p) => p.months === YEAR_MONTHS);

  if (t === undefined || t1 === undefined) {
    return null;
  }

  const roa = ratio(t.net_income, t1.total_assets);
  const cashFlow = ratio(t.operating_cash_flow, t1.total_assets);
  const roaBefore = ratio(t1.net_income, t2?.total_assets);
  const leverage = ratio(t.long_debt, mean(t.total_assets, t1.total_assets));
  const leverageBefore = ratio(
    t1.long_debt,
    mean(t1.total_assets, t2?.total_assets),
  );
  const currentRatio = ratio(t.current_assets, t.current_liabilities);
  const currentRatioBefore = ratio(t1.current_assets, t1.current_liabilities);
  const grossMargin = ratio(t.gross_profit, t.revenue);
  const grossMarginBefore = ratio(t1.gross_profit, t1.revenue);
  const turnover = ratio(t.revenue, t1.total_assets);
  const turnoverBefore = ratio(t1.revenue, t2?.total_assets);

  return {
    year: t.period,
    prior: t1.period,
    signals: [
      positive("p1", roa),
      positive("p2", cashFlow),
      compare("p3", "percent", roa, roaBefore, (c, p) => c > p),
      compare("p4", "percent", cashFlow, roa, (c, p) => c > p),
      compare("p5", "ratio4", leverage, leverageBefore, (c, p) => c < p),
      compare(
        "p6",
        "ratio2",
        currentRatio,
        currentRatioBefore,
        (c, p) => c > p,
      ),
      compare(
        "p7",
        "shares",
        t.shares_issued,
        t1.shares_issued,
        (c, p) => c <= p,
      ),
      compare("p8", "percent", grossMargin, grossMarginBefore, (c, p) => c > p),
      compare("p9", "ratio4", turnover, turnoverBefore, (c, p) => c > p),
    ],
  };
}

// P1 and P2 compare with zero.
function positive(id: SignalID, current: number | null): Signal {
  if (current === null) {
    return missing(id, "percent");
  }

  return {
    id,
    state: current > 0 ? "yes" : "no",
    unit: "percent",
    current,
    prior: null,
  };
}

function compare(
  id: SignalID,
  unit: SignalUnit,
  current: number | null | undefined,
  prior: number | null | undefined,
  holds: (current: number, prior: number) => boolean,
): Signal {
  if (current == null || prior == null) {
    return missing(id, unit);
  }

  return {
    id,
    state: holds(current, prior) ? "yes" : "no",
    unit,
    current,
    prior,
  };
}

function missing(id: SignalID, unit: SignalUnit): Signal {
  return { id, state: "missing", unit, current: null, prior: null };
}

// Null with a missing input or a divisor not above zero.
function ratio(
  numerator: number | null | undefined,
  divisor: number | null | undefined,
): number | null {
  if (numerator == null || divisor == null || divisor <= 0) {
    return null;
  }

  return numerator / divisor;
}

function mean(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null || b == null) {
    return null;
  }

  return (a + b) / 2;
}
