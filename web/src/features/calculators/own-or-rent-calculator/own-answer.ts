import { ownershipCost } from "@/features/calculators/model/plan-math";
import type { OwnershipComponent } from "@/features/calculators/model/plan-math";

export type OwnRateKey =
  | "riskFree"
  | "propertyTax"
  | "maintenance"
  | "appreciation"
  | "riskPremium"
  | "deductibleTax"
  | "mortgage";

export type OwnInputKey = "price" | "rent" | OwnRateKey;

export const componentOrder: readonly OwnershipComponent[] = [
  "forgone",
  "propertyTax",
  "deduction",
  "maintenance",
  "appreciation",
  "riskPremium",
];

export type OwnAnswer =
  | { kind: "missing"; missing: OwnInputKey[] }
  | {
      kind: "solved";
      lead: "own" | "rent" | "equal";
      // Minor units: the annual cost of owning and the annual rent.
      own: number;
      rent: number;
      // Minor units: |own - rent|, by integer subtraction.
      difference: number;
      components: Record<OwnershipComponent, number>;
      // The widths of the owning bar, in componentOrder: a negative component (appreciation, the
      // deduction) lowers the cost and draws no width.
      parts: number[];
    };

const inputOrder: readonly OwnInputKey[] = [
  "price",
  "rent",
  "riskFree",
  "propertyTax",
  "maintenance",
  "appreciation",
  "riskPremium",
  "deductibleTax",
  "mortgage",
];

// Design §5, own-or-rent: the annual cost of owning in six components against the annual rent.
export function ownAnswer(input: {
  price: number | null;
  rent: number | null;
  rates: Record<OwnRateKey, number | null>;
}): OwnAnswer {
  const { price, rent, rates } = input;
  const values: Record<OwnInputKey, number | null> = { price, rent, ...rates };
  const missing = inputOrder.filter((key) => values[key] === null);
  if (price === null || rent === null || missing.length > 0)
    return { kind: "missing", missing };

  const got = ownershipCost({
    price,
    ...(rates as Record<OwnRateKey, number>),
  });
  const difference = got.total - rent;

  return {
    kind: "solved",
    lead: leadOf(difference),
    own: got.total,
    rent,
    difference: Math.abs(difference),
    components: got.components,
    parts: componentOrder.map((c) => Math.max(0, got.components[c])),
  };
}

function leadOf(difference: number): "own" | "rent" | "equal" {
  if (difference === 0) return "equal";

  return difference > 0 ? "rent" : "own";
}
