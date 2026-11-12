import type { components } from "@/api/schema.gen";
import { numberFormatter } from "@/i18n/format";

type Money = components["schemas"]["Money"];

export const noValue = "—";

// A share in basis points as a percentage with one decimal: 557 reads "5,6%" in pt-BR.
export function formatShare(tag: string, bp: number | undefined): string {
  if (bp === undefined) return noValue;

  return numberFormatter(tag, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(bp / 10000);
}

export function isPositive(money: Money | undefined): money is Money {
  return money !== undefined && money.amount > 0;
}
