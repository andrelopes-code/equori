import { BudgetLegend } from "@/features/assistant/view/forms/budget-legend";
import { BudgetTrack } from "@/features/assistant/view/forms/budget-track";
import { budgetRows } from "@/features/assistant/view/forms/budget-rows";
import type { BudgetData } from "@/features/assistant/view/forms/budget-rows";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// A month of budgets: spent against the limit on one scale, the excess in the danger tone, the
// pace of the day as a hollow mark.
export function BudgetBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const budget = data as BudgetData;
  const rows = budgetRows(budget);

  return (
    <>
      <ul className={styles.bars}>
        {rows.map((row) => (
          <li key={row.key} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.rowKey}>
                <span className={styles.rowName}>{row.name}</span>
              </span>

              <span className={styles.rowValue}>
                {format.money(row.spent)}
                {row.over.amount > 0 && (
                  <small className={styles.over}>
                    {t("assistantView.budget.over", {
                      amount: format.money(row.over),
                    })}
                  </small>
                )}
                {row.over.amount === 0 && (
                  <small>
                    {t("assistantView.budget.of", {
                      limit: format.money(row.limit),
                    })}
                  </small>
                )}
              </span>

              <BudgetTrack row={row} />
            </div>
          </li>
        ))}
      </ul>

      <BudgetLegend day={budget.day} />
    </>
  );
}
