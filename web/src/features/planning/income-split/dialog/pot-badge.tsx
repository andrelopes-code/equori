import { potColor } from "@/features/planning/income-split/dialog/split-bar";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";

interface PotBadgeProps {
  // The position of the bucket in the split; undefined for the categories without a bucket.
  number?: number;
}

// The number of a bucket on its colour (dialog spec A249). Built here: no family draws a
// numbered key that a bar segment, a table row and a matrix column share.
export function PotBadge({ number }: PotBadgeProps) {
  if (number === undefined)
    return <span className={styles.badge} data-none="" />;

  return (
    <span className={styles.badge} data-color={potColor(number)}>
      {String(number)}
    </span>
  );
}
