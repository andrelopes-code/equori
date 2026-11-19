import { useEffect } from "react";

import type { components } from "@/api/schema.gen";
import { usePreviewContributionPlan } from "@/features/portfolio/api";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { toInput } from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  updateClass,
  type EditDraft,
} from "@/features/portfolio/contribution-plan/model/plan-edits";

type Money = components["schemas"]["Money"];

export interface RuleMatch {
  count: number;
  value: Money;
}

const debounceMs = 250;

// The securities the group holds under one rule: a preview without amount of the draft with the
// rules of the group replaced by this one (GR8). Without a rule nothing is sent.
export function useRuleMatch(
  draft: EditDraft | undefined,
  index: number,
  rule: Rule | undefined,
): RuleMatch | undefined {
  const preview = usePreviewContributionPlan();
  const { mutate } = preview;

  const classes =
    draft === undefined || rule === undefined
      ? undefined
      : toInput(updateClass(draft, index, (c) => ({ ...c, rules: [rule] })))
          .classes;
  const key = JSON.stringify(classes ?? null);

  useEffect(() => {
    if (classes === undefined || classes.some((c) => c.name.trim() === ""))
      return;

    const timer = setTimeout(() => {
      mutate({ classes });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
    // key stands for classes: the array changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mutate]);

  const group =
    classes === undefined ? undefined : preview.data?.classes[index];
  if (group === undefined) return undefined;

  return { count: group.matched.length, value: group.value };
}
