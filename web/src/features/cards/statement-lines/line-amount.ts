import type { components } from "@/api/schema.gen";
import type { StatementLine } from "@/features/cards/model/statement-groups";
import type { AmountDirection } from "@/ui/money/amount-tone";

type Money = components["schemas"]["Money"];

export function lineAmount(line: StatementLine): {
  money: Money;
  direction: AmountDirection;
} {
  const amount = line.amount.amount === 0 ? 0 : -line.amount.amount;
  return {
    money: { ...line.amount, amount },
    direction: line.card_role === "charge" ? "out" : "in",
  };
}
