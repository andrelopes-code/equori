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
import { Heading } from "@slotted/react/typography";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import styles from "@/features/calculators/calculators.module.css";
import type { CalculatorId } from "@/features/calculators/calculators";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/page-back";

// One calculator (design §4, "Layout"): the inputs beside the results, which stay in view while
// the inputs scroll and carry their own evidence (a chart, a short table); the optional inputs
// under the inputs, and on a phone under the results, so the answer follows the required inputs; below them the details
// too wide for the results column (two schedules side by side), then "How it is calculated". One column below 1024 px, in the same order.
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
}: {
  id: CalculatorId;
  unavailable?: boolean;
  inputs: ReactNode;
  // Inputs a result does not need: they refine it or add figures to it.
  options?: ReactNode;
  results: ReactNode;
  details?: ReactNode;
  method: ReactNode;
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
        <Stack gap={8}>
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
          {inputs !== null && (
            <div className={styles.work}>
              <Card className={styles.inputs}>
                <CardBody>
                  <Stack gap={6}>{inputs}</Stack>
                </CardBody>
              </Card>
              {options !== undefined && (
                <Card className={styles.options}>
                  <CardBody>
                    <Stack gap={6}>
                      <Heading level={2} size="md">
                        {t("calc.options")}
                      </Heading>
                      {options}
                    </Stack>
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
          {details}
          {method}
        </Stack>
      </PageBody>
    </Page>
  );
}
