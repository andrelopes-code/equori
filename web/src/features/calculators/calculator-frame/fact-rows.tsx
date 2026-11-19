import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";

interface FactRowsProps {
  rows: { term: string; note?: string; value: string }[];
}

export function FactRows({ rows }: FactRowsProps) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => (
        <div key={row.term} className={styles.row}>
          <dt>
            {row.term}
            {row.note !== undefined && (
              <span className={styles.rowNote}>{row.note}</span>
            )}
          </dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
