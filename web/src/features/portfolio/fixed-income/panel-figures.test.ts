import { describe, expect, it } from "vitest";

import { exposureTracks } from "@/features/portfolio/fixed-income/exposure-tracks";
import { maturityLadder } from "@/features/portfolio/fixed-income/maturity-ladder";
import { returnShares } from "@/features/portfolio/fixed-income/return-shares";
import {
  timelineFrom,
  timelinePoints,
} from "@/features/portfolio/fixed-income/timeline-points";
import { fixedIncomeVerdict } from "@/features/portfolio/fixed-income/verdict";
import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const brl = (amount: number) => ({ amount, currency: "BRL" });

// The six contracts of the approved mock (FC36), values in minor units of BRL.
const holdings = [
  { code: "CDBX", value: 20000000 },
  { code: "LCIX", value: 10000000 },
  { code: "LFX", value: 3000000 },
  { code: "DEBY", value: 5000000 },
  { code: "NTNB35", value: 2000000 },
  { code: "CDBZ", value: 1230000 },
];

const terms = new Map([
  ["CDBX", { index_id: "cdi", matures_on: "2028-03-02" }],
  ["LCIX", { index_id: "cdi", matures_on: "2027-05-10" }],
  ["LFX", { index_id: "cdi", matures_on: "2030-08-01" }],
  ["DEBY", { index_id: "ipca", matures_on: "2032-06-15" }],
  ["NTNB35", { index_id: "ipca", matures_on: "2035-05-15" }],
  ["CDBZ", { matures_on: "2026-12-15" }],
]);

const indexes = [
  { id: "cdi", period: "day" as const },
  { id: "ipca", period: "month" as const },
];

const t: TFunction = (key, vars) =>
  catalogEn[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    String(vars?.[name] ?? whole),
  );

