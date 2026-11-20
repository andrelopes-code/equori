import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { compareRows } from "@/features/assistant/view/forms/bars/compare-rows";
import type { CompareData } from "@/features/assistant/view/forms/bars/compare-rows";
import { CompareLegend } from "@/features/assistant/view/forms/bars/compare-legend";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";

// Two periods by category: paired bars on one axis, the later value and its difference at the end.
export function CompareBody({ data }: FormBodyProps) {
  const format = useValueFormat();
  const compare = data as CompareData;
  const rows = compareRows(compare);

  return (
    <>
      <CompareLegend periods={compare.periods} />

      <ul className={styles.bars}>
        {rows.map((row) => (
          <li key={row.key} className={styles.item}>
            <div className={styles.pair}>
              <span className={styles.rowKey}>
                <span className={styles.rowName}>{row.name}</span>
              </span>

              <span className={styles.rowValue}>
                {valueText({ money: row.after }, format)}
                <small>
                  {format.delta({
                    amount: row.delta,
                    currency: row.after.currency,
                  })}
                </small>
              </span>

              <span className={styles.track}>
                <i
                  className={styles.fillRef}
                  style={{ inlineSize: `${String(row.beforeWidth)}%` }}
                />
              </span>

              <span className={styles.track}>
                <i
                  className={styles.fill}
                  style={{ inlineSize: `${String(row.afterWidth)}%` }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
