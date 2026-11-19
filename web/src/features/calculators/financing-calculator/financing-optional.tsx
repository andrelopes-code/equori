import { OptionalGroup } from "@/features/calculators/calculator-frame/optional-group";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { CountField } from "@/features/calculators/fields/count-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { addressKeys } from "@/features/calculators/financing-calculator/address-keys";
import { useT } from "@/i18n/i18n-provider";

interface FinancingOptionalProps {
  money: CalculatorMoney;
}

export function FinancingOptional({ money }: FinancingOptionalProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <OptionalGroup
      addressKeys={addressKeys}
      keys={["prepayMonth", "prepayAmount"]}
      add={t("calc.financing.prepay.add")}
      legend={t("calc.financing.prepay.title")}
      remove={t("calc.financing.prepay.remove")}
    >
      <CountField
        label={t("calc.financing.prepayMonth")}
        width="short"
        name="prepayMonth"
        value={search.prepayMonth ?? ""}
        onChange={(v) => {
          set({ prepayMonth: v });
        }}
      />

      <AmountField
        label={t("calc.financing.prepayAmount")}
        help={t("calc.financing.prepayAmount.help")}
        width="medium"
        value={search.prepayAmount}
        money={money}
        onChange={(v) => {
          set({ prepayAmount: v });
        }}
      />
    </OptionalGroup>
  );
}
