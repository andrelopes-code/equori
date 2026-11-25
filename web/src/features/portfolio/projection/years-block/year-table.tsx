import type { YearRow as YearRowData } from "@/features/portfolio/projection/model/year-rows";
import { YearRow } from "@/features/portfolio/projection/years-block/year-row";
import styles from "@/features/portfolio/projection/years-block/years-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface YearTableProps {
  rows: readonly YearRowData[];
  currency: string;
  scale: number;
}

// PX10: the seven columns of the years; the header stays while the open table scrolls.
export function YearTable({ rows, currency, scale }: YearTableProps) {
  const t = useT();

  return (
    <table className={styles.yearTable}>
      <thead>
        <tr>
          <th scope="col" className={styles.yearCol}>
            {t("portfolio.projection.years.col.year")}
          </th>
          <th scope="col" className={styles.ageCol}>
            {t("portfolio.projection.years.col.age")}
          </th>
          <th scope="col">
            {t("portfolio.projection.years.col.contributions")}
          </th>
          <th scope="col">{t("portfolio.projection.years.col.gains")}</th>
          <th scope="col">{t("portfolio.projection.years.col.withdrawals")}</th>
          <th scope="col">{t("portfolio.projection.years.col.contributed")}</th>
          <th scope="col">{t("portfolio.projection.years.col.value")}</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <YearRow key={row.year} row={row} currency={currency} scale={scale} />
        ))}
      </tbody>
    </table>
  );
}
