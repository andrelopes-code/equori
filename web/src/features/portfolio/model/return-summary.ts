import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  comparisonAxis,
  type ReturnAxis,
} from "@/features/portfolio/model/return-axis";
import { periodReturn } from "@/features/portfolio/model/yield-figures";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];
type ReturnReport = components["schemas"]["ReturnReport"];

export interface ReturnBar {
  key: "subject" | "index" | "inflation";
  label: string;
  bp: number;
}

export interface ReturnChip {
  tone: "success" | "danger" | "neutral";
  icon: "up" | "down" | "equal" | "check";
  text: string;
}

export interface ReturnComparison {
  key: "index" | "inflation";
  heading: string;
  window: string;
  help: string;
  chip?: ReturnChip;
  bars: [ReturnBar, ReturnBar];
}

export interface ReturnSummary {
  verdict?: string;
  verdictHelp?: string;
  comparisons: ReturnComparison[];
  axis?: ReturnAxis;
}

// The longest period whose verdict states no annual rate (return honesty HR3).
const YEAR_DAYS = 366;

// returnSummary is the verdict sentence and the comparison blocks of a return report (RC2, RC3,
// return honesty HR3, HR4). days is the calendar span of the period, its two ends included.
export function returnSummary(
  report: ReturnReport,
  t: TFunction,
  tag: string,
  days?: number,
): ReturnSummary {
  const ret = periodReturn(report);
  const annual =
    ret !== undefined && days !== undefined && days > YEAR_DAYS
      ? annualBP(ret, days)
      : undefined;
  const comparisons = [
    indexComparison(report, t, tag),
    inflationComparison(report, t, tag),
  ].filter((comparison) => comparison !== undefined);
  const values = comparisons.flatMap((c) => c.bars.map((bar) => bar.bp));

  return {
    ...(ret === undefined
      ? {}
      : {
          verdict: verdictText(ret, annual, t, tag),
          verdictHelp: verdictHelp(annual, t),
        }),
    comparisons,
    ...(values.length === 0 ? {} : { axis: comparisonAxis(values) }),
  };
}

// HR3: the period return alone; above a year, its annual rate as well.
function verdictText(
  ret: number,
  annual: number | undefined,
  t: TFunction,
  tag: string,
): string {
  const core = t("return.verdict.period", {
    subject: t("return.subject.account"),
    return: formatBasisPoints(ret, tag),
  });
  const year =
    annual === undefined
      ? ""
      : t("return.verdict.annual", { annual: formatBasisPoints(annual, tag) });

  return `${core}${year}.`;
}

function verdictHelp(annual: number | undefined, t: TFunction): string {
  const help = t("return.help.period");

  return annual === undefined ? help : `${help} ${t("return.help.annual")}`;
}

// annualBP is the rate a year that compounds to the period return over days: (1 + r)^(365 / days)
// − 1, in basis points.
function annualBP(periodBP: number, days: number): number {
  return Math.round(((1 + periodBP / 10000) ** (365 / days) - 1) * 10000);
}

function indexComparison(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): ReturnComparison | undefined {
  const b = report.benchmark;
  if (b?.return_bp === undefined) return undefined;

  const chip = indexChip(report.profile, b, t, tag);
  const index = indexName(b.index);

  return {
    key: "index",
    heading: t("return.against.index", { index }),
    window: t("return.against.window", {
      subject: t("return.bar.account"),
      index,
      from: formatDate(b.from, tag),
      until: formatDate(b.until, tag),
      days: String(b.days),
    }),
    help: t("return.help.index", {
      subject: t("return.subject.account"),
      index,
    }),
    ...(chip === undefined ? {} : { chip }),
    bars: [
      subjectBar(b.return_bp, t),
      { key: "index", label: index, bp: b.index_bp },
    ],
  };
}

function inflationComparison(
  report: ReturnReport,
  t: TFunction,
  tag: string,
): ReturnComparison | undefined {
  const i = report.inflation;
  if (i === undefined) return undefined;

  const inflation = indexName(i.index);

  return {
    key: "inflation",
    heading: t("return.against.inflation"),
    window: t("return.against.months", {
      subject: t("return.bar.account"),
      index: inflation,
      from: formatDate(i.from, tag),
      until: formatDate(i.until, tag),
    }),
    help: t("return.help.inflation", {
      subject: t("return.subject.account"),
      index: inflation,
    }),
    chip: {
      ...signTone(i.real_bp),
      text: t("return.chip.real", { real: formatBasisPoints(i.real_bp, tag) }),
    },
    bars: [
      subjectBar(i.return_bp, t),
      { key: "inflation", label: inflation, bp: i.index_bp },
    ],
  };
}

function indexChip(
  profile: ReturnReport["profile"],
  b: ReturnBenchmark,
  t: TFunction,
  tag: string,
): ReturnChip | undefined {
  if (profile === "rate" && b.percent_bp !== undefined) {
    const reached = b.percent_bp >= 10000;

    return {
      tone: reached ? "success" : "danger",
      icon: reached ? "check" : "down",
      text: t("return.chip.percent", {
        percent: formatBasisPoints(b.percent_bp, tag),
        index: indexName(b.index),
      }),
    };
  }

  if (profile === "market" && b.excess_bp !== undefined) {
    const value = numberFormatter(tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
    }).format(b.excess_bp / 100);

    return {
      ...signTone(b.excess_bp),
      text: t("portfolio.yield.points", { value }),
    };
  }

  return undefined;
}

function subjectBar(bp: number, t: TFunction): ReturnBar {
  return { key: "subject", label: t("return.bar.account"), bp };
}

function signTone(bp: number): Pick<ReturnChip, "tone" | "icon"> {
  if (bp > 0) return { tone: "success", icon: "up" };
  if (bp < 0) return { tone: "danger", icon: "down" };

  return { tone: "neutral", icon: "equal" };
}
