import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { RateField } from "@/features/calculators/fields/rate-field";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/recurring-cost-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

export function RecurringOptional() {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <OptionalGroups
      addressKeys={addressKeys}
      groups={[
        {
          keys: ["rate"],
          add: t("calc.recurring.rate.add"),
          legend: t("calc.recurring.rate.legend"),
          remove: t("calc.recurring.rate.remove"),
          children: (
            <RateField
              label={t("calc.recurring.rate")}
              hint={t("calc.recurring.rate.hint")}
              compact
              name="rate"
              value={search.rate ?? ""}
              onChange={(v) => {
                set({ rate: v });
              }}
            />
          ),
        },
      ]}
    />
  );
}
