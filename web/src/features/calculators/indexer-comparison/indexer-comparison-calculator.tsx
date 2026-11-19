import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { IndexerComparison } from "@/features/calculators/indexer-comparison/indexer-comparison";
import { useAppLocaleState } from "@/i18n/i18n-provider";

// The comparison as a calculator: it holds its inputs in state, so the frame is drawn by
// IndexerComparison once the base currency loads, with the amount empty.
export function IndexerComparisonCalculator() {
  const money = useCalculatorMoney();
  const { locale: profile } = useAppLocaleState();
  const rules = fixedIncomeRules(profile.region);

  if (money === null)
    return (
      <CalculatorFrame
        id="indexer-comparison"
        inputs={null}
        results={null}
        method={
          <CalculatorMethod
            id="indexer-comparison"
            sources={rules?.sources ?? []}
          />
        }
      />
    );

  return <IndexerComparison amount={0} currency={money.currency} />;
}
