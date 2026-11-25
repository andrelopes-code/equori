import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import { useT } from "@/i18n/i18n-provider";

// The legend of the plot is off, so its four marks are written here.
export function JourneyKey() {
  const t = useT();

  return (
    <ul className={styles.keyList}>
      <li>
        <span
          className={[styles.seriesMark, styles["mark-portfolio"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.journey.key.value")}
      </li>

      <li>
        <span
          className={[styles.seriesMark, styles["mark-plan"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.journey.key.plan")}
      </li>

      <li>
        <span
          className={[styles.seriesMark, styles["mark-contributed"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.journey.key.contributed")}
      </li>

      <li>
        <span className={styles.keySwatch} aria-hidden="true" />
        {t("portfolio.projection.journey.key.gain")}
      </li>
    </ul>
  );
}
