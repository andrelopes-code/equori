export type CalculatorId =
  | "compound"
  | "rates"
  | "correction"
  | "fixed-income"
  | "financing"
  | "cash-or-installments"
  | "credit-cost"
  | "debt-payoff"
  | "reserve"
  | "recurring-cost"
  | "independence"
  | "own-or-rent";

export type CalculatorGroup = "invest" | "credit" | "plan";

export const calculatorGroups: readonly CalculatorGroup[] = [
  "invest",
  "credit",
  "plan",
];

// In the order of the calculators design, section 5.
export const calculators: readonly {
  id: CalculatorId;
  group: CalculatorGroup;
}[] = [
  { id: "compound", group: "invest" },
  { id: "rates", group: "invest" },
  { id: "correction", group: "invest" },
  { id: "fixed-income", group: "invest" },
  { id: "financing", group: "credit" },
  { id: "cash-or-installments", group: "credit" },
  { id: "credit-cost", group: "credit" },
  { id: "debt-payoff", group: "credit" },
  { id: "reserve", group: "plan" },
  { id: "recurring-cost", group: "plan" },
  { id: "independence", group: "plan" },
  { id: "own-or-rent", group: "plan" },
];

export function isCalculatorId(id: string): id is CalculatorId {
  return calculators.some((c) => c.id === id);
}
