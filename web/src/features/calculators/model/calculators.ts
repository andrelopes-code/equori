export type CalculatorId =
  | "compound"
  | "rates"
  | "correction"
  | "fixed-income"
  | "indexer-comparison"
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
  { id: "indexer-comparison", group: "invest" },
  { id: "financing", group: "credit" },
  { id: "cash-or-installments", group: "credit" },
  { id: "credit-cost", group: "credit" },
  { id: "debt-payoff", group: "credit" },
  { id: "reserve", group: "plan" },
  { id: "recurring-cost", group: "plan" },
  { id: "independence", group: "plan" },
  { id: "own-or-rent", group: "plan" },
];

// The calculators with a screen of their own; the list shows only these. `screens` of the
// calculator page is typed by this tuple, so both hold the same set.
export const writtenIds = [
  "compound",
  "rates",
  "correction",
  "fixed-income",
  "indexer-comparison",
  "financing",
  "cash-or-installments",
  "credit-cost",
  "debt-payoff",
  "recurring-cost",
  "own-or-rent",
] as const satisfies readonly CalculatorId[];

export type WrittenId = (typeof writtenIds)[number];

export const written: ReadonlySet<CalculatorId> = new Set(writtenIds);

export function isWritten(id: CalculatorId): id is WrittenId {
  return written.has(id);
}

export function isCalculatorId(id: string): id is CalculatorId {
  return calculators.some((c) => c.id === id);
}
