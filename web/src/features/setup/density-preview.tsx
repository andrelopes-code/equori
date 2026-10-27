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

// The table's frame in the drawing's 160 by 100 units: a header band, then the body the rows share.
const left = 8;
const right = 152;
const headEnd = 22;
const bodyEnd = 92;

// Families read: none draws a miniature of a table. The drawing is an SVG on a fixed grid, so it
// keeps its proportions at every card width. Text bars keep one thickness at every density and the
// rows share the body's height, so a denser choice shows more rows closer together, which is what
// the choice changes.
export function DensityPreview({ density }: { density: Density }) {
  const count = rowCount[density];
  const rowHeight = (bodyEnd - headEnd) / count;
  return (
    <span className={styles.density}>
      <svg viewBox="0 0 160 100" className={styles.drawing}>
        <rect className={styles.ground} width="160" height="100" />
        <rect
          className={styles.card}
          x={left}
          y="8"
          width={right - left}
          height={bodyEnd - 8}
          rx="4"
        />
        <rect
          className={styles.muted}
          x="16"
          y="13.5"
          width="34"
          height="3"
          rx="1.5"
        />
        <rect
          className={styles.muted}
          x="122"
          y="13.5"
          width="22"
          height="3"
          rx="1.5"
        />
        {widths.slice(0, count).map((width, index) => {
          const top = headEnd + rowHeight * index;
          const middle = top + rowHeight / 2;
          return (
            <g key={width}>
              <line
                className={styles.rule}
                x1={left}
                x2={right}
                y1={top}
                y2={top}
              />
              <circle
                className={series[index % series.length]}
                cx="19"
                cy={middle}
                r="2.6"
              />
              <rect
                className={styles.ink}
                x="26"
                y={middle - 1.75}
                width={width}
                height="3.5"
                rx="1.75"
              />
              <rect
                className={styles.muted}
                x="124"
                y={middle - 1.75}
                width="20"
                height="3.5"
                rx="1.75"
              />
            </g>
          );
        })}
      </svg>
    </span>
  );
}
