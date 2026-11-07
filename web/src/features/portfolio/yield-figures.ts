import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type ReturnReport = components["schemas"]["ReturnReport"];

// One line of the yield column: the figure and, muted beside it, the index it is read against.
export interface YieldLine {
  primary: string;
  secondary?: string;
  negative: boolean;
}

// A row of a yield group: a term, its value and how the value reads.
export interface YieldRow {
  key: string;
  term: string;
  hint?: string;
  value: string;
  negative: boolean;
  // The figure the group exists for, written in a heavier weight.
  emphasis: boolean;
}

// A group of the yield section of an account page: the figures that share one period.
export interface YieldGroup {
  key: string;
  title: string;
  period: string;
  rows: YieldRow[];
}

// yieldLine is the yield column of the balance sheet (amendment A208 R17): a rate profile reads
// its rate a year and its percent of the index; a market profile, or a report without a rate a
// year, reads the return of the days compared and the index over the same days.
export function yieldLine(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldLine | undefined {
  const b = report.benchmark;
  const rate = (bp: number) => formatBasisPoints(bp, tag);

  if (b?.annual_bp !== undefined) {
    return {
      primary: t("portfolio.yield.annual", { rate: rate(b.annual_bp) }),
      ...secondary(
        b,
        b.percent_bp === undefined
          ? undefined
          : t("portfolio.yield.ofIndex", {
              percent: rate(b.percent_bp),
              index: indexName(b.index),
            }),
        t,
        tag,
      ),
      negative: b.annual_bp < 0,
    };
  }

  const ret = b?.return_bp ?? report.period_bp;
  if (ret === undefined) return undefined;

  return {
    primary: rate(ret),
    ...(b?.return_bp === undefined
      ? {}
      : secondary(
          b,
          t("portfolio.yield.indexOver", {
            index: indexName(b.index),
            rate: rate(b.index_bp),
          }),
          t,
          tag,
        )),
    negative: ret < 0,
  };
}

// yieldGroups are the groups of the yield section of an account page (amendment A208 R17): the
// comparison with the index over the days compared, and the return net of inflation over its
// whole months, each present when the report defines it.
export function yieldGroups(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldGroup[] {
  return [indexGroup(report, t, tag), inflationGroup(report, t, tag)].filter(
    (group) => group !== undefined,
  );
}

// returnLines are the lines the return section of the Portfolio states under the annual rate
// (amendment A208 R7, R17), in order.
export function returnLines(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): string[] {
  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const lines: string[] = [];

  if (report.period_bp !== undefined) {
    lines.push(t("portfolio.return.period", { rate: rate(report.period_bp) }));
  }

  lines.push(...benchmarkLines(report, t, tag));

  const i = report.inflation;
  if (i !== undefined) {
    lines.push(
      t("portfolio.return.real", {
        index: indexName(i.index),
        inflation: rate(i.index_bp),
        from: formatDate(i.from, tag),
        until: formatDate(i.until, tag),
        rate: rate(i.real_bp),
      }),
    );
  }

  return lines;
}

// indexGroup compares the return with the index over the same days: a rate profile by its rate a
// year and percent of the index, a market profile by the difference in percentage points.
function indexGroup(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldGroup | undefined {
  const b = report.benchmark;
  if (b?.return_bp === undefined) return undefined;

  const index = indexName(b.index);
  const rows =
    report.profile === "rate"
      ? rateRows(b, b.return_bp, t, tag)
      : marketRows(b, b.return_bp, t, tag);

  return {
    key: "index",
    title: t("portfolio.yield.group.index", { index }),
    period: t("portfolio.yield.group.indexPeriod", {
      from: formatDate(b.from, tag),
      until: formatDate(b.until, tag),
      days: String(b.days),
    }),
    rows,
  };
}

// rateRows lead with the rate a year and the percent of the index, then the period's figures.
function rateRows(
  b: ReturnBenchmark,
  ret: number,
  t: TFunction,
  tag: string,
): YieldRow[] {
  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const index = indexName(b.index);
  const rows: YieldRow[] = [];

  if (b.annual_bp !== undefined) {
    rows.push({
      key: "annual",
      term: t("portfolio.yield.row.annual"),
      hint: t("portfolio.yield.row.annualHint", { index }),
      value: t("portfolio.yield.annual", { rate: rate(b.annual_bp) }),
      negative: b.annual_bp < 0,
      emphasis: true,
    });
  }

  if (b.percent_bp !== undefined) {
    rows.push({
      key: "percent",
      term: t("portfolio.yield.row.percent", { index }),
      hint: t("portfolio.yield.row.percentHint", { index }),
      value: rate(b.percent_bp),
      negative: b.percent_bp < 0,
      emphasis: true,
    });
  }

  rows.push(returnRow(ret, false, t, tag), indexRow(b, t, tag));

  return rows;
}

// marketRows lead with the return of the period, not annualized, then the index and the
// difference from it.
function marketRows(
  b: ReturnBenchmark,
  ret: number,
  t: TFunction,
  tag: string,
): YieldRow[] {
  const rows = [returnRow(ret, true, t, tag), indexRow(b, t, tag)];

  if (b.excess_bp !== undefined) {
    rows.push({
      key: "excess",
      term: t("portfolio.yield.row.excess", { index: indexName(b.index) }),
      hint: t("portfolio.yield.row.excessHint", { index: indexName(b.index) }),
      value: t("portfolio.yield.points", { value: points(b.excess_bp, tag) }),
      negative: b.excess_bp < 0,
      emphasis: true,
    });
  }

  return rows;
}

// returnRow is the time-weighted return of the days compared; a market return says it is not
// annualized.
function returnRow(
  ret: number,
  market: boolean,
  t: TFunction,
  tag: string,
): YieldRow {
  return {
    key: "return",
    term: t("portfolio.yield.row.return"),
    ...(market ? { hint: t("portfolio.yield.row.returnHint") } : {}),
    value: formatBasisPoints(ret, tag),
    negative: ret < 0,
    emphasis: market,
  };
}

// indexRow is the index's growth over the same days, with its rate a year when the index has one.
function indexRow(b: ReturnBenchmark, t: TFunction, tag: string): YieldRow {
  const rate = (bp: number) => formatBasisPoints(bp, tag);

  return {
    key: "index",
    term: t("portfolio.yield.row.index", { index: indexName(b.index) }),
    value:
      b.index_annual_bp === undefined
        ? rate(b.index_bp)
        : t("portfolio.yield.row.indexValue", {
            rate: rate(b.index_bp),
            annual: rate(b.index_annual_bp),
          }),
    negative: b.index_bp < 0,
    emphasis: false,
  };
}

// inflationGroup is the return over the whole months with a published inflation rate, that
// inflation, and the real return between them.
function inflationGroup(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldGroup | undefined {
  const i = report.inflation;
  if (i === undefined) return undefined;

  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const index = indexName(i.index);

  return {
    key: "inflation",
    title: t("portfolio.yield.group.inflation", { index }),
    period: t("portfolio.yield.group.inflationPeriod", {
      from: formatDate(i.from, tag),
      until: formatDate(i.until, tag),
      index,
    }),
    rows: [
      {
        key: "nominal",
        term: t("portfolio.yield.row.return"),
        value: rate(i.return_bp),
        negative: i.return_bp < 0,
        emphasis: false,
      },
      {
        key: "inflation",
        term: t("portfolio.yield.row.index", { index }),
        value: rate(i.index_bp),
        negative: false,
        emphasis: false,
      },
      {
        key: "real",
        term: t("portfolio.yield.row.real"),
        hint: t("portfolio.yield.row.realHint", { index }),
        value: rate(i.real_bp),
        negative: i.real_bp < 0,
        emphasis: true,
      },
    ],
  };
}

// benchmarkLines are the lines of the comparison with the index: the rate a year, the percent of
// the index, the index's growth, the difference from it and, for a market profile, why the first
// two are absent.
function benchmarkLines(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): string[] {
  const b = report.benchmark;
  if (b === undefined) return [];

  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const index = indexName(b.index);
  const lines: string[] = [];

  if (b.annual_bp !== undefined) {
    lines.push(
      t("portfolio.return.annualEquivalent", {
        days: String(b.days),
        rate: rate(b.annual_bp),
      }),
    );
  }

  if (b.percent_bp !== undefined) {
    lines.push(
      t("portfolio.return.percentOfIndex", {
        percent: rate(b.percent_bp),
        index,
        from: formatDate(b.from, tag),
        until: formatDate(b.until, tag),
      }),
    );
  }

  lines.push(
    t("portfolio.return.indexGrowth", { index, rate: rate(b.index_bp) }),
  );

  if (b.excess_bp !== undefined) {
    lines.push(
      t("portfolio.return.excess", { index, value: points(b.excess_bp, tag) }),
    );
  }

  if (report.profile === "market") {
    lines.push(t("portfolio.return.marketProfile", { index }));
  }

  return lines;
}

// secondary is the muted part of a yield line, followed by the first day compared when the
// comparison left out days of the period (amendment A208 R14, R18).
function secondary(
  b: ReturnBenchmark,
  text: string | undefined,
  t: TFunction,
  tag: string,
): { secondary?: string } {
  const since =
    b.skipped > 0
      ? t("portfolio.yield.since", { from: formatDate(b.from, tag) })
      : undefined;
  const parts = [text, since].filter((p) => p !== undefined);

  return parts.length === 0 ? {} : { secondary: parts.join(" · ") };
}

// points writes basis points as signed percentage points with two decimals: −1033 is "−10.33".
function points(bp: number, tag: string): string {
  return numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(bp / 100);
}
