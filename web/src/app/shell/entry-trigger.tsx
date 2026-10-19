import { Kbd } from "@slotted/react/kbd";

import styles from "@/app/shell/ledger-index.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: button, text-field, search-field. A button would read as one action among
// others; the index draws entry as a field that names the action and shows what to type
// (shell second pass S1).
export function EntryTrigger({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  return (
    <button type="button" className={styles.trigger} onClick={onOpen}>
      <span className={styles.triggerHead}>
        <span className={styles.triggerLabel}>{t("nav.entry")}</span>
        <Kbd size="xs">{t("nav.entry.key")}</Kbd>
      </span>
      <span className={styles.triggerExample}>{t("nav.entry.example")}</span>
    </button>
  );
}
