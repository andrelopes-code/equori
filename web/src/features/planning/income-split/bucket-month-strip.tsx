import type { TrackCell } from "@/features/planning/income-split/bucket-history";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketMonthStripProps {
  cells: readonly TrackCell[];
  current: string;
  // The month's name for each cell, in the cells' order.
  names: readonly string[];
}

// Six squares, one per month: kept, missed or without income, the month on screen outlined.
// Each square names its month and state for a screen reader.
export function BucketMonthStrip({
  cells,
  current,
  names,
}: BucketMonthStripProps) {
  const t = useT();

  return (
    <div className={styles.strip} role="list">
      {cells.map((c, i) => {
        const state = c.state;
        const month = names[i] ?? c.month;
        return (
          <span
            key={c.month}
            role="listitem"
            className={styles.cell}
            data-state={state}
            aria-label={t(`track.cell.${state}`, { month })}
            title={t(`track.cell.${state}`, { month })}
            {...(c.month === current ? { "data-current": "" } : {})}
          />
        );
      })}
    </div>
  );
}
