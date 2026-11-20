import type { GoalsData } from "@/features/assistant/view/forms/planning/planning-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// Each goal: saved against the target, and what each month to its date must put in.
export function GoalsBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const { goals } = data as GoalsData;

  return (
    <ul className={styles.bars}>
      {goals.map((g) => (
        <li key={g.goal_id} className={styles.item}>
          <div className={styles.goalRow}>
            <span className={styles.rowKey}>
              <span className={styles.rowName}>{g.name}</span>
            </span>
            <span className={styles.rowValue}>
              {format.whole(g.current, false)}
              <small>
                {t("assistantView.budget.of", {
                  limit: format.whole(g.target, false),
                })}
              </small>
            </span>
            <span className={styles.track}>
              <i
                className={styles.fill}
                style={{
                  inlineSize: `${String(Math.min(g.progress_bp / 100, 100))}%`,
                }}
              />
            </span>
            <span className={styles.goalPace}>
              {g.months > 0
                ? t("assistantView.goals.pace", {
                    monthly: format.money(g.monthly),
                    due: formatDate(g.due_on, locale),
                  })
                : t("assistantView.goals.due", {
                    due: formatDate(g.due_on, locale),
                  })}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
