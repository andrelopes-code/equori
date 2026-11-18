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

import { useComparableIndexes } from "@/features/calculators/indexer-comparison/use-comparison-data";
import {
  calculatorGroups,
  calculators,
} from "@/features/calculators/model/calculators";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";
import { PageStack } from "@/ui/page-layout/page-stack";

// The calculators by group, each with the question it answers (design §4, "Routes").
export function CalculatorsPage() {
  const t = useT();
  const currency = useCalculatorMoney()?.currency ?? "";
  const comparable = useComparableIndexes(currency).length > 0;
  const listed = calculators.filter(
    (c) => c.id !== "indexer-comparison" || comparable,
  );

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
        <PageStack>
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
                  {listed
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
        </PageStack>
      </PageBody>
    </Page>
  );
}
