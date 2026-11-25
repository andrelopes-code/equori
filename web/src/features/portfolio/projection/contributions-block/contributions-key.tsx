import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { useT } from "@/i18n/i18n-provider";

// The legend of the plot is off, so its two marks are written here.
export function ContributionsKey() {
  const t = useT();

  return (
    <ul className={styles.keyList}>
      <li>
        <span
          className={[styles.keySwatch, styles.barMark].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.contributions.key.recorded")}
      </li>

      <li>
        <span className={styles.seriesMark} aria-hidden="true" />
        {t("portfolio.projection.contributions.key.planned")}
      </li>
    </ul>
  );
}
