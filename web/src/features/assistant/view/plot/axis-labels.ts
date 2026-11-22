import { monthLabel } from "@/features/assistant/view/forms/charts/month-label";
import type { ViewValue } from "@/features/assistant/view/view-types";
import {
  formatDateShortYear,
  formatDayMonth,
  formatReferenceMonthCompact,
} from "@/i18n/format";

// The labels of a chart's category axis (answer views design, V36): a month or a day in its
// short form, the year only when the rows span more than one; any other label as the table
// writes it.
export function axisLabels(
  rows: ViewValue[][],
  column: number,
  written: string[][],
  locale: string,
): string[] {
  const years = new Set(
    rows.map((r) => (r[column]?.month ?? r[column]?.date ?? "").slice(0, 4)),
  );
  const oneYear = years.size === 1;

  return rows.map((row, i) => {
    const v = row[column];
    if (v?.month !== undefined) {
      return oneYear
        ? monthLabel(v.month, locale)
        : formatReferenceMonthCompact(v.month, locale);
    }

    if (v?.date !== undefined) {
      return oneYear
        ? formatDayMonth(v.date, locale)
        : formatDateShortYear(v.date, locale);
    }

    return written[i]?.[column] ?? "";
  });
}
