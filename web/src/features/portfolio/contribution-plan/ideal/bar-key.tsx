import styles from "@/features/portfolio/contribution-plan/ideal/bar-key.module.css";
import { useT } from "@/i18n/i18n-provider";

interface BarKeyProps {
  // The hatched sample appears only when a bar can draw it.
  withAfter: boolean;
}

// The marks of the bars with their words. Each sample is hidden from assistive technology: the
// bars say the same in words.
export function BarKey({ withAfter }: BarKeyProps) {
  const t = useT();

  return (
    <div className={styles.key}>
      <span className={styles.entry}>
        <i aria-hidden="true" className={styles.today} />
        {t("contributionPlan.keyToday")}
      </span>

      {withAfter && (
        <span className={styles.entry}>
          <i aria-hidden="true" className={styles.after} />
          {t("contributionPlan.keyAfter")}
        </span>
      )}

      <span className={styles.entry}>
        <i aria-hidden="true" className={styles.marker} />
        {t("contributionPlan.keyIdeal")}
      </span>
    </div>
  );
}
