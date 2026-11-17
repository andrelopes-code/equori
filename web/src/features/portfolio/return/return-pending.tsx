import { Skeleton } from "@slotted/react/skeleton";

import styles from "@/features/portfolio/return/return-view.module.css";

// RK7: the report while it loads, in the shape of its content: the lead line, then one block
// per column.
export function ReturnPending() {
  return (
    <div className={styles.layout}>
      <Skeleton className={styles.pendingLead} />

      <div className={styles.columns}>
        <Skeleton shape="block" className={styles.pendingBlock} />
        <Skeleton shape="block" className={styles.pendingBlock} />
      </div>
    </div>
  );
}
