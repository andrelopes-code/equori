import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  drawdownRows,
  portfolioKey,
  riskBands,
  seriesWithValue,
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

  it("RK8: states the drawdown of each month", () => {
    expect(drawdownRows(report).map((r) => r.values[portfolioKey])).toEqual([
      0,
      undefined,
      -645,
    ]);
  });

  it("RK7: reads a month on the first line that holds a value in it", () => {
    const at = seriesWithValue(
      [
        { name: "jan-2026", portfolio: undefined, stock: 3893 },
        { name: "fev-2026", portfolio: 2403, stock: 3900 },
        { name: "mar-2026", portfolio: undefined, stock: undefined },
      ],
      ["portfolio", "stock"],
    );

    expect(at("jan-2026")).toBe("stock");
    expect(at("fev-2026")).toBe("portfolio");
    expect(at("mar-2026")).toBeUndefined();
    expect(at("abr-2026")).toBeUndefined();
  });

  it("RK3, RK7, RK8: marks the runs without a figure and why", () => {
    const month = (
      m: string,
      fields: Partial<RiskReport["portfolio"]["months"][number]>,
    ) => ({ month: m, state: "known" as const, ...fields });
    const months = [
      month("2025-01-31", { state: "nothing_held" }),
      month("2025-02-28", { drawdown_bp: 0 }),
      month("2025-03-31", { drawdown_bp: -100 }),
      month("2025-04-30", { excluded_bp: 3000 }),
      month("2025-05-31", { excluded_bp: 2000 }),
      month("2025-06-30", { drawdown_bp: 0, excluded_bp: 500 }),
      month("2025-07-31", { drawdown_bp: 0, span_months: 2 }),
      month("2025-08-31", { drawdown_bp: 0, volatility_bp: 400 }),
    ];

    const bands = riskBands({
      ...report,
      portfolio: { key: "", months },
    });

    expect(bands.drawdown).toEqual([
      { from: "2025-04-30", to: "2025-05-31", reason: "excluded" },
    ]);
    expect(bands.volatility).toEqual([
      { from: "2025-02-28", to: "2025-03-31", reason: "short" },
      { from: "2025-04-30", to: "2025-05-31", reason: "excluded" },
      { from: "2025-06-30", to: "2025-06-30", reason: "short" },
      { from: "2025-07-31", to: "2025-07-31", reason: "excluded" },
    ]);
  });
});
