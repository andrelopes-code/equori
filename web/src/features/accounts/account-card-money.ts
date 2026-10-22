import { formatMoneyParts } from "@/i18n/format";
import type { MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locale";

// The gap between the symbol and the number: a plain space in pt-BR, none in en.
export function symbolGap(locale: Locale): string {
  return locale === "pt-BR" ? " " : "";
}

export function moneyParts(
  amount: number,
  currency: string,
  scale: number,
  locale: Locale,
): MoneyParts {
  return formatMoneyParts({ amount, currency }, scale, locale);
}

export function fullMoney(p: MoneyParts, locale: Locale): string {
  return `${p.sign}${p.symbol}${symbolGap(locale)}${p.integer}${p.fraction}`;
}

// The amount without its minor digits, for the meter's texts.
export function wholeMoney(p: MoneyParts, locale: Locale): string {
  return `${p.sign}${p.symbol}${symbolGap(locale)}${p.integer}`;
}
