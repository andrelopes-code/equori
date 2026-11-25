import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AgeFactProps {
  age: number;
}

// PX2: the age from the birth date, with the place it comes from.
export function AgeFact({ age }: AgeFactProps) {
  const t = useT();

  return (
    <div className={styles.planFact}>
      <span className={styles.planFactLabel}>
        {t("portfolio.projection.plan.age")}
      </span>

      <span className={styles.planFactValue}>
        {t("portfolio.projection.plan.ageValue", { years: String(age) })}
      </span>

      <span className={styles.planFactHint}>
        {t("portfolio.projection.plan.ageSource")}
      </span>
    </div>
  );
}
