import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import { useT } from "@/i18n/i18n-provider";

// The legend of the plot is off, so its three marks are written here.
export function EvolutionKey() {
  const t = useT();

  return (
    <ul className={styles.keyList}>
      <li>
        <span
          className={[styles.seriesMark, styles["mark-portfolio"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.results.evolution.value")}
      </li>

      <li>
        <span
          className={[styles.seriesMark, styles["mark-contributed"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.results.evolution.contributed")}
      </li>

      <li>
        <span className={styles.keySwatch} aria-hidden="true" />
        {t("portfolio.results.evolution.gain")}
      </li>
    </ul>
  );
}
