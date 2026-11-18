import { useParams } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { CalculatorFrame } from "@/features/calculators/calculator-frame/calculator-frame";
import type { CalculatorId } from "@/features/calculators/model/calculators";
import { CashOrInstallmentsCalculator } from "@/features/calculators/cash-or-installments-calculator/cash-or-installments-calculator";
import { CompoundCalculator } from "@/features/calculators/compound-calculator/compound-calculator";
import { CorrectionCalculator } from "@/features/calculators/correction-calculator/correction-calculator";
import { CreditCostCalculator } from "@/features/calculators/credit-cost-calculator/credit-cost-calculator";
import { DebtPayoffCalculator } from "@/features/calculators/debt-payoff-calculator/debt-payoff-calculator";
import { FinancingCalculator } from "@/features/calculators/financing-calculator/financing-calculator";
import { FixedIncomeCalculator } from "@/features/calculators/fixed-income-calculator/fixed-income-calculator";
import { IndexerComparisonCalculator } from "@/features/calculators/indexer-comparison/indexer-comparison-calculator";
import { OwnOrRentCalculator } from "@/features/calculators/own-or-rent-calculator/own-or-rent-calculator";
import { RatesCalculator } from "@/features/calculators/rates-calculator/rates-calculator";
import { RecurringCostCalculator } from "@/features/calculators/recurring-cost-calculator/recurring-cost-calculator";

const screens: Partial<Record<CalculatorId, ComponentType>> = {
  compound: CompoundCalculator,
  rates: RatesCalculator,
  correction: CorrectionCalculator,
  "fixed-income": FixedIncomeCalculator,
  "indexer-comparison": IndexerComparisonCalculator,
  financing: FinancingCalculator,
  "cash-or-installments": CashOrInstallmentsCalculator,
  "credit-cost": CreditCostCalculator,
  "debt-payoff": DebtPayoffCalculator,
  "recurring-cost": RecurringCostCalculator,
  "own-or-rent": OwnOrRentCalculator,
};

// The route validates the id; a calculator not yet written shows its frame alone.
export function CalculatorPage() {
  const { id } = useParams({ from: "/_authed/calculators/$id" });
  const calculatorId = id as CalculatorId;
  const Screen = screens[calculatorId];
  return Screen === undefined ? (
    <CalculatorFrame
      id={calculatorId}
      unavailable
      inputs={null}
      results={null}
      method={null}
    />
  ) : (
    <Screen />
  );
}
