import { Skeleton } from "@slotted/react/skeleton";

import styles from "@/features/portfolio/attribution/attribution.module.css";

// The year while it loads, in the shape of its content: the two sentences, then the rows.
export function AttributionPending() {
  return (
    <div className={styles.layout}>
      <Skeleton className={styles.pendingLead} />
      <Skeleton shape="block" className={styles.pendingRows} />
    </div>
  );
}
