import type { TransactionData } from "@/features/assistant/view/forms/view-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TransactionTrailProps {
  history: TransactionData["history"];
}

// The versions a transaction went through, newest first, each with its reason and moment.
export function TransactionTrail({ history }: TransactionTrailProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (history.length === 0) return null;

  const moment = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <ol className={styles.trail}>
      {[...history].reverse().map((h) => (
        <li key={h.version}>
          <span className={styles.trailDot} />
          <span className={styles.rowName}>
            {t("assistantView.transaction.changed", {
              version: String(h.version + 1),
            })}
          </span>
          <time className={styles.trailAt} dateTime={h.at}>
            {moment.format(new Date(h.at))}
          </time>
        </li>
      ))}
    </ol>
  );
}
