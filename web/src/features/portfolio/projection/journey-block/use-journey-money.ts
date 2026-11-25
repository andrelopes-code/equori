import { useMoneyFormat } from "@/privacy/use-money-format";

export interface JourneyMoney {
  // To the minor unit.
  exact: (minor: number) => string;
  // In whole units, where a figure has to fit a line.
  whole: (minor: number) => string;
  signed: (minor: number) => string;
}

// The three ways the side of the journey writes an amount of the plan currency (O9).
export function useJourneyMoney(currency: string, scale: number): JourneyMoney {
  const fmt = useMoneyFormat();
  const money = (amount: number) => ({ amount: Math.round(amount), currency });

  return {
    exact: (minor) => fmt.money(money(minor), scale),
    whole: (minor) => fmt.money(money(minor / 10 ** scale), 0),
    signed: (minor) => fmt.signed(money(minor), scale),
  };
}
