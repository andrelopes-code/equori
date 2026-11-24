import { Button } from "@slotted/react/button";

import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { useT } from "@/i18n/i18n-provider";

interface PlanHeaderProps {
  // The plan is shown, not edited, and holds groups: its groups can be edited.
  editable: boolean;
  editDisabled: boolean;
  onEdit: () => void;
}

// The header of the contribution plan: the tab of the portfolio area, the help page of the
// screen and the action that edits the groups.
export function PlanHeader({
  editable,
  editDisabled,
  onEdit,
}: PlanHeaderProps) {
  const t = useT();

  return (
    <PortfolioAreaHeader
      tab="contributions"
      subheading={t("contributionPlan.subtitle")}
      help="contribution-plan"
      actions={
        editable && (
          <Button disabled={editDisabled} onClick={onEdit}>
            {t("contributionPlan.edit")}
          </Button>
        )
      }
    />
  );
}
