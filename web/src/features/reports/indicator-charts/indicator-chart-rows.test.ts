import { describe, expect, it } from "vitest";

import { indicatorChartRows } from "@/features/reports/indicator-charts/indicator-chart-rows";
import { indicatorReport } from "@/testing/indicator-report";

describe("indicatorChartRows", () => {
  it("leaves every field of a month before the first record empty", () => {
    const rows = indicatorChartRows(indicatorReport(), false, (m) => m);

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      label: "2025-11",
      income: null,
      expense: null,
      liquid: null,
      debts: null,
      savings: null,
      trailing: null,
    });
  });

  it("reads the amounts and ratios of an active month", () => {
    const rows = indicatorChartRows(indicatorReport(), false, (m) => m);

    expect(rows[3]).toEqual({
      label: "2026-02",
      income: 100000,
      expense: 80000,
      liquid: 500000,
      debts: 0,
      savings: 1000,
      trailing: 900,
    });
    expect(rows[11]).toMatchObject({
      label: "2026-10",
      savings: 800,
      trailing: 1200,
    });
  });

  it("leaves the savings rate of an incomplete last month out", () => {
    const rows = indicatorChartRows(indicatorReport(), true, (m) => m);

    expect(rows[11]).toMatchObject({
      income: 100000,
      savings: null,
      trailing: 1200,
    });
  });
});
