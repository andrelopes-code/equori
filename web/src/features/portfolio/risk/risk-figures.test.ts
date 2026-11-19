import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  deepestFall,
  drawdownRows,
  portfolioKey,
  riskNotes,
  volatilityKeys,
  volatilityRows,
} from "@/features/portfolio/risk/risk-figures";

type RiskReport = components["schemas"]["RiskReport"];

const report: RiskReport = {
  value_in: "BRL",
  window_months: 36,
  portfolio: {
    key: "",
    volatility_bp: 2403,
    volatility_months: 13,
    months: [
      { month: "2026-01-31", state: "known", drawdown_bp: 0 },
      { month: "2026-02-28", state: "stale" },
      {
        month: "2026-03-31",
        state: "known",
        drawdown_bp: -645,
        volatility_bp: 2403,
      },
    ],
  },
  classes: [
    {
      key: "stock",
      months: [
        { month: "2026-01-31", state: "known" },
        { month: "2026-02-28", state: "stale" },
        { month: "2026-03-31", state: "known", volatility_bp: 3893 },
      ],
    },
    {
      key: "currency",
      months: [
        { month: "2026-01-31", state: "nothing_held" },
        { month: "2026-02-28", state: "known" },
        { month: "2026-03-31", state: "known" },
      ],
    },
  ],
  correlations: [],
  left_out: [],
};

describe("risk figures", () => {
  it("RK7: draws the classes that hold a volatility, a gap where a month has none", () => {
    expect(volatilityKeys(report)).toEqual(["stock"]);
    expect(volatilityRows(report)).toEqual([
      {
        month: "2026-01-31",
        values: { [portfolioKey]: undefined, stock: undefined },
      },
      {
        month: "2026-02-28",
        values: { [portfolioKey]: undefined, stock: undefined },
      },
      { month: "2026-03-31", values: { [portfolioKey]: 2403, stock: 3893 } },
    ]);
  });

  it("RK8: states the drawdown of each month and the deepest fall", () => {
    expect(drawdownRows(report).map((r) => r.values[portfolioKey])).toEqual([
      0,
      undefined,
      -645,
    ]);
    expect(deepestFall(report)).toEqual({ month: "2026-03-31", bp: -645 });
    expect(
      deepestFall({
        ...report,
        portfolio: { ...report.portfolio, months: [] },
      }),
    ).toBeUndefined();
  });

  it("RK3, RK7: counts the months without a fresh price and a short sample", () => {
    expect(riskNotes(report)).toEqual({
      unknownMonths: 1,
      unknownClasses: ["stock"],
      shortSample: 13,
      belowFloor: undefined,
    });

    // A known month that leaves out 1500 basis points counts; 1000 does not (RK3).
    const partial = (bp: number) => ({
      ...report,
      portfolio: {
        ...report.portfolio,
        months: [
          { month: "2026-01-31", state: "known" as const, excluded_bp: bp },
        ],
      },
      classes: [
        {
          key: "etf",
          months: [
            { month: "2026-01-31", state: "known" as const, excluded_bp: bp },
          ],
        },
      ],
    });
    expect(riskNotes(partial(1500)).unknownMonths).toBe(1);
    expect(riskNotes(partial(1500)).unknownClasses).toEqual(["etf"]);
    expect(riskNotes(partial(1000)).unknownMonths).toBe(0);

    const young = {
      ...report,
      portfolio: {
        key: "",
        months: report.portfolio.months,
      },
    };
    expect(riskNotes(young)).toEqual({
      unknownMonths: 1,
      unknownClasses: ["stock"],
      shortSample: undefined,
      belowFloor: 2,
    });
  });
});
