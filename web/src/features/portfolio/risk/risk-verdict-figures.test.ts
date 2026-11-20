import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  countedMonths,
  deepestFall,
  riskLeader,
} from "@/features/portfolio/risk/risk-verdict-figures";

type RiskReport = components["schemas"]["RiskReport"];
type RiskMonth = RiskReport["portfolio"]["months"][number];

const known = (month: string, drawdown?: number): RiskMonth => ({
  month,
  state: "known",
  ...(drawdown === undefined ? {} : { drawdown_bp: drawdown }),
});

const reportOf = (
  months: RiskMonth[],
  classes: RiskReport["classes"] = [],
) => ({
  value_in: "BRL",
  window_months: 36,
  portfolio: { key: "", months },
  classes,
  correlations: [],
  left_out: [],
});

describe("risk verdict figures", () => {
  it("RK8: finds the deepest fall, its peak and the month back at the peak", () => {
    const report = reportOf([
      known("2026-01-31", 0),
      known("2026-02-28", 0),
      known("2026-03-31", -120),
      known("2026-04-30", -251),
      known("2026-05-31", -90),
      known("2026-06-30", 0),
    ]);

    expect(deepestFall(report)).toEqual({
      bp: -251,
      month: "2026-04-30",
      peak: "2026-02-28",
      end: { kind: "recovered", month: "2026-06-30" },
    });
  });

  it("RK3, RK8: says when the fall is still open or a gap broke it", () => {
    const open = reportOf([known("2026-01-31", 0), known("2026-02-28", -80)]);
    const broken = reportOf([
      known("2026-01-31", 0),
      known("2026-02-28", -80),
      known("2026-03-31"),
      known("2026-04-30", 0),
    ]);

    expect(deepestFall(open)?.end).toEqual({ kind: "below" });
    expect(deepestFall(broken)?.end).toEqual({ kind: "unmeasured" });
    expect(deepestFall(reportOf([known("2026-01-31", 0)]))).toBeUndefined();
  });

  it("RK10: names the class with the largest share of the swing", () => {
    const series = (key: string, share?: number) => ({
      key,
      months: [],
      ...(share === undefined ? {} : { risk_share_bp: share }),
    });
    const report = reportOf(
      [],
      [series("fixed_income", -34), series("stock", 8626), series("etf")],
    );

    expect(riskLeader(report)?.key).toBe("stock");
    expect(riskLeader(reportOf([], [series("etf")]))).toBeUndefined();
  });

  it("RK3, RK7: counts only the months a volatility reads", () => {
    const report = reportOf([
      known("2026-01-31", 0),
      { ...known("2026-02-28", 0), excluded_bp: 1000 },
      { ...known("2026-03-31", 0), excluded_bp: 1001 },
      { ...known("2026-04-30", 0), span_months: 2 },
      { month: "2026-05-31", state: "stale" },
    ]);

    expect(countedMonths(report)).toBe(2);
  });
});
