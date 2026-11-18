import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import {
  fundFigures,
  monthDistribution,
  reportStale,
  yearDistribution,
} from "@/features/instruments/fund-report/fund-figures";

type Period = components["schemas"]["FundReportPeriod"];
type Report = components["schemas"]["FundReport"];

const BOOK = "165.02474631029";

describe("fundFigures", () => {
  it("FR7 divides the price by the unit book value", () => {
    const figures = fundFigures(
      report([period("2026-10-01", { unit_book_value: BOOK })]),
      158,
    );

    expect(figures?.priceToBook).toBeCloseTo(0.9574, 4);
  });

  it("FR7 without a price has no ratio and no yield", () => {
    const figures = fundFigures(
      report([period("2026-10-01", { unit_book_value: BOOK })]),
      null,
    );

    expect(figures?.priceToBook).toBeNull();
    expect(figures?.yearYield).toBeNull();
  });

  it("FR7 with a zero book value has no ratio", () => {
    const figures = fundFigures(
      report([period("2026-10-01", { unit_book_value: "0" })]),
      158,
    );

    expect(figures?.priceToBook).toBeNull();
  });

  it("FR9 yields the twelve month sum over the price", () => {
    const figures = fundFigures(report(months(12)), 158);

    expect(figures?.yearDistribution).toBeCloseTo(13.2, 4);
    expect(figures?.yearYield).toBeCloseTo(0.083544, 6);
  });

  it("FR9 with eleven periods has no sum and no yield", () => {
    const figures = fundFigures(report(months(12).slice(0, 11)), 158);

    expect(figures?.yearDistribution).toBeNull();
    expect(figures?.yearYield).toBeNull();
  });

  it("takes the figures of the newest period as numbers", () => {
    const newest = period("2026-10-01", {
      net_assets: 765689937148,
      holders: 633787,
      admin_fee: "0.000465",
      delivered: "2026-11-13",
    });

    const figures = fundFigures(report([newest]), 158);

    expect(figures?.period).toBe("2026-10-01");
    expect(figures?.delivered).toBe("2026-11-13");
    expect(figures?.netAssets).toBe(765689937148);
    expect(figures?.holders).toBe(633787);
    expect(figures?.adminFee).toBe(0.000465);
  });

  it("returns null for a report without periods", () => {
    expect(fundFigures(report([]), 158)).toBeNull();
  });
});

describe("monthDistribution", () => {
  it("FR8 multiplies the month yield by the unit book value", () => {
    const p = period("2026-10-01", {
      month_yield: "0.006943",
      unit_book_value: BOOK,
    });

    expect(monthDistribution(p)).toBeCloseTo(1.1458, 4);
  });

  it("FR8 with a blank yield is null", () => {
    const p = period("2026-10-01", {
      month_yield: null,
      unit_book_value: BOOK,
    });

    expect(monthDistribution(p)).toBeNull();
  });
});

describe("yearDistribution", () => {
  it("FR9 with a gap of one month is null", () => {
    const withGap = [...months(13)]
      .filter((p) => p.period !== "2026-05-01")
      .slice(0, 12);

    expect(withGap).toHaveLength(12);
    expect(yearDistribution(withGap)).toBeNull();
  });

  it("FR9 with a blank month is null", () => {
    const blank = months(12).map((p, i) =>
      i === 4 ? { ...p, month_yield: null } : p,
    );

    expect(yearDistribution(blank)).toBeNull();
  });
});

describe("reportStale", () => {
  it("is stale after the period plus two months and 20 days", () => {
    expect(reportStale("2026-10-01", "2026-12-21")).toBe(false);
    expect(reportStale("2026-10-01", "2026-12-22")).toBe(true);
  });
});

function months(count: number): Period[] {
  return Array.from({ length: count }, (_, i) => {
    const index = 2026 * 12 + 9 - i;
    const month = String((index % 12) + 1).padStart(2, "0");

    return period(`${String(Math.floor(index / 12))}-${month}-01`, {
      month_yield: "0.01",
      unit_book_value: "110",
    });
  });
}

function period(date: string, over: Partial<Period>): Period {
  return {
    period: date,
    delivered: null,
    net_assets: null,
    holders: null,
    units: null,
    unit_book_value: null,
    admin_fee: null,
    month_yield: null,
    month_amortization: null,
    ...over,
  };
}

function report(periods: Period[]): Report {
  return {
    source: "br_cvm_fii",
    source_url: "https://example.test",
    exchange: "B3",
    code: "HGLG11",
    currency: "BRL",
    identifier: "1",
    name: "Fund",
    segment: "",
    periods,
  };
}
