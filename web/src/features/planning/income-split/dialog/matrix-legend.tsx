import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";
import { useT } from "@/i18n/i18n-provider";

// The bucket the legend draws its marks with.
const sample = 2;

// What the three marks of the matrix mean (dialog spec A250).
export function MatrixLegend() {
  const t = useT();
  const number = String(sample);
  const more = `+${number}`;

  return (
    <div className={styles.legend}>
      <span className={styles.key}>
        <span
          className={styles.mark}
          data-color={sample}
          data-checked=""
          aria-hidden="true"
        >
          {number}
        </span>
        <Text size="xs" tone="muted">
          {t("buckets.legend.own")}
        </Text>
      </span>

      <span className={styles.key}>
        <span
          className={styles.mark}
          data-color={sample}
          data-checked=""
          data-inherited=""
          aria-hidden="true"
        >
          {number}
        </span>
        <Text size="xs" tone="muted">
          {t("buckets.legend.follows")}
        </Text>
      </span>

      <span className={styles.key}>
        <span className={styles.more} aria-hidden="true">
          {more}
        </span>
        <Text size="xs" tone="muted">
          {t("buckets.legend.more")}
        </Text>
      </span>
    </div>
  );
}
