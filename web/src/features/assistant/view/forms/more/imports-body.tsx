import type { ImportsData } from "@/features/assistant/view/forms/more/more-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The import batches: where each went, when, what it created and what waits for review.
export function ImportsBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { batches } = data as ImportsData;

  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <ul className={styles.events}>
      {batches.map((b) => (
        <li key={b.batch_id} className={styles.importRow}>
          <span className={styles.eventText}>
            <span className={styles.eventName}>{b.account}</span>
            <span className={styles.eventMeta}>
              {when.format(new Date(b.started_at))}
            </span>
          </span>
          <span className={styles.count}>
            <b>{b.created}</b>
            {t("assistantView.imports.created")}
          </span>
          <span
            className={b.needs_review > 0 ? styles.countWarn : styles.count}
          >
            <b>{b.needs_review}</b>
            {t("assistantView.imports.review")}
          </span>
        </li>
      ))}
    </ul>
  );
}
