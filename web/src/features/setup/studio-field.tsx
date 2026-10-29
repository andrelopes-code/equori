import { Text } from "@slotted/react/typography";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/features/setup/appearance-studio.module.css";

export interface StudioFieldProps {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}

// Families read: field, segmented-control. A control of the studio under its name and one line
// of hint, at the panel's width.
export function StudioField({
  label,
  description,
  children,
}: StudioFieldProps) {
  const id = useId();

  return (
    <div role="group" aria-labelledby={id} className={styles.field}>
      <div className={styles.fieldText}>
        <Text size="sm" weight="medium" id={id}>
          {label}
        </Text>
        {description !== undefined && (
          <Text size="xs" tone="muted">
            {description}
          </Text>
        )}
      </div>
      {children}
    </div>
  );
}
