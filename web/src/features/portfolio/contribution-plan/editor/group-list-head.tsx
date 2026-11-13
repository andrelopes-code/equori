import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { useT } from "@/i18n/i18n-provider";

// The names of the columns above the first row. Each row labels its own controls, so the
// header is hidden from assistive technology.
export function GroupListHead() {
  const t = useT();

  return (
    <div aria-hidden="true" className={styles.head}>
      <Text size="xs" tone="muted" className={styles.headName}>
        {t("contributionPlan.colGroup")}
      </Text>

      <Text size="xs" tone="muted" className={styles.headTarget}>
        {t("contributionPlan.colTarget")}
      </Text>

      <Text size="xs" tone="muted" className={styles.headToday}>
        {t("contributionPlan.barToday")}
      </Text>

      <Text size="xs" tone="muted" className={styles.headAmount}>
        {t("contributionPlan.colGets")}
      </Text>
    </div>
  );
}
