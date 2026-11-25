import type { components } from "@/api/schema.gen";
import {
  type Effect,
  type Review,
  derivesIdeals,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";

type Plan = components["schemas"]["ContributionPlan"];
type Input = components["schemas"]["ContributionPlanInput"];
type Money = components["schemas"]["Money"];

export type Rule = components["schemas"]["ContributionRule"];

export interface MemberDraft {
  accountId?: string;
  instrument?: string;
  targetBp?: number;
  // One answer per question of the class, true for "sim", null for none and for "não se aplica".
  answers?: (boolean | null)[];
  // The day of each answer and whether it replaces the fact's (CO3).
  answerDates?: (string | null)[];
  answerOverrides?: boolean[];
  // Released for the month of today (CO8).
  released?: boolean;
}

export interface ClassDraft {
  name: string;
  targetBp: number;
  // A criterion of the class sets the ideals of its assets (CO5).
  byQuestions: boolean;
  questions: string[];
  // One fact key per question, "" for a question the investor answers (FQ1).
  questionFacts: string[];
  // One limit per question as the API writes it, "" without one (AC11).
  questionLimits: string[];
  // What each criterion does and its reminder in months (CO1, CO7).
  questionEffects?: Effect[];
  questionReviews?: Review[];
  members: MemberDraft[];
  // The conditions of a group by rule (GR1); empty for a group of members.
  rules: Rule[];
}

export interface PlanDraft {
  amount?: Money;
  classes: ClassDraft[];
}

export function toDraft(view: Plan): PlanDraft {
  const draft: PlanDraft = {
    classes: view.classes.map((cls) => ({
      name: cls.name,
      targetBp: cls.target_bp,
      byQuestions: derivesIdeals(cls),
      questions: cls.questions,
      questionFacts: cls.question_facts,
      questionLimits: cls.question_limits,
      questionEffects: cls.question_effects,
      questionReviews: cls.question_reviews,
      rules: cls.rules,
      members: cls.members.map((m) => ({
        ...(m.account_id === undefined ? {} : { accountId: m.account_id }),
        ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
        ...(m.target_bp === undefined ? {} : { targetBp: m.target_bp }),
        ...(m.answers === undefined ? {} : { answers: m.answers }),
        ...(m.answer_dates === undefined
          ? {}
          : { answerDates: m.answer_dates }),
        ...(m.answer_overrides === undefined
          ? {}
          : { answerOverrides: m.answer_overrides }),
        ...(m.released === true ? { released: true } : {}),
      })),
    })),
  };
  if (view.amount !== undefined) draft.amount = view.amount;

  return draft;
}

export function toInput(draft: PlanDraft): Input {
  return {
    ...(draft.amount === undefined ? {} : { amount: draft.amount }),
    classes: draft.classes.map((cls) => {
      const asked = cls.rules.length === 0 && cls.questions.length > 0;

      return {
        name: cls.name,
        target_bp: cls.targetBp,
        ...(asked ? { questions: cls.questions } : {}),
        ...(asked && cls.questionFacts.some((fact) => fact !== "")
          ? { question_facts: cls.questionFacts }
          : {}),
        ...(asked && cls.questionLimits.some((limit) => limit !== "")
          ? { question_limits: cls.questionLimits }
          : {}),
        ...(asked && (cls.questionEffects?.length ?? 0) > 0
          ? { question_effects: cls.questionEffects ?? [] }
          : {}),
        ...(asked && (cls.questionReviews?.length ?? 0) > 0
          ? { question_reviews: cls.questionReviews ?? [] }
          : {}),
        ...(cls.rules.length > 0 ? { rules: cls.rules } : {}),
        members:
          cls.rules.length > 0
            ? []
            : cls.members.map((m) => ({
                ...(m.accountId === undefined
                  ? {}
                  : { account_id: m.accountId }),
                ...(m.instrument === undefined
                  ? {}
                  : { instrument: m.instrument }),
                ...(cls.byQuestions || m.targetBp === undefined
                  ? {}
                  : { target_bp: m.targetBp }),
                ...(asked ? { answers: m.answers ?? [] } : {}),
                ...(asked && m.answerDates !== undefined
                  ? { answer_dates: m.answerDates }
                  : {}),
                ...(asked && m.answerOverrides !== undefined
                  ? { answer_overrides: m.answerOverrides }
                  : {}),
                ...(m.released === undefined ? {} : { released: m.released }),
              })),
      };
    }),
  };
}
