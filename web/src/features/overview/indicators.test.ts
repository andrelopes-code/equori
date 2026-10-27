import { describe, expect, it } from "vitest";

import {
  lastMonth,
  ratioSeries,
  showsDebt,
} from "@/features/overview/indicators";
import { formatMonths } from "@/i18n/format";
import { indicatorsFixture } from "@/testing/report-api";

describe("indicators", () => {
  it("reads the last month and the series of a ratio", () => {
    const report = indicatorsFixture();
    expect(lastMonth(report).month).toBe("2026-10");
    expect(ratioSeries(report, "trailing_savings_rate")).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      5000,
      4825,
      4720,
      4650,
    ]);
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
});
