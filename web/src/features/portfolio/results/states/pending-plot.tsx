import styles from "@/features/portfolio/results/states/pending.module.css";

interface PendingPlotProps {
  // The size of the Chart it stands in for.
  size: "md" | "lg";
}

const gridRows = [12, 98, 184, 270, 356];

const line =
  "M44.0 328.5L64.1 316.9L84.2 312.8L104.2 318.2L124.3 327.7L144.4 332.1L164.4 325.9L184.5 311.3" +
  "L204.6 296.6L224.7 289.8L244.8 292.9L264.8 299.9L284.9 301.9L305.0 293.4L325.1 276.7L345.1 260.1" +
  "L365.2 251.7L385.3 253.0L405.4 258.3L425.4 258.4L445.5 248.0L465.6 229.6L485.6 211.5L505.7 201.7" +
  "L525.8 201.7L545.9 205.4L566.0 203.9L586.0 191.9L606.1 172.0L626.2 152.6L646.2 141.6L666.3 140.4" +
  "L686.4 142.8L706.5 139.8L726.5 126.3L746.6 105.1L766.7 84.5L786.8 72.5L806.9 70.1L826.9 71.3L847.0 66.9";

// PR11: the grid and one slow line where the plot comes; the box is the plot height of the Chart.
export function PendingPlot({ size }: PendingPlotProps) {
  return (
    <svg
      className={[styles.plot, styles[size]].join(" ")}
      viewBox="0 0 863 380"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {gridRows.map((y) => (
        <line
          key={y}
          className={styles.gridLine}
          x1={44}
          x2={847}
          y1={y}
          y2={y}
        />
      ))}

      <path className={styles.pendingLine} d={line} />
    </svg>
  );
}
