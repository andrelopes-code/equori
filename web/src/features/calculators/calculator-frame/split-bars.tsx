import {
  axisMax,
  barWidths,
} from "@/features/calculators/calculator-frame/axis";
import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";

interface SplitBarsProps {
  rows: {
    name: string;
    parts: [number, number];
    total: string;
    // The row's accessible name, with its values.
    label: string;
  }[];
  legend: [string, string];
}

export function SplitBars({ rows, legend }: SplitBarsProps) {
  const max = axisMax(
    Math.max(0, ...rows.map((row) => row.parts[0] + row.parts[1])),
  );

  return (
    <div className={styles.split} data-part="split">
      {rows.map((row) => {
        const [principal, interest] = barWidths(row.parts, max);

        return (
          <div
            key={row.name}
            className={styles.splitRow}
            role="img"
            aria-label={row.label}
          >
            <span className={styles.splitName}>{row.name}</span>
            <span className={styles.splitTrack}>
              <span
                className={styles.splitPrincipal}
                style={{ inlineSize: principal }}
              />
              <span
                className={styles.splitInterest}
                style={{ inlineSize: interest }}
              />
            </span>
            <span className={styles.splitTotal}>{row.total}</span>
          </div>
        );
      })}

      <p className={styles.splitLegend}>
        <span className={styles.keyPrincipal} />
        {legend[0]}
        <span className={styles.keyInterest} />
        {legend[1]}
      </p>
    </div>
  );
}
