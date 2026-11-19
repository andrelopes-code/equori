import { AccumulationCalculator } from "@/features/calculators/compound-calculator/accumulation-calculator";
import { IncomeCalculator } from "@/features/calculators/compound-calculator/income-calculator";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/compound-calculator/address-keys";

// Design §5, compound: what an investment reaches, the deposit that reaches a target, or how the
// balance evolves while its income is spent in part and reinvested in part.
export function CompoundCalculator() {
  const [search] = useCalculatorSearch(addressKeys);

  return search.mode === "income" ? (
    <IncomeCalculator />
  ) : (
    <AccumulationCalculator />
  );
}
