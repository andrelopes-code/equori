import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { PlanDistributeDialog } from "@/features/planning/budget-plan/plan-distribute-dialog";
import { suggestion } from "@/features/planning/budget-plan/model/plan-math";
import { PlanSuggestionBanner } from "@/features/planning/budget-plan/plan-suggestion-banner";
import { PlanTable } from "@/features/planning/budget-plan/plan-table";
import { PlanToolbar } from "@/features/planning/budget-plan/plan-toolbar";
import type { usePlanDraft } from "@/features/planning/budget-plan/use-plan-draft";
import type { usePlanFigures } from "@/features/planning/budget-plan/use-plan-figures";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import type { usePlanReview } from "@/features/planning/budget-plan/use-plan-review";
import { useT } from "@/i18n/i18n-provider";

type BudgetPlan = components["schemas"]["BudgetPlan"];

interface PlanWorkAreaProps {
  plan: BudgetPlan;
  draft: ReturnType<typeof usePlanDraft>;
  figures: ReturnType<typeof usePlanFigures>;
  review: ReturnType<typeof usePlanReview>;
  format: PlanFormat;
  month: string;
  editable: boolean;
  noHistory: boolean;
  collapsed: ReadonlySet<string>;
  highlighted: string | null;
  // The rows the last save failed on.
  invalid: ReadonlySet<string>;
  onToggle: (group: string) => void;
  onHighlight: (group: string | null) => void;
  // A change the reader can undo from a toast.
  onUndoable: (title: string) => void;
}

// The table of the plan with its toolbar, or its heading in a read-only month, and the
// suggestion under review (budget plan spec 5.1 and 5.2).
export function PlanWorkArea({
  plan,
  draft,
  figures,
  review,
  format,
  month,
  editable,
  noHistory,
  collapsed,
  highlighted,
  invalid,
  onToggle,
  onHighlight,
  onUndoable,
}: PlanWorkAreaProps) {
  const t = useT();
  const [unit, setUnit] = useState<"money" | "share">("money");
  const [picking, setPicking] = useState(false);
  const { reference, unassigned, groups, lastMonth } = figures;

  return (
    <Stack gap={3}>
      {editable && (
        <PlanToolbar
          heading={t("plan.heading", { month: format.month(month) })}
          previousMonth={lastMonth}
          unit={unit}
          shareable={reference !== undefined && reference > 0}
          canDistribute={unassigned !== undefined && unassigned > 0}
          suggestPrimary={
            noHistory || plan.rows.every((r) => r.budget_id === undefined)
          }
          onUnit={setUnit}
          onDistribute={() => {
            draft.distribute("proportional");
            onUndoable(t("plan.distributed"));
          }}
          onPickOne={() => {
            setPicking(true);
          }}
          onSuggest={(basis) => {
            review.start(basis, suggestion(draft.rows, basis));
          }}
        />
      )}
      {!editable && (
        <Text size="md" weight="semibold">
          {t("plan.heading", { month: format.month(month) })}
        </Text>
      )}
      {noHistory && (
        <Text size="sm" tone="muted">
          {t("plan.noHistory")}
        </Text>
      )}
      {review.review !== null && (
        <PlanSuggestionBanner
          summary={review.summary}
          checked={review.accepted.size}
          fit={review.review.fit}
          canFit={review.canFit}
          onFit={review.setFit}
          onApply={() => {
            const count = review.apply();
            onUndoable(
              count === 1
                ? t("plan.appliedOne")
                : t("plan.applied", { count: String(count) }),
            );
          }}
          onDiscard={review.clear}
        />
      )}

      <PlanTable
        caption={t("plan.heading", { month: format.month(month) })}
        groups={groups}
        collapsed={collapsed}
        previousMonth={lastMonth}
        format={format}
        unit={unit}
        reference={reference}
        rest={unassigned ?? 0}
        editable={editable}
        invalid={invalid}
        highlighted={highlighted}
        review={review.rows}
        onToggle={onToggle}
        onHighlight={onHighlight}
        onChange={(id, amount) => {
          if (amount === undefined) draft.revert(id);
          else draft.set(id, amount);
        }}
      />
      {picking && (
        <PlanDistributeDialog
          rows={groups.flatMap((g) => g.lines)}
          rest={unassigned ?? 0}
          format={format}
          onCancel={() => {
            setPicking(false);
          }}
          onPick={(categoryId) => {
            setPicking(false);
            draft.distribute({ categoryId });
            onUndoable(t("plan.distributed"));
          }}
        />
      )}
    </Stack>
  );
}
