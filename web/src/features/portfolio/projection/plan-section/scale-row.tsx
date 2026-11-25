import type { CSSProperties } from "react";

import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import type { ScaleRow as Row } from "@/features/portfolio/projection/plan-section/reference-scale";

interface ScaleRowProps {
  row: Row;
  name: string;
  value: string;
}

// PX17: one reference: its name and rate over a bar, or the plan's range with its expected return.
export function ScaleRow({ row, name, value }: ScaleRowProps) {
  const span = { "--from": row.from, "--to": row.to } as CSSProperties;

  return (
    <div className={styles.scaleRow}>
      <span className={styles.planFactLabel}>{name}</span>
      <span className={styles.planFactValue}>{value}</span>

      <span className={styles.scaleTrack} aria-hidden="true">
        {row.kind === "plan" && (
          <>
            <span className={styles.scaleRange} style={span} />
            <span
              className={styles.scaleDot}
              style={{ "--at": row.at } as CSSProperties}
            />
          </>
        )}
        {row.kind !== "plan" && (
          <span className={styles.scaleBar} style={span} />
        )}
      </span>
    </div>
  );
}
