import { Field, FieldDescription, FieldError } from "@slotted/react/field";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { UnitInput } from "@/features/portfolio/projection/plan-section/unit-input";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface PlanRowProps {
  label: string;
  help: string;
  optional?: boolean;
  unit: string;
  value: string;
  onChange: (text: string) => void;
  note: string;
  // Replaces the note while the value is outside its range.
  error?: string | undefined;
}

// PX17: one premise per row: the label, its definition and a note at the start, the field at the end.
export function PlanRow({
  label,
  help,
  optional = false,
  unit,
  value,
  onChange,
  note,
  error,
}: PlanRowProps) {
  return (
    <Field
      necessity={optional ? "optional" : "none"}
      invalid={error !== undefined}
      className={styles.planRow}
    >
      <FieldTitle label={label} help={help} className={styles.planRowLabel} />

      <div className={styles.planRowControl}>
        <UnitInput
          unit={unit}
          inputMode="decimal"
          value={value}
          onChange={onChange}
        />
      </div>

      {error !== undefined && (
        <FieldError className={styles.planError}>{error}</FieldError>
      )}
      {error === undefined && (
        <FieldDescription className={styles.planHint}>{note}</FieldDescription>
      )}
    </Field>
  );
}
