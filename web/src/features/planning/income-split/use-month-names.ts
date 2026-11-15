import { useMemo } from "react";

import { useAppLocale } from "@/i18n/i18n-provider";

// The names of months written YYYY-MM in the active tag: a letter for a column head, a short
// name for a cell and a long name for a sentence.
export function useMonthNames(months: readonly string[]) {
  const [locale] = useAppLocale();
  return useMemo(() => {
    const date = (m: string) => new Date(`${m}-01T00:00:00Z`);
    const format = (month: "narrow" | "short" | "long") =>
      new Intl.DateTimeFormat(locale, { month, timeZone: "UTC" });
    const narrow = format("narrow");
    const short = format("short");
    const long = format("long");
    return {
      narrow: months.map((m) => narrow.format(date(m))),
      short: months.map((m) => short.format(date(m))),
      long: (m: string) => long.format(date(m)),
    };
  }, [locale, months]);
}
