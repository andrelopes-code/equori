import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { settingsQuery, useScale } from "@/features/setup";
import { useMoneyFormat } from "@/privacy/use-money-format";

export interface CalculatorMoney {
  currency: string;
  scale: number;
  // Minor units of the base currency as text; masked in privacy mode (ADR 018).
  format: (minor: number) => string;
}

// Calculators count in the base currency (design §3); null until settings and scales load.
export function useCalculatorMoney(): CalculatorMoney | null {
  const fmt = useMoneyFormat();
  const currency = useQuery(settingsQuery(useApi())).data?.base_currency;
  const scaleOf = useScale();
  if (currency === undefined || scaleOf === null) return null;
  const scale = scaleOf(currency);
  return {
    currency,
    scale,
    format: (minor) => fmt.money({ amount: minor, currency }, scale),
  };
}
