import { catalogKey } from "@/features/assistant/model/catalog-key";
import type { RecurringData } from "@/features/assistant/view/forms/planning/planning-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// The charges that repeat, the largest yearly cost first: name over its cadence and last amount,
// the yearly cost at the end, each bar against the largest cost.
export function RecurringBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const { items } = data as RecurringData;

  const largest = Math.max(0, ...items.map((i) => Math.abs(i.yearly.amount)));
  const cadence = (f: string) => {
    const key = catalogKey(`assistantView.cadence.${f}`);
    return key === undefined ? f : t(key);
  };
  const cost = (m: RecurringData["items"][number]["last"]) =>
    format.money({ ...m, amount: Math.abs(m.amount) });

  return (
    <ul className={styles.bars}>
      {items.map((it) => (
        <li key={it.key} className={styles.item}>
          <div className={styles.tallRow}>
            <span className={styles.stacked}>
              <span className={styles.rowName}>{it.name}</span>
              <span className={styles.rowMeta}>
                {t("assistantView.recurring.meta", {
                  cadence: cadence(it.frequency),
                  amount: cost(it.last),
                })}
              </span>
            </span>
            <span className={styles.rowValue}>
              {cost(it.yearly)}
              <small>{t("assistantView.recurring.per_year")}</small>
            </span>
            <span className={styles.track}>
              <i
                className={styles.fill}
                style={{
                  inlineSize: `${String(largest > 0 ? (Math.abs(it.yearly.amount) / largest) * 100 : 0)}%`,
                }}
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
