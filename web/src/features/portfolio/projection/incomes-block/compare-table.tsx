import caseStyles from "@/features/portfolio/projection/cases-block/cases-block.module.css";
import { LastsText } from "@/features/portfolio/projection/cases-block/lasts-text";
import { ShareText } from "@/features/portfolio/projection/cases-block/share-text";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import type { PlanCase } from "@/features/portfolio/projection/model/plan-case";
import { useT } from "@/i18n/i18n-provider";

interface CompareTableProps {
  plan: PlanCase;
  without: PlanCase;
  lastAge: number;
  currency: string;
  scale: number;
}

// PX21: the plan with and without its other incomes, in income mode.
export function CompareTable({
  plan,
  without,
  lastAge,
  currency,
  scale,
}: CompareTableProps) {
  const t = useT();
  const money = useJourneyMoney(currency, scale);

  const rows = [
    { key: "with" as const, figures: plan },
    { key: "without" as const, figures: without },
  ];

  return (
    <table className={caseStyles.caseTable}>
      <thead>
        <tr>
          <th scope="col" className={caseStyles.caseCol}>
            {t("portfolio.projection.incomes.col.plan")}
          </th>
          <th scope="col">{t("portfolio.projection.incomes.col.needed")}</th>
          <th scope="col">{t("portfolio.projection.cases.col.share")}</th>
          <th scope="col">{t("portfolio.projection.cases.col.income")}</th>
          <th scope="col">{t("portfolio.projection.cases.col.lasts")}</th>
        </tr>
      </thead>

      <tbody>
        {rows.map(({ key, figures }) => (
          <tr
            key={key}
            className={key === "with" ? caseStyles.planRow : undefined}
          >
            <th scope="row" className={caseStyles.caseCol}>
              {t(`portfolio.projection.incomes.${key}`)}
            </th>

            <td>{money.exact(figures.needed ?? 0)}</td>

            <td>
              <ShareText covered={figures.covered} />
            </td>

            <td>
              {t("portfolio.projection.journey.facts.perMonth", {
                amount: money.exact(figures.sustained),
              })}
            </td>

            <td>
              <LastsText figures={figures} lastAge={lastAge} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
