import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import styles from "@/features/assistant/panel/pending-dock.module.css";
import { useOpenSheets } from "@/features/assistant/panel/use-open-sheets";
import { useT } from "@/i18n/i18n-provider";

interface PendingDockProps {
  // The element that holds the feed's sheets.
  scrollRoot: HTMLElement | null;
}

// Families read: button, typography. Stands above the composer while a sheet awaits a decision
// and none of its footers is in view (spec 2026-11-15, section 6).
export function PendingDock({ scrollRoot }: PendingDockProps) {
  const t = useT();
  const { count, hidden } = useOpenSheets(scrollRoot);

  if (count === 0 || !hidden) return null;

  function handleReview() {
    scrollRoot?.querySelector("[data-open-sheet]")?.scrollIntoView({
      block: "center",
    });
  }

  return (
    <div className={styles.dock}>
      <span className={styles.pulse} aria-hidden="true" />

      <Text size="sm" className={styles.label}>
        {count === 1
          ? t("assistant.dock.one")
          : t("assistant.dock.many", { count })}
      </Text>

      <Button size="sm" onClick={handleReview}>
        {t("assistant.dock.review")}
      </Button>
    </div>
  );
}
