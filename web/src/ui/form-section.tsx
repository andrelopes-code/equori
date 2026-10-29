import type { ReactNode } from "react";

import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";

import styles from "@/ui/form-layout.module.css";

interface FormSectionProps {
  legend: ReactNode;
  children: ReactNode;
}

// F5: a topic of a form, named by its legend only.
export function FormSection({ legend, children }: FormSectionProps) {
  return (
    <FieldGroup className={styles.section}>
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      <FieldGroupContent>{children}</FieldGroupContent>
    </FieldGroup>
  );
}
