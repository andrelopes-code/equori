import type { PositionKind } from "@/features/reports/indicator-series";
import { useScale } from "@/features/setup";
import {
  formatBasisPoints,
  formatDayMonthLong,
  formatMonthInSentence,
  formatMonths,
  numberFormatter,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// How the indicators tab writes a figure. Amounts go through useMoneyFormat, so privacy mode masks
// them; ratios are not amounts and stay readable.
export interface IndicatorFormat {
  money: (amount: number) => string;
  percent: (bp: number) => string;
  // The ratio of a position row: months of expense for liquidity, a percentage for the others.
  ratio: (kind: PositionKind, bp: number) => string;
  // A difference of two ratios in percentage points, without its sign.
  points: (bp: number) => string;
  // The name of a month inside a sentence: "outubro", "October".
  month: (month: string) => string;
  // A day for a sentence: "9 de novembro", "November 9".
  day: (iso: string) => string;
}

// Null until the instrument scales have loaded: the tab waits instead of guessing the digits.
export function useIndicatorFormat(currency: string): IndicatorFormat | null {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  if (scale === null) return null;

  const percent = (bp: number) => formatBasisPoints(bp, locale);
  const months = (bp: number) =>
    t("overview.indicators.months", { months: formatMonths(bp, locale) });

  return {
    money: (amount) => fmt.money({ amount, currency }, scale(currency)),
    percent,
    ratio: (kind, bp) => (kind === "liquidity" ? months(bp) : percent(bp)),
    points: (bp) =>
      numberFormatter(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(bp) / 100),
    month: (month) => formatMonthInSentence(month, locale),
    day: (iso) => formatDayMonthLong(iso, locale),
  };
}
