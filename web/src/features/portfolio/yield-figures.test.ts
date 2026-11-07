import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  yieldGroups,
  yieldLine,
  yieldNotes,
} from "@/features/portfolio/yield-figures";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type ReturnReport = components["schemas"]["ReturnReport"];

const t: TFunction = (key, params) =>
  catalogEn[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const tPtBR: TFunction = (key, params) =>
  catalogPtBR[key].replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(params?.[name]),
  );

const base = {
  annual_bp: 1500,
  index: "cdi",
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
    credits: 0,
    restarted: false,
    started_late: false,
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
    credits: 0,
    restarted: false,
    started_late: false,
    return_bp: -1380,
    index_bp: 352,
    excess_bp: -1732,
    index_annual_bp: 1490,
  },
};

// The first day of the 90 days that end on 2026-10-16.
const WINDOW_FROM = "2026-07-19";

const money = (m: { amount: number; currency: string }) =>
  `${m.currency} ${(m.amount / 100).toFixed(2)}`;

const REASONS = [
  ["no_index_for_region", "No reference index for the region"],
  ["currency_mismatch", "Values in BRL: CDI applies to another currency"],
  ["nothing_held", "Nothing held in the period"],
  ["no_yield_recorded", "No yield recorded in the period"],
  ["single_credit", "Only one yield credit recorded"],
  ["too_small", "Balance too small: credits are rounded to the cent"],
  [
    "too_few_days",
    "Fewer than 5 days with a CDI rate: one credit would distort the percent",
  ],
  ["no_rate_in_window", "CDI has no rate yet for the days compared"],
  ["percent_undefined", "The percent of CDI is not defined for this return"],
] as const;

function without(
  report: ReturnReport,
  ...keys: (keyof ReturnBenchmark)[]
): ReturnBenchmark {
  return Object.fromEntries(
    Object.entries(report.benchmark ?? {}).filter(
      ([key]) => !keys.includes(key as keyof ReturnBenchmark),
    ),
  ) as ReturnBenchmark;
}

function withBenchmark(overrides: Partial<ReturnBenchmark>): ReturnReport {
  return {
    ...rate,
    benchmark: { ...rate.benchmark, ...overrides } as ReturnBenchmark,
  };
}

