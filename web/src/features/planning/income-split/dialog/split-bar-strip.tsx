import type { CSSProperties } from "react";

import { potColor } from "@/features/planning/income-split/dialog/split-bar";
import type { SplitBar } from "@/features/planning/income-split/dialog/split-bar";
import styles from "@/features/planning/income-split/dialog/split-dialog.module.css";

interface SplitBarStripProps {
  bar: SplitBar;
  // The buckets and their shares in words.
  label: string;
  // The smaller bar of a preset.
  mini?: boolean;
}

// The split as one bar (dialog spec A249): a segment per bucket, the missing share hatched.
// Built here: the Chart family draws no bar without axes inside a form.
export function SplitBarStrip({
  bar,
  label,
  mini = false,
}: SplitBarStripProps) {
  return (
    <div
      className={styles.bar}
      data-mini={mini ? "" : undefined}
      role="img"
      aria-label={label}
    >
      {bar.segments.map((s) => (
        <span
          key={s.key}
          className={styles.segment}
          data-color={potColor(s.number)}
          style={{ "--share": s.bp } as CSSProperties}
        />
      ))}
      {bar.rest > 0 && (
        <span
          className={styles.rest}
          style={{ "--share": bar.rest } as CSSProperties}
        />
      )}
    </div>
  );
}
