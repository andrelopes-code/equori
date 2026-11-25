import styles from "@/features/portfolio/projection/versus-block/versus-block.module.css";
import { useT } from "@/i18n/i18n-provider";

// The legend of the plot is off, so its four marks are written here.
export function VersusKey() {
  const t = useT();

  return (
    <ul className={styles.keyList}>
      <li>
        <span
          className={[styles.seriesMark, styles["mark-portfolio"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.versus.key.value")}
      </li>

      <li>
        <span
          className={[styles.seriesMark, styles["mark-plan"]].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.versus.key.plan")}
      </li>

      <li>
        <span
          className={[styles.keySwatch, styles.aheadArea].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.versus.key.ahead")}
      </li>

      <li>
        <span
          className={[styles.keySwatch, styles.behindArea].join(" ")}
          aria-hidden="true"
        />
        {t("portfolio.projection.versus.key.behind")}
      </li>
    </ul>
  );
}
