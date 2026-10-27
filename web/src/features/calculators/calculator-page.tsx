import { useParams } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import type { CalculatorId } from "@/features/calculators/calculators";
import { CashOrInstallmentsCalculator } from "@/features/calculators/cash-or-installments-calculator";
import { CompoundCalculator } from "@/features/calculators/compound-calculator";
import { CorrectionCalculator } from "@/features/calculators/correction-calculator";
import { CreditCostCalculator } from "@/features/calculators/credit-cost-calculator";
import { DebtPayoffCalculator } from "@/features/calculators/debt-payoff-calculator";
import { FinancingCalculator } from "@/features/calculators/financing-calculator";
import { FixedIncomeCalculator } from "@/features/calculators/fixed-income-calculator";
import { RatesCalculator } from "@/features/calculators/rates-calculator";

const screens: Partial<Record<CalculatorId, ComponentType>> = {
  compound: CompoundCalculator,
  rates: RatesCalculator,
  correction: CorrectionCalculator,
  "fixed-income": FixedIncomeCalculator,
  financing: FinancingCalculator,
  "cash-or-installments": CashOrInstallmentsCalculator,
  "credit-cost": CreditCostCalculator,
  "debt-payoff": DebtPayoffCalculator,
};

// The route validates the id; a calculator not yet written shows its frame alone.
export function CalculatorPage() {
  const { id } = useParams({ from: "/_authed/calculators/$id" });
  const calculatorId = id as CalculatorId;
  const Screen = screens[calculatorId];
  return Screen === undefined ? (
    <CalculatorFrame
      id={calculatorId}
      inputs={null}
      results={null}
      method={null}
    />
  ) : (
    <Screen />
  );
}
