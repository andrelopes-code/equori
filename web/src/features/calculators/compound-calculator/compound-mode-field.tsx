import { SolveGroup } from "@/features/calculators/calculator-frame/solve-group";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import {
  addressKeys,
  choices,
} from "@/features/calculators/compound-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

type CompoundMode = "final" | "target" | "income";

// What the calculator answers, with a line that says what the chosen answer is.
export function CompoundModeField() {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);
  const mode: CompoundMode =
    choices.mode.find((m) => m === search.mode) ?? "final";

  return (
    <SolveGroup<CompoundMode>
      legend={t("calc.compound.mode")}
      hint={t(`calc.compound.mode.${mode}.hint`)}
      choices={[
        { value: "final", label: t("calc.compound.mode.final") },
        { value: "target", label: t("calc.compound.mode.target") },
        { value: "income", label: t("calc.compound.mode.income") },
      ]}
      value={mode}
      onChange={(next) => {
        set({ mode: next === "final" ? undefined : next });
      }}
    />
  );
}
