import type { Floating } from "@/features/calculators/floating";
import { formatRate } from "@/features/calculators/format-rate";
import { indexName } from "@/features/calculators/index-catalog";
import { formatDate } from "@/i18n/format";
import type { useT } from "@/i18n/i18n-provider";

// Where a rate filled from a daily index comes from: "110% of the CDI at its rate of …, over a
// year", "SOFR + 2% a year over the 12 months to …", "100% of the CDI along the path the survey
// of … expects, over 60 months". to is the survey's date for the expected basis.
export function floatingOrigin(
  t: ReturnType<typeof useT>,
  locale: string,
  indexId: string,
  floating: Floating & { value: number },
  to: string,
  months = 12,
): string {
  const params = {
    index: indexName(indexId),
    date: formatDate(to, locale),
  };
  if (floating.basis === "expected")
    return floating.form === "percent"
      ? t("calc.origin.daily.expected", {
          ...params,
          months: String(months),
          percent: formatRate(floating.value, locale),
        })
      : t("calc.origin.spread.expected", {
          ...params,
          months: String(months),
          spread: formatRate(floating.value, locale),
        });
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
