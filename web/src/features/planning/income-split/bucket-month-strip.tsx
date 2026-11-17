import type { TrackCell } from "@/features/planning/income-split/bucket-history";
import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BucketMonthStripProps {
  cells: readonly TrackCell[];
  // The month on screen, whose name the strip writes in the text colour.
  shown: string;
  // The month's name for each cell, in the cells' order.
  names: readonly string[];
}

// Six marks, one per month, each over its month's short name: solid when the bucket kept its
// target, hatched when it missed it, dashed without income. Each names its month and state.
export function BucketMonthStrip({
  cells,
  shown,
  names,
}: BucketMonthStripProps) {
  const t = useT();

  return (
    <div className={styles.strip} role="list">
      {cells.map((c, i) => {
        const month = names[i] ?? c.month;
        const current = c.month === shown;
        const text = t(`track.cell.${c.state}`, { month });
        const label = c.changed ? t("track.cell.changed", { text }) : text;
        return (
          <span
            key={c.month}
            role="listitem"
            className={styles.month}
            aria-label={label}
            title={label}
            {...(c.changed ? { "data-changed": "" } : {})}
          >
            <span
              className={styles.cell}
              data-state={c.state}
              aria-hidden="true"
            />
            <span
              className={styles.monthName}
              aria-hidden="true"
              {...(current ? { "data-current": "" } : {})}
            >
              {month}
            </span>
          </span>
        );
      })}
    </div>
  );
}
