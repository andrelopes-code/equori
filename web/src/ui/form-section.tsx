import type { ReactNode } from "react";

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
    <FieldGroup className={styles.section} kind="section">
      <FieldGroupLegend className={styles.sectionLegend}>
        {legend}
      </FieldGroupLegend>
      {description !== undefined && (
        <FieldGroupDescription>{description}</FieldGroupDescription>
      )}
      <FieldGroupContent>{children}</FieldGroupContent>
    </FieldGroup>
  );
}
