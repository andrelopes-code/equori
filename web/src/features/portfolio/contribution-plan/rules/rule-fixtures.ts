import type { components } from "@/api/schema.gen";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { json } from "@/testing/fake-api";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

export const byRuleDraft = (rules: Rule[]): EditDraft => ({
  classes: [
    {
      name: "Pós",
      targetBp: 10000,
      byQuestions: false,
      questions: [],
      questionFacts: [],
      questionLimits: [],
      members: [],
      rules,
      locked: false,
      split: false,
      byRule: true,
      memberLocks: [],
    },
  ],
});

// The preview of a draft whose first group meets one security worth 18,000.00.
export const previewRoute = () =>
  json(200, {
    status: "complete",
    total: brl(1800000),
    drift_bp: 0,
    classes: [
      {
        name: "Pós",
        target_bp: 10000,
        value: brl(1800000),
        share_bp: 10000,
        questions: [],
        question_facts: [],
        question_limits: [],
        question_ideals: false,
        rules: [],
        matched: [{ instrument: "CDB1", value: brl(1800000), share_bp: 10000 }],
        members: [],
      },
    ],
    outside: [],
    missing: [],
  } satisfies Plan);
