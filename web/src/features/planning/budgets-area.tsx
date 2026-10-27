import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { useDeferredValue, useState } from "react";

import { BudgetPlanTab } from "@/features/planning/budget-plan-tab";
import { BudgetsTab } from "@/features/planning/budgets-tab";
import type { BudgetView } from "@/features/planning/planning-search";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// The budgets tab in two views of the same month: Plan distributes the reference, Track
// follows the spending. A month after the current one opens in Plan (spec 5).
export function BudgetsArea({
  month,
  view,
  onView,
  onCreate,
}: {
  month: string;
  view: BudgetView | undefined;
  onView: (view: BudgetView) => Promise<unknown>;
  onCreate: () => void;
}) {
  const t = useT();
  const today = useToday();
  const current: BudgetView =
    view ?? (month > today.slice(0, 7) ? "plan" : "track");
  // CP-09: the control moves at once; the view renders from the deferred value.
  const [chosen, setChosen] = useState<BudgetView | null>(null);
  const shown = useDeferredValue(chosen ?? current);
  return (
    <Stack gap={5}>
      <SegmentedControl
        aria-label={t("plan.view")}
        value={chosen ?? current}
        onValueChange={(value) => {
          const next: BudgetView = value === "plan" ? "plan" : "track";
          setChosen(next);
          void onView(next).finally(() => {
            setChosen(null);
          });
        }}
      >
        <Segment value="plan">{t("plan.view.plan")}</Segment>
        <Segment value="track">{t("plan.view.track")}</Segment>
      </SegmentedControl>
      <div aria-busy={shown !== (chosen ?? current) || undefined}>
        {shown === "plan" ? (
          <BudgetPlanTab month={month} />
        ) : (
          <BudgetsTab month={month} onCreate={onCreate} />
        )}
      </div>
    </Stack>
  );
}
