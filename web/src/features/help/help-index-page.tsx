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
import { Stack } from "@slotted/react/stack";

import { HelpFeatured } from "@/features/help/help-featured";
import { HelpKindCard } from "@/features/help/help-kind-card";
import { useT } from "@/i18n/i18n-provider";

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
        <Stack gap={8}>
          <HelpFeatured id="first-month" />

          <Grid columns={3} minItemWidth="md" gap={6} align="start">
            <HelpKindCard kind="howto" />
            <HelpKindCard kind="reference" />
            <HelpKindCard kind="explanation" />
          </Grid>
        </Stack>
      </PageBody>
    </Page>
  );
}
