import { ButtonLink } from "@slotted/react/button";
import {
  Card,
  CardActions,
  CardBody,
  CardFooter,
  CardHeader,
} from "@slotted/react/card";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Stepper, StepperList, StepperStep } from "@slotted/react/stepper";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  anyTransactionQuery,
  uncategorizedQuery,
} from "@/features/overview/api";
import { firstSteps } from "@/features/overview/first-steps";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

// What a newcomer does before the overview has anything to show, as numbered steps with the next
// one's action; gone once every step is done.
export function FirstStepsBlock() {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const anyTransaction = useQuery(anyTransactionQuery(api));
  const uncategorized = useQuery(uncategorizedQuery(api));

  const loaded =
    accounts.data !== undefined &&
    anyTransaction.data !== undefined &&
    uncategorized.data !== undefined;
  const steps = loaded
    ? firstSteps({
        hasAccount: accounts.data.some((a) => a.kind !== undefined),
        hasTransaction: anyTransaction.data,
        hasUncategorized: uncategorized.data.count > 0,
      })
    : [];
  const next = steps.find((s) => !s.done);

  if (next === undefined) return null;

  const done = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader>
        <Stack gap={1}>
          <Heading level={2} size="md">
            {t("firstSteps.title")}
          </Heading>
          <Text size="sm" tone="muted">
            {t("firstSteps.description")}
          </Text>
        </Stack>
        <CardActions>
          <Tag size="sm" tone="secondary">
            {t("firstSteps.progress", { done, total: steps.length })}
          </Tag>
        </CardActions>
      </CardHeader>
      <CardBody>
        <Stepper step={steps.indexOf(next)} navigation="none">
          <StepperList aria-label={t("firstSteps.title")}>
            {steps.map((step) => (
              <StepperStep
                key={step.id}
                label={t(`firstSteps.${step.id}`)}
                description={t(`firstSteps.${step.id}Hint`)}
                complete={step.done}
              />
            ))}
          </StepperList>
        </Stepper>
      </CardBody>
      <CardFooter>
        <Inline gap={3} wrap="wrap">
          <ButtonLink render={routeTo(next.destination)}>
            {t(`firstSteps.action.${next.id}`)}
          </ButtonLink>
          <ButtonLink
            variant="ghost"
            tone="secondary"
            render={routeTo({
              to: "/help/$page",
              params: { page: "first-month" },
            })}
          >
            {t("firstSteps.guide")}
          </ButtonLink>
        </Inline>
      </CardFooter>
    </Card>
  );
}
