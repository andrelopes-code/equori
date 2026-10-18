import { Link } from "@tanstack/react-router";
import { Kbd } from "@slotted/react/kbd";

import styles from "@/app/shell/ledger-index.module.css";
import {
  newTransactionHref,
  useOpenAccountID,
} from "@/app/shell/use-open-account-id";
import { useT } from "@/i18n/i18n-provider";

// Families read: button, text-field, search-field. A button would read as an action among
// others; the prototype draws entry as a field that shows what to type (shell second pass S1).
export function EntryTrigger() {
  const t = useT();
  const href = newTransactionHref(useOpenAccountID());
  return (
    <Link to={href} className={styles.trigger}>
      <span className={styles.hint}>{t("nav.entry.hint")}</span>
      <Kbd size="xs">{t("nav.entry.key")}</Kbd>
    </Link>
  );
}
