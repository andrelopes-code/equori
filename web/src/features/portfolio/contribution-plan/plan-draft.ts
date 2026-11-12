import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];
type Input = components["schemas"]["ContributionPlanInput"];
type Money = components["schemas"]["Money"];

export interface MemberDraft {
  accountId?: string;
  instrument?: string;
  targetBp?: number;
}

export interface ClassDraft {
  name: string;
  targetBp: number;
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
      members: cls.members.map((m) => ({
        ...(m.account_id === undefined ? {} : { accountId: m.account_id }),
        ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
        ...(m.target_bp === undefined ? {} : { targetBp: m.target_bp }),
      })),
    })),
  };
  if (view.amount !== undefined) draft.amount = view.amount;

  return draft;
}

export function toInput(draft: PlanDraft): Input {
  return {
    ...(draft.amount === undefined ? {} : { amount: draft.amount }),
    classes: draft.classes.map((cls) => ({
      name: cls.name,
      target_bp: cls.targetBp,
      members: cls.members.map((m) => ({
        ...(m.accountId === undefined ? {} : { account_id: m.accountId }),
        ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
        ...(m.targetBp === undefined ? {} : { target_bp: m.targetBp }),
      })),
    })),
  };
}
