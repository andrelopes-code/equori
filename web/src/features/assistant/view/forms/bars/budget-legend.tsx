import styles from "@/features/assistant/view/forms/forms.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BudgetLegendProps {
  // The day of the pace mark; 0 draws no pace entry.
  day: number;
}

// The keys of a budget view: spent, over the limit, the limit and the pace of the day.
export function BudgetLegend({ day }: BudgetLegendProps) {
  const t = useT();

  return (
    <ul className={styles.legend}>
      <li>
        <i className={styles.key} />
        {t("assistantView.budget.legend_spent")}
      </li>
      <li>
        <i className={styles.keyOver} />
        {t("assistantView.budget.legend_over")}
      </li>
      <li>
        <i className={styles.keyTick} />
        {t("assistantView.budget.legend_limit")}
      </li>
      {day > 0 && (
        <li>
          <i className={styles.keyPace} />
          {t("assistantView.budget.legend_pace", { day: String(day) })}
        </li>
      )}
    </ul>
  );
}
