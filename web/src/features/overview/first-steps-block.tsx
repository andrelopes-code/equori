import { List } from "@slotted/react/list";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  anyTransactionQuery,
  uncategorizedQuery,
} from "@/features/overview/api";
import { FirstStepItem } from "@/features/overview/first-step-item";
import { firstSteps } from "@/features/overview/first-steps";
import { useT } from "@/i18n/i18n-provider";
import { AppLink } from "@/ui/app-link";

// What a newcomer does before the overview has anything to show; gone once it is done.
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

  if (steps.length === 0) return null;

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("firstSteps.title")}</SectionHeading>
          <SectionDescription>{t("firstSteps.description")}</SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <Stack gap={4}>
          <List variant="framed">
            {steps.map((step) => (
              <FirstStepItem key={step.id} step={step} />
            ))}
          </List>

          <Text size="sm">
            <AppLink
              to={{ to: "/help/$page", params: { page: "first-month" } }}
            >
              {t("firstSteps.guide")}
            </AppLink>
          </Text>
        </Stack>
      </SectionBody>
    </Section>
  );
}
