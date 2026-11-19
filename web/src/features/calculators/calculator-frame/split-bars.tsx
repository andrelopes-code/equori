import { Fragment } from "react";
import type { CSSProperties } from "react";

import {
  axisMax,
  barWidths,
} from "@/features/calculators/calculator-frame/axis";
import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";

interface SplitBarsProps {
  rows: {
    name: string;
    parts: number[];
    total: string;
    // The row's accessible name, with its values.
    label: string;
  }[];
  // One entry per part; omitted for rows of a single part.
  legend?: string[];
}

// Steps of the accent ramp for the parts after the first two.
const ramp = [
  "var(--slotted-tone-accent-border)",
  "var(--slotted-tone-accent-solid-hover)",
  "var(--slotted-tone-accent-solid-active)",
  "var(--slotted-tone-accent-text)",
];

export function SplitBars({ rows, legend }: SplitBarsProps) {
  const max = axisMax(Math.max(0, ...rows.map((row) => sum(row.parts))));

  return (
    <div className={styles.split} data-part="split">
      {rows.map((row) => {
        const widths = barWidths(row.parts, max);

        return (
          <div
            key={row.name}
            className={styles.splitRow}
            role="img"
            aria-label={row.label}
          >
            <span className={styles.splitName}>{row.name}</span>
            <span className={styles.splitTrack}>
              {widths.map((width, index) => (
                <span
                  key={index}
                  className={partClass(index, "part")}
                  style={{ inlineSize: width, ...partColor(index) }}
                />
              ))}
            </span>
            <span className={styles.splitTotal}>{row.total}</span>
          </div>
        );
      })}

      {legend !== undefined && (
        <p className={styles.splitLegend} data-part="legend">
          {legend.map((entry, index) => (
            <Fragment key={entry}>
              <span
                className={partClass(index, "key")}
                data-part="key"
                style={partColor(index)}
              />
              {entry}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

function sum(parts: number[]): number {
  return parts.reduce((total, part) => total + part, 0);
}

// Parts 0 and 1 take the principal and interest looks; later parts take a step of the ramp.
function partClass(index: number, kind: "part" | "key"): string | undefined {
  if (index >= 2) return kind === "part" ? styles.splitPart : styles.keyPart;
  if (kind === "part")
    return index % 2 === 0 ? styles.splitPrincipal : styles.splitInterest;

  return index % 2 === 0 ? styles.keyPrincipal : styles.keyInterest;
}

function partColor(index: number): CSSProperties {
  if (index < 2) return {};

  return { "--part": ramp[(index - 2) % ramp.length] } as CSSProperties;
}
