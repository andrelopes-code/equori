import { useMemo } from "react";

import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

// A share in basis points as a percentage with one decimal in the active tag.
export function useShareText(): (bp: number) => string {
  const [locale] = useAppLocale();
  return useMemo(() => {
    const percent = numberFormatter(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return (bp: number) => percent.format(bp / 10000);
  }, [locale]);
}
