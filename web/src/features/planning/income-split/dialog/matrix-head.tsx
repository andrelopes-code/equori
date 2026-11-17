import { Text } from "@slotted/react/typography";

import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import { PotBadge } from "@/features/planning/income-split/dialog/pot-badge";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

interface MatrixHeadProps {
  buckets: readonly DraftBucket[];
}

// The columns of the matrix (dialog spec A250): each bucket by its number and name, then the
// column of the categories without a bucket.
export function MatrixHead({ buckets }: MatrixHeadProps) {
  const t = useT();
  const unplaced = t("buckets.unplaced");

  return (
    <div className={styles.mHead}>
      <Text size="xs" tone="muted" className={styles.mCorner}>
        {t("buckets.matrix.category")}
      </Text>
      {buckets.map((b, i) => (
        <span key={b.key} className={styles.mCol} title={b.name}>
          <PotBadge number={i + 1} />
          <Text size="xs" className={styles.mColName}>
            {b.name.trim() === "" ? t("buckets.field.name") : b.name}
          </Text>
        </span>
      ))}
      <span className={styles.mCol} data-none="" title={unplaced}>
        <PotBadge />
        <Text size="xs" tone="muted" className={styles.mColName}>
          {unplaced}
        </Text>
      </span>
    </div>
  );
}
