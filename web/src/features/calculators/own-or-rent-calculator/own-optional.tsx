import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/own-or-rent-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

// The deduction exists only where mortgage interest is deductible: its two rates default to 0 and
// stand apart from the rates every home has.
export function OwnOptional() {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <OptionalGroups
      addressKeys={addressKeys}
      groups={[
        {
          keys: ["deductibleTax", "mortgage"],
          add: t("calc.own.deductible.add"),
          legend: t("calc.own.deductible.legend"),
          remove: t("calc.own.deductible.remove"),
          children: (
            <>
              <RateField
                label={t("calc.own.deductibleTax")}
                hint={t("calc.own.deductibleTax.hint")}
                compact
                name="deductibleTax"
                value={search.deductibleTax ?? ""}
                onChange={(v) => {
                  set({ deductibleTax: v });
                }}
              />

              <RateField
                label={t("calc.own.mortgage")}
                hint={t("calc.own.mortgage.hint")}
                compact
                name="mortgage"
                value={search.mortgage ?? ""}
                onChange={(v) => {
                  set({ mortgage: v });
                }}
              />
            </>
          ),
        },
      ]}
    />
  );
}
