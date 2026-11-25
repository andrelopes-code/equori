import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useSetBirthDate } from "@/features/session";
import { DateInput } from "@/ui/form-fields/date-input";

// PX3: the birth date in place of the age; a chosen date is written to the profile at once.
export function BirthField() {
  const t = useT();
  const today = useToday();
  const save = useSetBirthDate();

  function handleChange(iso: string) {
    if (iso !== "") save.mutate(iso);
  }

  return (
    <Field necessity="none" className={styles.planField}>
      <FieldLabel>{t("portfolio.projection.plan.birth")}</FieldLabel>

      <DateInput
        name="birth_date"
        value={save.variables ?? ""}
        onChange={handleChange}
        shortcuts={false}
        min="1900-01-01"
        max={today}
      />

      <FieldDescription>
        {t("portfolio.projection.plan.birthHint")}
      </FieldDescription>
    </Field>
  );
}
