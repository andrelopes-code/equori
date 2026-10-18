import type { ReactNode } from "react";

import styles from "@/ui/figure-strip.module.css";

// Families read: stat-card, description-list, grid. stat-card always draws its frame;
// description-list stops at three columns and draws no rule between them. The strip is
// a description list of its own: one column per figure, thin rules between and under (L12).
export function FigureStrip({
  label,
  ruled = true,
  children,
}: {
  label?: string;
  // The rule under the strip; a page header draws its own.
  ruled?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-own="figure-strip" className={styles.frame}>
      <dl
        {...(label === undefined ? {} : { "aria-label": label })}
        className={styles.strip}
        data-ruled={ruled ? "" : undefined}
      >
        {children}
      </dl>
    </div>
  );
}
