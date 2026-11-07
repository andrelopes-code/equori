import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type ReturnReport = components["schemas"]["ReturnReport"];

// One line of the yield column: the figure and, muted beside it, the index it is read against.
export interface YieldLine {
  primary: string;
  secondary?: string;
  negative: boolean;
}

// A card of the yield section of an account page.
export interface YieldCard {
  key: string;
  label: string;
  value: string;
  note: string;
  negative: boolean;
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
      ...(b.percent_bp === undefined
        ? {}
        : {
            secondary: t("portfolio.yield.ofIndex", {
              percent: rate(b.percent_bp),
              index: indexName(b.index),
            }),
          }),
      negative: b.annual_bp < 0,
    };
  }

  const ret = b?.return_bp ?? report.period_bp;
  if (ret === undefined) return undefined;

  return {
    primary: rate(ret),
    ...(b?.return_bp === undefined
      ? {}
      : {
          secondary: t("portfolio.yield.indexOver", {
            index: indexName(b.index),
            rate: rate(b.index_bp),
          }),
        }),
    negative: ret < 0,
  };
}

// yieldCards are the cards of the yield section of an account page (amendment A208 R17), each
// present when the report defines its figure.
export function yieldCards(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldCard[] {
  return [
    returnCard(report, t, tag),
    indexCard(report, t, tag),
    realCard(report, t, tag),
  ].filter((card) => card !== undefined);
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

// returnCard is the rate a year of a rate profile, or the return of the days compared.
function returnCard(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldCard | undefined {
  const b = report.benchmark;
  if (b?.return_bp === undefined) return undefined;

  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const window = {
    days: String(b.days),
    from: formatDate(b.from, tag),
    until: formatDate(b.until, tag),
  };

  if (b.annual_bp !== undefined) {
    return {
      key: "annual",
      label: t("portfolio.yield.card.annual"),
      value: t("portfolio.yield.annual", { rate: rate(b.annual_bp) }),
      note: t("portfolio.yield.card.annualNote", {
        ...window,
        rate: rate(b.return_bp),
      }),
      negative: b.annual_bp < 0,
    };
  }

  return {
    key: "return",
    label: t("portfolio.yield.card.return"),
    value: rate(b.return_bp),
    note: t("portfolio.yield.card.returnNote", window),
    negative: b.return_bp < 0,
  };
}

// indexCard is the percent of the index of a rate profile, or the difference from the index.
function indexCard(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldCard | undefined {
  const b = report.benchmark;
  if (b === undefined) return undefined;

  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const index = indexName(b.index);

  if (b.percent_bp !== undefined) {
    return {
      key: "percent",
      label: t("portfolio.yield.card.percent", { index }),
      value: rate(b.percent_bp),
      note: t("portfolio.yield.card.percentNote", {
        index,
        rate: rate(b.index_annual_bp ?? b.index_bp),
      }),
      negative: b.percent_bp < 0,
    };
  }

  if (b.excess_bp === undefined) return undefined;

  return {
    key: "excess",
    label: t("portfolio.yield.card.excess", { index }),
    value: t("portfolio.yield.points", { value: points(b.excess_bp, tag) }),
    note: t("portfolio.yield.card.excessNote", {
      index,
      rate: rate(b.index_bp),
    }),
    negative: b.excess_bp < 0,
  };
}

// realCard is the return net of inflation over whole months.
function realCard(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): YieldCard | undefined {
  const i = report.inflation;
  if (i === undefined) return undefined;

  const rate = (bp: number) => formatBasisPoints(bp, tag);

  return {
    key: "real",
    label: t("portfolio.yield.card.real"),
    value: rate(i.real_bp),
    note: t("portfolio.yield.card.realNote", {
      nominal: rate(i.return_bp),
      index: indexName(i.index),
      inflation: rate(i.index_bp),
      from: formatDate(i.from, tag),
      until: formatDate(i.until, tag),
    }),
    negative: i.real_bp < 0,
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

// points writes basis points as signed percentage points with two decimals: −1033 is "−10.33".
function points(bp: number, tag: string): string {
  return numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(bp / 100);
}
