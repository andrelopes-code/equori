import { useState } from "react";

import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  emptyForm,
  formOfRule,
  ruleOfForm,
  takesKind,
  yearProblem,
} from "@/features/portfolio/contribution-plan/rules/rule-form";
import type { RuleForm } from "@/features/portfolio/contribution-plan/rules/rule-form";

// The form of the rule under edit and what follows from it: the rule, its year problem and
// whether it can be saved.
export function useRuleDialog(initial: Rule | undefined) {
  const [form, setForm] = useState<RuleForm>(
    initial === undefined ? emptyForm : formOfRule(initial),
  );

  const rule = ruleOfForm(form);
  const problem = yearProblem(form);
  const complete = Object.keys(rule).length > 0;

  return {
    form,
    rule,
    problem,
    complete,
    canSave: complete && problem === undefined,
    change: (patch: Partial<RuleForm>) => {
      setForm((current) => ({ ...current, ...patch }));
    },
    // A new type drops the subtypes of the old one and a kind it does not take.
    changeType: (type: string) => {
      setForm((current) => ({
        ...current,
        type,
        subtypes: [],
        kind: takesKind(type) ? current.kind : "",
      }));
    },
  };
}
