import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { HelpLink } from "@/features/help";
import { useT } from "@/i18n/i18n-provider";

// The header of the form New budget, with the help page of the task.
export function BudgetFormHeader() {
  const t = useT();

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("budget.new")}</PageHeaderHeading>
            <PageHeaderSubheading>
              {t("budget.newSubtitle")}
            </PageHeaderSubheading>
          </PageHeaderTitle>

          <PageHeaderActions>
            <HelpLink page="create-budget" />
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
