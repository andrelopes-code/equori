import { useScale } from "@/features/setup";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  const fmt = useMoneyFormat();
  const scaleOf = useScale() ?? (() => 0);
  return {
    money: (m) => fmt.money(m, scaleOf(m.currency)),
    date: (iso) => formatDate(iso, locale),
    month: (reference) => formatReferenceMonth(reference, locale),
  };
}
