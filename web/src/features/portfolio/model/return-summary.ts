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

export type ReturnSubject = "portfolio" | "account";

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
  chip?: ReturnChip;
  bars: [ReturnBar, ReturnBar];
}

export interface ReturnSummary {
  verdict?: string;
  comparisons: ReturnComparison[];
  axis?: ReturnAxis;
}

// returnSummary is the verdict sentence and the comparison blocks of a return report (RC2, RC3).
export function returnSummary(
  report: ReturnReport,
  subject: ReturnSubject,
  t: TFunction,
  tag: string,
): ReturnSummary {
  const verdict = verdictText(report, subject, t, tag);
  const comparisons = [
    indexComparison(report, subject, t, tag),
    inflationComparison(report, subject, t, tag),
  ].filter((comparison) => comparison !== undefined);
  const values = comparisons.flatMap((c) => c.bars.map((bar) => bar.bp));

  return {
    ...(verdict === undefined ? {} : { verdict }),
    comparisons,
    ...(values.length === 0 ? {} : { axis: comparisonAxis(values) }),
  };
}

function verdictText(
  report: ReturnReport,
  subject: ReturnSubject,
  t: TFunction,
  tag: string,
): string | undefined {
  const b = report.benchmark;
  const ret = b?.return_bp ?? periodReturn(report);
  if (ret === undefined) return undefined;

  const i = report.inflation;
  const core = verdictCore(report, ret, t, tag, {
    subject: t(`return.subject.${subject}`),
    return: formatBasisPoints(ret, tag),
    index: b === undefined ? "" : indexName(b.index),
  });
  const real =
    i === undefined
      ? ""
      : t("return.verdict.real", {
          real: formatBasisPoints(i.real_bp, tag),
          inflation: indexName(i.index),
        });

  return `${core}${real}.`;
}

function verdictCore(
  report: ReturnReport,
  ret: number,
  t: TFunction,
  tag: string,
  vars: Record<string, string>,
): string {
  const b = report.benchmark;

  if (
    report.profile === "rate" &&
    b?.percent_bp !== undefined &&
    b.annual_bp !== undefined
  ) {
    return t("return.verdict.rate", {
      ...vars,
      percent: formatBasisPoints(b.percent_bp, tag),
      annual: formatBasisPoints(b.annual_bp, tag),
    });
  }

  if (report.profile === "market" && b?.excess_bp !== undefined) {
    const key = excessKey(b.excess_bp);
    const delta = numberFormatter(tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(b.excess_bp) / 100);

    return t(key, { ...vars, delta });
  }

  if (b?.return_bp !== undefined) {
    return t("return.verdict.index", {
      ...vars,
      indexReturn: formatBasisPoints(b.index_bp, tag),
    });
  }

  return t("return.verdict.period", vars);
}

function indexComparison(
  report: ReturnReport,
  subject: ReturnSubject,
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
      from: formatDate(b.from, tag),
      until: formatDate(b.until, tag),
      days: String(b.days),
    }),
    ...(chip === undefined ? {} : { chip }),
    bars: [
      subjectBar(subject, b.return_bp, t),
      { key: "index", label: index, bp: b.index_bp },
    ],
  };
}

function inflationComparison(
  report: ReturnReport,
  subject: ReturnSubject,
  t: TFunction,
  tag: string,
): ReturnComparison | undefined {
  const i = report.inflation;
  if (i === undefined) return undefined;

  return {
    key: "inflation",
    heading: t("return.against.inflation"),
    window: t("return.against.months", {
      from: formatDate(i.from, tag),
      until: formatDate(i.until, tag),
    }),
    chip: {
      ...signTone(i.real_bp),
      text: t("return.chip.real", { real: formatBasisPoints(i.real_bp, tag) }),
    },
    bars: [
      subjectBar(subject, i.return_bp, t),
      { key: "inflation", label: indexName(i.index), bp: i.index_bp },
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

function subjectBar(
  subject: ReturnSubject,
  bp: number,
  t: TFunction,
): ReturnBar {
  return { key: "subject", label: t(`return.bar.${subject}`), bp };
}

function signTone(bp: number): Pick<ReturnChip, "tone" | "icon"> {
  if (bp > 0) return { tone: "success", icon: "up" };
  if (bp < 0) return { tone: "danger", icon: "down" };

  return { tone: "neutral", icon: "equal" };
}

function excessKey(
  excessBP: number,
): "return.verdict.above" | "return.verdict.below" | "return.verdict.inline" {
  if (excessBP > 0) return "return.verdict.above";
  if (excessBP < 0) return "return.verdict.below";

  return "return.verdict.inline";
}
