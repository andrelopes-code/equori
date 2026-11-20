import type { ReactNode } from "react";

import { cx } from "@/ui/cx";
import styles from "@/ui/navigation/steady-label.module.css";

interface SteadyLabelProps {
  // Every text the label can show after a step.
  widest: readonly string[];
  // Adds to the reserved width, through a rule on the box's ::after.
  className?: string | undefined;
  children: ReactNode;
}

// Workaround for Slotted issue #138: a Button takes the width of its label, so a stepper moves
// its arrows at each step; this label reserves the width of the widest text it can show.
export function SteadyLabel({ widest, className, children }: SteadyLabelProps) {
  return (
    <span
      className={cx(styles.label, className)}
      data-widest={widest.join("\n")}
    >
      {children}
    </span>
  );
}
