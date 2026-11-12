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
// zero. A change of either is sent after 250 ms; the figures keep the previous answer until the
// next one arrives, and `pending` says so. A draft with a blank class name is not sent.
export function useContributionPreview(
  plan: Plan | undefined,
  draft?: PlanDraft,
) {
  const [typed, setTyped] = useState<number | undefined>(undefined);
  const [settledKey, setSettledKey] = useState<string | undefined>(undefined);
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
  const currency = plan?.total.currency;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettledKey(key);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [key]);

  useEffect(() => {
    if (!ready || currency === undefined || asked.amount <= 0) return;

    mutate({
      amount: { amount: asked.amount, currency },
      classes: asked.classes,
    });
    // askedKey stands for asked: the parsed copy changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedKey, ready, currency, mutate]);

  const previewed = ready && asked.amount > 0 && preview.data !== undefined;
  const view = previewed ? preview.data : plan;
  const pending = key !== askedKey || (asked.amount > 0 && preview.isPending);

  return { amount, setAmount: setTyped, view, pending };
}
