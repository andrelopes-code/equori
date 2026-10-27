import { Text } from "@slotted/react/typography";
import { useId } from "react";
import type { ReactNode } from "react";

import styles from "@/features/setup/settings-page.module.css";

// Families read: field, switch, list-item. A switch draws the row of a setting itself; a select or
// a picture choice has no row that names the setting on one side and holds the control on the
// other, so the row is the page's own. stacked puts a wide control under its words.
export function SettingsRow({
  label,
  description,
  stacked = false,
  children,
}: {
  label: string;
  description?: ReactNode;
  stacked?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={styles.row}
      data-stacked={stacked || undefined}
    >
      <div className={styles.rowText}>
        <Text size="md" weight="medium" id={id}>
          {label}
        </Text>
        {description !== undefined && (
          <Text size="sm" tone="muted">
            {description}
          </Text>
        )}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}
