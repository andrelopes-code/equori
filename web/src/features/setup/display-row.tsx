import type { ReactNode } from "react";

import styles from "@/features/setup/display-row.module.css";

export function DisplayRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
