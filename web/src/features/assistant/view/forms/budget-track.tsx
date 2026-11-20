import type { BudgetRow } from "@/features/assistant/view/forms/budget-rows";
import styles from "@/features/assistant/view/forms/forms.module.css";

interface BudgetTrackProps {
  row: BudgetRow;
}

const pct = (n: number) => `${String(n)}%`;

// The track of a budget: the spent fill, the excess after the limit, the pace and the limit tick.
export function BudgetTrack({ row }: BudgetTrackProps) {
  return (
    <span className={styles.track}>
      <i className={styles.fill} style={{ inlineSize: pct(row.fill) }} />
      {row.overWidth > 0 && (
        <i
          className={styles.overFill}
          style={{
            insetInlineStart: pct(row.tick),
            inlineSize: pct(row.overWidth),
          }}
        />
      )}
      {row.pace !== undefined && (
        <i
          className={styles.pace}
          style={{ insetInlineStart: pct(row.pace) }}
        />
      )}
      <i className={styles.tick} style={{ insetInlineStart: pct(row.tick) }} />
    </span>
  );
}
