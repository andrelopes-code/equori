import type { TableRow } from "@/features/portfolio/results/months-block/month-comparison";
import { MonthSumCell } from "@/features/portfolio/results/months-block/month-sum-cell";
import { useAppLocale } from "@/i18n/i18n-provider";
import { monthCellText } from "@/ui/month-heat/month-cell-text";
import { MonthCells } from "@/ui/month-heat/month-cells";
import styles from "@/ui/month-heat/month-heat.module.css";

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

      <MonthCells cells={row.cells} text={(cell) => monthCellText(cell, tag)} />

      <MonthSumCell value={row.total} strong />

      <MonthSumCell value={row.accumulated} />
    </tr>
  );
}
