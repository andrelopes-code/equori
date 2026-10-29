import type { ReactNode } from "react";

import { FieldDefaultsProvider } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupDescription,
  FieldGroupLegend,
} from "@slotted/react/field-group";

import styles from "@/ui/form-layout.module.css";

interface FormSectionProps {
  legend: ReactNode;
  // What holds for every field of the topic, in one sentence.
  description?: ReactNode;
  children: ReactNode;
}

// F5: a topic of a form, named by its legend only.
export function FormSection({
  legend,
  description,
  children,
}: FormSectionProps) {
  return (
    // Workaround for Slotted issue #40: a section is a topic, not a question, so its legend says no
    // necessity; the provider inside gives its fields back the application's own.
    <FieldGroup className={styles.section} necessity="none">
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      {description !== undefined && (
        <FieldGroupDescription>{description}</FieldGroupDescription>
      )}
      <FieldGroupContent>
        <FieldDefaultsProvider necessity="optional">
          {children}
        </FieldDefaultsProvider>
      </FieldGroupContent>
    </FieldGroup>
  );
}
