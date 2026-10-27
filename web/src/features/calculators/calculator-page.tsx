import { useParams } from "@tanstack/react-router";
import type { ComponentType } from "react";

import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import type { CalculatorId } from "@/features/calculators/calculators";
import { CompoundCalculator } from "@/features/calculators/compound-calculator";

const screens: Partial<Record<CalculatorId, ComponentType>> = {
  compound: CompoundCalculator,
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
