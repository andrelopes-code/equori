import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { useT } from "@/i18n/i18n-provider";

interface AgeFactProps {
  age: number;
}

// PX2: the age from the birth date, with the place it comes from.
export function AgeFact({ age }: AgeFactProps) {
  const t = useT();

  return (
    <Field necessity="none" className={styles.planFact}>
      <FieldLabel>{t("portfolio.projection.plan.age")}</FieldLabel>

      <span className={styles.planFactValue}>
        {t("portfolio.projection.plan.ageValue", { years: String(age) })}
      </span>

      <FieldDescription>
        {t("portfolio.projection.plan.ageSource")}
      </FieldDescription>
    </Field>
  );
}
