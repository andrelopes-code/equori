import caseStyles from "@/features/portfolio/projection/cases-block/cases-block.module.css";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import type { IncomeStep } from "@/features/portfolio/projection/model/income-steps";
import { useT } from "@/i18n/i18n-provider";

interface StepsTableProps {
  steps: readonly IncomeStep[];
  currency: string;
  scale: number;
}

// PX21: the total income of each range of ages, in rate mode.
export function StepsTable({ steps, currency, scale }: StepsTableProps) {
  const t = useT();
  const money = useJourneyMoney(currency, scale);

  return (
    <table className={caseStyles.caseTable}>
      <thead>
        <tr>
          <th scope="col" className={caseStyles.caseCol}>
            {t("portfolio.projection.incomes.col.ages")}
          </th>
          <th scope="col">{t("portfolio.projection.incomes.col.total")}</th>
        </tr>
      </thead>

      <tbody>
        {steps.map((step) => (
          <tr key={step.from}>
            <th scope="row" className={caseStyles.caseCol}>
              {t("portfolio.projection.incomes.row.range", {
                from: step.from,
                to: step.to,
              })}
            </th>

            <td>
              {t("portfolio.projection.journey.facts.perMonth", {
                amount: money.exact(step.total),
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
