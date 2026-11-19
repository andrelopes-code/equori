import { barWidths } from "@/features/calculators/calculator-frame/axis";
import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";

interface ChoiceRowsProps {
  head: [string, string, string];
  rows: {
    name: string;
    effect: string;
    saved: number;
    savedText: string;
    // The row's accessible name, with its values.
    label: string;
  }[];
  note?: string;
}

export function ChoiceRows({ head, rows, note }: ChoiceRowsProps) {
  const widths = barWidths(
    rows.map((row) => row.saved),
    Math.max(0, ...rows.map((row) => row.saved)),
  );

  return (
    <div className={styles.choices}>
      <div className={styles.choiceHead}>
        <span>{head[0]}</span>
        <span>{head[1]}</span>
        <span>{head[2]}</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={row.name}
          className={styles.choiceRow}
          role="img"
          aria-label={row.label}
        >
          <span className={styles.choiceName}>{row.name}</span>
          <span className={styles.choiceMain}>{row.effect}</span>
          <span className={styles.choiceTrack}>
            <span
              className={styles.choiceBar}
              style={{ inlineSize: widths[index] }}
            />
          </span>
          <span className={styles.choiceSaves}>{row.savedText}</span>
        </div>
      ))}

      {note !== undefined && <p className={styles.choiceNote}>{note}</p>}
    </div>
  );
}
