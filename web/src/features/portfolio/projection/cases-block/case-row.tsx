import type { CaseRowData } from "@/features/portfolio/projection/cases-block/case-rows";
import styles from "@/features/portfolio/projection/cases-block/cases-block.module.css";
import { LastsText } from "@/features/portfolio/projection/cases-block/lasts-text";
import { ShareText } from "@/features/portfolio/projection/cases-block/share-text";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

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

      {row.sustains !== null && (
        <td>
          <ShareText covered={row.covered} />
        </td>
      )}

      <td>
        {t("portfolio.projection.journey.facts.perMonth", {
          amount: money.exact(row.sustained),
        })}
      </td>

      {row.sustains !== null && (
        <td>
          <LastsText figures={row} lastAge={lastAge} />
        </td>
      )}
    </tr>
  );
}
