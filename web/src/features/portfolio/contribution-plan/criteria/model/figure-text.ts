import type { LimitUnit } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { numberFormatter } from "@/i18n/format";

// The figure of a cell in the unit of its criterion, short enough for a column of 6.5rem: a rate
// with one decimal below 100%, a multiple with one decimal, two below one.
export function figureText(
  locale: string,
  unit: LimitUnit,
  value: string,
): string {
  const number = Number(value);

  if (unit === "years" || unit === "points")
    return numberFormatter(locale).format(number);

  if (unit === "percent") {
    return numberFormatter(locale, {
      style: "percent",
      maximumFractionDigits: Math.abs(number) < 1 ? 1 : 0,
    }).format(number);
  }

  const digits = Math.abs(number) < 1 ? 2 : 1;

  return numberFormatter(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}
