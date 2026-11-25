import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AgeFactProps {
  age: number;
}

// PX2, PX17: the first stop of the line, the age from the birth date with the place it comes from.
export function AgeFact({ age }: AgeFactProps) {
  const t = useT();

  return (
    <div className={styles.lifeFact}>
      <p className={styles.lifeLabel}>{t("portfolio.projection.plan.today")}</p>

      <p className={styles.lifeAge}>
        {t("portfolio.projection.plan.ageValue", { years: String(age) })}
      </p>

      <p className={styles.planHint}>
        {t("portfolio.projection.plan.ageSource")}
      </p>
    </div>
  );
}
