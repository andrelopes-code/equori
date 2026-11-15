import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/income-split/bucket-track.module.css";
import { useT } from "@/i18n/i18n-provider";

// What the gauge's mark and the strip's squares mean.
export function BucketTrackLegend() {
  const t = useT();

  return (
    <div className={styles.legend}>
      <span className={styles.key}>
        <span className={styles.swatch} data-state="kept" />
        <Text size="xs" tone="muted">
          {t("track.legend.kept")}
        </Text>
      </span>
      <span className={styles.key}>
        <span className={styles.swatch} data-state="missed" />
        <Text size="xs" tone="muted">
          {t("track.legend.missed")}
        </Text>
      </span>
      <span className={styles.key}>
        <span className={styles.swatch} data-state="none" />
        <Text size="xs" tone="muted">
          {t("track.legend.none")}
        </Text>
      </span>
      <span className={styles.key}>
        <span className={styles.legendTick} />
        <Text size="xs" tone="muted">
          {t("track.legend.target")}
        </Text>
      </span>
    </div>
  );
}
