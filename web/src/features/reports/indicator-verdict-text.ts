import type { Ledger, Verdict } from "@/features/reports/indicator-verdict";
import type { IndicatorFormat } from "@/features/reports/use-indicator-format";
import type { TFunction } from "@/i18n/i18n-provider";

export interface SentenceContext {
  t: TFunction;
  format: IndicatorFormat;
  // YYYY-MM of the asked month.
  month: string;
  ledger: Ledger;
}

// The verdict as the one sentence that opens the tab (spec IT1).
export function verdictSentence(
  verdict: Verdict,
  { t, format, month, ledger }: SentenceContext,
): string {
  const name = format.month(month);

  switch (verdict.kind) {
    case "above":
    case "below":
      return t(`report.indicators.verdict.${verdict.kind}`, {
        month: name,
        rate: format.percent(verdict.rate),
        delta: format.points(verdict.delta),
        mean: format.percent(verdict.mean),
      });
    case "inline":
      return t("report.indicators.verdict.inline", {
        month: name,
        rate: format.percent(verdict.rate),
        mean: format.percent(verdict.mean),
      });
    case "noMean":
      return t("report.indicators.verdict.noMean", {
        month: name,
        rate: format.percent(verdict.rate),
      });
    case "noIncome":
      return t("report.indicators.verdict.noIncome", { month: name });
    case "partial":
      return t("report.indicators.verdict.partial", {
        month: name,
        income: format.money(ledger.income),
        expense: format.money(ledger.expense),
      });
  }
}
