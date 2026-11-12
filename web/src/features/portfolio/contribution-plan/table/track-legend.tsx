import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/table/track-legend.module.css";
import { useT } from "@/i18n/i18n-provider";

// Names the three marks of a drift track: the current bar, the contribution segment, the target.
export function TrackLegend() {
  const t = useT();

  return (
    <div className={styles.legend}>
      <span className={styles.item}>
        <span aria-hidden className={styles.current} />
        <Text size="xs" tone="muted">
          {t("contributionPlan.legendCurrent")}
        </Text>
      </span>

      <span className={styles.item}>
        <span aria-hidden className={styles.contribution} />
        <Text size="xs" tone="muted">
          {t("contributionPlan.legendContribution")}
        </Text>
      </span>

      <span className={styles.item}>
        <span aria-hidden className={styles.target} />
        <Text size="xs" tone="muted">
          {t("contributionPlan.legendTarget")}
        </Text>
      </span>
    </div>
  );
}
