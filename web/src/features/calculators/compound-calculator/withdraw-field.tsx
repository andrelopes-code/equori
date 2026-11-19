import { withdrawUnits } from "@/features/calculators/compound-calculator/use-accumulation";
import { DurationField } from "@/features/calculators/fields/duration-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import {
  addressKeys,
  choices,
} from "@/features/calculators/compound-calculator/address-keys";
import { readUnit, unitPatch } from "@/features/calculators/model/duration";
import { useT } from "@/i18n/i18n-provider";

// The term the income spends the balance over.
export function WithdrawField() {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);
  const unit = readUnit(search.withdrawUnit, choices.withdrawUnit);

  return (
    <DurationField
      compact
      label={t("calc.compound.withdraw")}
      name="withdraw"
      value={search.withdraw ?? ""}
      onChange={(v) => {
        set({ withdraw: v });
      }}
      unit={unit}
      units={withdrawUnits}
      onUnitChange={(u) => {
        set(unitPatch("withdraw", search.withdraw, unit, u, withdrawUnits));
      }}
    />
  );
}
