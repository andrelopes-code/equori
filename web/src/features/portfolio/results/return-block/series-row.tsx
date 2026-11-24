import styles from "@/features/portfolio/results/return-block/return-block.module.css";

interface SeriesRowProps {
  name: string;
  value: string;
  // The slot of the data scale of the series; its mark repeats the stroke of the line.
  slot: number;
  on: boolean;
  // Absent for the portfolio, whose line is always drawn.
  onToggle?: (() => void) | undefined;
}

const markNames = [
  "portfolio",
  "cdi",
  "ibov",
  "ipca",
  "sp500",
  "ftse",
] as const;

export function SeriesRow({ name, value, slot, on, onToggle }: SeriesRowProps) {
  const mark =
    styles[`mark-${markNames[Math.min(slot, markNames.length) - 1] ?? "ftse"}`];
  const content = (
    <>
      <span
        className={`${styles.seriesMark ?? ""} ${mark ?? ""}`}
        aria-hidden="true"
      />
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
