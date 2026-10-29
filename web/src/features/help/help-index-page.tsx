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

import { HelpKindSection } from "@/features/help/help-kind-section";
import { helpKinds } from "@/features/help/help-pages";
import { useT } from "@/i18n/i18n-provider";

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
        <Stack gap={6}>
          {helpKinds.map((kind) => (
            <HelpKindSection key={kind} kind={kind} />
          ))}
        </Stack>
      </PageBody>
    </Page>
  );
}
