import type { ReactNode } from "react";

import type { IndexStroke } from "@/features/portfolio/results/return-block/block-figures";
import styles from "@/features/portfolio/results/return-block/return-block.module.css";

interface SeriesRowProps {
  name: string;
  value: ReactNode;
  // The slot of the data scale of the series; its mark repeats the stroke of the line.
  slot: number;
  // The stroke of the line, which the mark repeats.
  stroke?: IndexStroke;
  on: boolean;
  // Absent for the portfolio, whose line is always drawn.
  onToggle?: (() => void) | undefined;
}

const strokeMarks = {
  solid: undefined,
  dashed: styles.markDashed,
  dotted: styles.markDotted,
};

const markNames = [
  "portfolio",
  "cdi",
  "ibov",
  "ipca",
  "sp500",
  "ftse",
] as const;

export function SeriesRow({
  name,
  value,
  slot,
  stroke = "solid",
  on,
  onToggle,
}: SeriesRowProps) {
  const mark =
    styles[`mark-${markNames[Math.min(slot, markNames.length) - 1] ?? "ftse"}`];
  const marks = [styles.seriesMark, mark, strokeMarks[stroke]].filter(
    (name) => name !== undefined,
  );
  const content = (
    <>
      <span className={marks.join(" ")} aria-hidden="true" />
      <span className={styles.seriesName}>{name}</span>
      <span className={styles.seriesValue}>{value}</span>
    </>
  );

  if (onToggle === undefined)
    return (
      <li className={styles.seriesRow} data-on="">
        {content}
      </li>
    );

  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={styles.seriesRow}
        data-on={on ? "" : undefined}
        onClick={onToggle}
      >
        {content}
      </button>
    </li>
  );
}
