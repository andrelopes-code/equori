import type { components } from "@/api/schema.gen";

type Kind = NonNullable<components["schemas"]["Account"]["kind"]>;

// The outline of an account's mark tells its kind without an icon: a rounded square holds
// money at hand, a card shape a credit card, a circle money set aside.
export type AccountShape = "square" | "card" | "circle";

const shapeOfKind: Record<Kind, AccountShape> = {
  checking: "square",
  cash: "square",
  wallet: "square",
  benefit: "square",
  receivable: "square",
  loan: "square",
  payable: "square",
  credit_card: "card",
  savings: "circle",
  reserve: "circle",
  brokerage: "circle",
};

export function shapeOf(kind: Kind | undefined): AccountShape {
  return kind === undefined ? "square" : shapeOfKind[kind];
}
