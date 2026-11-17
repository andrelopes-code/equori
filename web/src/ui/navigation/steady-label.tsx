import type { ReactNode } from "react";

import styles from "@/ui/navigation/steady-label.module.css";

interface SteadyLabelProps {
  // Every text the label can show after a step.
  widest: readonly string[];
  children: ReactNode;
}

// Workaround for Slotted issue #138: a Button takes the width of its label, so a stepper moves
// its arrows at each step; this label reserves the width of the widest text it can show.
export function SteadyLabel({ widest, children }: SteadyLabelProps) {
  return (
    <span className={styles.label} data-widest={widest.join("\n")}>
      {children}
    </span>
  );
}
