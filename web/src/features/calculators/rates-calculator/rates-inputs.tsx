import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/rates-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

interface RatesInputsProps {
  period: "month" | "year";
}

export function RatesInputs({ period }: RatesInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <RateField
      compact
      label={t("calc.rates.rate")}
      hint={t("calc.rates.rate.hint")}
      name="rate"
      value={search.rate ?? ""}
      onChange={(v) => {
        set({ rate: v });
      }}
      period={period}
      onPeriodChange={(p) => {
        set({ period: p === "month" ? "month" : undefined });
      }}
    />
  );
}
