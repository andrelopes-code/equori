import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useEndBudget } from "@/features/planning/api";
import { useScale } from "@/features/setup";
import { formatMonthSlashYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

type Budget = components["schemas"]["Budget"];
type Money = components["schemas"]["Money"];

interface EndBudgetDialogProps {
  budget: Budget;
  // The category the budget is for, as the month view names it.
  name: string;
  // The first month without the budget.
  month: string;
  // What the month would carry from the one before.
  carried: Money;
  onDone: () => void;
  onCancel: () => void;
}

// Ending a budget keeps the months before and removes the amounts from month on; the dialog
// names each removed amount and a carried balance that does not pass the end (budget end E16).
export function EndBudgetDialog({
  budget,
  name,
  month,
  carried,
  onDone,
  onCancel,
}: EndBudgetDialogProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const end = useEndBudget();
  const [error, setError] = useState<string | null>(null);
  if (scale === null) return null;

  const label = formatMonthSlashYear(month, locale);
  const removed = budget.amounts.filter(
    (a) => a.effective_from >= month && !a.ended,
  );
  const dropped = budget.rollover && carried.amount > 0;
  const money = (m: Money) => fmt.money(m, scale(m.currency));

  function handleConfirm() {
    setError(null);
    end
      .mutateAsync({ id: budget.id, month })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("budget.endTitle", { name, month: label })}
      description={t("budget.endHint", { month: label })}
      confirmLabel={t("budget.endConfirm")}
      tone={removed.length > 0 || dropped ? "danger" : "accent"}
      pending={end.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      {removed.map((a) => (
        <Text key={a.effective_from} size="sm">
          {t("budget.endRemoved", {
            amount: money(a.amount),
            month: formatMonthSlashYear(a.effective_from, locale),
          })}
        </Text>
      ))}
      {dropped && (
        <Text size="sm">
          {t("budget.endCarried", { amount: money(carried), month: label })}
        </Text>
      )}
    </ConfirmDialog>
  );
}
