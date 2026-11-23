import type { MessageKey } from "@/i18n/catalog.en";
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
