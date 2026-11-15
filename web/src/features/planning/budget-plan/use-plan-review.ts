import { useState } from "react";

import { fitToRoom } from "@/features/planning/budget-plan/plan-math";
import type { RowReview } from "@/features/planning/budget-plan/plan-row";
import type { SuggestBasis } from "@/features/planning/budget-plan/plan-toolbar";
import type { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface Review {
  basis: SuggestBasis;
  proposals: ReadonlyMap<string, number>;
  unchecked: ReadonlySet<string>;
  fit: boolean;
}

// The suggestion under review (budget plan A132): proposals fitted to the room when asked,
// checked by default, with the sentence that sums them up.
export function usePlanReview(
  draft: ReturnType<typeof usePlanDraft>,
  room: number | undefined,
  format: PlanFormat,
  previousMonth: string,
) {
  const t = useT();
  const [review, setReview] = useState<Review | null>(null);

  let rows: Map<string, RowReview> | undefined;
  let summary = "";
  let canFit = false;
  const accepted = new Map<string, number>();
  if (review !== null) {
    const counted = new Set(
      draft.rows.filter((r) => r.counted).map((r) => r.category_id),
    );
    const steady = draft.rows
      .filter((r) => r.counted && !review.proposals.has(r.category_id))
      .reduce((sum, r) => sum + r.draft, 0);
    const proposedCounted = new Map(
      [...review.proposals].filter(([id]) => counted.has(id)),
    );
    const proposedSum = [...proposedCounted.values()].reduce(
      (a, v) => a + v,
      0,
    );
    canFit = room !== undefined && steady + proposedSum > room;
    const fitted =
      review.fit && canFit && room !== undefined
        ? new Map([
            ...review.proposals,
            ...fitToRoom(proposedCounted, room - steady),
          ])
        : review.proposals;
    rows = new Map();
    for (const [id, value] of fitted) {
      const checked = !review.unchecked.has(id);
      if (checked) accepted.set(id, value);
      rows.set(id, {
        suggested: value,
        checked,
        onCheck: (on) => {
          const unchecked = new Set(review.unchecked);
          if (on) unchecked.delete(id);
          else unchecked.add(id);
          setReview({ ...review, unchecked });
        },
      });
    }
    const delta = draft.rows.reduce(
      (sum, r) =>
        sum +
        (r.counted && accepted.has(r.category_id)
          ? (accepted.get(r.category_id) ?? 0) - r.draft
          : 0),
      0,
    );
    const basis =
      review.basis === "average"
        ? t("plan.suggest.average")
        : t("plan.suggest.lastMonth", { month: previousMonth });
    const unassigned = draft.unassigned;
    const rest = unassigned === undefined ? undefined : unassigned - delta;
    summary =
      fitted.size === 0
        ? t("plan.reviewNone", { basis })
        : t(fitted.size === 1 ? "plan.reviewOne" : "plan.review", {
            basis,
            count: String(fitted.size),
            delta: format.signed(delta),
            rest: rest === undefined ? t("plan.dash") : format.money(rest),
          });
  }

  return {
    review,
    rows,
    summary,
    canFit,
    accepted,
    start: (basis: SuggestBasis, proposals: ReadonlyMap<string, number>) => {
      setReview({ basis, proposals, unchecked: new Set(), fit: true });
    },
    setFit: (fit: boolean) => {
      if (review !== null) setReview({ ...review, fit });
    },
    clear: () => {
      setReview(null);
    },
    // Applies the checked proposals to the draft, ends the review and returns their count.
    apply: () => {
      draft.apply(accepted);
      setReview(null);
      return accepted.size;
    },
  };
}
