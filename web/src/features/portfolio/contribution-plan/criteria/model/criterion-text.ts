import { limitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { factText } from "@/features/portfolio/contribution-plan/model/fact-labels";
import type { TFunction } from "@/i18n/i18n-provider";

// The text of a criterion in the active language: the catalog text of its limit or its signal, else
// the text the plan stores.
export function criterionText(
  t: TFunction,
  fact: string,
  stored: string,
): string {
  const criterion = limitCriterion(fact);

  return criterion === undefined
    ? factText(t, fact, stored)
    : t(criterion.label);
}
