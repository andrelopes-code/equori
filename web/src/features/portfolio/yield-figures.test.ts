import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  returnLines,
  yieldCards,
  yieldLine,
} from "@/features/portfolio/yield-figures";

type ReturnReport = components["schemas"]["ReturnReport"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
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
    return_bp: -1380,
    index_bp: 352,
    excess_bp: -1732,
    index_annual_bp: 1490,
  },
};

describe("yieldLine", () => {
  it("reads a rate profile as a rate a year and a percent of the index", () => {
    expect(yieldLine(rate, t, "en")).toEqual({
      primary: "15.17% a year",
      secondary: "101.80% of CDI",
      negative: false,
    });
  });

  it("reads a market profile as the return beside the index, never annualized", () => {
    expect(yieldLine(market, t, "en")).toEqual({
      primary: "−13.80%",
      secondary: "CDI 3.52%",
      negative: true,
    });
  });

  it("reads the period return alone without an index", () => {
    expect(
      yieldLine({ ...base, profile: "market", period_bp: -1400 }, t, "en"),
    ).toEqual({
      primary: "−14.00%",
      negative: true,
    });
  });

  it("states nothing without a return", () => {
    expect(yieldLine({ ...base, profile: "rate" }, t, "en")).toBeUndefined();
  });
});

describe("yieldCards", () => {
  it("gives a rate profile its rate a year, percent of the index and real return", () => {
    expect(
      yieldCards(rate, t, "en").map((c) => [
        c.label,
        c.value,
        c.note,
        c.negative,
      ]),
    ).toEqual([
      [
        "Rate a year",
        "15.17% a year",
        "14.80% in 245 business days, 11/03/2025 to 10/16/2026",
        false,
      ],
      [
        "Percent of CDI",
        "101.80%",
        "CDI 14.90% a year over the same days",
        false,
      ],
      [
        "Real return",
        "8.10%",
        "13.50% less IPCA 5.00%, 11/01/2025 to 09/30/2026",
        false,
      ],
    ]);
  });

  it("gives a market profile its return and its difference from the index", () => {
    expect(
      yieldCards(market, t, "en").map((c) => [
        c.label,
        c.value,
        c.note,
        c.negative,
      ]),
    ).toEqual([
      [
        "Return",
        "−13.80%",
        "63 business days, 07/20/2026 to 10/16/2026; not annualized",
        true,
      ],
      ["Against CDI", "−17.32 pp", "CDI 3.52% over the same days", true],
    ]);
  });
});

describe("returnLines", () => {
  it("states every figure of a rate profile", () => {
    expect(returnLines(rate, t, "en")).toEqual([
      "Time-weighted return of the period: 14.90%",
      "Rate a year over 245 business days: 15.17%",
      "101.80% of CDI from 11/03/2025 to 10/16/2026",
      "CDI over the same days: 14.55%",
      "Against CDI over the same days: +0.25 pp",
      "Real return, less IPCA 5.00% from 11/01/2025 to 09/30/2026: 8.10%",
    ]);
  });

  it("says why a market profile has no rate a year or percent of the index", () => {
    expect(returnLines(market, t, "en")).toEqual([
      "Time-weighted return of the period: −14.00%",
      "CDI over the same days: 3.52%",
      "Against CDI over the same days: −17.32 pp",
      "Market prices: the return is not annualized or stated as a percent of CDI.",
    ]);
  });
});
