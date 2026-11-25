import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import { usePreviewContributionPlan } from "@/features/portfolio/api";
import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { PlanDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";

type Plan = components["schemas"]["ContributionPlan"];
type Classes = components["schemas"]["ContributionPlanInput"]["classes"];

const debounceMs = 250;

// The amount of the strip and the draft of the targets (the saved plan outside edit mode) with the
// plan they produce: the preview for the amount, or the saved plan itself while the amount is
// zero and no group has rules or criteria (GR8: such a group sends the preview without the amount).
// A change of either is sent after 250 ms, and a new answer of the filings in the saved plan at once
// (a feed loaded while the screen is open); the figures keep the previous answer until the next one
// arrives, and `pending` says so. A draft with a blank class name is not sent.
export function useContributionPreview(
  plan: Plan | undefined,
  draft?: PlanDraft,
) {
  const [typed, setTyped] = useState<number | undefined>(undefined);
  const [settledKey, setSettledKey] = useState<string | undefined>(undefined);
  const [last, setLast] = useState<Plan | undefined>(undefined);
  const preview = usePreviewContributionPlan();
  const { mutate } = preview;

  const amount = typed ?? plan?.amount?.amount ?? 0;
  const classes: Classes =
    plan === undefined ? [] : toInput(draft ?? toDraft(plan)).classes;
  const key = JSON.stringify({ amount, classes });
  const askedKey = settledKey ?? key;
  const asked = JSON.parse(askedKey) as { amount: number; classes: Classes };
  const ready =
    classes.length > 0 && classes.every((c) => c.name.trim() !== "");
  const byRule = asked.classes.some((c) => (c.rules?.length ?? 0) > 0);
  const byCriteria =
    draft !== undefined &&
    asked.classes.some((c) => (c.questions?.length ?? 0) > 0);
  const sends = asked.amount > 0 || byRule || byCriteria;
  const currency = plan?.total.currency;
  const factAnswers = JSON.stringify(
    plan?.classes.map((c) => c.members.map((m) => m.fact_answers)),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettledKey(key);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [key]);

  useEffect(() => {
    if (!ready || currency === undefined || !sends) return;

    // Without an amount the preview values the draft with no split (GR8).
    mutate(
      {
        ...(asked.amount > 0
          ? { amount: { amount: asked.amount, currency } }
          : {}),
        classes: asked.classes,
      },
      { onSuccess: setLast },
    );
    // askedKey stands for asked: the parsed copy changes identity on every render. factAnswers is
    // not the plan: a preview refetches it, and a moving quote would send previews without end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedKey, factAnswers, ready, currency, mutate]);

  const previewed = ready && sends && last !== undefined && fits(last, classes);
  const view = previewed ? last : plan;
  const pending = key !== askedKey || (sends && preview.isPending);

  return { amount, setAmount: setTyped, view, pending };
}

// Whether the answer holds the groups and the assets asked now: one of other groups is not drawn while
// the next answer is on the way.
function fits(view: Plan, classes: Classes): boolean {
  return (
    view.classes.length === classes.length &&
    view.classes.every(
      (cls, i) => cls.members.length === classes[i]?.members.length,
    )
  );
}
