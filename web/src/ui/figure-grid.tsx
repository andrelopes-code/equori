import type { ReactNode } from "react";

import styles from "@/ui/figure-grid.module.css";

// RP-02, OV-05: the figures of a page are peer tiles in one grid, as many per line as fit.
export function FigureGrid({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={styles.grid}>
      {children}
    </section>
  );
}
