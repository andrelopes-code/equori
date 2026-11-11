import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";
import {
  comparedReturn,
  marketReturn,
  plainReturn,
} from "@/testing/portfolio-api";

import { comparisonAxis } from "@/features/portfolio/model/return-axis";
import {
  type ReturnComparison,
  type ReturnSubject,
  returnSummary,
} from "@/features/portfolio/model/return-summary";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type ReturnInflation = components["schemas"]["ReturnInflation"];
type ReturnReport = components["schemas"]["ReturnReport"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const tPtBR: TFunction = (key, params) =>
  catalogPtBR[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const benchmarkDefaults = {
  started_late: false,
  credits: 0,
  restarted: false,
  skipped: 0,
};

const plain: ReturnReport = { ...plainReturn, profile: "rate" };

const compared: ReturnReport = {
  ...comparedReturn,
  profile: "rate",
  benchmark: { ...comparedReturn.benchmark, ...benchmarkDefaults },
};

const marketBenchmark: ReturnBenchmark = {
  ...marketReturn.benchmark,
  ...benchmarkDefaults,
};

const marketWithoutInflation: ReturnReport = {
  ...plainReturn,
  profile: "market",
  period_bp: marketReturn.period_bp,
  benchmark: marketBenchmark,
};

const market: ReturnReport = {
  ...marketWithoutInflation,
  inflation: marketReturn.inflation,
};

// A savings account paid 104.30% of the CDI, with IPCA 4.41% over twelve months.
const rateBenchmark: ReturnBenchmark = {
  ...benchmarkDefaults,
  index: "cdi",
  from: "2025-11-03",
  until: "2026-10-16",
  days: 245,
  return_bp: 1342,
  index_bp: 1287,
  percent_bp: 10430,
  annual_bp: 1412,
};

const rateInflation: ReturnInflation = {
  index: "ipca",
  from: "2025-11-01",
  until: "2026-10-31",
  index_bp: 441,
  return_bp: 1230,
  real_bp: 755,
};

const rateWithoutInflation: ReturnReport = {
  ...plain,
  period_bp: 1342,
  benchmark: rateBenchmark,
};

const rate: ReturnReport = {
  ...rateWithoutInflation,
  inflation: rateInflation,
};

const noYield: ReturnReport = {
  ...plain,
  period_bp: 1342,
  inflation: rateInflation,
  unavailable_reason: "no_yield_recorded",
};

const noYieldWithoutInflation: ReturnReport = {
  ...plain,
  period_bp: 1342,
  unavailable_reason: "no_yield_recorded",
};

describe("returnSummary", () => {
  const cases: {
    name: string;
    report: ReturnReport;
    subject: ReturnSubject;
    verdict: string | undefined;
    comparisons: ReturnComparison[];
    axisValues?: number[];
  }[] = [
    {
      name: "a market return below the index, with inflation",
      report: market,
      subject: "portfolio",
      verdict:
        "In the period, the portfolio returned −10.00%: 10.33 pp below the CDI, with a real return of −0.89% over the IPCA.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "danger", icon: "down", text: "−10.33 pp" },
          bars: [
            { key: "subject", label: "Portfolio", bp: -1000 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
        {
          key: "inflation",
          heading: "Against inflation",
          window: "11/01/2025 to 12/31/2025",
          chip: { tone: "danger", icon: "down", text: "−0.89% real" },
          bars: [
            { key: "subject", label: "Portfolio", bp: 0 },
            { key: "inflation", label: "IPCA", bp: 90 },
          ],
        },
      ],
      axisValues: [-1000, 33, 0, 90],
    },
    {
      name: "a compared return at 100% of the index",
      report: compared,
      subject: "portfolio",
      verdict:
        "In the period, the portfolio returned 0.33%, against 0.33% of the CDI.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "success", icon: "check", text: "100.00% of the CDI" },
          bars: [
            { key: "subject", label: "Portfolio", bp: 33 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
      ],
      axisValues: [33, 33],
    },
    {
      name: "a report without a period return",
      report: plain,
      subject: "account",
      verdict: undefined,
      comparisons: [],
    },
    {
      name: "a period return without a comparison",
      report: { ...plain, period_bp: 500 },
      subject: "account",
      verdict: "In the period, the account returned 5.00%.",
      comparisons: [],
    },
    {
      name: "a rate return with percent, annual rate and inflation",
      report: rate,
      subject: "account",
      verdict:
        "In the period, the account returned 13.42%: 104.30% of the CDI (14.12% a year), with a real return of 7.55% over the IPCA.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "11/03/2025 to 10/16/2026 · 245 days",
          chip: { tone: "success", icon: "check", text: "104.30% of the CDI" },
          bars: [
            { key: "subject", label: "Account", bp: 1342 },
            { key: "index", label: "CDI", bp: 1287 },
          ],
        },
        {
          key: "inflation",
          heading: "Against inflation",
          window: "11/01/2025 to 10/31/2026",
          chip: { tone: "success", icon: "up", text: "7.55% real" },
          bars: [
            { key: "subject", label: "Account", bp: 1230 },
            { key: "inflation", label: "IPCA", bp: 441 },
          ],
        },
      ],
      axisValues: [1342, 1287, 1230, 441],
    },
    {
      name: "a rate return below the index",
      report: {
        ...rateWithoutInflation,
        benchmark: { ...rateBenchmark, percent_bp: 9500, annual_bp: 1300 },
      },
      subject: "account",
      verdict:
        "In the period, the account returned 13.42%: 95.00% of the CDI (13.00% a year).",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "11/03/2025 to 10/16/2026 · 245 days",
          chip: { tone: "danger", icon: "down", text: "95.00% of the CDI" },
          bars: [
            { key: "subject", label: "Account", bp: 1342 },
            { key: "index", label: "CDI", bp: 1287 },
          ],
        },
      ],
      axisValues: [1342, 1287],
    },
    {
      name: "a market return above the index",
      report: {
        ...marketWithoutInflation,
        benchmark: { ...marketBenchmark, return_bp: 427, excess_bp: 394 },
      },
      subject: "portfolio",
      verdict:
        "In the period, the portfolio returned 4.27%: 3.94 pp above the CDI.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "success", icon: "up", text: "+3.94 pp" },
          bars: [
            { key: "subject", label: "Portfolio", bp: 427 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
      ],
      axisValues: [427, 33],
    },
    {
      name: "a market return in line with the index",
      report: {
        ...marketWithoutInflation,
        benchmark: { ...marketBenchmark, return_bp: 33, excess_bp: 0 },
      },
      subject: "portfolio",
      verdict:
        "In the period, the portfolio returned 0.33%: in line with the CDI.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "neutral", icon: "equal", text: "0.00 pp" },
          bars: [
            { key: "subject", label: "Portfolio", bp: 33 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
      ],
      axisValues: [33, 33],
    },
    {
      name: "a reason that withholds the period return, without a benchmark",
      report: noYieldWithoutInflation,
      subject: "account",
      verdict: undefined,
      comparisons: [],
    },
    {
      name: "a reason that withholds the period return, with inflation",
      report: noYield,
      subject: "account",
      verdict: undefined,
      comparisons: [
        {
          key: "inflation",
          heading: "Against inflation",
          window: "11/01/2025 to 10/31/2026",
          chip: { tone: "success", icon: "up", text: "7.55% real" },
          bars: [
            { key: "subject", label: "Account", bp: 1230 },
            { key: "inflation", label: "IPCA", bp: 441 },
          ],
        },
      ],
      axisValues: [1230, 441],
    },
  ];

  it.each(cases)("en: $name", (c) => {
    const got = returnSummary(c.report, c.subject, t, "en");

    expect(got.verdict).toBe(c.verdict);
    expect(got.comparisons).toEqual(c.comparisons);
    expect(got.axis).toEqual(
      c.axisValues === undefined ? undefined : comparisonAxis(c.axisValues),
    );
  });

  it("pt-BR: a market return below the index, with inflation", () => {
    const got = returnSummary(market, "portfolio", tPtBR, "pt-BR");

    expect(got.verdict).toBe(
      "No período, a carteira rendeu −10,00%: 10,33 p.p. abaixo do CDI, com retorno real de −0,89% sobre o IPCA.",
    );
    expect(got.comparisons).toEqual([
      {
        key: "index",
        heading: "Contra o CDI",
        window: "02/01/2026 a 09/01/2026 · 6 dias",
        chip: { tone: "danger", icon: "down", text: "−10,33 p.p." },
        bars: [
          { key: "subject", label: "Carteira", bp: -1000 },
          { key: "index", label: "CDI", bp: 33 },
        ],
      },
      {
        key: "inflation",
        heading: "Contra a inflação",
        window: "01/11/2025 a 31/12/2025",
        chip: { tone: "danger", icon: "down", text: "−0,89% real" },
        bars: [
          { key: "subject", label: "Carteira", bp: 0 },
          { key: "inflation", label: "IPCA", bp: 90 },
        ],
      },
    ]);
  });

  it("pt-BR: a rate return with percent, annual rate and inflation", () => {
    const got = returnSummary(rate, "account", tPtBR, "pt-BR");

    expect(got.verdict).toBe(
      "No período, a conta rendeu 13,42%: 104,30% do CDI (14,12% ao ano), com retorno real de 7,55% sobre o IPCA.",
    );
    expect(got.comparisons[0]?.chip).toEqual({
      tone: "success",
      icon: "check",
      text: "104,30% do CDI",
    });
  });
});
