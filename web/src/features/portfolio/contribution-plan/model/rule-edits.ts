import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  type EditDraft,
  updateClass,
} from "@/features/portfolio/contribution-plan/model/plan-edits";

export const maxRules = 5;

// On: the group gathers its assets by rule, with no rule yet, and drops its members, questions
// and member targets. Off: the group drops its rules and holds chosen assets again.
export function setByRule(
  draft: EditDraft,
  index: number,
  on: boolean,
): EditDraft {
  return updateClass(draft, index, (cls) =>
    on
      ? {
          ...cls,
          byRule: true,
          byQuestions: false,
          split: false,
          questions: [],
          members: [],
          memberLocks: [],
          rules: [],
        }
      : { ...cls, byRule: false, rules: [] },
  );
}

export function addRule(
  draft: EditDraft,
  index: number,
  rule: Rule,
): EditDraft {
  if ((draft.classes[index]?.rules.length ?? 0) >= maxRules) return draft;

  return updateClass(draft, index, (cls) => ({
    ...cls,
    rules: [...cls.rules, rule],
  }));
}

export function replaceRule(
  draft: EditDraft,
  index: number,
  at: number,
  rule: Rule,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    rules: cls.rules.map((r, i) => (i === at ? rule : r)),
  }));
}

export function removeRule(
  draft: EditDraft,
  index: number,
  at: number,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    rules: cls.rules.filter((_, i) => i !== at),
  }));
}
