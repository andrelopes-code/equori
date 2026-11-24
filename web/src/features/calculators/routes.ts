import { lazyRouteComponent } from "@tanstack/react-router";

export { isCalculatorId } from "@/features/calculators/model/calculators";
export { validateCalculatorSearch } from "@/features/calculators/model/calculator-search";

export const CalculatorsPage = lazyRouteComponent(
  () => import("@/features/calculators/pages/calculators-page"),
  "CalculatorsPage",
);

export const CalculatorPage = lazyRouteComponent(
  () => import("@/features/calculators/pages/calculator-page"),
  "CalculatorPage",
);
