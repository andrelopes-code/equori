import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import { usePreviewContributionPlan } from "@/features/portfolio/api";
import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/plan-draft";

type Plan = components["schemas"]["ContributionPlan"];

const debounceMs = 250;

// The amount of the strip and the plan it produces: the preview of the saved plan for the amount,
// or the saved plan itself while the amount is zero. The figures keep the previous answer until
// the next one arrives, and `pending` says so.
export function useContributionPreview(plan: Plan | undefined) {
  const [typed, setTyped] = useState<number | undefined>(undefined);
  const [settled, setSettled] = useState<number | undefined>(undefined);
  const preview = usePreviewContributionPlan();
  const { mutate } = preview;

  const amount = typed ?? plan?.amount?.amount ?? 0;
  const asked = settled ?? amount;
  const hasPlan = plan !== undefined && plan.classes.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(amount);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [amount]);

  useEffect(() => {
    if (plan === undefined || plan.classes.length === 0 || asked <= 0) return;

    mutate({
      amount: { amount: asked, currency: plan.total.currency },
      classes: toInput(toDraft(plan)).classes,
    });
  }, [plan, asked, mutate]);

  const previewed = hasPlan && asked > 0 && preview.data !== undefined;
  const view = previewed ? preview.data : plan;
  const pending = amount !== asked || (asked > 0 && preview.isPending);

  return { amount, setAmount: setTyped, view, pending };
}
