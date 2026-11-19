import { allocationLabel } from "@/features/portfolio/model/allocation-label";
import { portfolioKey } from "@/features/portfolio/risk/risk-figures";
import type { TFunction } from "@/i18n/i18n-provider";

const noInstitutions = new Map<string, string>();

// The name of a line of the risk history: the portfolio or the instrument type of a class.
export function classLabel(t: TFunction, key: string): string {
  if (key === portfolioKey || key === "") return t("portfolio.risk.portfolio");

  return allocationLabel(t, "type", key, noInstitutions);
}
