import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

import { yieldGroups, yieldLine } from "@/features/portfolio/yield-figures";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type ReturnReport = components["schemas"]["ReturnReport"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

// The first day of the 90-day window of the balance sheet dated 2026-11-06.
const WINDOW_START = "2026-08-09";

const tPtBR: TFunction = (key, params) =>
  catalogPtBR[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const base = {
  annual_bp: 1500,
  flows: [],
  opening: { amount: 1000000, currency: "BRL" },
  closing: { amount: 1151700, currency: "BRL" },
};

// A savings account paid 101.80% of the CDI over 245 CDI days, with IPCA 5.00% over 11 months.
const rate: ReturnReport = {
  ...base,
  profile: "rate",
  period_bp: 1490,
  benchmark: {
    index: "cdi",
    from: "2025-11-03",
    until: "2026-10-16",
    days: 245,
    skipped: 0,
    return_bp: 1480,
    index_bp: 1455,
    percent_bp: 10180,
    annual_bp: 1517,
    index_annual_bp: 1490,
    excess_bp: 25,
  },
  inflation: {
    index: "ipca",
    from: "2025-11-01",
    until: "2026-09-30",
    index_bp: 500,
    return_bp: 1350,
    real_bp: 810,
  },
};

// A crypto brokerage that lost 13.80% while the CDI grew 3.52%.
const market: ReturnReport = {
  ...base,
  profile: "market",
  period_bp: -1400,
  benchmark: {
    index: "cdi",
    from: "2026-07-20",
    until: "2026-10-16",
    days: 63,
    skipped: 0,
    return_bp: -1380,
    index_bp: 352,
    excess_bp: -1732,
    index_annual_bp: 1490,
  },
};

describe("yieldLine", () => {
  it("reads a rate profile as a rate a year and a percent of the index", () => {
    expect(yieldLine(rate, t, "en", WINDOW_START)).toEqual({
      primary: "15.17% a year",
      secondary: "101.80% of CDI",
      negative: false,
    });
  });

  it("reads a market profile as the return beside the index, never annualized", () => {
    expect(yieldLine(market, t, "en", WINDOW_START)).toEqual({
      primary: "−13.80%",
      secondary: "CDI 3.52%",
      negative: true,
    });
  });

  it("reads the period return alone without an index", () => {
    expect(
      yieldLine(
        { ...base, profile: "market", period_bp: -1400 },
        t,
        "en",
        WINDOW_START,
      ),
    ).toEqual({
      primary: "−14.00% in the period",
      negative: true,
    });
  });

  it("reads the period return alone in Portuguese", () => {
    expect(
      yieldLine(
        { ...base, profile: "market", period_bp: -1400 },
        tPtBR,
        "pt-BR",
        WINDOW_START,
      )?.primary,
    ).toBe("−14,00% no período");
  });

  it("says from when the comparison runs when it starts late (A208 R8)", () => {
    const late: ReturnReport = {
      ...rate,
      benchmark: {
        index: "cdi",
        from: "2026-10-19",
        until: "2026-11-06",
        days: 13,
        skipped: 50,
        return_bp: 63,
        index_bp: 62,
        percent_bp: 10180,
        annual_bp: 1517,
      },
    };
    expect(yieldLine(late, t, "en", WINDOW_START)?.secondary).toBe(
      "101.80% of CDI · since 10/19/2026",
    );
  });

  it.each([
    ["8 days after the window start", "2026-08-17", true],
    ["7 days after the window start", "2026-08-16", false],
    ["3 days after the window start", "2026-08-12", false],
  ])("notes the start of the comparison %s: %s", (_, from, noted) => {
    const starts: ReturnReport = {
      ...rate,
      benchmark: { ...rate.benchmark, from } as ReturnBenchmark,
    };

    expect(
      yieldLine(starts, t, "en", WINDOW_START)?.secondary?.includes("since"),
    ).toBe(noted);
  });

  it("states nothing without a return", () => {
    expect(
      yieldLine({ ...base, profile: "rate" }, t, "en", WINDOW_START),
    ).toBeUndefined();
  });
});

describe("yieldGroups", () => {
  const read = (report: ReturnReport) =>
    yieldGroups(report, t, "en").map((g) => ({
      title: g.title,
      period: g.period,
      rows: g.rows.map((r) => [r.term, r.value, r.emphasis, r.negative]),
    }));

  it("groups a rate profile by the days compared and the months of inflation", () => {
    expect(read(rate)).toEqual([
      {
        title: "Compared with CDI",
        period: "11/03/2025 to 10/16/2026 · 245 days with a CDI rate",
        rows: [
          ["Rate a year", "15.17% a year", true, false],
          ["Percent of CDI", "101.80%", true, false],
          ["Return", "14.80%", false, false],
          ["CDI in the period", "14.55% (14.90% a year)", false, false],
        ],
      },
      {
        title: "Net of IPCA",
        period: "11/01/2025 to 09/30/2026 · months with a published IPCA",
        rows: [
          ["Return", "13.50%", false, false],
          ["IPCA in the period", "5.00%", false, false],
          ["Real return", "8.10%", true, false],
        ],
      },
    ]);
  });

  it("leads a market profile with its return and its difference from the index", () => {
    expect(read(market)).toEqual([
      {
        title: "Compared with CDI",
        period: "07/20/2026 to 10/16/2026 · 63 days with a CDI rate",
        rows: [
          ["Return", "−13.80%", true, true],
          ["CDI in the period", "3.52%", false, false],
          ["Difference from CDI", "−17.32 pp", true, true],
        ],
      },
    ]);
  });
});
