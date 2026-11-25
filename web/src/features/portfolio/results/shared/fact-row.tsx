import type { ReactNode } from "react";

import styles from "@/features/portfolio/results/shared/shared.module.css";

interface FactRowProps {
  label: string;
  // A mark that repeats one of the plot, before the label.
  mark?: ReactNode;
  children: ReactNode;
}

// One line: the label at the start, the value at the end.
export function FactRow({ label, mark, children }: FactRowProps) {
  return (
    <div className={styles.fact}>
      <dt>
        {mark}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
