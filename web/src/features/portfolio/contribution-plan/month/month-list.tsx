import { Button } from "@slotted/react/button";
import { SectionActions } from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import {
  dueCount,
  listSections,
} from "@/features/portfolio/contribution-plan/list/list-rows";
import { PlanBoard } from "@/features/portfolio/contribution-plan/list/plan-board";
import { useOpenRow } from "@/features/portfolio/contribution-plan/list/use-open-row";
import { MonthSection } from "@/features/portfolio/contribution-plan/month/month-section";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface MonthListProps {
  // The plan stored, and the plan split by the amount.
  plan: Plan;
  view: Plan;
  amount: number;
  pending: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onAmount: (minor: number) => void;
  // Enters edit mode with the assets of a group open.
  onSplit: (group: number) => void;
}

// The month with the list of the assets, and the way to the answers that are due, which never holds it.
export function MonthList({
  plan,
  view,
  amount,
  pending,
  memberName,
  onAmount,
  onSplit,
}: MonthListProps) {
  const t = useT();
  const scale = useScale();
  const sections = listSections(view, memberName, scale ?? undefined);
  const opened = useOpenRow(sections, plan);

  const due = dueCount(plan);

  return (
    <MonthSection
      view={view}
      amount={amount}
      pending={pending}
      onAmount={onAmount}
      board={
        <PlanBoard
          plan={plan}
          view={view}
          sections={sections}
          opened={opened}
          memberName={memberName}
          onSplit={onSplit}
        />
      }
      actions={
        opened.moreDue && (
          <SectionActions>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              onClick={opened.onNextDue}
            >
              {due === 1
                ? t("contributionPlan.list.reviewOne")
                : t("contributionPlan.list.reviewMany", {
                    count: String(due),
                  })}
            </Button>
          </SectionActions>
        )
      }
    />
  );
}
