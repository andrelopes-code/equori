import { Heading, Text } from "@slotted/react/typography";

import styles from "@/features/accounts/kind-chooser/kind-panel.module.css";
import { KindScene } from "@/features/accounts/kind-chooser/kind-scene";
import { useT } from "@/i18n/i18n-provider";

// KC7: with no kind chosen, the scene of checking in neutral ink and the invitation to choose.
export function KindPanelEmpty() {
  const t = useT();

  return (
    <aside className={styles.panel} data-empty="" aria-live="polite">
      <KindScene kind="checking" tone="neutral" />

      <div className={styles.head}>
        <Heading level={3} size="md" wrap="nowrap">
          {t("kindPanel.emptyTitle")}
        </Heading>
        <Text size="sm" tone="muted" wrap="nowrap">
          {t("kindPanel.emptyBody")}
        </Text>
      </div>
    </aside>
  );
}
