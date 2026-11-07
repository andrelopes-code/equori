import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import {
  formatBasisPoints,
  formatDate,
  formatDayMonthNumeric,
  numberFormatter,
} from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type Money = components["schemas"]["Money"];
type ReturnReport = components["schemas"]["ReturnReport"];

// The relative error of the percent, in basis points of itself, from which it is shown (R22).
const MIN_MARGIN_BP = 100;

// The values of `unavailable_reason` that have a text; another value reads as a generic text (R23).
const REASONS = [
  "no_index_for_region",
  "currency_mismatch",
  "nothing_held",
  "no_yield_recorded",
  "single_credit",
  "too_small",
  "too_few_days",
  "no_rate_in_window",
  "percent_undefined",
] as const;

// The reasons that keep the period return beside them (R8, R17). Any other reason without a
// benchmark states itself alone: the return of a period with no recorded yield reads as zero and
// misleads.
const PERIOD_REASONS = [
  "no_index_for_region",
  "currency_mismatch",
  "no_rate_in_window",
  "percent_undefined",
];

// One line of the yield column: the figure and, muted beside it, the index it is read against.
export interface YieldLine {
  // Absent when the line states only why there is no figure.
  primary?: string;
  secondary?: string;
  // "since {date}": the day a comparison that starts after the first rate day of the window
  // begins from (`started_late`), or the first day of the window of a return without comparison.
  since?: string;
  // True when `secondary` is the text of an `unavailable_reason`, which may wrap.
  reason?: true;
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

// The window of the account page: the days it covers and its first and last day.
export interface YieldWindow {
  from: string;
  to: string;
  days: number;
}

// yieldLine is the yield column of the balance sheet (amendment A208 R8, R21, R22, R23): a rate
// profile reads its rate a year and, muted, its percent of the index; a market profile, or a rate
// profile without a rate a year, the return and, muted, the index. "since {date}" follows when the
// comparison starts after the first rate day of the window (`started_late`); a period return that
// spans the window starts at `windowFrom`. Without a comparison the reason, muted.
export function yieldLine(
  report: ReturnReport,
  t: TFunction,
  tag: string,
  windowFrom: string,
): YieldLine | undefined {
  const b = report.benchmark;
  const reason = reasonText(report, t);
  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const since = (from: string) =>
    t("portfolio.yield.since", { date: formatDayMonthNumeric(from, tag) });
  const note = (text: string | undefined, isReason: boolean) => ({
    ...(text === undefined ? {} : { secondary: text }),
    ...(isReason && text !== undefined ? { reason: true as const } : {}),
  });

  if (b === undefined) {
    const ret = periodReturn(report);
    if (ret === undefined) {
      return reason === undefined
        ? undefined
        : { ...note(reason, true), negative: false };
    }

    return {
      primary: rate(ret),
      ...note(reason, true),
      since: since(windowFrom),
      negative: ret < 0,
    };
  }

  const percent = percentOfIndex(b, t, tag);

  if (b.annual_bp !== undefined) {
    return {
      primary: t("portfolio.yield.annual", { rate: rate(b.annual_bp) }),
      ...note(percent, false),
      ...(b.started_late ? { since: since(b.from) } : {}),
      negative: b.annual_bp < 0,
    };
  }

  const ret = b.return_bp ?? periodReturn(report);
  if (ret === undefined) {
    return reason === undefined
      ? undefined
      : { ...note(reason, true), negative: false };
  }

  const indexOver =
    b.return_bp === undefined
      ? undefined
      : t("portfolio.yield.indexOver", {
          index: indexName(b.index),
          rate: rate(b.index_bp),
        });

  let from: string | undefined;
  if (b.return_bp === undefined) from = windowFrom;
  else if (b.started_late) from = b.from;

  const isReason = percent === undefined && reason !== undefined;

  return {
    primary: rate(ret),
    ...note(percent ?? reason ?? indexOver, isReason),
    ...(from === undefined ? {} : { since: since(from) }),
    negative: ret < 0,
  };
}

// yieldNotes are the lines under the groups of the yield section: why a figure is absent (R23),
// then the income and expense treated as money in or out and where to record yield (R19).
export function yieldNotes(
  report: ReturnReport,
  t: TFunction,
  money: (amount: Money) => string,
): string[] {
  const reason = reasonText(report, t);
  const excluded = excludedText(report, t, money);
  const notes = [reason, excluded].filter((note) => note !== undefined);

  return excluded === undefined
    ? notes
    : [...notes, t("portfolio.yield.excludedHint")];
}

// yieldGroups are the groups of the yield section of an account page (amendment A208 R17): the
// return of the period when the comparison is absent (given a window), the comparison with the
// index over the days compared, and the return net of inflation over its whole months, each
// present when the report defines it.
export function yieldGroups(
  report: ReturnReport,
  t: TFunction,
  tag: string,
  window?: YieldWindow,
): YieldGroup[] {
  return [
    periodGroup(report, t, tag, window),
    indexGroup(report, t, tag),
    inflationGroup(report, t, tag),
  ].filter((group) => group !== undefined);
}

// periodGroup is the return of the window as one card, for a report with no comparison to draw.
function periodGroup(
  report: ReturnReport,
  t: TFunction,
  tag: string,
  window: YieldWindow | undefined,
): YieldGroup | undefined {
  const ret = periodReturn(report);
  if (window === undefined || ret === undefined) return undefined;
  if (report.benchmark?.return_bp !== undefined) return undefined;

  return {
    key: "period",
    title: t("portfolio.yield.group.period"),
    period: t("portfolio.yield.group.periodWindow", {
      from: formatDate(window.from, tag),
      until: formatDate(window.to, tag),
      days: String(window.days),
    }),
    rows: [
      {
        key: "period",
        term: t("portfolio.yield.row.periodReturn"),
        value: formatBasisPoints(ret, tag),
        negative: ret < 0,
        emphasis: true,
      },
    ],
  };
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
      index,
    }),
    rows: [...rows, ...recordedRows(b, t)],
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
      value: percentWithMargin(b, b.percent_bp, t, tag),
      negative: b.percent_bp < 0,
      emphasis: true,
    });
  }

  rows.push(returnRow(ret, false, t, tag), indexRow(b, false, t, tag));

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
  const rows = [returnRow(ret, true, t, tag), indexRow(b, true, t, tag)];

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

