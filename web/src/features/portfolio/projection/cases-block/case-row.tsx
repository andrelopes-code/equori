import type { CaseRowData } from "@/features/portfolio/projection/cases-block/case-rows";
import styles from "@/features/portfolio/projection/cases-block/cases-block.module.css";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { wholeShare } from "@/features/portfolio/projection/model/whole-share";
import { formatBasisPoints, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface CaseRowProps {
  row: CaseRowData;
  lastAge: number;
  currency: string;
  scale: number;
}

// PX16: the figures of one case; the plan is the subject of the table.
export function CaseRow({ row, lastAge, currency, scale }: CaseRowProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const percent = numberFormatter(tag, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const lasts =
    row.endAge === null
      ? t("portfolio.projection.cases.lasts", { age: lastAge })
      : t("portfolio.projection.cases.ends", { age: row.endAge });

  return (
    <tr className={row.kind === "plan" ? styles.planRow : undefined}>
      <th scope="row" className={styles.caseCol}>
        {t(`portfolio.projection.case.${row.kind}`)}
      </th>

      <td>
        {t("portfolio.projection.versus.return.value", {
          rate: formatBasisPoints(row.returnBp, tag),
        })}
      </td>

      <td>{money.exact(row.atWithdrawal)}</td>

      {row.covered !== null && (
        <td>{percent.format(wholeShare(row.covered))}</td>
      )}

      <td>
        {t("portfolio.projection.journey.facts.perMonth", {
          amount: money.exact(row.sustained),
        })}
      </td>

      {row.sustains !== null && (
        <td>
          <Toned value={row.sustains ? 1 : -1}>{lasts}</Toned>
        </td>
      )}
    </tr>
  );
}
