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
import type { CalculatorId } from "@/features/calculators/model/calculators";
import { useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/navigation/page-back";
import { PageStack } from "@/ui/page-layout/page-stack";

interface CalculatorFrameBase {
  id: CalculatorId;
}

interface AnswerFrameProps extends CalculatorFrameBase {
  unavailable?: false;
  // null while the base currency loads: the frame draws the answer without the inputs card.
  inputs: ReactNode;
  answer: ReactNode;
  evidence?: ReactNode;
  // Inputs the answer does not need; drawn in the inputs card.
  optional?: ReactNode;
  details?: ReactNode;
  method: ReactNode;
}

// A calculator not yet written draws its title and the unavailable message only.
interface UnavailableFrameProps extends CalculatorFrameBase {
  unavailable: true;
}

type CalculatorFrameProps = AnswerFrameProps | UnavailableFrameProps;

// One calculator: the answer, then the evidence beside the inputs (the optional inputs inside
// their card), then the details and "How it is calculated".
export function CalculatorFrame(props: CalculatorFrameProps) {
  const t = useT();
  const hasEvidence =
    !props.unavailable &&
    props.evidence !== undefined &&
    props.evidence !== null;

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack render={(p) => <Link {...p} to="/calculators" />}>
            {t("calc.back")}
          </PageBack>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {t(`calc.${props.id}.title`)}
              </PageHeaderHeading>
              <PageHeaderSubheading>
                {t(`calc.${props.id}.question`)}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <PageStack>
          {props.unavailable ? (
            <ResultState status="empty" align="start">
              <ResultStateContent>
                <ResultStateTitle>{t("calc.unavailable")}</ResultStateTitle>
                <ResultStateDescription>
                  {t("calc.unavailable.description")}
                </ResultStateDescription>
              </ResultStateContent>
            </ResultState>
          ) : (
            <div className={gridClass(hasEvidence)}>
              {props.answer}

              {hasEvidence && (
                <div className={design.evidence}>{props.evidence}</div>
              )}

              {props.inputs !== null && (
                <Card className={design.inputs}>
                  <CardBody>
                    <Stack gap={8}>
                      {props.inputs}
                      {props.optional}
                    </Stack>
                  </CardBody>
                </Card>
              )}

              <div className={design.after}>
                {props.details}
                {props.method}
              </div>
            </div>
          )}
        </PageStack>
      </PageBody>
    </Page>
  );
}

// Without evidence the inputs card takes the first column, under the answer.
function gridClass(hasEvidence: boolean): string | undefined {
  return hasEvidence ? design.calc : [design.calc, design.noEvidence].join(" ");
}
