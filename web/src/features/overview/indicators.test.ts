import { describe, expect, it } from "vitest";

import {
  indicatorSeries,
  lastMonth,
  showsDebt,
} from "@/features/overview/indicators";
import { formatMonths } from "@/i18n/format";
import { indicatorsFixture } from "@/testing/report-api";

describe("indicators", () => {
  it("reads the last month", () => {
    const report = indicatorsFixture();
    expect(lastMonth(report).month).toBe("2026-10");
  });
  it("writes liquidity in months with one decimal", () => {
    expect(formatMonths(66915, "en-US")).toBe("6.7");
    expect(formatMonths(66915, "pt-BR")).toBe("6,7");
  });
  it("shows debt only with liabilities or debt payments", () => {
    const zero = { amount: 0, currency: "BRL" };
    expect(showsDebt(lastMonth(indicatorsFixture()))).toBe(true);
    expect(
      showsDebt(
        lastMonth(indicatorsFixture({ liabilities: zero, debt_service: zero })),
      ),
    ).toBe(false);
  });
  it("draws a series from its first month with a value", () => {
    const report = indicatorsFixture();

    expect(indicatorSeries(report, "savings_rate")).toEqual([
      5000, 5000, 5000, 4300, 4300, 4300, 4300,
    ]);
  });
  it("keeps a gap after the first value", () => {
    const report = indicatorsFixture();
    const months = report.months.map((m, i) =>
      i === 8 ? { ...m, savings_rate: { reason: "no_income" as const } } : m,
    );

    expect(indicatorSeries({ ...report, months }, "savings_rate")).toEqual([
      5000,
      5000,
      5000,
      null,
      4300,
      4300,
      4300,
    ]);
  });
  it("draws nothing with fewer than three values", () => {
    expect(indicatorSeries(indicatorsFixture(), "liquidity")).toEqual([]);
  });
});
