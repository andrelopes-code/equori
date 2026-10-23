import styles from "@/features/setup/appearance-previews.module.css";
import type { Density } from "@/theme/density";

// How many rows of a table one box holds at each density.
const rowCount: Record<Density, number> = {
  comfortable: 4,
  compact: 6,
  dense: 8,
};

// A fixed run of text widths, so the same row reads the same at every density.
const widths = [62, 48, 70, 55, 66, 44, 58, 52] as const;

// Families read: none draws a miniature of a table. The rows share the box's height, so a denser
// choice shows more of them and a looser one fewer, which is what the choice changes.
export function DensityPreview({ density }: { density: Density }) {
  const count = rowCount[density];
  return (
    <span className={styles.density}>
      <span className={styles.head}>
        <span className={styles.headText} />
        <span className={styles.headAmount} />
      </span>
      {widths.slice(0, count).map((width, index) => (
        <span key={width} className={styles.row}>
          <span className={styles.mark} data-series={(index % 4) + 1} />
          <span
            className={styles.text}
            style={{ inlineSize: `${String(width)}%` }}
          />
          <span className={styles.amount} />
        </span>
      ))}
    </span>
  );
}
