import type { components } from "@/api/schema.gen";
import { reasonText } from "@/features/instruments/company-report/reason-text";
import { formatDate, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type Figure = components["schemas"]["CompanyFigure"];
type Range = components["schemas"]["CompanyRange"];
type Change = components["schemas"]["CompanyChange"];

const yearMonths = 12;

// A multiple with one decimal; below one, with two. Without a value, "sem dado".
export function multipleValue(
  t: TFunction,
  locale: string,
  figure: Figure,
): string {
  return figure.value === undefined
    ? t("companyReport.missing")
    : multiple(locale, figure.value);
}

// The line under a multiple: the reason it has no value, its range, or why it has no range.
export function multipleNote(
  t: TFunction,
  locale: string,
  figure: Figure,
  range: Range | undefined,
): string {
  if (figure.value === undefined) return reasonText(t, figure.reason ?? "");
  if (range === undefined) return t("companyReport.noRange");

  return t("companyReport.range", {
    years: String(range.years),
    least: multiple(locale, range.least),
    greatest: multiple(locale, range.greatest),
  });
}

// The line under a change: the period it compares, or the reason it compares none.
export function changeNote(
  t: TFunction,
  locale: string,
  change: Change,
): string {
  if (change.date === undefined) return reasonText(t, change.reason ?? "");

  const date = formatDate(change.date, locale);

  return change.months === yearMonths
    ? t("companyReport.change.year", { date })
    : t("companyReport.change.period", {
        months: String(change.months),
        date,
      });
}

function multiple(locale: string, value: string): string {
  const number = Number(value);
  const digits = Math.abs(number) < 1 ? 2 : 1;

  return numberFormatter(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}
