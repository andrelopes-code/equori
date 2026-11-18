import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { budgetPlanQuery } from "@/features/planning";
import { useToday } from "@/i18n/today";
import { useT } from "@/i18n/i18n-provider";

interface MonthPlanHintProps {
  // The currency of the contribution amount.
  currency: string;
  money: (m: { amount: number; currency: string }) => string;
  onUse: (minor: number) => void;
}

// What the month plan already sends to the brokerage, with the action that takes it as the
// contribution amount (CN20). Draws nothing while the plan sends nothing there, or in another
// currency.
export function MonthPlanHint({ currency, money, onUse }: MonthPlanHintProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const plan = useQuery(budgetPlanQuery(api, today.slice(0, 7)));

  const savings = plan.data?.savings_brokerage;
  const goals = plan.data?.goal_deposits_brokerage;
  if (savings === undefined || goals === undefined) return null;

  const total = savings.amount + goals.amount;
  if (total <= 0 || savings.currency !== currency) return null;

  return (
    <Inline gap={3} align="center">
      <Text size="sm" tone="muted">
        {t("contributionPlan.planHint", {
          savings: money(savings),
          goals: money(goals),
        })}
      </Text>
      <Button
        size="sm"
        variant="outline"
        tone="secondary"
        onClick={() => {
          onUse(total);
        }}
      >
        {t("contributionPlan.usePlan", {
          amount: money({ amount: total, currency }),
        })}
      </Button>
    </Inline>
  );
}
