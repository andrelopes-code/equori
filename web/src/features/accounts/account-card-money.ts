import { symbolGap } from "@/i18n/format";
import type { MoneyParts } from "@/i18n/format";
import type { MoneyFormat } from "@/privacy/use-money-format";

export interface CardMoneyParts extends MoneyParts {
  gap: string;
}

export function moneyParts(
  amount: number,
  currency: string,
  scale: number,
  locale: string,
  fmt: MoneyFormat,
): CardMoneyParts {
  const money = { amount, currency };
  return {
    ...fmt.parts(money, scale),
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
