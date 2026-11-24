import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import { formatMonthShort } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// The month of any year stands for the column: the names come from the active locale.
const columns = Array.from(
  { length: 12 },
  (_, month) => `2000-${String(month + 1).padStart(2, "0")}`,
);

// PR8: the header of the month table: the year, the twelve months, the year sum and the total.
export function MonthHead() {
  const t = useT();
  const [tag] = useAppLocale();

  return (
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
  );
}
