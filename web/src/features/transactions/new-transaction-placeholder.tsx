import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import styles from "@/features/transactions/new-transaction-page.module.css";

// Same boxes as the form: the mode control, then the label and control of each of the seven fields.
export function NewTransactionPlaceholder() {
  return (
    <SkeletonRegion>
      <div className={styles.form}>
        <Skeleton shape="block" />
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n}>
            <Skeleton shape="text" inlineSize="25%" />
            <Skeleton shape="block" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
