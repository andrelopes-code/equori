import type { ReactNode } from "react";

import styles from "@/ui/navigation/period-label.module.css";
import { SteadyLabel } from "@/ui/navigation/steady-label";

interface PeriodLabelProps {
  // The period holds today.
  current: boolean;
  // Every text the label can show after a step.
  widest: readonly string[];
  children: ReactNode;
}

// build-own-element: the label of a period inside its trigger, with the mark of the period that
// holds today (PC3 of docs/specs/2026-11-17-period-controls-design.md). The mark is decoration:
// the trigger's accessible name carries the words.
export function PeriodLabel({ current, widest, children }: PeriodLabelProps) {
  return (
    <span className={styles["period-label"]}>
      <SteadyLabel widest={widest} className={styles.reserve}>
        <span className={styles.text}>
          <span
            className={styles.mark}
            data-on={current ? "" : undefined}
            aria-hidden="true"
          />
          {children}
        </span>
      </SteadyLabel>
    </span>
  );
}
