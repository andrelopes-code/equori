import styles from "@/features/assistant/view/answer-view.module.css";

interface ViewTableProps {
  head: string[];
  rows: string[][];
}

// The figures of a view as a table: what the chart draws, and the form of a kind the client lacks.
export function ViewTable({ head, rows }: ViewTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={i > 0 ? styles.end : undefined}>
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={i > 0 ? styles.end : undefined}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