// indexRow is the index's growth over the same days, with its rate a year when the index has one
// and the profile is rate: a market return is not annualized (amendment A208 R12).
function indexRow(
  b: ReturnBenchmark,
  market: boolean,
  t: TFunction,
  tag: string,
): YieldRow {
  const rate = (bp: number) => formatBasisPoints(bp, tag);

  return {
    key: "index",
    term: t("portfolio.yield.row.index", { index: indexName(b.index) }),
    value:
      market || b.index_annual_bp === undefined
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

// recordedRows state the yield credits the comparison covers and whether a flow between two
// credits moved its start (amendment A208 R20).
function recordedRows(b: ReturnBenchmark, t: TFunction): YieldRow[] {
  const rows: YieldRow[] = [];

  if (b.credits > 0) {
    rows.push({
      key: "credits",
      term: t("portfolio.yield.row.credits"),
      value: String(b.credits),
      negative: false,
      emphasis: false,
    });
  }

  if (b.restarted) {
    rows.push({
      key: "restarted",
      term: t("portfolio.yield.row.restarted"),
      value: t("portfolio.yield.row.restartedValue"),
      negative: false,
      emphasis: false,
    });
  }

  return rows;
}

// percentOfIndex is the percent of the index, with its margin when the error is large (R22).
function percentOfIndex(
  b: ReturnBenchmark,
  t: TFunction,
  tag: string,
): string | undefined {
  if (b.percent_bp === undefined) return undefined;

  return t("portfolio.yield.ofIndex", {
    percent: percentWithMargin(b, b.percent_bp, t, tag),
    index: indexName(b.index),
  });
}

// percentWithMargin appends "±X pp" to the percent, X being the percent times its error, in
// percentage points (amendment A208 R22).
function percentWithMargin(
  b: ReturnBenchmark,
  percentBP: number,
  t: TFunction,
  tag: string,
): string {
  const value = formatBasisPoints(percentBP, tag);
  const error = b.percent_error_bp;
  if (error === undefined || error < MIN_MARGIN_BP) return value;

  const margin = numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs((percentBP * error) / 1_000_000));

  return t("portfolio.yield.margin", { value, margin });
}

// periodReturn is `period_bp` when it reads true: with a benchmark, or without one for a reason
// of PERIOD_REASONS or none (amendment A208 R8).
function periodReturn(report: ReturnReport): number | undefined {
  const reason = report.unavailable_reason ?? "";
  const keeps = reason === "" || PERIOD_REASONS.includes(reason);

  return report.benchmark === undefined && !keeps
    ? undefined
    : report.period_bp;
}

// reasonText is the text of `unavailable_reason`; a reason without its own text reads as a
// generic one, and a report that holds every figure has none (amendment A208 R23). A reason that
// names the index reads the one the report carries.
function reasonText(report: ReturnReport, t: TFunction): string | undefined {
  const value = report.unavailable_reason;
  if (value === undefined || value === "") return undefined;

  const reason = REASONS.find((r) => r === value);
  if (reason === undefined) return t("portfolio.yield.reason.other");

  return t(`portfolio.yield.reason.${reason}`, {
    index: report.index === undefined ? "" : indexName(report.index),
    currency: report.opening.currency,
  });
}

// excludedText is the income and expense of the period treated as money in or out, with the
// categories that hold most of it (amendment A208 R19).
function excludedText(
  report: ReturnReport,
  t: TFunction,
  money: (amount: Money) => string,
): string | undefined {
  const { income, expense } = report.excluded ?? {};
  const parts = [
    income === undefined
      ? undefined
      : t("portfolio.yield.excludedIncome", { amount: money(income.amount) }),
    expense === undefined
      ? undefined
      : t("portfolio.yield.excludedExpense", { amount: money(expense.amount) }),
  ].filter((part) => part !== undefined);
  if (parts.length === 0) return undefined;

  const categories = [
    ...new Set([...(income?.categories ?? []), ...(expense?.categories ?? [])]),
  ];
  const joined = parts.join(" / ");

  return categories.length === 0
    ? t("portfolio.yield.excluded", { parts: joined })
    : t("portfolio.yield.excludedIn", {
        parts: joined,
        categories: categories.join(", "),
      });
}

// points writes basis points as signed percentage points with two decimals: −1033 is "−10.33".
function points(bp: number, tag: string): string {
  return numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(bp / 100);
}
