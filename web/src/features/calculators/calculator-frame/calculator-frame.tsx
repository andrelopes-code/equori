import { Card, CardBody } from "@slotted/react/card";
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
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import design from "@/features/calculators/calculator-frame/calculator-design.module.css";
import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import type { CalculatorId } from "@/features/calculators/model/calculators";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { PageStack } from "@/ui/page-layout/page-stack";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

// One calculator (design §4, "Layout"): the inputs beside the results, which stay in view while
// the inputs scroll and carry their own evidence (a chart, a short table); the optional inputs
// under the inputs, and on a phone under the results, so the answer follows the required inputs; below them the details
// too wide for the results column (two schedules side by side), then "How it is calculated". One column below 1024 px, in the same order.
// With answer set, the frame draws the answer-first layout instead: the answer, then the evidence
// beside the inputs (the optional inputs inside their card), then the details and the method.
// results is null until every required input is valid; inputs is null while the base currency
// loads, and for a calculator not yet written, which states so.
export function CalculatorFrame({
  id,
  unavailable = false,
  inputs,
  options,
  results,
  details,
  method,
  answer,
  evidence,
  optional,
}: {
  id: CalculatorId;
  unavailable?: boolean;
  inputs: ReactNode;
  // Inputs a result does not need: they refine it or add figures to it.
  options?: ReactNode;
  results?: ReactNode;
  details?: ReactNode;
  method: ReactNode;
  answer?: ReactNode;
  evidence?: ReactNode;
  // Inputs of the answer layout a result does not need; drawn in the inputs card.
  optional?: ReactNode;
}) {
  const t = useT();
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(props) => <Link {...props} to="/calculators" />}>
            {t("calc.back")}
          </PageBack>
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
        <PageStack>
          {unavailable && (
            <ResultState status="empty" align="start">
              <ResultStateContent>
                <ResultStateTitle>{t("calc.unavailable")}</ResultStateTitle>
                <ResultStateDescription>
                  {t("calc.unavailable.description")}
                </ResultStateDescription>
              </ResultStateContent>
            </ResultState>
          )}
          {answer !== undefined && (
            <div className={design.calc}>
              {answer}

              {evidence !== undefined && (
                <div className={design.evidence}>{evidence}</div>
              )}

              {inputs !== null && (
                <Card className={design.inputs}>
                  <CardBody>
                    <Stack gap={6}>
                      {inputs}
                      {optional}
                    </Stack>
                  </CardBody>
                </Card>
              )}

              <div className={design.after}>
                {details}
                {method}
              </div>
            </div>
          )}
          {answer === undefined && inputs !== null && (
            <div className={styles.work}>
              <Card className={styles.inputs}>
                <CardBody>
                  <Stack gap={6}>{inputs}</Stack>
                </CardBody>
              </Card>
              {options !== undefined && (
                <Card className={styles.options}>
                  <CardBody>
                    <Section size="lg">
                      <SectionHeader>
                        <SectionTitle>
                          <SectionHeading>{t("calc.options")}</SectionHeading>
                        </SectionTitle>
                      </SectionHeader>

                      <SectionBody>
                        <Stack gap={6}>{options}</Stack>
                      </SectionBody>
                    </Section>
                  </CardBody>
                </Card>
              )}
              <section
                className={styles.results}
                aria-label={t("calc.results")}
                aria-live="polite"
              >
                {results ?? (
                  <ResultState status="empty" align="start" live="off">
                    <ResultStateContent>
                      <ResultStateTitle>
                        {t("calc.results.emptyTitle")}
                      </ResultStateTitle>
                      <ResultStateDescription>
                        {t("calc.results.empty")}
                      </ResultStateDescription>
                    </ResultStateContent>
                  </ResultState>
                )}
              </section>
            </div>
          )}
          {answer === undefined && (
            <>
              {details}
              {method}
            </>
          )}
        </PageStack>
      </PageBody>
    </Page>
  );
}
