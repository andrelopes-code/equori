import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import { addressKeys } from "@/features/calculators/cash-or-installments-calculator/address-keys";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { ChoiceField } from "@/features/calculators/fields/choice-field";
import { CountField } from "@/features/calculators/fields/count-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { RateSourceFields } from "@/features/calculators/rate-source/rate-source-fields";
import type { useRateSource } from "@/features/calculators/rate-source/use-rate-source";
import { useT } from "@/i18n/i18n-provider";

interface CashInputsProps {
  money: CalculatorMoney;
  compare: ReturnType<typeof useRateSource>;
  firstNow: boolean;
}

export function CashInputs({ money, compare, firstNow }: CashInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      <AmountField
        label={t("calc.cash.price")}
        width="medium"
        value={search.cash}
        money={money}
        onChange={(v) => {
          set({ cash: v });
        }}
      />

      <div className={styles.pair}>
        <CountField
          label={t("calc.cash.count")}
          unit={t("calc.unit.installments")}
          name="count"
          width="short"
          value={search.count ?? ""}
          onChange={(v) => {
            set({ count: v });
          }}
        />

        <AmountField
          label={t("calc.cash.installment")}
          width="medium"
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      </div>

      <ChoiceField
        label={t("calc.cash.first")}
        choices={[
          { value: "later", label: t("calc.cash.first.later") },
          { value: "now", label: t("calc.cash.first.now") },
        ]}
        value={firstNow ? "now" : "later"}
        onChange={(next) => {
          set({ first: next === "now" ? "now" : undefined });
        }}
      />

      <RateSourceFields
        label={t("calc.cash.compare")}
        hint={t("calc.cash.compare.hint")}
        help={`${t("calc.cash.implied.help")} ${t("calc.cash.present.help")}`}
        sourceLabel={t("calc.cash.rateSource")}
        source={compare}
        set={set}
      />
    </>
  );
}
