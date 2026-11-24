import { useT } from "@/i18n/i18n-provider";
import { MonthHead } from "@/ui/month-heat/month-head";
import styles from "@/ui/month-heat/month-heat.module.css";

// PR8: the header of the month table: the year, the twelve months, the year sum and the total.
export function MonthHeadColumns() {
  const t = useT();

  return (
    <MonthHead year={t("portfolio.results.months.year")}>
      <th scope="col" className={styles.sumCol}>
        {t("portfolio.results.months.year")}
      </th>

      <th scope="col" className={styles.sumCol}>
        {t("portfolio.results.months.accumulated")}
      </th>
    </MonthHead>
  );
}
