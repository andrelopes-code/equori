import { useMemo } from "react";

import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// How the Plan view writes its amounts, shares and months: one currency and scale for the
// whole plan, a share with one decimal (budget plan, spec 5.1).
export function usePlanFormat(currency: string, scale: number) {
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  return useMemo(() => {
    const percent = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    // A month inside a sentence keeps the case the language gives it ("em novembro de 2026").
    const monthYear = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const monthOnly = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: "UTC",
    });
    const date = (month: string) => new Date(`${month}-01T00:00:00Z`);
    return {
      hidden: fmt.hidden,
      scale,
      currency,
      money: (amount: number) => fmt.money({ amount, currency }, scale),
      signed: (amount: number) => fmt.signed({ amount, currency }, scale),
      share: (bp: number | undefined) =>
        bp === undefined ? undefined : percent.format(bp / 10000),
      month: (month: string) => monthYear.format(date(month)),
      monthName: (month: string) => monthOnly.format(date(month)),
    };
  }, [fmt, locale, currency, scale]);
}

export type PlanFormat = ReturnType<typeof usePlanFormat>;