describe("yieldLine", () => {
  it("reads a rate profile as a rate a year and a percent of the index, with no days (R21)", () => {
    expect(yieldLine(rate, t, "en", WINDOW_FROM)).toEqual({
      primary: "15.17% a year",
      secondary: "101.80% of CDI",
      negative: false,
    });
  });

  it("reads the Portuguese rate profile without an article before the index (R21, R23)", () => {
    expect(yieldLine(rate, tPtBR, "pt-BR", WINDOW_FROM)).toEqual({
      primary: "15,17% a.a.",
      secondary: "101,80% do índice CDI",
      negative: false,
    });
  });

  it.each([
    [14, "15.17% a year"],
    [1, "15.17% a year"],
    [245, "15.17% a year"],
  ])("reads a rate a year from %s days compared (R21)", (days, primary) => {
    expect(
      yieldLine(withBenchmark({ days }), t, "en", WINDOW_FROM)?.primary,
    ).toBe(primary);
  });

  it("reads the rate a year, the percent and the day a late start begins from (R21)", () => {
    const late = withBenchmark({
      days: 14,
      from: "2026-10-19",
      started_late: true,
    });

    expect(yieldLine(late, t, "en", WINDOW_FROM)).toEqual({
      primary: "15.17% a year",
      secondary: "101.80% of CDI",
      since: "since 10/19",
      negative: false,
    });
    expect(yieldLine(late, tPtBR, "pt-BR", WINDOW_FROM)).toEqual({
      primary: "15,17% a.a.",
      secondary: "101,80% do índice CDI",
      since: "desde 19/10",
      negative: false,
    });
  });

  it("states no start day for a window whose first rate day is compared (R21)", () => {
    const full = withBenchmark({
      days: 14,
      from: "2026-10-19",
      started_late: false,
    });

    expect(yieldLine(full, t, "en", WINDOW_FROM)?.since).toBeUndefined();
  });

  it("reads the period return when there is no rate a year (R8)", () => {
    const benchmark = without(withBenchmark({}), "annual_bp");

    expect(
      yieldLine({ ...rate, benchmark }, t, "en", WINDOW_FROM)?.primary,
    ).toBe("14.80%");
  });

  it("reads a market profile as the return beside the index, never annualized", () => {
    expect(yieldLine(market, t, "en", WINDOW_FROM)).toEqual({
      primary: "−13.80%",
      secondary: "CDI 3.52%",
      negative: true,
    });
  });

  it("reads a market profile that starts late with the day it starts from (R21)", () => {
    const late: ReturnReport = {
      ...market,
      benchmark: {
        ...market.benchmark,
        from: "2026-10-19",
        started_late: true,
      } as ReturnBenchmark,
    };

    expect(yieldLine(late, t, "en", WINDOW_FROM)).toMatchObject({
      primary: "−13.80%",
      since: "since 10/19",
    });
    expect(yieldLine(late, tPtBR, "pt-BR", WINDOW_FROM)).toMatchObject({
      primary: "−13,80%",
      since: "desde 19/10",
    });
  });

  it.each([
    [100, "101.80% ±1.02 pp of CDI"],
    [99, "101.80% of CDI"],
    [500, "101.80% ±5.09 pp of CDI"],
    [0, "101.80% of CDI"],
  ])(
    "appends the error of the percent only from 100: %s (R22)",
    (error, text) => {
      expect(
        yieldLine(
          withBenchmark({ percent_error_bp: error }),
          t,
          "en",
          WINDOW_FROM,
        )?.secondary,
      ).toBe(text);
    },
  );

  it("appends the error of the percent in Portuguese (R22)", () => {
    expect(
      yieldLine(
        withBenchmark({ percent_error_bp: 100 }),
        tPtBR,
        "pt-BR",
        WINDOW_FROM,
      )?.secondary,
    ).toBe("101,80% ±1,02 p.p. do índice CDI");
  });

  it("states why the percent is absent when the balance is too small (R22)", () => {
    const benchmark = without(withBenchmark({}), "percent_bp", "annual_bp");

    expect(
      yieldLine(
        { ...rate, benchmark, unavailable_reason: "too_small" },
        t,
        "en",
        WINDOW_FROM,
      ),
    ).toEqual({
      primary: "14.80%",
      secondary: "Balance too small: credits are rounded to the cent",
      reason: true,
      negative: false,
    });
  });

  it("states the return and why the percent is absent below five compared days (R22)", () => {
    const benchmark = without(withBenchmark({}), "percent_bp", "annual_bp");
    const report: ReturnReport = {
      ...rate,
      benchmark,
      unavailable_reason: "too_few_days",
    };

    expect(yieldLine(report, t, "en", WINDOW_FROM)).toEqual({
      primary: "14.80%",
      secondary:
        "Fewer than 5 days with a CDI rate: one credit would distort the percent",
      reason: true,
      negative: false,
    });
    expect(yieldLine(report, tPtBR, "pt-BR", WINDOW_FROM)).toEqual({
      primary: "14,80%",
      secondary:
        "Menos de 5 dias com taxa CDI: um crédito distorceria o percentual",
      reason: true,
      negative: false,
    });
  });

  it.each(REASONS)(
    "states why there is no comparison: %s (R23)",
    (reason, text) => {
      expect(
        yieldLine(
          { ...base, profile: "rate", unavailable_reason: reason },
          t,
          "en",
          WINDOW_FROM,
        ),
      ).toEqual({ secondary: text, reason: true, negative: false });
    },
  );

  it.each([
    "no_index_for_region",
    "currency_mismatch",
    "no_rate_in_window",
    "percent_undefined",
  ])(
    "states the period return over the window beside the reason: %s (R8, W2)",
    (reason) => {
      expect(
        yieldLine(
          {
            ...base,
            profile: "rate",
            period_bp: 120,
            unavailable_reason: reason,
          },
          t,
          "en",
          WINDOW_FROM,
        ),
      ).toEqual({
        primary: "1.20%",
        since: "since 07/19",
        reason: true,
        secondary: yieldLine(
          { ...base, profile: "rate", unavailable_reason: reason },
          t,
          "en",
          WINDOW_FROM,
        )?.secondary,
        negative: false,
      });
    },
  );

  it.each(["nothing_held", "no_yield_recorded", "single_credit"])(
    "states the reason alone, never a period return of 0.00%: %s (R8, W2)",
    (reason) => {
      const line = yieldLine(
        { ...base, profile: "rate", period_bp: 0, unavailable_reason: reason },
        t,
        "en",
        WINDOW_FROM,
      );

      expect(line?.primary).toBeUndefined();
      expect(line?.secondary).toBeDefined();
    },
  );

  it("states the period return in Portuguese over the window beside the reason (R8, W2)", () => {
    expect(
      yieldLine(
        {
          ...base,
          profile: "rate",
          period_bp: 120,
          unavailable_reason: "currency_mismatch",
        },
        tPtBR,
        "pt-BR",
        WINDOW_FROM,
      ),
    ).toEqual({
      primary: "1,20%",
      since: "desde 19/07",
      reason: true,
      secondary: "Valores em BRL: o índice CDI se aplica a outra moeda",
      negative: false,
    });
  });

  it("labels the period return with the window, not the days compared, without a return of the comparison (W3)", () => {
    const benchmark = without(
      withBenchmark({}),
      "annual_bp",
      "return_bp",
      "percent_bp",
    );

    expect(
      yieldLine({ ...rate, benchmark }, t, "en", WINDOW_FROM),
    ).toMatchObject({ primary: "14.90%", since: "since 07/19" });
    expect(
      yieldLine({ ...rate, benchmark }, tPtBR, "pt-BR", WINDOW_FROM),
    ).toMatchObject({ primary: "14,90%", since: "desde 19/07" });
  });

  it("names the index of the report in the text of a reason (W1, W5)", () => {
    const benchmark = without(rate, "annual_bp", "percent_bp");
    const line = (reason: string, translate: TFunction, tag: string) =>
      yieldLine(
        { ...rate, benchmark, unavailable_reason: reason },
        translate,
        tag,
        WINDOW_FROM,
      )?.secondary;

    expect(line("percent_undefined", t, "en")).toBe(
      "The percent of CDI is not defined for this return",
    );
    expect(line("percent_undefined", tPtBR, "pt-BR")).toBe(
      "O percentual do índice CDI não é definido para este retorno",
    );
    expect(line("no_rate_in_window", t, "en")).toBe(
      "CDI has no rate yet for the days compared",
    );
    expect(line("no_rate_in_window", tPtBR, "pt-BR")).toBe(
      "O índice CDI ainda não tem taxa para os dias comparados",
    );
    expect(line("currency_mismatch", t, "en")).toBe(
      "Values in BRL: CDI applies to another currency",
    );
    expect(line("currency_mismatch", tPtBR, "pt-BR")).toBe(
      "Valores em BRL: o índice CDI se aplica a outra moeda",
    );
  });

  it("states the reason in Portuguese (R23)", () => {
    expect(
      yieldLine(
        { ...base, profile: "rate", unavailable_reason: "too_small" },
        tPtBR,
        "pt-BR",
        WINDOW_FROM,
      )?.secondary,
    ).toBe("Saldo pequeno demais: os créditos são arredondados ao centavo");
  });

  it("reads the period return alone without an index", () => {
    expect(
      yieldLine(
        { ...base, profile: "market", period_bp: -1400 },
        t,
        "en",
        WINDOW_FROM,
      ),
    ).toEqual({
      primary: "−14.00%",
      since: "since 07/19",
      negative: true,
    });
  });

  it("reads the period return alone in Portuguese", () => {
    expect(
      yieldLine(
        { ...base, profile: "market", period_bp: -1400 },
        tPtBR,
        "pt-BR",
        WINDOW_FROM,
      ),
    ).toMatchObject({ primary: "−14,00%", since: "desde 19/07" });
  });

  it("states nothing without a return or a reason", () => {
    expect(
      yieldLine({ ...base, profile: "rate" }, t, "en", WINDOW_FROM),
    ).toBeUndefined();
  });

  it("states a generic text for a reason the catalog does not hold (R23)", () => {
    const report: ReturnReport = {
      ...base,
      profile: "rate",
      unavailable_reason: "something_new",
    };

    expect(yieldLine(report, t, "en", WINDOW_FROM)?.secondary).toBe(
      "No comparison available for the period",
    );
    expect(yieldLine(report, tPtBR, "pt-BR", WINDOW_FROM)?.secondary).toBe(
      "Sem comparação disponível no período",
    );
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

  it("states the credits and the restart in the comparison group (R20)", () => {
    const groups = read(withBenchmark({ credits: 30, restarted: true }));

    expect(groups[0]?.rows.slice(-2)).toEqual([
      ["Yield credits", "30", false, false],
      ["Restarted after a flow between credits", "Yes", false, false],
    ]);
  });

  it("appends the error to the percent card (R22)", () => {
    const groups = read(withBenchmark({ percent_error_bp: 250 }));

    expect(groups[0]?.rows[1]).toEqual([
      "Percent of CDI",
      "101.80% ±2.55 pp",
      true,
      false,
    ]);
  });

  it("shows the inflation group alone when the comparison is absent (R23)", () => {
    const rest: ReturnReport = { ...base, profile: "rate" };
    if (rate.inflation !== undefined) rest.inflation = rate.inflation;

    expect(
      yieldGroups(
        { ...rest, unavailable_reason: "single_credit" },
        t,
        "en",
      ).map((g) => g.key),
    ).toEqual(["inflation"]);
  });

  it.each([
    "no_index_for_region",
    "currency_mismatch",
    "no_rate_in_window",
    "percent_undefined",
  ])(
    "draws the period return of the window when the comparison is absent: %s (R17, W2)",
    (reason) => {
      const window = { from: "2025-11-08", to: "2026-11-07", days: 365 };
      const report: ReturnReport = {
        ...base,
        profile: "rate",
        period_bp: 1490,
        unavailable_reason: reason,
      };

      expect(yieldGroups(report, t, "en", window)).toEqual([
        {
          key: "period",
          title: "In the period",
          period: "11/08/2025 to 11/07/2026 · 365 days",
          rows: [
            {
              key: "period",
              term: "Return in the period",
              value: "14.90%",
              negative: false,
              emphasis: true,
            },
          ],
        },
      ]);
      expect(yieldGroups(report, tPtBR, "pt-BR", window)[0]).toMatchObject({
        title: "No período",
        period: "08/11/2025 a 07/11/2026 · 365 dias",
        rows: [{ term: "Retorno no período", value: "14,90%" }],
      });
    },
  );

  it.each(["nothing_held", "no_yield_recorded", "single_credit"])(
    "draws no period return for a reason that leaves it misleading: %s (R17, W2)",
    (reason) => {
      const report: ReturnReport = {
        ...base,
        profile: "rate",
        period_bp: 0,
        unavailable_reason: reason,
      };
      const window = { from: "2025-11-08", to: "2026-11-07", days: 365 };

      expect(yieldGroups(report, t, "en", window)).toEqual([]);
    },
  );

  it("draws no period return without a window (W2)", () => {
    const report: ReturnReport = {
      ...base,
      profile: "rate",
      period_bp: 120,
      unavailable_reason: "currency_mismatch",
    };

    expect(yieldGroups(report, t, "en")).toEqual([]);
  });

  it("names the groups of a rate profile without an article before the index (R23)", () => {
    expect(yieldGroups(rate, tPtBR, "pt-BR").map((g) => g.title)).toEqual([
      "Comparado ao índice CDI",
      "Descontado o índice IPCA",
    ]);
  });
});

describe("yieldNotes", () => {
  const excluded: ReturnReport["excluded"] = {
    income: {
      amount: { amount: 150000, currency: "BRL" },
      categories: ["Salary", "Gifts"],
    },
    expense: {
      amount: { amount: 32050, currency: "BRL" },
      categories: ["Salary", "Taxes"],
    },
  };

  it("states each reason where a figure is absent (R23)", () => {
    expect(
      yieldNotes(
        { ...base, profile: "rate", unavailable_reason: "nothing_held" },
        t,
        money,
      ),
    ).toEqual(["Nothing held in the period"]);
  });

  it("states the specific text of a reason that names the index, in Portuguese (W1)", () => {
    expect(
      yieldNotes(
        { ...base, profile: "rate", unavailable_reason: "no_rate_in_window" },
        tPtBR,
        money,
      ),
    ).toEqual(["O índice CDI ainda não tem taxa para os dias comparados"]);
  });

  it("states the income and expense treated as money in or out, with a hint (R19)", () => {
    expect(yieldNotes({ ...rate, excluded }, t, money)).toEqual([
      "BRL 1500.00 in other income / BRL 320.50 in other expenses in this account were treated as money in or out, not yield (Salary, Gifts, Taxes).",
      "To count a credit as yield, categorize it under Yield.",
    ]);
  });

  it("states the expense alone, without categories, in Portuguese (R19)", () => {
    expect(
      yieldNotes(
        {
          ...rate,
          excluded: {
            expense: {
              amount: { amount: 32050, currency: "BRL" },
              categories: [],
            },
          },
        },
        tPtBR,
        money,
      ),
    ).toEqual([
      "BRL 320.50 em outras despesas nesta conta foram tratados como dinheiro que entra ou sai, não como rendimento.",
      "Para contar um crédito como rendimento, categorize-o em Rendimento.",
    ]);
  });

  it("states nothing when the report holds every figure", () => {
    expect(yieldNotes(rate, t, money)).toEqual([]);
  });
});
