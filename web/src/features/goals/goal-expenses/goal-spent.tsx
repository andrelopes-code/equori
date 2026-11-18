import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { Goal } from "@/features/goals/goal-card/goal-line";
import { GoalExpensesDrawer } from "@/features/goals/goal-expenses/goal-expenses-drawer";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface GoalSpentProps {
  goal: Goal;
  scale: (code: string) => number;
}

// What the goal spent, and the withdrawal whose expenses are still to be named (planning
// coherence A256). Draws nothing for a goal that spent nothing and has no such withdrawal.
export function GoalSpent({ goal, scale }: GoalSpentProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const [open, setOpen] = useState(false);

  const withdrawal = goal.unexplained_withdrawal;
  if (goal.spent.amount === 0 && withdrawal === undefined) return null;

  const money = (m: Goal["spent"]) => fmt.money(m, scale(m.currency));
  const handleOpen = () => {
    setOpen(true);
  };

  return (
    <Stack gap={1}>
      {goal.spent.amount > 0 && (
        <Inline justify="between" align="center" gap={3} wrap="nowrap">
          <Text size="sm" numeric="tabular">
            {t("goals.spent", { amount: money(goal.spent) })}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={handleOpen}
          >
            {t("goals.expenses.see")}
          </Button>
        </Inline>
      )}

      {withdrawal !== undefined && (
        <Inline justify="between" align="center" gap={3} wrap="nowrap">
          <Text size="sm" tone="muted" numeric="tabular">
            {t("goals.withdrawal", {
              amount: money(withdrawal.amount),
              date: formatDate(withdrawal.since, locale),
            })}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={handleOpen}
          >
            {t("goals.withdrawal.choose")}
          </Button>
        </Inline>
      )}

      {open && (
        <GoalExpensesDrawer
          goal={goal}
          scale={scale}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </Stack>
  );
}
