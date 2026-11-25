import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";

interface UnitFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (text: string) => void;
  inputMode: "numeric" | "decimal";
  hint?: string | undefined;
  error?: string | undefined;
}

// A number typed in the plan section with its unit at the end.
export function UnitField({
  label,
  unit,
  value,
  onChange,
  inputMode,
  hint,
  error,
}: UnitFieldProps) {
  return (
    <Field
      necessity="none"
      className={styles.planField}
      invalid={error !== undefined}
    >
      <FieldLabel>{label}</FieldLabel>

      <TextField
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        end={unit}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />

      {hint !== undefined && error === undefined && (
        <FieldDescription>{hint}</FieldDescription>
      )}
      {error !== undefined && <FieldError>{error}</FieldError>}
    </Field>
  );
}
