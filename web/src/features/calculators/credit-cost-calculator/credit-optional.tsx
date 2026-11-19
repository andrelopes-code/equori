import { OptionalGroups } from "@/features/calculators/calculator-frame/optional-groups";
import { addressKeys } from "@/features/calculators/credit-cost-calculator/address-keys";
import { AmountField } from "@/features/calculators/fields/amount-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useT } from "@/i18n/i18n-provider";

interface CreditOptionalProps {
  money: CalculatorMoney;
}

export function CreditOptional({ money }: CreditOptionalProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <OptionalGroups
      addressKeys={addressKeys}
      groups={[
        {
          keys: ["fees"],
          add: t("calc.credit.fees.add"),
          legend: t("calc.credit.fees.legend"),
          remove: t("calc.credit.fees.remove"),
          children: (
            <AmountField
              label={t("calc.credit.fees")}
              hint={t("calc.credit.fees.hint")}
              help={t("calc.credit.fees.help")}
              width="medium"
              value={search.fees}
              money={money}
              onChange={(v) => {
                set({ fees: v });
              }}
            />
          ),
        },
      ]}
    />
  );
}
