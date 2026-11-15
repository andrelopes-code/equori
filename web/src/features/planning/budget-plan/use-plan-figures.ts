import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  bucketFigures,
  bucketGroups,
} from "@/features/planning/income-split/bucket-figures";
import { planGroups } from "@/features/planning/budget-plan/plan-groups";
import {
  firstNextChange,
  previousMonth,
} from "@/features/planning/budget-plan/plan-month";
import { planSegments } from "@/features/planning/budget-plan/plan-segments";
import type { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

type BudgetPlan = components["schemas"]["BudgetPlan"];

// The figures of the Plan view that follow the draft (budget plan spec 5.1): the room left
// after commitments, the groups of the table, the buckets, the bar's segments and the save
// bar's sentence.
export function usePlanFigures(
  plan: BudgetPlan,
  draft: ReturnType<typeof usePlanDraft>,
  entries: readonly CategoryEntry[],
  month: string,
  format: PlanFormat,
) {
  const t = useT();
  const reference = draft.reference;
  const unassigned = draft.unassigned;
  // With a bucket method the table and the bar follow the buckets (income buckets spec 5).
  const groups =
    plan.buckets === undefined
      ? planGroups(entries, draft.rows, t("plan.withoutBudget"))
      : bucketGroups(plan.buckets, entries, draft.rows, t("buckets.outside"));
  const next = firstNextChange(draft.rows);

  return {
    reference,
    unassigned,
    over: unassigned !== undefined && unassigned < 0,
    room:
      reference === undefined
        ? undefined
        : reference - plan.installments.amount - plan.savings.amount,
    committed: plan.installments.amount + plan.savings.amount + draft.planned,
    groups,
    buckets:
      plan.buckets === undefined
        ? undefined
        : bucketFigures(
            plan.buckets,
            entries,
            draft.rows,
            reference,
            plan.savings.amount,
          ),
    lastMonth: format.monthName(previousMonth(month)),
    figure:
      unassigned === undefined
        ? t("plan.dash")
        : format.money(Math.abs(unassigned)),
    segments: planSegments(
      plan.installments.amount,
      plan.savings.amount,
      groups,
      unassigned,
      {
        installments: t("plan.installments"),
        savings: t("plan.savings"),
        rest: t("plan.unassigned"),
        over: t("plan.overSegment"),
      },
    ),
    applies:
      next === undefined
        ? t("plan.applies", { month: format.month(month) })
        : t("plan.appliesUntil", {
            month: format.month(month),
            until: format.month(previousMonth(next)),
          }),
  };
}
