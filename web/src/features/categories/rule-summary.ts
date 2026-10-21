import type { components } from "@/api/schema.gen";
import {
  actionSentence,
  conditionSentence,
} from "@/features/categories/rule-sentence";
import type { RuleWords } from "@/features/categories/rule-sentence";

type RuleInput = components["schemas"]["RuleInput"];

// "When description contains “uber” and amount is less than R$ 0,00 → categorize as Transport".
export function ruleSummary(
  rule: Pick<RuleInput, "conditions" | "actions">,
  words: RuleWords,
): string {
  const when = rule.conditions
    .map((c) => conditionSentence(c, words))
    .join(` ${words.t("rule.and")} `);
  const then = rule.actions.map((a) => actionSentence(a, words)).join("; ");
  return words.t("rule.summary", { when, then });
}
