import type { components } from "@/api/schema.gen";
import type { StatementLine } from "@/features/cards/statement-groups";

type Money = components["schemas"]["Money"];

export function lineAmount(line: StatementLine): {
  money: Money;
  tone: "neutral" | "positive";
} {
  const amount = line.amount.amount === 0 ? 0 : -line.amount.amount;
  return {
    money: { ...line.amount, amount },
    tone: line.card_role === "charge" ? "neutral" : "positive",
  };
}
