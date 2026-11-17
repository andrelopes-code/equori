import { useMemo } from "react";

import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

// A share in basis points as a percentage in the active tag, with one decimal; decimals 0
// drops a zero decimal, as a sum does.
export function useShareText(decimals: 0 | 1 = 1): (bp: number) => string {
  const [locale] = useAppLocale();
  return useMemo(() => {
    const percent = numberFormatter(locale, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: 1,
    });
    return (bp: number) => percent.format(bp / 10000);
  }, [locale, decimals]);
}
