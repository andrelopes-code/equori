import { fullMoney, moneyParts, wholeMoney } from "@/features/accounts";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface CardMoney {
  // The amount without its minor digits, masked in privacy mode.
  whole: (amount: number) => string;
  // The amount with its minor digits, masked in privacy mode.
  full: (amount: number) => string;
}

export function useCardMoney(currency: string, scale: number): CardMoney {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const parts = (amount: number) =>
    moneyParts(amount, currency, scale, locale, fmt);
  const masked = t("accountCard.hiddenAmount", { symbol: parts(0).symbol });

  return {
    whole: (amount) => (fmt.hidden ? masked : wholeMoney(parts(amount))),
    full: (amount) => (fmt.hidden ? masked : fullMoney(parts(amount))),
  };
}
