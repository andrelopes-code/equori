import { describe, expect, it } from "vitest";

import { indicatorReport as report, savings } from "@/testing/indicator-report";
import {
  activeFrom,
  amountSeries,
  positionRows,
  ratioSeries,
} from "@/features/reports/model/indicator-series";

describe("activeFrom", () => {
  it("is the first month with a non-zero amount", () => {
    expect(activeFrom(report())).toBe(3);
  });

  it("is 12 when every amount is zero", () => {
    expect(activeFrom(report({ active: 12 }))).toBe(12);
  });
});

describe("ratioSeries", () => {
  it("leaves a gap before the first active month", () => {
    expect(ratioSeries(report(), "liquidity", false)).toEqual([
      null,
      null,
      null,
      30300,
      30400,
      30500,
      30600,
      30700,
      30800,
      30900,
      31000,
      31100,
    ]);
  });

  it("reads the savings rate of a complete last month", () => {
    expect(ratioSeries(report(), "savings_rate", false)[11]).toBe(800);
  });

  it("leaves the savings rate of an incomplete last month out", () => {
    expect(ratioSeries(report(), "savings_rate", true)[11]).toBeNull();
  });

  it("keeps the other ratios of an incomplete last month", () => {
    expect(ratioSeries(report(), "liquidity", true)[11]).toBe(31100);
  });

  it("gives null for a ratio with a reason", () => {
    const withReason = report({
      last: { liquidity: { reason: "insufficient_history" } },
    });

    expect(ratioSeries(withReason, "liquidity", false)[11]).toBeNull();
  });
});

describe("amountSeries", () => {
  it("leaves a gap before the first active month", () => {
    expect(amountSeries(report(), "income")).toEqual([
      null,
      null,
      null,
      ...Array<number>(9).fill(100000),
    ]);
  });
});

describe("positionRows", () => {
  it("places the savings rate among the other months", () => {
    const row = positionRows(report(), false)[0];

    expect(row).toEqual({
      kind: "savings_rate",
      value: 800,
      state: {
        kind: "strip",
        min: -500,
        max: 2500,
        dots: [3, 4, 5, 6, 7, 8, 9, 10].map((index) => ({
          index,
          bp: savings[index - 3],
        })),
        band: [-500, 2500],
        flat: false,
        current: 800,
        markerHidden: false,
        mean: 1200,
      },
    });
  });

  it("hides the marker of an incomplete month and keeps its value", () => {
    const row = positionRows(report(), true)[0];

    expect(row?.value).toBe(800);
    expect(row?.state).toMatchObject({ kind: "strip", markerHidden: true });
  });

  it("flags a band that holds one value", () => {
    const row = positionRows(report(), false)[2];

    expect(row?.kind).toBe("committed_share");
    expect(row?.state).toMatchObject({
      kind: "strip",
      flat: true,
      band: [0, 0],
      current: 1744,
      max: 1744,
    });
  });

  it("says no debt when the ratio is zero in every drawn month", () => {
    const row = positionRows(report(), false)[3];

    expect(row).toEqual({
      kind: "debt_service_share",
      value: 0,
      state: { kind: "none" },
    });
  });

  it("carries the reason of the asked month", () => {
    const withReason = report({
      last: { liquidity: { reason: "insufficient_history" } },
    });
    const row = positionRows(withReason, false)[1];

    expect(row).toEqual({
      kind: "liquidity",
      value: null,
      state: { kind: "reason", reason: "insufficient_history" },
    });
  });

  it("is short with fewer than three drawn months", () => {
    const row = positionRows(report({ active: 10 }), false)[1];

    expect(row?.state).toEqual({ kind: "short" });
  });
});
