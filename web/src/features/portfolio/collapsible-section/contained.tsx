import type { ReactNode } from "react";

import styles from "@/features/portfolio/collapsible-section/collapsible-section.module.css";

interface ContainedProps {
  children: ReactNode;
}

// A part of the header that handles its own presses: a click inside it does not reach the header,
// so choosing a year or opening a help mark does not minimize the section.
export function Contained({ children }: ContainedProps) {
  return (
    <div
      className={styles.contained}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
