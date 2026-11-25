import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface JourneyMoney {
  // To the minor unit.
  exact: (minor: number) => string;
  // In whole units, where a figure has to fit a line.
  whole: (minor: number) => string;
  // In thousands or millions ("R$ 2,29 mi"), where the order of the figure is what is read.
  compact: (minor: number) => string;
  signed: (minor: number) => string;
}

// The ways the projection writes an amount of the plan currency (O9).
export function useJourneyMoney(currency: string, scale: number): JourneyMoney {
  const fmt = useMoneyFormat();
  const [tag] = useAppLocale();

  const money = (amount: number) => ({ amount: Math.round(amount), currency });
  const short = numberFormatter(tag, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  });
  const whole = (minor: number) => fmt.money(money(minor / 10 ** scale), 0);

  return {
    exact: (minor) => fmt.money(money(minor), scale),
    whole,
    // While privacy is on the masked form of the hook stands in: no amount leaves it.
    compact: (minor) =>
      fmt.hidden ? whole(minor) : short.format(minor / 10 ** scale),
    signed: (minor) => fmt.signed(money(minor), scale),
  };
}
