import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";

interface SettingRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

// A setting of a criterion: its name, its control and one line under it.
export function SettingRow({ label, hint, children }: SettingRowProps) {
  return (
    <div className={styles.set}>
      <Text size="sm" tone="muted">
        {label}
      </Text>

      {children}

      {hint !== undefined && (
        <Text size="xs" tone="muted" className={styles.setHint}>
          {hint}
        </Text>
      )}
    </div>
  );
}
