import { useMemo } from "react";

import { useAppLocale } from "@/i18n/i18n-provider";

// The names of months written YYYY-MM in the active tag: a short name under a mark and a long
// name for a sentence.
export function useMonthNames(months: readonly string[]) {
  const [locale] = useAppLocale();
  return useMemo(() => {
    const date = (m: string) => new Date(`${m}-01T00:00:00Z`);
    const format = (month: "short" | "long") =>
      new Intl.DateTimeFormat(locale, { month, timeZone: "UTC" });
    const short = format("short");
    const long = format("long");
    return {
      short: months.map((m) => short.format(date(m))),
      long: (m: string) => long.format(date(m)),
    };
  }, [locale, months]);
}
