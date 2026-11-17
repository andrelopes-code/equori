import { Grid } from "@slotted/react/grid";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { HelpFeatured } from "@/features/help/featured/help-featured";
import { HelpKindCard } from "@/features/help/kind-card/help-kind-card";
import { useT } from "@/i18n/i18n-provider";
import { PageStack } from "@/ui/page-layout/page-stack";

// The walkthrough first, as the way in for a newcomer; then the other pages by kind.
export function HelpIndexPage() {
  const t = useT();

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("help.title")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("help.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <PageStack>
          <HelpFeatured id="first-month" />

          <Grid columns={3} minItemWidth="md" gap={6}>
            <HelpKindCard kind="howto" />
            <HelpKindCard kind="reference" />
            <HelpKindCard kind="explanation" />
          </Grid>
        </PageStack>
      </PageBody>
    </Page>
  );
}
