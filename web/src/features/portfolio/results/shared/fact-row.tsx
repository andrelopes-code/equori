import type { ReactNode } from "react";

import styles from "@/features/portfolio/results/shared/shared.module.css";

interface FactRowProps {
  label: string;
  children: ReactNode;
}

// One line: the label at the start, the value at the end.
export function FactRow({ label, children }: FactRowProps) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
