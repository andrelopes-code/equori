import type { ReactNode } from "react";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";

interface PlanGroupProps {
  legend: string;
  description: string;
  children: ReactNode;
}

// PX17: a group of premises under its legend and one line that says what they share.
export function PlanGroup({ legend, description, children }: PlanGroupProps) {
  return (
    <fieldset className={styles.planGroup}>
      <legend className={styles.planGroupLegend}>{legend}</legend>
      <p className={styles.planGroupDescription}>{description}</p>
      <div className={styles.planGroupRows}>{children}</div>
    </fieldset>
  );
}
