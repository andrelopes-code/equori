import type { ReactNode } from "react";

import styles from "@/ui/figure-strip.module.css";

export function FigureStripItem({
  label,
  caption,
  children,
}: {
  label: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.item}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.figure}>{children}</dd>
      {caption !== undefined && <dd className={styles.caption}>{caption}</dd>}
    </div>
  );
}
