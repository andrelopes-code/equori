import { useMemo } from "react";

import { formatMoney, formatMoneyParts, formatSigned } from "@/i18n/format";
import type { MoneyParts } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { maskParts, maskText } from "@/privacy/mask";
import { usePrivacy } from "@/privacy/privacy-provider";

interface Money {
  amount: number;
  currency: string;
}

export interface MoneyFormat {
  hidden: boolean;
  money: (m: Money, scale: number, options?: { symbol?: boolean }) => string;
  signed: (m: Money, scale: number, options?: { symbol?: boolean }) => string;
  parts: (m: Money, scale: number) => MoneyParts;
}

// O9: the one way the application writes an amount. While privacy is on, the amount never leaves
// this hook, so no text, attribute or accessible name of any screen can carry it.
export function useMoneyFormat(): MoneyFormat {
  const [locale] = useAppLocale();
  const { hidden } = usePrivacy();
  return useMemo(() => {
    const masked = (m: Money, scale: number) =>
      maskText(formatMoneyParts(m, scale, locale));
    if (hidden) {
      return {
        hidden,
        money: masked,
        signed: masked,
        parts: (m, scale) => maskParts(formatMoneyParts(m, scale, locale)),
      };
    }
    return {
      hidden,
      money: (m, scale, options) => formatMoney(m, scale, locale, options),
      signed: (m, scale, options) => formatSigned(m, scale, locale, options),
      parts: (m, scale) => formatMoneyParts(m, scale, locale),
    };
  }, [locale, hidden]);
}
