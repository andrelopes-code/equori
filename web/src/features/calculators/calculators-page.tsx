import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";

import {
  calculatorGroups,
  calculators,
} from "@/features/calculators/calculators";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// The calculators by group, each with the question it answers (design §4, "Routes").
export function CalculatorsPage() {
  const t = useT();
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("calc.title")}</PageHeaderHeading>
              <PageHeaderSubheading>{t("calc.subtitle")}</PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          {calculatorGroups.map((group) => (
            <Section key={group}>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t(`calc.group.${group}`)}</SectionHeading>
                  <SectionDescription>
                    {t(`calc.group.${group}.description`)}
                  </SectionDescription>
                </SectionTitle>
              </SectionHeader>
              <SectionBody>
                <List variant="framed">
                  {calculators
                    .filter((c) => c.group === group)
                    .map(({ id }) => (
                      <ListItem key={id}>
                        <ListItemLink
                          render={routeTo({
                            to: "/calculators/$id",
                            params: { id },
                          })}
                        >
                          <ListItemBody>
                            <ListItemLabel>
                              {t(`calc.${id}.title`)}
                            </ListItemLabel>
                            <ListItemDescription>
                              {t(`calc.${id}.question`)}
                            </ListItemDescription>
                          </ListItemBody>
                        </ListItemLink>
                      </ListItem>
                    ))}
                </List>
              </SectionBody>
            </Section>
          ))}
        </Stack>
      </PageBody>
    </Page>
  );
}
