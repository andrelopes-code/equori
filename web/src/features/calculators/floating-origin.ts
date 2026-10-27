import type { Floating } from "@/features/calculators/floating";
import { formatRate } from "@/features/calculators/format-rate";
import { indexName } from "@/features/calculators/index-catalog";
import { formatDate } from "@/i18n/format";
import type { useT } from "@/i18n/i18n-provider";

// Where a rate filled from a daily index comes from: "110% of the CDI at its rate of …, over a
// year", "SOFR + 2% a year over the 12 months to …".
export function floatingOrigin(
  t: ReturnType<typeof useT>,
  locale: string,
  indexId: string,
  floating: Floating & { value: number },
  to: string,
): string {
  const params = {
    index: indexName(indexId),
    date: formatDate(to, locale),
  };
  const current = floating.basis === "current";
  return floating.form === "percent"
    ? t(current ? "calc.origin.daily.current" : "calc.origin.daily", {
        ...params,
        percent: formatRate(floating.value, locale),
      })
    : t(current ? "calc.origin.spread.current" : "calc.origin.spread", {
        ...params,
        spread: formatRate(floating.value, locale),
      });
}
