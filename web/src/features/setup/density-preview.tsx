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

const series = [
  styles.seriesOne,
  styles.seriesTwo,
  styles.seriesThree,
  styles.seriesFour,
] as const;

// The rows share the drawing's height between these two edges, in its 160 by 100 units.
const top = 10;
const bottom = 90;

// Families read: none draws a miniature of a table. The drawing is an SVG on a fixed grid, so it
// keeps its proportions at every card width. Each row is a dot and one faint bar of one thickness
// at every density, so a denser choice shows more rows closer together, which is what the choice
// changes.
export function DensityPreview({ density }: { density: Density }) {
  const count = rowCount[density];
  const rowHeight = (bottom - top) / count;

  return (
    <span className={styles.density}>
      <svg viewBox="0 0 160 100" className={styles.drawing}>
        <rect className={styles.ground} width="160" height="100" />
        {widths.slice(0, count).map((width, index) => {
          const middle = top + rowHeight * (index + 0.5);

          return (
            <g key={width}>
              {index > 0 && (
                <line
                  className={styles.rule}
                  x1="12"
                  x2="148"
                  y1={top + rowHeight * index}
                  y2={top + rowHeight * index}
                />
              )}
              <circle
                className={series[index % series.length]}
                cx="18"
                cy={middle}
                r="2.6"
              />
              <rect
                className={styles.pill}
                x="26"
                y={middle - 1.5}
                width={width}
                height="3"
                rx="1.5"
              />
            </g>
          );
        })}
      </svg>
    </span>
  );
}
