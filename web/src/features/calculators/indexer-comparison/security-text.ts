import type { Security } from "@/features/calculators/indexer-comparison/security";
import { formatRate } from "@/features/calculators/model/format-rate";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import type { TFunction } from "@/i18n/i18n-provider";

// A security in words: "Fixed 8.00% a year", "140% of CDI", "IPCA + 6.50% a year"; the name of
// its form while the rate is not a number.
export function securityText(
  security: Security,
  t: TFunction,
  locale: string,
): string {
  const index = indexName(security.index ?? "");
  const rate = security.rate;

  if (security.form === "fixed")
    return rate === null
      ? t("calc.indexerComparison.form.fixed")
      : t("calc.indexerComparison.text.fixed", {
          rate: twoDecimals(rate, locale),
        });
  if (security.form === "percent")
    return rate === null
      ? t("calc.indexerComparison.form.percent", { index })
      : t("calc.indexerComparison.text.percent", {
          percent: formatRate(rate, locale),
          index,
        });

  return rate === null
    ? t("calc.indexerComparison.form.spread", { index })
    : t("calc.indexerComparison.text.spread", {
        index,
        rate: twoDecimals(rate, locale),
      });
}

function twoDecimals(rate: number, locale: string): string {
  return formatRate(rate, locale, { min: 2, max: 2 });
}
