import type { TableRow } from "@/features/portfolio/results/months-block/month-comparison";
import { MonthHeadColumns } from "@/features/portfolio/results/months-block/month-head-columns";
import { MonthRow } from "@/features/portfolio/results/months-block/month-row";
import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/month-heat/month-heat.module.css";

interface MonthTableProps {
  // Newest year first.
  rows: TableRow[];
}

// PR8: the heat table of the months; the caption carries the unit of its cells.
export function MonthTable({ rows }: MonthTableProps) {
  const t = useT();

  return (
    <div className={styles.monthScroll}>
      <table className={styles.monthTable}>
        <caption className={styles.srOnly}>
          {t("portfolio.results.months.caption")}
        </caption>

        <MonthHeadColumns />

        <tbody>
          {rows.map((row) => (
            <MonthRow key={row.year} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
