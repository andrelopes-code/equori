import type { components } from "@/api/schema.gen";
import { usedShare } from "@/features/planning/model/budget-month";
import { useScale } from "@/features/setup";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";

interface BudgetSpentFigureProps {
  // Undefined while the month loads.
  progress: components["schemas"]["BudgetProgress"] | undefined;
}

// What the budget spent in the month and the share it used; the expenses a goal paid are left
// out of the figure and named in its note (planning coherence A257).
export function BudgetSpentFigure({ progress }: BudgetSpentFigureProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const scale = useScale();
  const fmt = useMoneyFormat();

  if (progress === undefined || scale === null)
    return (
      <FigureCard label={t("budget.spent")} value={undefined} note="" loading />
    );

  const share = numberFormatter(locale, { style: "percent" }).format(
    usedShare(progress) / 100,
  );
  const paid = progress.goal_paid;
  const note =
    paid.amount > 0
      ? t("budget.usedNoteGoalPaid", {
          share,
          paid: fmt.money(paid, scale(paid.currency)),
        })
      : t("budget.usedNote", { share });

  return (
    <FigureCard
      label={t("budget.spent")}
      value={{ money: progress.spent, scale: scale(progress.spent.currency) }}
      note={note}
    />
  );
}
