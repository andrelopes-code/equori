import type { Verdict } from "@/features/reports/indicator-verdict";
import type { IndicatorFormat } from "@/features/reports/use-indicator-format";
import type { TFunction } from "@/i18n/i18n-provider";

export interface VerdictContext {
  t: TFunction;
  format: IndicatorFormat;
  // YYYY-MM of the asked month.
  month: string;
}

// What the card writes: the savings rate as its figure, and one short line that compares it with the
// reader's own 12-month mean or says why it cannot. Every case fills the same two slots, so the
// card keeps its shape whatever the month holds (indicators tab design, IT1).
export interface VerdictText {
  // Null when the month has no rate to write.
  figure: string | null;
  line: string;
  // The figure is written but not compared: the month is incomplete.
  provisional: boolean;
}

export function verdictText(
  verdict: Verdict,
  { t, format, month }: VerdictContext,
): VerdictText {
  const name = format.month(month);

  switch (verdict.kind) {
    case "above":
    case "below":
      return {
        figure: format.percent(verdict.rate),
        line: t(`report.indicators.verdict.${verdict.kind}`, {
          delta: format.points(verdict.delta),
          mean: format.percent(verdict.mean),
        }),
        provisional: false,
      };
    case "inline":
      return {
        figure: format.percent(verdict.rate),
        line: t("report.indicators.verdict.inline", {
          mean: format.percent(verdict.mean),
        }),
        provisional: false,
      };
    case "noMean":
      return {
        figure: format.percent(verdict.rate),
        line: t("report.indicators.verdict.noMean"),
        provisional: false,
      };
    case "noIncome":
      return {
        figure: null,
        line: t("report.indicators.verdict.noIncome", { month: name }),
        provisional: false,
      };
    case "partial":
      return {
        figure: verdict.rate === null ? null : format.percent(verdict.rate),
        line: t("report.indicators.verdict.partial"),
        provisional: true,
      };
  }
}
