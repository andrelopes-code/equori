import type { components } from "@/api/schema.gen";
import {
  type Effect,
  type Review,
  counts,
  effectOf,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";
import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import type { Answer } from "@/features/portfolio/contribution-plan/panel/criteria-edits";
import type { TFunction } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];
type Detail = components["schemas"]["ContributionFactDetail"];

// A criterion of a group, as the panel draws it.
export interface CriterionView {
  position: number;
  // The text the plan stores: the key of the criterion in its group.
  question: string;
  // The text in the active language.
  text: string;
  fact: string;
  limit: string;
  effect: Effect;
  review: Review;
  counts: boolean;
}

// The answer of one asset to a criterion.
export interface AnswerView {
  // What the investor chose; undefined without an answer.
  own: Exclude<Answer, "auto"> | undefined;
  // Whether the own answer replaces the one equori gives.
  overrides: boolean;
  date: string | null;
  // The answer equori gives; "none" with the reason in the detail, undefined for an own criterion.
  fact: "yes" | "no" | "none" | undefined;
  detail: Detail;
  due: boolean;
}

export function criteriaOf(t: TFunction, cls: Group): CriterionView[] {
  return cls.questions.map((question, position) => {
    const fact = cls.question_facts[position] ?? "";

    return {
      position,
      question,
      text: criterionText(t, fact, question),
      fact,
      limit: cls.question_limits[position] ?? "",
      effect: effectOf(cls, position),
      review: cls.question_reviews[position] ?? 0,
      counts: counts(cls, position),
    };
  });
}

export function answerOf(
  member: Member,
  { position, fact }: CriterionView,
): AnswerView {
  const date = member.answer_dates?.[position] ?? null;
  const overrides = member.answer_overrides?.[position] ?? false;

  return {
    own: ownAnswer(member.answers?.[position] ?? null, date, overrides),
    overrides,
    date,
    fact: fact === "" ? undefined : (member.fact_answers?.[position] ?? "none"),
    detail: member.fact_details?.[position] ?? {},
    due: member.due?.includes(position) ?? false,
  };
}

// The answer that counts (CO4): undefined without one, "na" where the investor set it aside.
export function effectiveAnswer(
  answer: AnswerView,
): Exclude<Answer, "auto"> | undefined {
  if (answer.overrides) return answer.own;
  if (answer.fact === "yes" || answer.fact === "no") return answer.fact;

  return answer.own;
}

// The points of an asset among the counting criteria that weigh; undefined with an automatic one
// without an answer, as the asset takes an equal share (CO5).
export function pointsOf(
  member: Member,
  criteria: readonly CriterionView[],
): { yes: number; count: number } | undefined {
  const weighing = criteria.filter((c) => c.counts && c.effect === "weigh");
  const answers = weighing.map((c) => ({ c, answer: answerOf(member, c) }));

  const blank = answers.some(
    ({ c, answer }) =>
      c.fact !== "" &&
      !answer.overrides &&
      effectiveAnswer(answer) === undefined,
  );
  if (blank) return undefined;

  return {
    yes: answers.filter(({ answer }) => effectiveAnswer(answer) === "yes")
      .length,
    count: weighing.length,
  };
}

// The answers of a group to a criterion, counted.
export function answerCounts(
  cls: Group,
  criterion: CriterionView,
): { yes: number; no: number; none: number } {
  const answers = cls.members.map((m) =>
    effectiveAnswer(answerOf(m, criterion)),
  );

  return {
    yes: answers.filter((a) => a === "yes").length,
    no: answers.filter((a) => a === "no").length,
    none: answers.filter((a) => a === undefined).length,
  };
}

// A null answer with a date, or that replaces the one of equori, is "não se aplica" (CO3).
function ownAnswer(
  stored: boolean | null,
  date: string | null,
  overrides: boolean,
): Exclude<Answer, "auto"> | undefined {
  if (stored === null) return date === null && !overrides ? undefined : "na";

  return stored ? "yes" : "no";
}
