import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];
type Input = components["schemas"]["ContributionPlanInput"];
type Money = components["schemas"]["Money"];

export interface MemberDraft {
  accountId?: string;
  instrument?: string;
  targetBp?: number;
  // One answer per question of the class, true for "sim" (CQ2).
  answers?: boolean[];
}

export interface ClassDraft {
  name: string;
  targetBp: number;
  // The class divides its ideal by the investor's questions (CQ3).
  byQuestions: boolean;
  questions: string[];
  members: MemberDraft[];
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
      byQuestions: cls.questions.length > 0,
      questions: cls.questions,
      members: cls.members.map((m) => ({
        ...(m.account_id === undefined ? {} : { accountId: m.account_id }),
        ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
        ...(m.target_bp === undefined ? {} : { targetBp: m.target_bp }),
        ...(m.answers === undefined ? {} : { answers: m.answers }),
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
      const asked = cls.byQuestions && cls.questions.length > 0;

      return {
        name: cls.name,
        target_bp: cls.targetBp,
        ...(asked ? { questions: cls.questions } : {}),
        members: cls.members.map((m) => ({
          ...(m.accountId === undefined ? {} : { account_id: m.accountId }),
          ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
          ...(cls.byQuestions || m.targetBp === undefined
            ? {}
            : { target_bp: m.targetBp }),
          ...(asked ? { answers: m.answers ?? [] } : {}),
        })),
      };
    }),
  };
}
