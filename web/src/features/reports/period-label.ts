import { kindOf } from "@/features/reports/report-period";
import type { ReportPeriod } from "@/features/reports/report-period";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

// "October 2026", "Q4 2026", "2026", or the two days of a custom period.
export function periodLabel(
  period: ReportPeriod,
  t: TFunction,
  tag: string,
): string {
  const year = period.from.slice(0, 4);
  switch (kindOf(period)) {
    case "month":
      return formatMonthTitle(period.from.slice(0, 7), tag);
    case "quarter":
      return t("report.period.quarterOf", {
        quarter: Math.floor((Number(period.from.slice(5, 7)) - 1) / 3) + 1,
        year,
      });
    case "year":
      return year;
    case "custom":
      return `${formatDate(period.from, tag)} – ${formatDate(period.to, tag)}`;
  }
}
