import { useScale } from "@/features/setup";
import { formatDate, formatMoney, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

interface Money {
  amount: number;
  currency: string;
}

export interface Display {
  money: (m: Money) => string;
  date: (iso: string) => string;
  month: (reference: string) => string;
}

// Values of the headline figures written in the reader's locale; the tables keep the raw cells.
export function useDisplay(): Display {
  const [locale] = useAppLocale();
  const scaleOf = useScale() ?? (() => 0);
  return {
    money: (m) => formatMoney(m, scaleOf(m.currency), locale),
    date: (iso) => formatDate(iso, locale),
    month: (reference) => formatReferenceMonth(reference, locale),
  };
}
