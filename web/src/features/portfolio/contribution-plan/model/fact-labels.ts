import type { MessageKey } from "@/i18n/catalog.en";
import { formatYear } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

const factLabelKeys: Record<string, MessageKey> = {
  piotroski_p1: "contributionPlan.facts.piotroski_p1",
  piotroski_p2: "contributionPlan.facts.piotroski_p2",
  piotroski_p3: "contributionPlan.facts.piotroski_p3",
  piotroski_p4: "contributionPlan.facts.piotroski_p4",
  piotroski_p5: "contributionPlan.facts.piotroski_p5",
  piotroski_p6: "contributionPlan.facts.piotroski_p6",
  piotroski_p7: "contributionPlan.facts.piotroski_p7",
  piotroski_p8: "contributionPlan.facts.piotroski_p8",
  piotroski_p9: "contributionPlan.facts.piotroski_p9",
};

// The catalog key of the text of a fact; undefined for an empty or unknown fact.
export function factLabelKey(fact: string): MessageKey | undefined {
  return Object.hasOwn(factLabelKeys, fact) ? factLabelKeys[fact] : undefined;
}

// The text of a question in the active language: the catalog text of its fact, else the stored
// text.
export function factText(t: TFunction, fact: string, stored: string): string {
  const key = factLabelKey(fact);

  return key === undefined ? stored : t(key);
}

// The start of the facts line of an instrument: the fiscal year of the signals, the absence of
// filings when the group names a fact and the member has no year, else "".
export function factsPrefix(
  t: TFunction,
  tag: string,
  factsYear: string | undefined,
  facts: string[],
): string {
  if (factsYear !== undefined) {
    return t("contributionPlan.facts.year", {
      year: formatYear(factsYear, tag),
    });
  }

  return facts.some((fact) => fact !== "")
    ? t("contributionPlan.facts.none")
    : "";
}
