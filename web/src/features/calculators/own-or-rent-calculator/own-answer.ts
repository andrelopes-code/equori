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
      // The owning bar, in componentOrder, adding to the net cost: the positive components keep
      // their shares of it; a negative component (appreciation, the deduction) draws no width.
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
    parts: netParts(
      componentOrder.map((c) => got.components[c]),
      got.total,
    ),
  };
}

function leadOf(difference: number): "own" | "rent" | "equal" {
  if (difference === 0) return "equal";

  return difference > 0 ? "rent" : "own";
}

// Each positive component takes its share of the net cost, rounded down; the last positive part
// takes the remainder, so the parts add to the net. A net of zero or less draws nothing.
function netParts(components: number[], net: number): number[] {
  const positive = components.map((c) => Math.max(0, c));
  const sum = positive.reduce((total, c) => total + c, 0);
  if (net <= 0 || sum === 0) return positive.map(() => 0);

  const parts = positive.map((c) =>
    Number((BigInt(c) * BigInt(net)) / BigInt(sum)),
  );
  const last = positive.map((c) => c > 0).lastIndexOf(true);
  parts[last] =
    (parts[last] ?? 0) + net - parts.reduce((total, p) => total + p, 0);

  return parts;
}
