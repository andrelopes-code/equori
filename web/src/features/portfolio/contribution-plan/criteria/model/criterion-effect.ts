import type { components } from "@/api/schema.gen";
import { limitCriterion } from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";

type Group = components["schemas"]["ContributionClass"];

export type Effect = Group["question_effects"][number];
export type Review = Group["question_reviews"][number];

export const effects: readonly Effect[] = ["warn", "hold", "weigh"];
export const reviews: readonly Review[] = [0, 1, 3, 6, 12];

interface Criteria {
  questions: string[];
  question_facts?: string[];
  question_limits?: string[];
  question_effects?: Effect[];
}

// What the criterion does; an absent effect weighs (CO1).
export function effectOf(cls: Criteria, q: number): Effect {
  return cls.question_effects?.[q] ?? "weigh";
}

// A criterion with a limit key and no limit counts for nothing (CO2).
export function counts(cls: Criteria, q: number): boolean {
  return (
    limitCriterion(cls.question_facts?.[q] ?? "") === undefined ||
    (cls.question_limits?.[q] ?? "") !== ""
  );
}

// Whether a counting criterion sets the ideals of the group (CO5).
export function derivesIdeals(cls: Criteria): boolean {
  return cls.questions.some(
    (_, q) => counts(cls, q) && effectOf(cls, q) === "weigh",
  );
}
