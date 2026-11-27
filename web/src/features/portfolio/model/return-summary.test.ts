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
    days?: number;
    verdict: string | undefined;
    comparisons: Omit<ReturnComparison, "help">[];
    axisValues?: number[];
  }[] = [
    {
      name: "a market return below the index, with inflation",
      report: market,
      verdict: "In the period, the account returned −10.00%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "danger", icon: "down", text: "−10.33 pp" },
          bars: [
            { key: "subject", label: "Account", bp: -1000 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
        {
          key: "inflation",
          heading: "Against inflation",
          window: "Account and IPCA, 11/01/2025 to 12/31/2025",
          chip: { tone: "danger", icon: "down", text: "−0.89% real" },
          bars: [
            { key: "subject", label: "Account", bp: 0 },
            { key: "inflation", label: "IPCA", bp: 90 },
          ],
        },
      ],
      axisValues: [-1000, 33, 0, 90],
    },
    {
      name: "a compared return at 100% of the index",
      report: compared,
      verdict: "In the period, the account returned 0.33%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "success", icon: "check", text: "100.00% of the CDI" },
          bars: [
            { key: "subject", label: "Account", bp: 33 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
      ],
      axisValues: [33, 33],
    },
    {
      name: "a report without a period return",
      report: plain,
      verdict: undefined,
      comparisons: [],
    },
    {
      name: "a period return without a comparison",
      report: { ...plain, period_bp: 500 },
      verdict: "In the period, the account returned 5.00%.",
      comparisons: [],
    },
    {
      name: "a rate return with percent, annual rate and inflation",
      report: rate,
      verdict: "In the period, the account returned 13.42%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 11/03/2025 to 10/16/2026 · 245 days",
          chip: { tone: "success", icon: "check", text: "104.30% of the CDI" },
          bars: [
            { key: "subject", label: "Account", bp: 1342 },
            { key: "index", label: "CDI", bp: 1287 },
          ],
        },
        {
          key: "inflation",
          heading: "Against inflation",
          window: "Account and IPCA, 11/01/2025 to 10/31/2026",
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
      verdict: "In the period, the account returned 13.42%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 11/03/2025 to 10/16/2026 · 245 days",
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
      verdict: "In the period, the account returned −10.00%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "success", icon: "up", text: "+3.94 pp" },
          bars: [
            { key: "subject", label: "Account", bp: 427 },
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
      verdict: "In the period, the account returned −10.00%.",
      comparisons: [
        {
          key: "index",
          heading: "Against the CDI",
          window: "Account and CDI, 01/02/2026 to 01/09/2026 · 6 days",
          chip: { tone: "neutral", icon: "equal", text: "0.00 pp" },
          bars: [
            { key: "subject", label: "Account", bp: 33 },
            { key: "index", label: "CDI", bp: 33 },
          ],
        },
      ],
      axisValues: [33, 33],
    },
    {
      name: "a reason that withholds the period return, without a benchmark",
      report: noYieldWithoutInflation,
      verdict: undefined,
      comparisons: [],
    },
    {
      name: "a reason that withholds the period return, with inflation",
      report: noYield,
      verdict: undefined,
      comparisons: [
        {
          key: "inflation",
          heading: "Against inflation",
          window: "Account and IPCA, 11/01/2025 to 10/31/2026",
          chip: { tone: "success", icon: "up", text: "7.55% real" },
          bars: [
            { key: "subject", label: "Account", bp: 1230 },
            { key: "inflation", label: "IPCA", bp: 441 },
          ],
        },
      ],
      axisValues: [1230, 441],
    },
    {
      name: "a single credit keeps the period return (HR7)",
      report: {
        ...noYieldWithoutInflation,
        unavailable_reason: "single_credit",
      },
      verdict: "In the period, the account returned 13.42%.",
      comparisons: [],
    },
    {
      name: "a balance too small withholds the period return (HR7)",
      report: { ...noYieldWithoutInflation, unavailable_reason: "too_small" },
      verdict: undefined,
      comparisons: [],
    },
    {
      name: "a period of 366 days states no annual rate (HR3)",
      report: { ...plain, period_bp: 2100 },
      days: 366,
      verdict: "In the period, the account returned 21.00%.",
      comparisons: [],
    },
    {
      name: "a period of two years states the annual rate (HR3)",
      report: { ...plain, period_bp: 2100 },
      days: 730,
      verdict: "In the period, the account returned 21.00%, or 10.00% a year.",
      comparisons: [],
    },
  ];

  it.each(cases)("en: $name", (c) => {
    const got = returnSummary(c.report, t, "en", c.days);

    expect(got.verdict).toBe(c.verdict);
    expect(got.comparisons.map(withoutHelp)).toEqual(c.comparisons);
    expect(got.axis).toEqual(
      c.axisValues === undefined ? undefined : comparisonAxis(c.axisValues),
    );
  });

  it("pt-BR: a market return below the index, with inflation", () => {
    const got = returnSummary(market, tPtBR, "pt-BR");

    expect(got.verdict).toBe("No período, a conta rendeu −10,00%.");
    expect(got.comparisons.map(withoutHelp)).toEqual([
      {
        key: "index",
        heading: "Contra o CDI",
        window: "Conta e CDI, de 02/01/2026 a 09/01/2026 · 6 dias",
        chip: { tone: "danger", icon: "down", text: "−10,33 p.p." },
        bars: [
          { key: "subject", label: "Conta", bp: -1000 },
          { key: "index", label: "CDI", bp: 33 },
        ],
      },
      {
        key: "inflation",
        heading: "Contra a inflação",
        window: "Conta e IPCA, de 01/11/2025 a 31/12/2025",
        chip: { tone: "danger", icon: "down", text: "−0,89% real" },
        bars: [
          { key: "subject", label: "Conta", bp: 0 },
          { key: "inflation", label: "IPCA", bp: 90 },
        ],
      },
    ]);
  });

  it("pt-BR: a rate return with percent, annual rate and inflation", () => {
    const got = returnSummary(rate, tPtBR, "pt-BR");

    expect(got.verdict).toBe("No período, a conta rendeu 13,42%.");
    expect(got.comparisons[0]?.chip).toEqual({
      tone: "success",
      icon: "check",
      text: "104,30% do CDI",
    });
  });
});

describe("returnSummary help", () => {
  it("explains the period return and each comparison window (HR4, HR6)", () => {
    const got = returnSummary(market, t, "en");

    expect(got.verdictHelp).toBe(
      "How much each 100 invested at the start of the period earned by its end. Deposits and withdrawals do not change this figure, so it can be compared with indexes.",
    );
    expect(got.comparisons.map((c) => c.help)).toEqual([
      "The CDI has a rate only on business days already published. Both bars measure the account and the CDI on those days, so the figure can differ from the period return.",
      "The IPCA is published once a month. Both bars measure the account and the IPCA over whole published months only, so the figure can differ from the period return. The real return is what the account earned above the IPCA.",
    ]);
  });

  it("adds the meaning of the annual rate to a period above a year", () => {
    const got = returnSummary({ ...plain, period_bp: 2100 }, t, "en", 730);

    expect(got.verdictHelp).toContain(
      "The annual rate is the rate that, repeated every year, reaches the same return.",
    );
  });
});

function withoutHelp({
  key,
  heading,
  window,
  chip,
  bars,
}: ReturnComparison): Omit<ReturnComparison, "help"> {
  return {
    key,
    heading,
    window,
    ...(chip === undefined ? {} : { chip }),
    bars,
  };
}
