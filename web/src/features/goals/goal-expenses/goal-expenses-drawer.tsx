import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { Goal } from "@/features/goals/goal-card/goal-line";
import { PaidExpensesTable } from "@/features/goals/goal-expenses/paid-expenses-table";
import { useGoalExpenses } from "@/features/goals/goal-expenses/use-goal-expenses";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface GoalExpensesDrawerProps {
  goal: Goal;
  scale: (code: string) => number;
  onClose: () => void;
}

// The expenses a goal paid and the ones it can still pay (planning coherence A256): what the
// goal pays counts against neither the budget nor the bucket of its category.
export function GoalExpensesDrawer({
  goal,
  scale,
  onClose,
}: GoalExpensesDrawerProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const expenses = useGoalExpenses(goal);

  const money = (m: Goal["spent"]) => fmt.money(m, scale(m.currency));
  const paid = (expenses.paid ?? []).map((e) => ({
    id: e.transaction_id,
    date: e.date,
    description: e.description,
    money: e.amount,
    direct: e.direct,
  }));

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="end"
      size="xl"
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>
            {t("goals.expenses.title", { name: goal.name })}
          </DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={6}>
            <Text size="sm" tone="muted">
              {t("goals.expenses.hint")}
            </Text>

            {expenses.error !== null && (
              <FormNotice>{expenses.error}</FormNotice>
            )}

            {expenses.loading && <Skeleton shape="block" blockSize="12rem" />}

            {!expenses.loading && paid.length === 0 && (
              <Text size="sm" tone="muted">
                {t("goals.expenses.empty")}
              </Text>
            )}

            {!expenses.loading && paid.length > 0 && (
              <PaidExpensesTable
                caption={t("goals.expenses.paid")}
                rows={paid}
                action={t("goals.expenses.remove")}
                actionName={(name) => t("goals.expenses.unlink", { name })}
                pending={expenses.pending}
                money={money}
                onAction={expenses.unlink}
              />
            )}

            {!expenses.loading && expenses.candidates.length === 0 && (
              <Text size="sm" tone="muted">
                {t("goals.expenses.noCandidates")}
              </Text>
            )}

            {!expenses.loading && expenses.candidates.length > 0 && (
              <PaidExpensesTable
                caption={t("goals.expenses.candidates", {
                  date: formatDate(expenses.since, locale),
                })}
                rows={expenses.candidates}
                action={t("goals.expenses.link")}
                actionName={(name) => t("goals.expenses.linkOne", { name })}
                pending={expenses.pending}
                money={money}
                onAction={expenses.link}
              />
            )}
          </Stack>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
