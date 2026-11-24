import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/agenda/month-grid.module.css";
import { useT } from "@/i18n/i18n-provider";

// What the marks of a day mean; the name of a day says it in words.
export function MonthGridLegend() {
  const t = useT();

  return (
    <div className={styles.legend} aria-hidden="true">
      <span className={styles.key}>
        <i className={styles.mark} data-direction="in" />
        <Text size="xs" tone="muted">
          {t("agenda.legendIn")}
        </Text>
      </span>

      <span className={styles.key}>
        <i className={styles.mark} data-direction="out" />
        <Text size="xs" tone="muted">
          {t("agenda.legendOut")}
        </Text>
      </span>

      <span className={styles.key}>
        <i className={styles.mark} data-direction="out" data-pending="" />
        <Text size="xs" tone="muted">
          {t("agenda.legendPending")}
        </Text>
      </span>
    </div>
  );
}
