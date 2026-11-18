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

import type { components } from "@/api/schema.gen";
import { IncompleteVerdict } from "@/features/portfolio/contribution-plan/month/incomplete-verdict";
import { MonthPlanHint } from "@/features/portfolio/contribution-plan/month/month-plan-hint";
import { PurchaseList } from "@/features/portfolio/contribution-plan/month/purchase-list";
import { monthVerdict } from "@/features/portfolio/contribution-plan/model/month-verdict";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { MoneyInput } from "@/ui/money/money-input";

type Plan = components["schemas"]["ContributionPlan"];

interface MonthSectionProps {
  view: Plan;
  amount: number;
  pending: boolean;
  // Edit mode: the card draws only its amount row.
  editing: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onAmount: (minor: number) => void;
  // Enters edit mode with the assets of a group open.
  onSplit: (group: number) => void;
}

// Where this month's money goes: the amount, the portfolio before and after it, the verdict
// sentence and the purchase list (spec, Screen, This month).
export function MonthSection({
  view,
  amount,
  pending,
  editing,
  memberName,
  onAmount,
  onSplit,
}: MonthSectionProps) {
  const t = useT();
  const [tag] = useAppLocale();
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
  const verdict = monthVerdict(view, {
    t,
    money,
    list: (items) =>
      new Intl.ListFormat(tag, { type: "conjunction" }).format(items),
    memberName,
  });
  const incomplete = view.status === "incomplete";

  return (
    <Section size="lg" ground="surface" aria-busy={pending}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("contributionPlan.month")}</SectionHeading>
        </SectionTitle>
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

          {!editing && incomplete && <IncompleteVerdict view={view} />}

          {!editing && !incomplete && <Text>{verdict}</Text>}

          {!editing && (
            <PurchaseList
              view={view}
              memberName={memberName}
              onSplit={onSplit}
            />
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
