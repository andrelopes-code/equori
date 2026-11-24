import type { ReactNode } from "react";

import styles from "@/features/instruments/months/months.module.css";

interface MonthFactProps {
  label: string;
  children: ReactNode;
}

// One line: the label and its value.
export function MonthFact({ label, children }: MonthFactProps) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
