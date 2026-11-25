import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { IncompleteVerdict } from "@/features/portfolio/contribution-plan/month/incomplete-verdict";
import { MonthPlanHint } from "@/features/portfolio/contribution-plan/month/month-plan-hint";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyInput } from "@/ui/money/money-input";

type Plan = components["schemas"]["ContributionPlan"];

interface MonthSectionProps {
  view: Plan;
  // The list of the month; nothing while the groups are edited.
  board?: ReactNode;
  // What the header of the section offers.
  actions?: ReactNode;
  amount: number;
  pending: boolean;
  onAmount: (minor: number) => void;
}

// Where this month's money goes: the amount, the portfolio before and after it and the list of the
// assets (spec, Screen).
export function MonthSection({
  view,
  board,
  actions,
  amount,
  pending,
  onAmount,
}: MonthSectionProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const currency = view.total.currency;
  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale?.(m.currency) ?? 0);
  const portfolio =
    view.total_after === undefined
      ? t("contributionPlan.portfolioToday", { today: money(view.total) })
      : t("contributionPlan.portfolioAfter", {
          today: money(view.total),
          after: money(view.total_after),
        });
  const incomplete = view.status === "incomplete";

  return (
    <Section size="lg" ground="surface" heading="title" aria-busy={pending}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("contributionPlan.month")}</SectionHeading>
        </SectionTitle>

        {actions}
      </SectionHeader>

      <SectionBody>
        <Stack gap={5}>
          <Inline gap={6} align="center" wrap="wrap">
            <Text size="sm" weight="semibold">
              {t("contributionPlan.amount")}
            </Text>

            <MoneyInput
              size="field"
              value={amount}
              onChange={onAmount}
              currency={currency}
              scale={scale?.(currency) ?? 0}
              sign="neutral"
              aria-label={t("contributionPlan.amount")}
            />

            <Text size="sm" tone="muted">
              {portfolio}
            </Text>
          </Inline>

          <MonthPlanHint currency={currency} money={money} onUse={onAmount} />

          {board !== undefined && incomplete && (
            <IncompleteVerdict view={view} />
          )}

          {board !== undefined && !incomplete && amount <= 0 && (
            <Text>{t("contributionPlan.verdictNoAmount")}</Text>
          )}

          {board}
        </Stack>
      </SectionBody>
    </Section>
  );
}
