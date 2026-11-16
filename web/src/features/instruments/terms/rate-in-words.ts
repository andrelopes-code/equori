import type { components } from "@/api/schema.gen";
import { formatPercentBp } from "@/features/instruments/terms/basis-points";
import { indexName } from "@/features/calculators";
import type { TFunction } from "@/i18n/i18n-provider";

type Terms = Pick<
  components["schemas"]["FixedIncomeTerms"],
  "index_id" | "percent_of_index_bp" | "spread_bp"
>;

const wholeIndexBp = 10000;

// The rate of a contract as a sentence: "110% of CDI", "IPCA + 6.5%", "12% a year".
export function rateInWords(
  terms: Terms,
  t: TFunction,
  locale: string,
): string {
  const {
    index_id: id,
    percent_of_index_bp: percentBp,
    spread_bp: spreadBp,
  } = terms;
  const spread = formatPercentBp(spreadBp, locale);

  if (id === undefined || id === "")
    return t("terms.rate.fixed", { rate: spread });

  const index = indexName(id);
  if (percentBp === wholeIndexBp)
    return spreadBp === 0
      ? index
      : t("terms.rate.inflation", { index, rate: spread });

  const share = t("terms.rate.percentOf", {
    percent: formatPercentBp(percentBp, locale),
    index,
  });

  return spreadBp === 0 ? share : `${share} + ${spread}`;
}
