import type { TableRow } from "@/features/portfolio/results/months-block/month-comparison";
import { MonthRow } from "@/features/portfolio/results/months-block/month-row";
import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import { formatMonthShort } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface MonthTableProps {
  // Newest year first.
  rows: TableRow[];
}

// The month of any year stands for the column: the names come from the active locale.
const columns = Array.from(
  { length: 12 },
  (_, month) => `2000-${String(month + 1).padStart(2, "0")}`,
);

// PR8: the heat table of the months; the caption carries the unit of its cells.
export function MonthTable({ rows }: MonthTableProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <div className={styles.monthScroll}>
      <table className={styles.monthTable}>
        <caption className={styles.srOnly}>
          {t("portfolio.results.months.caption")}
        </caption>

        <thead>
          <tr>
            <th scope="col" className={styles.yearCol}>
              {t("portfolio.results.months.year")}
            </th>

            {columns.map((month) => (
              <th key={month} scope="col">
                {formatMonthShort(month, tag)}
              </th>
            ))}

            <th scope="col" className={styles.sumCol}>
              {t("portfolio.results.months.year")}
            </th>

            <th scope="col" className={styles.sumCol}>
              {t("portfolio.results.months.accumulated")}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <MonthRow key={row.year} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
