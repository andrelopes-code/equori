import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-frame/calculator-method";
import { useCalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { fixedIncomeRules } from "@/features/calculators/fixed-income-calculator/fixed-income-region";
import { IndexerComparison } from "@/features/calculators/indexer-comparison/indexer-comparison";
import { useAppLocaleState } from "@/i18n/i18n-provider";

// The comparison as a calculator: it draws its own inputs and results, so it sits in the
// frame's details, below the header and above the method, with the amount empty.
export function IndexerComparisonCalculator() {
  const money = useCalculatorMoney();
  const { locale: profile } = useAppLocaleState();
  const rules = fixedIncomeRules(profile.region);

  return (
    <CalculatorFrame
      id="indexer-comparison"
      inputs={null}
      results={null}
      details={
        money === null ? null : (
          <IndexerComparison amount={0} currency={money.currency} />
        )
      }
      method={
        <CalculatorMethod
          id="indexer-comparison"
          sources={rules?.sources ?? []}
        />
      }
    />
  );
}
