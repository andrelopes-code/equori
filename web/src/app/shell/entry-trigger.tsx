import { Kbd } from "@slotted/react/kbd";

import styles from "@/app/shell/top-bar.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: button, kbd. The button centres its label and its end slot together and has
// no way to set them at opposite ends (Slotted finding "Button cannot spread its label and end
// slot apart"); the entry is drawn as a field trigger, neutral, with the label at the start
// and the key at the end.
export function EntryTrigger({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const key = t("nav.entry.key");
  return (
    <button
      type="button"
      data-own="entry-trigger"
      aria-keyshortcuts={key}
      className={styles.entry}
      onClick={onOpen}
    >
      <span>{t("nav.entry.long")}</span>
      <Kbd size="xs" variant="outline" aria-hidden="true">
        {key}
      </Kbd>
    </button>
  );
}
