import { Button } from "@slotted/react/button";

import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import { useT } from "@/i18n/i18n-provider";

interface IncomeRowProps {
  income: OtherIncome;
  currency: string;
  scale: number;
  onEdit: () => void;
}

// PX21: the name of an income, its ages, its monthly amount and the action.
export function IncomeRow({ income, currency, scale, onEdit }: IncomeRowProps) {
  const t = useT();
  const money = useJourneyMoney(currency, scale);

  const ages =
    income.end_age === undefined
      ? t("portfolio.projection.incomes.row.from", { from: income.start_age })
      : t("portfolio.projection.incomes.row.range", {
          from: income.start_age,
          to: income.end_age,
        });

  return (
    <li className={styles.row}>
      <span className={styles.name} title={income.name}>
        {income.name}
      </span>

      <span className={styles.when}>{ages}</span>

      <span className={styles.amount}>
        {t("portfolio.projection.journey.facts.perMonth", {
          amount: money.exact(income.amount),
        })}
      </span>

      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-label={t("portfolio.projection.incomes.edit.named", {
          name: income.name,
        })}
        onClick={onEdit}
      >
        {t("portfolio.projection.contributions.edit")}
      </Button>
    </li>
  );
}
