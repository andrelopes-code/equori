import { DurationField } from "@/features/calculators/fields/duration-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import {
  readUnit,
  termUnits,
  unitPatch,
} from "@/features/calculators/model/duration";
import { useT } from "@/i18n/i18n-provider";

// The months the deposits start later.
export function DelayField() {
  const t = useT();
  const [search, set] = useCalculatorSearch();
  const unit = readUnit(search.delayUnit, termUnits);

  return (
    <DurationField
      compact
      label={t("calc.compound.delay")}
      name="delay"
      value={search.delay ?? ""}
      onChange={(v) => {
        set({ delay: v });
      }}
      unit={unit}
      units={termUnits}
      onUnitChange={(u) => {
        set(unitPatch("delay", search.delay, unit, u));
      }}
    />
  );
}