const fmt = {
  money: (m: { amount: number }) =>
    `R$${(m.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  day: (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
};

describe("returnShares", () => {
  it("splits the value by return kind in whole percents that sum to 100", () => {
    expect(returnShares(holdings, terms, indexes)).toEqual([
      { kind: "rate", value: 33000000, share: 80 },
      { kind: "inflation", value: 7000000, share: 17 },
      { kind: "fixed", value: 1230000, share: 3 },
    ]);
  });

  it("puts a holding without terms under none", () => {
    const shares = returnShares(
      [...holdings, { code: "NOTERMS", value: 770000 }],
      terms,
      indexes,
    );

    expect(shares.at(-1)).toEqual({ kind: "none", value: 770000, share: 2 });
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBe(100);
  });
});

describe("maturityLadder", () => {
  it("sums the value by year of maturity against the largest year", () => {
    expect(maturityLadder(holdings, terms, indexes)).toEqual([
      { year: 2026, value: 1230000, width: 6.15, kind: "fixed" },
      { year: 2027, value: 10000000, width: 50, kind: "rate" },
      { year: 2028, value: 20000000, width: 100, kind: "rate" },
      { year: 2030, value: 3000000, width: 15, kind: "rate" },
      { year: 2032, value: 5000000, width: 25, kind: "inflation" },
      { year: 2035, value: 2000000, width: 10, kind: "inflation" },
    ]);
  });
});

const events = [
  {
    instrument: "LFX",
    date: "2026-11-10",
    kind: "interest",
    state: "due",
    gross: brl(82000),
  },
  {
    instrument: "DEBY",
    date: "2026-12-02",
    kind: "interest",
    state: "upcoming",
    gross: brl(158000),
  },
  {
    instrument: "CDBZ",
    date: "2026-12-15",
    kind: "maturity",
    state: "upcoming",
    gross: brl(1342000),
  },
  {
    instrument: "CDBX",
    date: "2027-01-05",
    kind: "interest",
    state: "upcoming",
    gross: brl(60683),
  },
  {
    instrument: "NTNB35",
    date: "2027-02-01",
    kind: "interest",
    state: "upcoming",
  },
];

describe("timelinePoints", () => {
  it("places each event in percent of the window", () => {
    const points = timelinePoints(events, "2026-08-20", "2027-02-15");

    expect(points.map((p) => [p.left, p.due])).toEqual([
      [45.81, true],
      [58.1, false],
      [65.36, false],
      [77.09, false],
      [92.18, false],
    ]);
  });
});

describe("timelineFrom", () => {
  it("leaves ten days before today so that today sits at 10% of the window", () => {
    const from = timelineFrom("2026-11-18");

    expect(from).toBe("2026-11-08");
    expect(timelinePoints(events, from, "2027-02-16")[0]?.left).toBeLessThan(
      10,
    );
    expect(
      timelinePoints(
        [{ instrument: "", date: "2026-11-18", kind: "", state: "" }],
        from,
        "2027-02-16",
      )[0]?.left,
    ).toBe(10);
  });

  it("hides the label of a dot within 4 points of the last visible label", () => {
    const close = [
      {
        instrument: "A",
        date: "2027-01-04",
        kind: "interest",
        state: "upcoming",
      },
      {
        instrument: "B",
        date: "2027-01-05",
        kind: "interest",
        state: "upcoming",
      },
      {
        instrument: "C",
        date: "2027-02-01",
        kind: "interest",
        state: "upcoming",
      },
    ];

    expect(
      timelinePoints(close, "2026-11-08", "2027-02-16").map((p) => p.labelled),
    ).toEqual([true, false, true]);
  });

  it("clamps an event older than the window to the start", () => {
    const old = [
      { instrument: "A", date: "2026-08-01", kind: "interest", state: "due" },
    ];

    expect(timelinePoints(old, "2026-11-08", "2027-02-16")[0]?.left).toBe(0);
  });
});

const report = {
  date: "2026-11-18",
  issuers: [
    {
      issuer: "Banco X",
      market_value: brl(33000000),
      covered_value: brl(30000000),
      uncovered_value: brl(3000000),
      limit: brl(25000000),
      excess: brl(5000000),
    },
    {
      issuer: "Debênture Y",
      market_value: brl(5000000),
      covered_value: brl(0),
      uncovered_value: brl(5000000),
      limit: brl(25000000),
      excess: brl(0),
    },
    {
      issuer: "Banco Z",
      market_value: brl(1230000),
      covered_value: brl(1230000),
      uncovered_value: brl(0),
      limit: brl(25000000),
      excess: brl(0),
    },
  ],
  guarantee: {
    name: "FGC",
    limit_per_issuer: brl(25000000),
    limit_per_period: brl(100000000),
    period_years: 4,
    covered: ["cdb", "lci"],
  },
  period_note: false,
  missing_prices: [],
};

describe("exposureTracks", () => {
  it("draws covered, excess and uncovered against a scale with room after the largest", () => {
    expect(exposureTracks(report)).toEqual([
      {
        issuer: "Banco X",
        covered: 68.87,
        excess: 13.77,
        uncovered: 8.26,
        limit: 68.87,
        figure: "excess",
        amount: brl(5000000),
      },
      {
        issuer: "Debênture Y",
        covered: 0,
        excess: 0,
        uncovered: 13.77,
        limit: 68.87,
        figure: "uncovered",
        amount: brl(0),
      },
      {
        issuer: "Banco Z",
        covered: 3.39,
        excess: 0,
        uncovered: 0,
        limit: 68.87,
        figure: "covered",
        amount: brl(0),
      },
    ]);
  });

  it("states the value of each issuer without a guarantee", () => {
    const tracks = exposureTracks({
      issuers: [
        {
          issuer: "Bund",
          market_value: brl(100000),
          covered_value: brl(0),
          uncovered_value: brl(100000),
        },
      ],
    });

    expect(tracks).toEqual([
      {
        issuer: "Bund",
        covered: 0,
        excess: 0,
        uncovered: 90.91,
        limit: undefined,
        figure: "value",
        amount: brl(100000),
      },
    ]);
  });
});

describe("fixedIncomeVerdict", () => {
  it("leads with the largest excess over the guarantee (mock)", () => {
    expect(fixedIncomeVerdict(report, events, t, fmt)).toEqual({
      tone: "danger",
      line: "R$50,000.00 above the FGC at Banco X",
      detail: "1 payment to record · matures on 15/12: R$13,420.00",
    });
  });

  it("leads with the payments to record when no guarantee is exceeded", () => {
    const quiet = { ...report, issuers: report.issuers.slice(1) };

    expect(fixedIncomeVerdict(quiet, events, t, fmt)).toEqual({
      tone: "danger",
      line: "1 payment to record",
      detail: "matures on 15/12: R$13,420.00",
    });
  });

  it("states the next maturity when nothing needs attention", () => {
    const quiet = { ...report, issuers: report.issuers.slice(1) };
    const upcoming = events.filter((e) => e.state !== "due");

    expect(fixedIncomeVerdict(quiet, upcoming, t, fmt)).toEqual({
      tone: "neutral",
      line: "Next maturity on 15/12: R$13,420.00",
      detail: "",
    });
  });
});
