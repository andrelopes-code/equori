import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import type { CaseKind } from "@/features/portfolio/projection/journey-block/journey-figures";
import { useT } from "@/i18n/i18n-provider";

interface JourneyKeyProps {
  cases: readonly CaseKind[];
}

// The legend of the plot is off, so its four marks and the typed cases are written here.
export function JourneyKey({ cases }: JourneyKeyProps) {
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

      {cases.map((kind) => (
        <li key={kind}>
          <span
            className={[styles.seriesMark, styles[`mark-${kind}`]].join(" ")}
            aria-hidden="true"
          />
          {t(`portfolio.projection.case.${kind}`)}
        </li>
      ))}
    </ul>
  );
}
