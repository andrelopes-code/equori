import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import styles from "@/features/calculators/calculators.module.css";
import type { CalculatorId } from "@/features/calculators/calculators";
import { useT } from "@/i18n/i18n-provider";

// One calculator (design §4, "Layout"): inputs, then results, then "How it is calculated".
// results is null until every required input is valid.
export function CalculatorFrame({
  id,
  inputs,
  results,
  method,
}: {
  id: CalculatorId;
  inputs: ReactNode;
  results: ReactNode;
  method: ReactNode;
}) {
  const t = useT();
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderNav>
            <PageHeaderBack
              render={(props) => <Link {...props} to="/calculators" />}
            >
              {t("calc.back")}
            </PageHeaderBack>
          </PageHeaderNav>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t(`calc.${id}.title`)}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t(`calc.${id}.question`)}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={8}>
          <div className={styles.work}>
            <Section>
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("calc.inputs")}</SectionHeading>
                </SectionTitle>
              </SectionHeader>
              <SectionBody>
                <Stack gap={4}>{inputs}</Stack>
              </SectionBody>
            </Section>
            <Section aria-live="polite">
              <SectionHeader>
                <SectionTitle>
                  <SectionHeading>{t("calc.results")}</SectionHeading>
                </SectionTitle>
              </SectionHeader>
              <SectionBody>
                {results ?? (
                  <Text size="sm" tone="muted">
                    {t("calc.results.empty")}
                  </Text>
                )}
              </SectionBody>
            </Section>
          </div>
          {method}
        </Stack>
      </PageBody>
    </Page>
  );
}
