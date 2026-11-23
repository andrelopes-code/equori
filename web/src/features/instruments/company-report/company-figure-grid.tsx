import type { ReactNode } from "react";

import styles from "@/features/instruments/company-report/company-figure-grid.module.css";

interface CompanyFigureGridProps {
  label: string;
  children: ReactNode;
}

// Four peer figures of a company: one line of four, two of two or four of one by the width of the
// block, so no figure stands alone on a line.
export function CompanyFigureGrid({ label, children }: CompanyFigureGridProps) {
  return (
    <section aria-label={label} className={styles.box}>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}
