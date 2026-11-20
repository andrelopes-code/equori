import { Skeleton } from "@slotted/react/skeleton";

import styles from "@/features/portfolio/attribution/attribution.module.css";

// The year while it loads, in the shape of its content: the summary of the year, then the rows.
export function AttributionPending() {
  return (
    <div className={styles.layout}>
      <Skeleton shape="block" className={styles.pendingSummary} />
      <Skeleton shape="block" className={styles.pendingRows} />
    </div>
  );
}
