import { CalcTable } from "@/features/calculators/calculator-frame/calc-table";
import { CalculatorDetails } from "@/features/calculators/calculator-frame/calculator-details";
import type { CreditFlow } from "@/features/calculators/credit-cost-calculator/credit-answer";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CreditDetailsProps {
  money: CalculatorMoney;
  flows: CreditFlow[];
}

export function CreditDetails({ money, flows }: CreditDetailsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const count = numberFormatter(tag);

  return (
    <CalculatorDetails
      title={t("calc.credit.details")}
      size={t("calc.credit.details.size", {
        count: count.format(flows.length),
      })}
    >
      <CalcTable
        long
        caption={t("calc.credit.flows")}
        headers={[
          t("calc.credit.col.number"),
          t("calc.credit.col.date"),
          t("calc.credit.col.days"),
          t("calc.credit.col.amount"),
        ]}
        rows={flows.map((flow, index) => ({
          key: flow.date,
          cells: [
            count.format(index + 1),
            formatDate(flow.date, tag),
            count.format(flow.days),
            money.format(flow.amount),
          ],
        }))}
      />
    </CalculatorDetails>
  );
}
