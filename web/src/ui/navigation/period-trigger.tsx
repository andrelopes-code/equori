import { Button } from "@slotted/react/button";
import type { ComponentProps } from "react";

import styles from "@/ui/navigation/period-trigger.module.css";

interface PeriodTriggerProps extends ComponentProps<typeof Button> {
  // The period holds today.
  current: boolean;
  // Every text the label can show after a step.
  widest: readonly string[];
}

// The trigger of a period: it keeps the width of the widest text a step reaches, and a mark names
// the period that holds today (PC3 of docs/specs/2026-11-17-period-controls-design.md). The mark
// is decoration: the trigger's accessible name carries the words.
export function PeriodTrigger({ current, ...props }: PeriodTriggerProps) {
  return (
    <Button
      {...props}
      className={styles.trigger}
      start={
        current ? (
          <span
            className={styles.mark}
            data-period-mark=""
            aria-hidden="true"
          />
        ) : null
      }
    />
  );
}
