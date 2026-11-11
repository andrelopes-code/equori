import type { MoneyFormat } from "@/privacy/use-money-format";

// An average cost travels as exact decimal text. Its amount keeps every decimal that carries a
// digit and at least the decimals of its currency, in integer arithmetic (O7).
export function averageCostAmount(
  text: string,
  currencyScale: number,
): { amount: number; scale: number } {
  const [whole = "", fraction = ""] = text.split(".");
  const kept = fraction.replace(/0+$/, "");
  const scale = Math.max(kept.length, currencyScale);

  return { amount: Number(whole + kept.padEnd(scale, "0")), scale };
}

// The average cost of a position as money of its cost's currency, masked with every other amount.
export function averageCostText(
  fmt: MoneyFormat,
  text: string | undefined,
  currency: string,
  currencyScale: number,
): string {
  if (text === undefined) return "";

  const { amount, scale } = averageCostAmount(text, currencyScale);

  return fmt.money({ amount, currency }, scale);
}
