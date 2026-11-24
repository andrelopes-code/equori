import type { ReactNode } from "react";

import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";

interface WindowTileProps {
  label: string;
  value: ReactNode;
  note: ReactNode;
}

// One figure of the row: the label, the value and a note of one line.
export function WindowTile({ label, value, note }: WindowTileProps) {
  return (
    <div className={styles.tile}>
      <dt>{label}</dt>

      <dd className={styles.tileValue}>{value}</dd>

      <dd className={styles.tileNote}>{note}</dd>
    </div>
  );
}
