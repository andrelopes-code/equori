import { CaseRow } from "@/features/portfolio/projection/cases-block/case-row";
import type { CaseRowData } from "@/features/portfolio/projection/cases-block/case-rows";
import styles from "@/features/portfolio/projection/cases-block/cases-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface CaseTableProps {
  rows: readonly CaseRowData[];
  withdrawalAge: number;
  started: boolean;
  lastAge: number;
  // Income mode: the share of the amount needed and the age the value lasts to are drawn.
  income: boolean;
  currency: string;
  scale: number;
}

// PX16: one line per case.
export function CaseTable({
  rows,
  withdrawalAge,
  started,
  lastAge,
  income,
  currency,
  scale,
}: CaseTableProps) {
  const t = useT();

  return (
    <table className={styles.caseTable}>
      <thead>
        <tr>
          <th scope="col" className={styles.caseCol}>
            {t("portfolio.projection.cases.col.case")}
          </th>
          <th scope="col">{t("portfolio.projection.cases.col.return")}</th>
          <th scope="col">
            {started
              ? t("portfolio.projection.cases.col.value.today")
              : t("portfolio.projection.cases.col.value", {
                  age: withdrawalAge,
                })}
          </th>
          {income && (
            <th scope="col">{t("portfolio.projection.cases.col.share")}</th>
          )}
          <th scope="col">{t("portfolio.projection.cases.col.income")}</th>
          {income && (
            <th scope="col">{t("portfolio.projection.cases.col.lasts")}</th>
          )}
        </tr>
      </thead>

      <tbody>
        {rows.map((row) => (
          <CaseRow
            key={row.kind}
            row={row}
            lastAge={lastAge}
            currency={currency}
            scale={scale}
          />
        ))}
      </tbody>
    </table>
  );
}
