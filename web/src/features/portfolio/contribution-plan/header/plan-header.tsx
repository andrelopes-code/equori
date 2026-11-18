import { Button } from "@slotted/react/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Link } from "@tanstack/react-router";

import { HelpLink } from "@/features/help";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";

interface PlanHeaderProps {
  // The plan is shown, not edited, and holds groups: its groups can be edited.
  editable: boolean;
  editDisabled: boolean;
  onEdit: () => void;
}

// The header of the contribution plan: the way back to the portfolio, the help page of the
// screen and the action that edits the groups.
export function PlanHeader({
  editable,
  editDisabled,
  onEdit,
}: PlanHeaderProps) {
  const t = useT();

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageBack render={(props) => <Link {...props} to="/portfolio" />}>
          {t("nav.portfolio")}
        </PageBack>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("contributionPlan.title")}</PageHeaderHeading>
            <PageHeaderSubheading>
              {t("contributionPlan.subtitle")}
            </PageHeaderSubheading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <HelpLink page="contribution-plan" />
            {editable && (
              <Button disabled={editDisabled} onClick={onEdit}>
                {t("contributionPlan.edit")}
              </Button>
            )}
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
