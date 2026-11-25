import type { ReactNode } from "react";

import { Field, FieldDescription, FieldError } from "@slotted/react/field";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { cx } from "@/ui/cx";
import { FieldTitle } from "@/ui/form-fields/field-title";

interface LifeFieldProps {
  label: string;
  help?: string | undefined;
  note?: string | undefined;
  // Replaces the note while the value is outside its range.
  error?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

// PX17: a field on the line of the plan: label, control and note on three fixed lines.
export function LifeField({
  label,
  help,
  note,
  error,
  className,
  children,
}: LifeFieldProps) {
  return (
    <Field
      necessity="none"
      invalid={error !== undefined}
      className={cx(styles.lifeField, className)}
    >
      <FieldTitle label={label} help={help} className={styles.lifeLabel} />

      {children}

      {error !== undefined && (
        <FieldError className={styles.planError}>{error}</FieldError>
      )}
      {error === undefined && note !== undefined && (
        <FieldDescription className={styles.planHint}>{note}</FieldDescription>
      )}
    </Field>
  );
}
