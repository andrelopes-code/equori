import { formatMoneyParts, symbolGap } from "@/i18n/format";
import type { MoneyParts } from "@/i18n/format";

export interface CardMoneyParts extends MoneyParts {
  gap: string;
}

export function moneyParts(
  amount: number,
  currency: string,
  scale: number,
  locale: string,
): CardMoneyParts {
  const money = { amount, currency };
  return {
    ...formatMoneyParts(money, scale, locale),
    gap: symbolGap(money, scale, locale),
  };
}

export function fullMoney(p: CardMoneyParts): string {
  return `${p.sign}${p.symbol}${p.gap}${p.integer}${p.fraction}`;
}

// The amount without its minor digits, for the meter's texts.
export function wholeMoney(p: CardMoneyParts): string {
  return `${p.sign}${p.symbol}${p.gap}${p.integer}`;
}
