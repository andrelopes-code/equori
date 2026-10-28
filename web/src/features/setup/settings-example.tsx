import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import styles from "@/features/setup/settings-page.module.css";

// A sample of how the active region writes a number; it is not an amount, so it bypasses the
// money formatters and their privacy mask.
const sampleNumber = 1234.56;

export function SettingsExample() {
  const t = useT();
  const { tag } = useAppLocaleState();
  const today = useToday();
  const number = numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(sampleNumber);
  return (
    <div
      role="group"
      aria-label={t("settings.language.example")}
      className={styles.example}
    >
      <div className={styles.sample}>
        <span className={styles.sampleLabel}>
          {t("settings.language.date")}
        </span>
        <span className={styles.sampleValue}>{formatDate(today, tag)}</span>
      </div>
      <div className={styles.sample}>
        <span className={styles.sampleLabel}>
          {t("settings.language.number")}
        </span>
        <span className={styles.sampleValue}>{number}</span>
      </div>
    </div>
  );
}
