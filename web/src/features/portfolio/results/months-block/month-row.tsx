import { heatLevel } from "@/features/portfolio/results/model/month-returns";
import type { TableRow } from "@/features/portfolio/results/months-block/month-comparison";
import {
  emptyCell,
  monthCellText,
} from "@/features/portfolio/results/months-block/month-cell-text";
import { MonthSumCell } from "@/features/portfolio/results/months-block/month-sum-cell";
import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";

interface MonthRowProps {
  row: TableRow;
}

// PR8: one calendar year: twelve cells shaded by the size of the return, the year and the total.
export function MonthRow({ row }: MonthRowProps) {
  const [tag] = useAppLocale();

  return (
    <tr>
      <th scope="row" className={styles.yearCol}>
        {row.year}
      </th>

      {row.cells.map((cell, month) => (
        <td key={month} className={heatClass(cell)}>
          {cell === null ? emptyCell : monthCellText(cell, tag)}
        </td>
      ))}

      <MonthSumCell value={row.total} strong />

      <MonthSumCell value={row.accumulated} />
    </tr>
  );
}

function heatClass(value: number | null): string | undefined {
  const heat = heatLevel(value);

  return heat === null
    ? undefined
    : styles[`${heat.tone}${String(heat.level)}`];
}
